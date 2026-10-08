import { MIN_IMAGE_MODEL } from '../src/utils/modelDefaults.js'

const DALLE3_MAX_PROMPT = 4000
const LEGACY_DALLE_MODELS = new Set(['dall-e-2', 'dall-e-3'])
const GPT_IMAGE_SIZE_ALIASES = {
  '1792x1024': '1536x1024',
  '1024x1792': '1024x1536',
}

function normalizeOpenAiImageModel(model) {
  const trimmed = String(model ?? '').trim()
  if (!trimmed || LEGACY_DALLE_MODELS.has(trimmed)) {
    return MIN_IMAGE_MODEL
  }
  return trimmed
}

function isGptImageModel(model) {
  return model.startsWith('gpt-image') || model === 'chatgpt-image-latest'
}

function parseOpenAiError(payload) {
  try {
    const data = JSON.parse(payload)
    const message = data.error?.message ?? data.message
    if (message) {
      return message
    }
  } catch {
    // plain text error
  }
  return payload || 'OpenAI image generation failed'
}

export function prepareDallePrompt(prompt, maxLength = DALLE3_MAX_PROMPT) {
  const text = String(prompt ?? '').trim()
  if (text.length <= maxLength) {
    return text
  }
  const styleMarker = 'Cinematic historical realism'
  const styleIndex = text.indexOf(styleMarker)
  if (styleIndex >= 0) {
    const afterStyle = text.indexOf('.', styleIndex + styleMarker.length)
    const sceneStart = afterStyle >= 0 ? afterStyle + 1 : styleIndex + 200
    const scene = text.slice(sceneStart).trim()
    const shortStyle = `${styleMarker}, 9th–11th century Europe, photorealistic, cinematic 16:9, no horned helmets.`
    const combined = `${shortStyle} ${scene}`.trim()
    if (combined.length <= maxLength) {
      return combined
    }
    return combined.slice(0, maxLength - 1).trim()
  }
  return text.slice(0, maxLength - 1).trim()
}

export async function generateWithProvider(provider, config, prompt, { width = 1920, height = 1080 } = {}) {
  switch (provider) {
    case 'openaiImage':
      return generateOpenAiImage(config, prompt, width, height)
    case 'geminiImage':
      return generateGeminiImage(config, prompt)
    default:
      throw new Error(`Unknown image provider: ${provider}`)
  }
}

function pickOpenAiSize(width, height, configSize, model) {
  const gptImage = isGptImageModel(model)
  const rawSize = configSize?.trim()
  if (rawSize) {
    if (gptImage) {
      return GPT_IMAGE_SIZE_ALIASES[rawSize] ?? rawSize
    }
    return rawSize
  }
  const ratio = width / height
  if (gptImage) {
    if (ratio >= 1.5) {
      return '1536x1024'
    }
    if (ratio <= 0.75) {
      return '1024x1536'
    }
    return '1024x1024'
  }
  if (ratio >= 1.5) {
    return '1792x1024'
  }
  if (ratio <= 0.75) {
    return '1024x1792'
  }
  return '1024x1024'
}

function pickOpenAiQuality(configQuality, model) {
  const quality = String(configQuality ?? '').trim().toLowerCase()
  if (isGptImageModel(model)) {
    if (quality === 'hd' || quality === 'high') {
      return 'high'
    }
    if (quality === 'low') {
      return 'low'
    }
    if (quality === 'medium') {
      return 'medium'
    }
    return 'medium'
  }
  return quality === 'hd' ? 'hd' : 'standard'
}

async function generateOpenAiImage(config, prompt, width, height) {
  const apiKey = config.apiKey?.trim()
  if (!apiKey) {
    throw new Error('OpenAI API key is required for image generation')
  }
  if (!apiKey.startsWith('sk-')) {
    throw new Error('OpenAI key should start with sk- (same key as ChatGPT API / platform.openai.com)')
  }

  const model = normalizeOpenAiImageModel(config.model)
  const safePrompt = prepareDallePrompt(prompt)
  const baseUrl = (config.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')
  const size = pickOpenAiSize(width, height, config.size, model)

  const body = {
    model,
    prompt: safePrompt,
    n: 1,
    size,
  }

  if (isGptImageModel(model)) {
    body.quality = pickOpenAiQuality(config.quality, model)
  } else if (model === 'dall-e-3') {
    body.quality = pickOpenAiQuality(config.quality, model)
  } else {
    body.response_format = 'b64_json'
  }

  const response = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const payload = await response.text()
  if (!response.ok) {
    const message = parseOpenAiError(payload)
    if (response.status === 401) {
      throw new Error(`Invalid API key — use the same sk-… key from platform.openai.com (not ChatGPT Plus login). ${message}`)
    }
    if (response.status === 429) {
      throw new Error(`Rate limit or billing — add payment method at platform.openai.com. ${message}`)
    }
    if (/content_policy|safety|moderation/i.test(message)) {
      throw new Error(`Content blocked by OpenAI safety filter — try a softer scene prompt. ${message}`)
    }
    throw new Error(message)
  }

  const data = JSON.parse(payload)
  const item = data.data?.[0]
  const b64 = item?.b64_json
  if (b64) {
    return { buffer: Buffer.from(b64, 'base64'), contentType: 'image/png' }
  }

  const imageUrl = item?.url
  if (imageUrl) {
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      throw new Error('OpenAI returned an image URL but download failed')
    }
    const buffer = Buffer.from(await imageResponse.arrayBuffer())
    const contentType = imageResponse.headers.get('content-type') ?? 'image/png'
    return { buffer, contentType }
  }

  throw new Error('OpenAI returned no image data')
}

async function generateGeminiImage(config, prompt) {
  const apiKey = config.apiKey?.trim()
  if (!apiKey) {
    throw new Error('Gemini API key is required for image generation')
  }
  const model = config.model || 'gemini-2.0-flash-preview-image-generation'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prepareDallePrompt(prompt, 8000) }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    }),
  })
  const payload = await response.text()
  if (!response.ok) {
    throw new Error(parseOpenAiError(payload) || 'Gemini image generation failed')
  }
  const data = JSON.parse(payload)
  const parts = data.candidates?.[0]?.content?.parts ?? []
  for (const part of parts) {
    const inline = part.inlineData ?? part.inline_data
    if (inline?.data) {
      const mime = inline.mimeType ?? inline.mime_type ?? 'image/png'
      return { buffer: Buffer.from(inline.data, 'base64'), contentType: mime }
    }
  }
  throw new Error('Gemini returned no image data')
}

export async function testImageProvider(provider, config) {
  const result = await generateWithProvider(provider, config, 'A simple red circle on white background, minimal test image, no text, no people')
  if (!result.buffer?.length) {
    throw new Error('No image returned')
  }
  return `OK (${Math.round(result.buffer.length / 1024)} KB)`
}
