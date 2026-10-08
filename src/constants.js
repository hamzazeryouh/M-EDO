
export const ANIMATIONS = [
  { id: 'static', label: 'Static', description: 'No movement' },
  { id: 'kenBurnsIn', label: 'Ken Burns In', description: 'Slow zoom in with pan' },
  { id: 'kenBurnsOut', label: 'Ken Burns Out', description: 'Slow zoom out with pan' },
  { id: 'zoomIn', label: 'Zoom In', description: 'Center zoom in' },
  { id: 'zoomOut', label: 'Zoom Out', description: 'Center zoom out' },
  { id: 'panLeft', label: 'Pan Left', description: 'Move camera left' },
  { id: 'panRight', label: 'Pan Right', description: 'Move camera right' },
  { id: 'panUp', label: 'Pan Up', description: 'Move camera up' },
  { id: 'panDown', label: 'Pan Down', description: 'Move camera down' },
  { id: 'fadeIn', label: 'Fade In', description: 'Fade from black' },
]

export const TRANSITIONS = [
  { id: 'cut', label: 'Cut', description: 'Hard cut, no blend', duration: 0 },
  { id: 'crossfade', label: 'Dissolve', description: 'Eased film dissolve into the next shot', duration: 1.05 },
  { id: 'blur', label: 'Blur dissolve', description: 'Soft-focus blend, like a graded timeline', duration: 0.95 },
  { id: 'fade', label: 'Dip to Black', description: 'Ease out through black, then ease in', duration: 1 },
  { id: 'zoom', label: 'Zoom through', description: 'Slow push-in as the next shot arrives', duration: 0.9 },
  { id: 'slideLeft', label: 'Push Left', description: 'Eased push with a soft edge shadow', duration: 0.75 },
  { id: 'slideRight', label: 'Push Right', description: 'Eased push with a soft edge shadow', duration: 0.75 },
]

export const PRESETS = [
  {
    id: 'documentary',
    label: 'Documentary',
    description: 'Slow Ken Burns + film dissolve, 5s per shot',
    duration: 5,
    animation: 'kenBurnsIn',
    transition: 'crossfade',
  },
  {
    id: 'documentarySlow',
    label: 'Documentary (slow)',
    description: 'Ken Burns out, 7s, film dissolve',
    duration: 7,
    animation: 'kenBurnsOut',
    transition: 'crossfade',
  },
  {
    id: 'news',
    label: 'News / fast',
    description: 'Static shots, 3s, quick cuts',
    duration: 3,
    animation: 'static',
    transition: 'cut',
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    description: 'Fade in + dip to black, 6s',
    duration: 6,
    animation: 'fadeIn',
    transition: 'fade',
  },
  {
    id: 'travel',
    label: 'Travel pan',
    description: 'Pan right, 4s, eased push',
    duration: 4,
    animation: 'panRight',
    transition: 'slideLeft',
  },
]

export const DEFAULT_DURATION = 5
export const DEFAULT_FPS = 30
export const DEFAULT_TRANSITION_DURATION = 1.05

export function transitionSeconds(shot, nextShot) {
  if (!shot || !nextShot || shot.transition === 'cut') {
    return 0
  }
  const spec = TRANSITIONS.find((item) => item.id === shot.transition)
  const preferred = Number(shot.transitionDuration) > 0
    ? Number(shot.transitionDuration)
    : (spec?.duration ?? DEFAULT_TRANSITION_DURATION)
  const cap = Math.min(shot.duration, nextShot.duration) * 0.45
  return Math.max(0.12, Math.min(preferred, cap))
}
export const EXPORT_WIDTH = 1920
export const EXPORT_HEIGHT = 1080

function baseShot(overrides = {}) {
  return {
    duration: DEFAULT_DURATION,
    animation: 'kenBurnsIn',
    transition: 'crossfade',
    voice: '',
    imagePrompt: '',
    audioSrc: null,
    audioName: '',
    missingImage: false,
    shotNumber: null,
    ...overrides,
  }
}

export function createShot(file, overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name: file.name,
    file,
    src: URL.createObjectURL(file),
    ...baseShot(overrides),
  }
}

export function createGeneratedShot(entry, overrides = {}) {
  return {
    id: crypto.randomUUID(),
    name: `Shot ${String(entry.shot).padStart(3, '0')}`,
    file: null,
    src: entry.src ?? null,
    ...baseShot({
      voice: entry.voice ?? '',
      imagePrompt: entry.imagePrompt ?? '',
      shotNumber: entry.shot,
      missingImage: !entry.src,
      ...overrides,
    }),
  }
}

export function shotsFromScript(scriptShots, presetId) {
  const preset = PRESETS.find((item) => item.id === presetId)
  return scriptShots.map((entry, index) => createGeneratedShot(entry, {
    duration: preset?.duration ?? DEFAULT_DURATION,
    animation: preset?.animation ?? 'kenBurnsIn',
    transition: index === scriptShots.length - 1 ? 'crossfade' : (preset?.transition ?? 'crossfade'),
  }))
}

export function applyPreset(shots, presetId) {
  const preset = PRESETS.find((item) => item.id === presetId)
  if (!preset) {
    return shots
  }
  return shots.map((shot, index) => ({
    ...shot,
    duration: preset.duration,
    animation: preset.animation,
    transition: index === shots.length - 1 ? shot.transition : preset.transition,
  }))
}

function pickRandomItem(items, avoidId = null) {
  const pool = avoidId ? items.filter((item) => item.id !== avoidId) : items
  const source = pool.length > 0 ? pool : items
  return source[Math.floor(Math.random() * source.length)]
}

export function applyRandomMix(shots, options = {}) {
  const animationPool = options.animations ?? ANIMATIONS
  const transitionPool = options.transitions ?? TRANSITIONS
  let lastAnimation = null
  let lastTransition = null

  return shots.map((shot, index) => {
    const animation = pickRandomItem(animationPool, lastAnimation?.id).id
    lastAnimation = { id: animation }

    const isLast = index === shots.length - 1
    const transition = isLast
      ? shot.transition
      : pickRandomItem(transitionPool, lastTransition?.id).id
    if (!isLast) {
      lastTransition = { id: transition }
    }

    return {
      ...shot,
      animation,
      transition,
    }
  })
}

export function animationLabel(id) {
  return ANIMATIONS.find((item) => item.id === id)?.label ?? id
}

export function transitionLabel(id) {
  return TRANSITIONS.find((item) => item.id === id)?.label ?? id
}

export function totalDuration(shots) {
  return shots.reduce((sum, shot) => sum + shot.duration, 0)
}

export function fitShotsToAudioDuration(shots, audioDurationSeconds) {
  if (shots.length === 0 || audioDurationSeconds <= 0) {
    return shots
  }

  const perShot = Math.floor((audioDurationSeconds / shots.length) * 100) / 100
  let assigned = 0

  return shots.map((shot, index) => {
    const duration =
      index === shots.length - 1
        ? Math.round((audioDurationSeconds - assigned) * 100) / 100
        : perShot
    assigned += duration
    return { ...shot, duration: Math.max(0.5, duration) }
  })
}

export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const frac = Math.round((seconds % 1) * 10)
  if (mins === 0) {
    return frac > 0 ? `${secs}.${frac}s` : `${secs}s`
  }
  return `${mins}:${String(secs).padStart(2, '0')}`
}
