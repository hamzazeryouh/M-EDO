import {
  DEFAULT_DURATION,
  PRESETS,
  applyRandomMix,
  fitShotsToAudioDuration,
  totalDuration,
} from '../constants'

function roundDuration(value) {
  return Math.max(0.5, Math.round(value * 100) / 100)
}

function pickRandomIndex(length, avoidIndex = -1) {
  if (length <= 1) {
    return 0
  }
  let index = Math.floor(Math.random() * length)
  while (index === avoidIndex) {
    index = Math.floor(Math.random() * length)
  }
  return index
}

function cloneVisualShot(source, slotIndex, loopPass) {
  return {
    ...source,
    id: crypto.randomUUID(),
    name: loopPass > 0 ? `${source.name} · mix ${loopPass + 1}` : source.name,
    audioSrc: null,
    audioName: '',
    voice: '',
    shotNumber: source.shotNumber ?? slotIndex + 1,
  }
}

export function getAudioMatchSlotDuration(settings = {}) {
  if (settings.audioMatchShotDuration > 0) {
    return settings.audioMatchShotDuration
  }
  const preset = PRESETS.find((item) => item.id === settings.stylePresetId)
  return preset?.duration ?? DEFAULT_DURATION
}

export function matchShotsToAudio(shots, audioDurationSeconds, options = {}) {
  if (shots.length === 0 || audioDurationSeconds <= 0) {
    return shots
  }

  const {
    mode = 'loopRandom',
    perShotDuration = DEFAULT_DURATION,
    stylePresetId = 'documentary',
    randomize = true,
  } = options

  const slotDuration = perShotDuration > 0
    ? perShotDuration
    : (PRESETS.find((item) => item.id === stylePresetId)?.duration ?? DEFAULT_DURATION)

  if (mode === 'stretch') {
    return fitShotsToAudioDuration(shots, audioDurationSeconds)
  }

  const currentTotal = totalDuration(shots)
  const neededSlots = Math.max(1, Math.ceil(audioDurationSeconds / slotDuration))
  const shouldLoop = neededSlots > shots.length || audioDurationSeconds > currentTotal + 0.5

  if (!shouldLoop) {
    const trimmed = neededSlots < shots.length ? shots.slice(0, neededSlots) : shots
    return fitShotsToAudioDuration(trimmed, audioDurationSeconds)
  }

  const result = []
  let assigned = 0
  let lastIndex = -1
  let loopPass = 0

  for (let slot = 0; slot < neededSlots; slot += 1) {
    if (slot > 0 && slot % shots.length === 0) {
      loopPass += 1
    }

    const sourceIndex = pickRandomIndex(shots.length, lastIndex)
    lastIndex = sourceIndex
    const source = shots[sourceIndex]
    const isLast = slot === neededSlots - 1
    const duration = isLast
      ? roundDuration(audioDurationSeconds - assigned)
      : roundDuration(Math.min(slotDuration, audioDurationSeconds - assigned))

    result.push({
      ...cloneVisualShot(source, slot, loopPass),
      duration,
    })
    assigned += duration
  }

  return randomize ? applyRandomMix(result) : result
}

export function describeAudioMatch(shots, audioDurationSeconds, options = {}) {
  const slotDuration = options.perShotDuration ?? getAudioMatchSlotDuration(options)
  const neededSlots = Math.max(1, Math.ceil(audioDurationSeconds / slotDuration))
  const currentTotal = totalDuration(shots)
  const mode = options.mode ?? 'loopRandom'

  if (mode === 'stretch') {
    return `Stretch ${shots.length} shots to ${roundDuration(audioDurationSeconds)}s`
  }

  if (neededSlots > shots.length || audioDurationSeconds > currentTotal + 0.5) {
    return `Loop ${shots.length} images randomly → ${neededSlots} clips (~${slotDuration}s each)`
  }

  return `Fit ${Math.min(shots.length, neededSlots)} shots to ${roundDuration(audioDurationSeconds)}s`
}
