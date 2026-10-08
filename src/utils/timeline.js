export function formatTimecode(seconds, fps = 30) {
  const totalFrames = Math.floor(seconds * fps)
  const frames = totalFrames % fps
  const totalSeconds = Math.floor(totalFrames / fps)
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`
}

export function getShotStarts(shots) {
  let elapsed = 0
  return shots.map((shot, index) => {
    const start = elapsed
    elapsed += shot.duration
    return { shot, index, start, end: elapsed }
  })
}

export function getShotIndexAtTime(shots, time) {
  let elapsed = 0
  for (let index = 0; index < shots.length; index += 1) {
    elapsed += shots[index].duration
    if (time < elapsed) {
      return index
    }
  }
  return Math.max(0, shots.length - 1)
}
