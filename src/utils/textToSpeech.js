import { getAudioDuration } from './audioMixer'
import { abortableDelay, throwIfStopped } from './agentStop'
import { DEFAULT_EDGE_TTS_VOICE, MOROCCAN_EDGE_VOICES } from './ttsDefaults'

export const OPENAI_TTS_VOICES = [
  { id: 'marin', label: 'Marin (recommended)' },
  { id: 'cedar', label: 'Cedar (recommended)' },
  { id: 'coral', label: 'Coral' },
  { id: 'alloy', label: 'Alloy' },
  { id: 'ash', label: 'Ash' },
  { id: 'ballad', label: 'Ballad' },
  { id: 'echo', label: 'Echo' },
  { id: 'fable', label: 'Fable' },
  { id: 'nova', label: 'Nova' },
  { id: 'onyx', label: 'Onyx' },
  { id: 'sage', label: 'Sage' },
  { id: 'shimmer', label: 'Shimmer' },
  { id: 'verse', label: 'Verse' },
]

export const TTS_VOICES = [
  ...MOROCCAN_EDGE_VOICES,
  { id: 'ar-SA-HamedNeural', label: 'Arabic (Saudi) — Hamed' },
  { id: 'ar-SA-ZariyahNeural', label: 'Arabic (Saudi) — Zariyah' },
  { id: 'ar-EG-SalmaNeural', label: 'Arabic (Egypt) — Salma' },
  { id: 'ar-EG-ShakirNeural', label: 'Arabic (Egypt) — Shakir' },
  { id: 'ar-AE-FatimaNeural', label: 'Arabic (UAE) — Fatima' },
  { id: 'en-US-JennyNeural', label: 'English (US) — Jenny' },
  { id: 'en-GB-SoniaNeural', label: 'English (UK) — Sonia' },
  { id: 'fr-FR-DeniseNeural', label: 'French — Denise' },
  { id: 'es-ES-ElviraNeural', label: 'Spanish (Spain) — Elvira' },
  { id: 'es-MX-DaliaNeural', label: 'Spanish (Mexico) — Dalia' },
]

export const TTS_RATES = [
  { id: '-10%', label: 'Slower' },
  { id: '+0%', label: 'Normal' },
  { id: '+10%', label: 'Faster' },
]

export const TTS_DELIVERIES = [
  { id: 'human', label: 'Human — breaths, pitch, pace' },
  { id: 'flat', label: 'Flat — one steady voice' },
]

export async function synthesizeText(text, options = {}) {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: options.signal,
    body: JSON.stringify({
      text,
      provider: options.provider ?? 'edge',
      config: {
        ...(options.config ?? {}),
        voice: options.config?.voice ?? options.voice ?? DEFAULT_EDGE_TTS_VOICE,
        rate: options.config?.rate ?? options.rate ?? '+0%',
        delivery: options.delivery ?? options.config?.delivery ?? 'human',
      },
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => 'TTS request failed')
    if (detail.includes('<!DOCTYPE') || detail.includes('<html')) {
      throw new Error('TTS API unavailable — run the app with npm run dev (not static dist/index.html).')
    }
    throw new Error(detail || 'TTS request failed')
  }

  const blob = await response.blob()
  const src = URL.createObjectURL(blob)
  const duration = await getAudioDuration(src).catch(() => 0)
  return { src, duration, blob }
}

export function previewSpeech(text, lang = 'ar-SA') {
  if (!('speechSynthesis' in window)) {
    throw new Error('Speech preview is not supported in this browser.')
  }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang
  utterance.rate = 0.95
  window.speechSynthesis.speak(utterance)
}

export async function generateTTSForShots(shots, options = {}) {
  const {
    provider = 'edge',
    config = {},
    voice = DEFAULT_EDGE_TTS_VOICE,
    rate = '+0%',
    delivery = 'human',
    matchDuration = true,
    onProgress,
    delayMs = 250,
    signal,
  } = options

  const ttsConfig = {
    ...config,
    voice: config.voice ?? voice,
    rate: config.rate ?? rate,
    delivery: delivery ?? config.delivery ?? 'human',
  }

  const updated = [...shots]
  const targets = updated
    .map((shot, index) => ({ shot, index }))
    .filter(({ shot }) => shot.voice?.trim())

  for (let step = 0; step < targets.length; step += 1) {
    throwIfStopped(signal)
    const { shot, index } = targets[step]
    if (shot.audioSrc?.startsWith('blob:')) {
      URL.revokeObjectURL(shot.audioSrc)
    }

    const result = await synthesizeText(shot.voice, { provider, config: ttsConfig, voice, rate, delivery, signal })
    updated[index] = {
      ...shot,
      audioSrc: result.src,
      audioName: `TTS ${shot.name}`,
      duration: matchDuration
        ? Math.max(0.5, Math.round((result.duration + 0.25) * 10) / 10)
        : shot.duration,
    }

    onProgress?.((step + 1) / targets.length, updated[index])
    if (delayMs > 0 && step < targets.length - 1) {
      await abortableDelay(delayMs, signal)
    }
  }

  return updated
}
