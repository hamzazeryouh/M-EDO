import { Communicate } from 'edge-tts-universal'
import { joinSpeechParts, prosodyForPart, splitForSpeech } from './humanSpeech.js'

const OPENAI_TTS_INSTRUCTIONS = {
  human: 'Speak in Arabic with a natural Moroccan accent. Warm documentary narration with clear pacing, varied intonation, and subtle emotional range.',
  flat: 'Speak in Arabic with a Moroccan accent in a steady, clear documentary tone.',
}

const OPENAI_TTS_VOICES = new Set([
  'alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx',
  'sage', 'shimmer', 'verse', 'marin', 'cedar',
])

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
  return payload || 'OpenAI TTS failed'
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function synthesizeWithProvider(provider, config, text) {
  switch (provider) {
    case 'openaiTts':
      return synthesizeOpenAi(config, text)
    case 'edge':
      return synthesizeEdge(config, text)
    case 'elevenlabs':
      return synthesizeElevenLabs(config, text)
    case 'azureTts':
      return synthesizeAzure(config, text)
    case 'googleTts':
      return synthesizeGoogle(config, text)
    default:
      throw new Error(`Unknown TTS provider: ${provider}`)
  }
}

async function synthesizeOpenAi(config, text) {
  const apiKey = config.apiKey?.trim()
  if (!apiKey) {
    throw new Error('OpenAI API key is required for TTS')
  }
  if (!apiKey.startsWith('sk-')) {
    throw new Error('OpenAI key should start with sk- (same key as ChatGPT API / platform.openai.com)')
  }

  const model = config.model?.trim() || 'gpt-4o-mini-tts'
  const voiceRaw = (config.voice?.trim() || 'marin').toLowerCase()
  if (!OPENAI_TTS_VOICES.has(voiceRaw)) {
    throw new Error(`Unknown OpenAI voice "${config.voice}". Use: marin, cedar, coral, alloy, onyx, etc.`)
  }
  const voice = voiceRaw
  const baseUrl = (config.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')
  const responseFormat = config.responseFormat?.trim() || 'mp3'
  const input = text.trim()
  if (!input) {
    throw new Error('Text is required')
  }

  const body = {
    model,
    voice,
    input,
  }
  if (responseFormat && responseFormat !== 'mp3') {
    body.response_format = responseFormat
  }

  const customInstructions = config.instructions?.trim()
  const delivery = config.delivery === 'flat' ? 'flat' : 'human'
  const instructions = customInstructions || OPENAI_TTS_INSTRUCTIONS[delivery]
  if (instructions && model.includes('gpt-4o-mini-tts')) {
    body.instructions = instructions
  } else if (instructions && (model === 'tts-1' || model === 'tts-1-hd')) {
    // Legacy models ignore instructions — narration style comes from input text only.
  }

  const response = await fetch(`${baseUrl}/audio/speech`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    const message = parseOpenAiError(detail)
    if (response.status === 401) {
      throw new Error(`Invalid OpenAI API key. ${message}`)
    }
    if (response.status === 429) {
      throw new Error(`OpenAI rate limit or billing issue. ${message}`)
    }
    throw new Error(message)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  if (!buffer.length) {
    throw new Error('OpenAI TTS returned no audio')
  }

  const contentTypes = {
    mp3: 'audio/mpeg',
    opus: 'audio/opus',
    aac: 'audio/aac',
    flac: 'audio/flac',
    wav: 'audio/wav',
    pcm: 'audio/pcm',
  }
  return { buffer, contentType: contentTypes[responseFormat] ?? 'audio/mpeg' }
}

async function synthesizeEdgeOnce(text, options) {
  const communicate = new Communicate(text.trim(), options)
  const chunks = []
  for await (const chunk of communicate.stream()) {
    if (chunk.type === 'audio' && chunk.data) {
      chunks.push(Buffer.from(chunk.data))
    }
  }
  if (chunks.length === 0) {
    throw new Error('Edge TTS returned no audio')
  }
  return Buffer.concat(chunks)
}

async function synthesizeEdge(config, text) {
  const voice = config.voice || 'ar-SA-HamedNeural'
  const rate = config.rate || '+0%'
  const human = config.delivery !== 'flat'
  const parts = human ? splitForSpeech(text) : [{ text: text.trim(), pauseMs: 0 }]

  if (!human || parts.length <= 1) {
    const prosody = human ? prosodyForPart(0, rate) : { rate, pitch: '+0Hz', volume: '+0%' }
    const buffer = await synthesizeEdgeOnce(parts[0]?.text || text, { voice, ...prosody })
    return { buffer, contentType: 'audio/mpeg' }
  }

  const buffers = []
  for (let index = 0; index < parts.length; index += 1) {
    const prosody = prosodyForPart(index, rate)
    buffers.push(await synthesizeEdgeOnce(parts[index].text, { voice, ...prosody }))
  }

  const buffer = await joinSpeechParts(buffers, parts.map((part) => part.pauseMs))
  return { buffer, contentType: 'audio/mpeg' }
}

async function synthesizeElevenLabs(config, text) {
  const apiKey = config.apiKey?.trim()
  const voiceId = config.voiceId?.trim()
  if (!apiKey || !voiceId) {
    throw new Error('ElevenLabs API key and voice ID are required')
  }
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: text.trim(),
      model_id: config.modelId || 'eleven_multilingual_v2',
      voice_settings: config.delivery === 'flat'
        ? { stability: 0.7, similarity_boost: 0.75, style: 0, use_speaker_boost: false }
        : { stability: 0.32, similarity_boost: 0.82, style: 0.42, use_speaker_boost: true },
    }),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => 'ElevenLabs TTS failed')
    throw new Error(detail || 'ElevenLabs TTS failed')
  }
  const arrayBuffer = await response.arrayBuffer()
  return { buffer: Buffer.from(arrayBuffer), contentType: 'audio/mpeg' }
}

