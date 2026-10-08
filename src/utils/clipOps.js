import { getShotStarts } from './timeline'

const MIN_CLIP_DURATION = 0.5

function roundSeconds(value) {
  return Math.max(MIN_CLIP_DURATION, Math.round(value * 10) / 10)
}

function splitVoiceText(text, ratio) {
  if (!text?.trim()) {
    return ['', '']
  }
  const words = text.trim().split(/\s+/)
  if (words.length <= 1) {
    return ratio < 0.5 ? [text, ''] : ['', text]
  }
  const splitAt = Math.max(1, Math.min(words.length - 1, Math.round(words.length * ratio)))
  return [words.slice(0, splitAt).join(' '), words.slice(splitAt).join(' ')]
}

function cloneShotPart(shot, overrides) {
  return {
    ...shot,
    ...overrides,
    audioSrc: null,
    audioName: '',
  }
}

export function splitShotsAtTime(shots, time) {
  const segments = getShotStarts(shots)
  const segment = segments.find(({ start, end }) => time > start + 0.25 && time < end - 0.25)
  if (!segment) {
    return { shots, selectedId: null, error: 'Move playhead inside a clip to split.' }
  }

  const localTime = time - segment.start
  const firstDuration = roundSeconds(localTime)
  const secondDuration = roundSeconds(segment.shot.duration - localTime)
  const ratio = localTime / segment.shot.duration
  const [voiceA, voiceB] = splitVoiceText(segment.shot.voice, ratio)

  if (segment.shot.audioSrc?.startsWith('blob:')) {
    URL.revokeObjectURL(segment.shot.audioSrc)
  }

  const first = cloneShotPart(segment.shot, {
    duration: firstDuration,
    voice: voiceA,
    name: `${segment.shot.name}a`,
  })

  const second = cloneShotPart(segment.shot, {
    id: crypto.randomUUID(),
    duration: secondDuration,
    voice: voiceB,
    name: `${segment.shot.name}b`,
  })

  const next = [...shots]
  next.splice(segment.index, 1, first, second)

  return {
    shots: next,
    selectedId: second.id,
    seekTime: segment.start + firstDuration,
    error: null,
  }
}

export function setShotDuration(shots, shotId, seconds) {
  const duration = roundSeconds(seconds)
  return shots.map((shot) => (shot.id === shotId ? { ...shot, duration } : shot))
}

export function duplicateShot(shots, shotId) {
  const index = shots.findIndex((shot) => shot.id === shotId)
  if (index === -1) {
    return shots
  }
  const source = shots[index]
  const copy = cloneShotPart(source, {
    id: crypto.randomUUID(),
    name: `${source.name} copy`,
  })
  const next = [...shots]
  next.splice(index + 1, 0, copy)
  return next
}
