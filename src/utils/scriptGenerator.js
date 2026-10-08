import { DEFAULT_DURATION, PRESETS } from '../constants'
import { getActiveAiConfig, getMaxImages, getTargetDurationSeconds } from './agentSettings'
import { shouldUseAiNarration } from './modelDefaults'
import { chatCompletion } from './aiAgent'
import { throwIfStopped, isAgentStop } from './agentStop'

const LANGUAGE_LABELS = {
  ar: 'Arabic',
  en: 'English',
  fr: 'French',
}

export function calculateShotCount(settings) {
  const preset = PRESETS.find((item) => item.id === settings.stylePresetId)
  const perShot = preset?.duration ?? DEFAULT_DURATION
  const targetSeconds = getTargetDurationSeconds(settings)
  let count = Math.max(1, Math.ceil(targetSeconds / perShot))
  if (settings.maxShots > 0) {
    count = Math.min(count, settings.maxShots)
  }
  const cap = settings.scriptMaxShots ?? 60
  count = Math.min(count, cap)
  const maxImages = getMaxImages(settings)
  if (maxImages > 0) {
    count = Math.min(count, maxImages)
  }
  return count
}

function extractJsonBlock(text) {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const objectMatch = cleaned.match(/\{[\s\S]*\}/)
  if (objectMatch) {
    return JSON.parse(objectMatch[0])
  }
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/)
  if (arrayMatch) {
    return { shots: JSON.parse(arrayMatch[0]) }
  }
  throw new Error('Could not parse script JSON from AI response')
}

function normalizeShots(rawShots, startNumber) {
  if (!Array.isArray(rawShots)) {
    throw new Error('Script response missing shots array')
  }
  return rawShots.map((item, index) => ({
    shot: Number(item.shot ?? startNumber + index),
    voice: String(item.voice ?? item.narration ?? '').trim(),
    imagePrompt: String(item.imagePrompt ?? item.prompt ?? item.visual ?? '').trim(),
  })).filter((item) => item.voice || item.imagePrompt)
}

async function generateScriptBatch(settings, {
  brief,
  language,
  platformLabel,
  shotCount,
  startShot,
  endShot,
  previousShots,
  stylePresetId,
  signal,
}) {
  const preset = PRESETS.find((item) => item.id === stylePresetId)
  const languageLabel = LANGUAGE_LABELS[language] ?? language
  const context = previousShots.length > 0
    ? `\nPrevious shots for continuity (do not repeat):\n${previousShots.slice(-3).map((s) => `#${s.shot}: ${s.voice.slice(0, 80)}`).join('\n')}`
    : ''

  const prompt = `You are a documentary video scriptwriter. Create shots ${startShot} through ${endShot} of a ${platformLabel} video (${shotCount} shots total).

Topic/brief:
${brief}

Language for narration (voice field): ${languageLabel}
Style: ${preset?.label ?? 'documentary'}, ~${preset?.duration ?? 5}s per shot
${context}

Return ONLY valid JSON (no markdown) in this exact shape:
{
  "title": "short video title",
  "shots": [
    { "shot": ${startShot}, "voice": "narration text for TTS", "imagePrompt": "detailed English image prompt, cinematic, 16:9, photorealistic, no text, no watermark" }
  ]
}

Rules:
- voice: 1-2 sentences per shot, natural spoken narration in ${languageLabel}
- imagePrompt: English, visual description matching the voice, documentary/cinematic style
- Generate exactly ${endShot - startShot + 1} shots numbered ${startShot} to ${endShot}
- Keep narrative flowing from previous shots`

  const content = await chatCompletion(settings, [{ role: 'user', content: prompt }], signal)
  const parsed = extractJsonBlock(content)
  const shots = normalizeShots(parsed.shots, startShot)
  return {
    title: parsed.title ?? '',
    shots,
  }
}

export async function generateVideoScript(settings, options = {}) {
  const {
    brief,
    language = settings.scriptLanguage ?? 'ar',
    platformLabel,
    onProgress,
    signal,
  } = options

  if (!brief?.trim()) {
    throw new Error('Video topic/brief is required for script generation')
  }

  const shotCount = calculateShotCount(settings)
  const batchSize = settings.scriptBatchSize ?? 10
  const allShots = []
  let title = ''

  for (let start = 1; start <= shotCount; start += batchSize) {
    throwIfStopped(signal)
    const end = Math.min(start + batchSize - 1, shotCount)
    const batch = await generateScriptBatch(settings, {
      brief,
      language,
      platformLabel,
      shotCount,
      startShot: start,
      endShot: end,
      previousShots: allShots,
      stylePresetId: settings.stylePresetId,
      signal,
    })
    if (batch.title && !title) {
      title = batch.title
    }
    allShots.push(...batch.shots)
    onProgress?.(allShots.length / shotCount, { batch: batch.shots.length, total: allShots.length })
  }

  if (allShots.length === 0) {
    throw new Error('AI returned an empty script')
  }

  return { title, shots: allShots, shotCount: allShots.length }
}

