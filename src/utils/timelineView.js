export const BASE_PX_PER_SECOND = 24
export const MIN_ZOOM = 0.02
export const MAX_ZOOM = 4
export const TRACK_HEADER_WIDTH = 88

export function clampZoom(zoom) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
}

export function getPxPerSecond(zoom) {
  return BASE_PX_PER_SECOND * clampZoom(zoom)
}

export function zoomToPercent(zoom) {
  return Math.round(clampZoom(zoom) * 100)
}

export function getTimelineDuration(duration, importedAudioDuration, masterDuration) {
  return Math.max(duration, importedAudioDuration, masterDuration ?? 0)
}

export function getTimelineWidth(totalDuration, zoom, minWidth = 320) {
  const pxPerSecond = getPxPerSecond(zoom)
  return Math.max(minWidth, totalDuration * pxPerSecond + 80)
}

export function getFitZoom(totalDuration, containerWidth, headerWidth = TRACK_HEADER_WIDTH) {
  if (totalDuration <= 0) {
    return 1
  }
  const available = Math.max(120, containerWidth - headerWidth - 24)
  const pxPerSecond = available / totalDuration
  return clampZoom(pxPerSecond / BASE_PX_PER_SECOND)
}

export function getRulerStep(totalDuration, pxPerSecond) {
  const minSpacing = 72
  const candidates = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600]

  for (const step of candidates) {
    if (step * pxPerSecond >= minSpacing) {
      return step
    }
  }

  if (totalDuration > 3600) {
    return 3600
  }
  return Math.max(1, Math.ceil(totalDuration / 8))
}

export function buildRulerTicks(totalDuration, pxPerSecond) {
  const step = getRulerStep(totalDuration, pxPerSecond)
  const ticks = []
  for (let time = 0; time <= totalDuration + step * 0.01; time += step) {
    ticks.push(Math.round(time * 1000) / 1000)
  }
  return ticks
}

export function isCompactTimeline(pxPerSecond) {
  return pxPerSecond < 6
}

export function getClipMinWidth(pxPerSecond) {
  if (pxPerSecond < 2) {
    return 2
  }
  if (pxPerSecond < 6) {
    return 6
  }
  return 28
}

export function formatRulerTime(seconds) {
  const totalSeconds = Math.floor(seconds)
  const hours = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function timeToScrollLeft(time, pxPerSecond, scrollWidth, viewportWidth, headerWidth = TRACK_HEADER_WIDTH) {
  const playheadX = headerWidth + time * pxPerSecond
  const margin = viewportWidth * 0.2
  if (playheadX < margin) {
    return 0
  }
  if (playheadX > scrollWidth - margin) {
    return Math.max(0, playheadX - viewportWidth * 0.35)
  }
  return Math.max(0, playheadX - viewportWidth * 0.35)
}
