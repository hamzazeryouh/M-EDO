import { getActiveImageConfig, getMaxImages } from './agentSettings'
import { abortableDelay, isAgentStop, throwIfStopped } from './agentStop'
import { shotNeedsImageGeneration } from './shotImages'

export async function generateImage(prompt, settings, { width = 1920, height = 1080, signal } = {}) {
  const { provider, config } = getActiveImageConfig(settings)
  const response = await fetch('/api/image/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, config, prompt, width, height }),
    signal,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => 'Image generation failed')
    if (detail.includes('<!DOCTYPE') || detail.includes('<html')) {
      throw new Error('Image API unavailable — run the app with npm run dev (not static build).')
    }
    throw new Error(detail || 'Image generation failed')
  }

  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

export async function generateImagesForShots(shots, settings, options = {}) {
  const {
    width = 1920,
    height = 1080,
    onProgress,
    delayMs = 1200,
    skipExisting = true,
    signal,
  } = options

  const updated = [...shots]
  let targets = updated
    .map((shot, index) => ({ shot, index }))
    .filter(({ shot }) => !skipExisting || shotNeedsImageGeneration(shot))
  const maxImages = Number(options.maxImages ?? getMaxImages(settings))
  if (maxImages > 0) {
    targets = targets.slice(0, maxImages)
  }

  for (let step = 0; step < targets.length; step += 1) {
    throwIfStopped(signal)
    const { shot, index } = targets[step]
    if (shot.src?.startsWith('blob:')) {
      URL.revokeObjectURL(shot.src)
    }

    try {
      const src = await generateImage(shot.imagePrompt, settings, { width, height, signal })
      updated[index] = {
        ...shot,
        src,
        missingImage: false,
        file: null,
      }
      onProgress?.((step + 1) / targets.length, {
        shot: updated[index],
        shots: updated,
        done: step + 1,
        total: targets.length,
      })
    } catch (error) {
      if (isAgentStop(error)) {
        throw error
      }
      const message = error instanceof Error ? error.message : 'Image generation failed'
      throw new Error(`${shot.name}: ${message}`)
    }
    if (delayMs > 0 && step < targets.length - 1) {
      await abortableDelay(delayMs, signal)
    }
  }

  return updated
}

export async function testImageProvider(settings, providerId) {
  const config = settings.providerKeys[providerId] ?? {}
  const response = await fetch('/api/image/test', {
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
