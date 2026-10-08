import { AI_PROVIDERS, IMAGE_PROVIDERS, TTS_PROVIDERS } from '../providers'
import { testImageProvider } from './imageGenerator'
import { getActiveAiConfig } from './agentSettings'

export async function chatCompletion(settings, messages, signal) {
  const { provider, config } = getActiveAiConfig(settings)
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, config, messages }),
    signal,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => 'AI request failed')
    throw new Error(detail || 'AI request failed')
  }

  const data = await response.json()
  return data.content ?? ''
}

export async function testAiProvider(settings, providerId) {
  const config = settings.providerKeys[providerId] ?? {}
  const response = await fetch('/api/ai/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: providerId, config }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || 'Test failed')
  }
  return payload.message || 'OK'
}

export async function testTtsProvider(settings, providerId) {
  const config = settings.providerKeys[providerId] ?? {}
  const response = await fetch('/api/tts/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: providerId, config }),
  })
  const raw = await response.text().catch(() => '')
  let payload = {}
  try {
    payload = raw ? JSON.parse(raw) : {}
  } catch {
    if (raw.includes('<!DOCTYPE') || raw.includes('<html')) {
      throw new Error('TTS API unavailable — run the app with npm run dev (not dist/index.html).')
    }
    throw new Error(raw.trim() || 'Test failed')
  }
  if (!response.ok) {
    throw new Error(payload.error || raw || 'Test failed')
  }
  return payload.message || 'OK'
}

export async function testAllProviders(settings) {
  const results = []

  for (const provider of AI_PROVIDERS) {
    const config = settings.providerKeys[provider.id] ?? {}
    if (!config.apiKey?.trim()) {
      results.push({ kind: 'ai', id: provider.id, label: provider.label, status: 'skip', message: 'No API key' })
      continue
    }
    try {
      const message = await testAiProvider(settings, provider.id)
      results.push({ kind: 'ai', id: provider.id, label: provider.label, status: 'ok', message })
    } catch (error) {
      results.push({
        kind: 'ai',
        id: provider.id,
        label: provider.label,
        status: 'err',
        message: error instanceof Error ? error.message : 'Failed',
      })
    }
  }

  for (const provider of TTS_PROVIDERS) {
    const config = settings.providerKeys[provider.id] ?? {}
    if (!provider.noKey && !config.apiKey?.trim()) {
      results.push({ kind: 'tts', id: provider.id, label: provider.label, status: 'skip', message: 'No API key' })
      continue
    }
    try {
      const message = await testTtsProvider(settings, provider.id)
      results.push({ kind: 'tts', id: provider.id, label: provider.label, status: 'ok', message })
    } catch (error) {
      results.push({
        kind: 'tts',
        id: provider.id,
        label: provider.label,
        status: 'err',
        message: error instanceof Error ? error.message : 'Failed',
      })
    }
  }

  for (const provider of IMAGE_PROVIDERS) {
    const config = settings.providerKeys[provider.id] ?? {}
    if (!config.apiKey?.trim()) {
      results.push({ kind: 'image', id: provider.id, label: provider.label, status: 'skip', message: 'No API key' })
      continue
    }
    try {
      const message = await testImageProvider(settings, provider.id)
      results.push({ kind: 'image', id: provider.id, label: provider.label, status: 'ok', message })
    } catch (error) {
      results.push({
        kind: 'image',
        id: provider.id,
        label: provider.label,
        status: 'err',
        message: error instanceof Error ? error.message : 'Failed',
      })
    }
  }

  return results
}

export async function planVideoWithAi(settings, { shotCount, targetSeconds, platformLabel }) {
  const { config } = getActiveAiConfig(settings)
  if (!config.apiKey?.trim()) {
    throw new Error('API key required for AI planning.')
  }

  const prompt = `You are a video production assistant. The user is building a ${platformLabel} video from ${shotCount} image shots. Target total duration: ${Math.round(targetSeconds)} seconds.

Reply in 3-5 short bullet points covering:
- recommended seconds per shot
- pacing tips for this format
- whether ${targetSeconds}s is realistic for ${shotCount} shots
Keep it concise, plain text, no markdown headers.`

  return chatCompletion(settings, [{ role: 'user', content: prompt }])
}