const SCENE_MARKER = 'between consecutive scenes.'

/** Derive a speakable line from an image prompt when no AI narration is available. */
export function narrationFallbackFromPrompt(imagePrompt) {
  const text = String(imagePrompt ?? '').trim()
  if (!text) {
    return ''
  }
  const markerIndex = text.lastIndexOf(SCENE_MARKER)
  if (markerIndex >= 0) {
    const scene = text.slice(markerIndex + SCENE_MARKER.length).trim()
    if (scene) {
      return scene
    }
  }
  const parts = text.split(/(?<=\.)\s+/).filter((part) => part.length > 20)
  return parts[parts.length - 1]?.trim() || text.slice(0, 220)
}

function mergeNarrationOntoShots(shots, narrations) {
  const byNumber = new Map(
    narrations.map((item) => [Number(item.shot ?? item.shotNumber), String(item.voice ?? '').trim()]),
  )
  return shots.map((shot, index) => {
    if (shot.voice?.trim()) {
      return shot
    }
    const shotNumber = shot.shotNumber ?? index + 1
    const voice = byNumber.get(shotNumber) ?? narrationFallbackFromPrompt(shot.imagePrompt)
    return voice ? { ...shot, voice } : shot
  })
}

async function generateNarrationBatch(settings, {
  brief,
  language,
  batch,
  previousVoice,
  signal,
}) {
  const languageLabel = LANGUAGE_LABELS[language] ?? language
  const context = previousVoice
    ? `\nPrevious narration for continuity:\n"${previousVoice.slice(0, 120)}"`
    : ''
  const shotLines = batch.map((shot, index) => {
    const num = shot.shotNumber ?? index + 1
    const visual = narrationFallbackFromPrompt(shot.imagePrompt) || shot.imagePrompt.slice(0, 200)
    return `#${num}: ${visual}`
  }).join('\n')

  const prompt = `You are a documentary narrator. Write spoken narration for each shot below.

Topic/brief:
${brief || 'Historical documentary'}

Language: ${languageLabel}
${context}

Shots (visual descriptions):
${shotLines}

Return ONLY valid JSON (no markdown):
{
  "shots": [
    { "shot": 1, "voice": "1-2 sentences of natural spoken narration in ${languageLabel}" }
  ]
}

Rules:
- One voice line per shot, matching the shot numbers above
- Natural documentary pacing, 1-2 sentences each
- Do not describe camera angles — tell the story`

  const content = await chatCompletion(settings, [{ role: 'user', content: prompt }], signal)
  const parsed = extractJsonBlock(content)
  if (!Array.isArray(parsed.shots)) {
    throw new Error('Narration response missing shots array')
  }
  return parsed.shots.map((item, index) => ({
    shot: Number(item.shot ?? batch[index]?.shotNumber ?? index + 1),
    voice: String(item.voice ?? item.narration ?? '').trim(),
  }))
}

/** Fill empty voice fields on existing shots (imported projects). */
export async function generateNarrationForShots(shots, settings, options = {}) {
  const {
    brief = settings.projectBrief ?? '',
    language = settings.scriptLanguage ?? 'en',
    onProgress,
    signal,
  } = options

  const needsVoice = shots.filter((shot) => !shot.voice?.trim() && shot.imagePrompt?.trim())
  if (needsVoice.length === 0) {
    return shots
  }

  function fallbackNarrations() {
    return needsVoice.map((shot, index) => ({
      shot: shot.shotNumber ?? index + 1,
      voice: narrationFallbackFromPrompt(shot.imagePrompt),
    }))
  }

  const { config: aiConfig } = getActiveAiConfig(settings ?? {})
  if (!shouldUseAiNarration(settings) || !aiConfig.apiKey?.trim()) {
    onProgress?.(1)
    return mergeNarrationOntoShots(shots, fallbackNarrations())
  }

  const batchSize = settings?.scriptBatchSize ?? 10
  const allNarrations = []
  let previousVoice = ''

  try {
    for (let start = 0; start < needsVoice.length; start += batchSize) {
      throwIfStopped(signal)
      const batch = needsVoice.slice(start, start + batchSize)
      const narrations = await generateNarrationBatch(settings, {
        brief,
        language,
        batch,
        previousVoice,
        signal,
      })
      allNarrations.push(...narrations)
      previousVoice = narrations[narrations.length - 1]?.voice ?? previousVoice
      onProgress?.(Math.min(1, (start + batch.length) / needsVoice.length))
    }
    return mergeNarrationOntoShots(shots, allNarrations)
  } catch (error) {
    if (isAgentStop(error)) {
      throw error
    }
    onProgress?.(1)
    return mergeNarrationOntoShots(shots, fallbackNarrations())
  }
}