function spokenSsml(text, human) {
  const parts = human ? splitForSpeech(text) : [{ text: text.trim(), pauseMs: 0 }]
  return parts.map((part, index) => {
    const body = escapeXml(part.text)
    const pause = human && index < parts.length - 1 && part.pauseMs
      ? `<break time="${part.pauseMs}ms"/>`
      : ''
    return `${body}${pause}`
  }).join(' ')
}

async function synthesizeAzure(config, text) {
  const apiKey = config.apiKey?.trim()
  const region = config.region?.trim()
  const voice = config.voice?.trim() || 'ar-SA-HamedNeural'
  if (!apiKey || !region) {
    throw new Error('Azure Speech API key and region are required')
  }
  const human = config.delivery !== 'flat'
  const inner = human
    ? `<prosody rate="-6%" pitch="-2Hz">${spokenSsml(text, true)}</prosody>`
    : spokenSsml(text, false)
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ar-SA"><voice name="${escapeXml(voice)}">${inner}</voice></speak>`
  const response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
    },
    body: ssml,
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => 'Azure TTS failed')
    throw new Error(detail || 'Azure TTS failed')
  }
  const arrayBuffer = await response.arrayBuffer()
  return { buffer: Buffer.from(arrayBuffer), contentType: 'audio/mpeg' }
}

async function synthesizeGoogle(config, text) {
  const apiKey = config.apiKey?.trim()
  if (!apiKey) {
    throw new Error('Google TTS API key is required')
  }
  const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: config.delivery === 'flat'
        ? { text: text.trim() }
        : { ssml: `<speak>${spokenSsml(text, true)}</speak>` },
      voice: {
        languageCode: config.languageCode || 'ar-XA',
        name: config.voice || 'ar-XA-Standard-A',
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: config.delivery === 'flat' ? 1 : 0.94,
        pitch: config.delivery === 'flat' ? 0 : -1,
      },
    }),
  })
  const payload = await response.text()
  if (!response.ok) {
    throw new Error(payload || 'Google TTS failed')
  }
  const data = JSON.parse(payload)
  if (!data.audioContent) {
    throw new Error('Google TTS returned no audio')
  }
  return { buffer: Buffer.from(data.audioContent, 'base64'), contentType: 'audio/mpeg' }
}

export async function testTtsProvider(provider, config) {
  const sample = provider === 'openaiTts'
    ? (config.testPhrase?.trim() || 'مرحباً، هذا اختبار للتعليق الصوتي الوثائقي بلهجة مغربية.')
    : provider === 'edge'
      ? 'مرحباً، هذا اختبار صوتي بلهجة مغربية.'
      : 'Hello, this is a voice test.'
  const result = await synthesizeWithProvider(provider, config, sample)
  if (!result.buffer?.length) {
    throw new Error('No audio returned')
  }
  return `OK (${Math.round(result.buffer.length / 1024)} KB)`
}
