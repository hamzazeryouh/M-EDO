import { totalDuration } from '../constants'

export function getShotStartTimes(shots) {
  let elapsed = 0
  return shots.map((shot) => {
    const start = elapsed
    elapsed += shot.duration
    return { shot, start }
  })
}

export function hasAnyAudio(shots, masterAudioSrc = null) {
  return Boolean(masterAudioSrc) || shots.some((shot) => shot.audioSrc)
}

export async function decodeAudio(src) {
  const response = await fetch(src)
  const arrayBuffer = await response.arrayBuffer()
  const context = new AudioContext()
  try {
    return await context.decodeAudioData(arrayBuffer)
  } finally {
    await context.close()
  }
}

export async function getAudioDuration(src) {
  const buffer = await decodeAudio(src)
  return buffer.duration
}

export async function spliceAudioTracks(tracks, sampleRate = 48000) {
  if (tracks.length === 0) {
    return null
  }

  const buffers = await Promise.all(tracks.map((track) => decodeAudio(track.src)))
  const totalDuration = buffers.reduce((sum, buffer) => sum + buffer.duration, 0)
  const length = Math.max(1, Math.ceil(totalDuration * sampleRate))
  const offline = new OfflineAudioContext(2, length, sampleRate)

  let startTime = 0
  for (const buffer of buffers) {
    const source = offline.createBufferSource()
    source.buffer = buffer
    source.connect(offline.destination)
    source.start(startTime)
    startTime += buffer.duration
  }

  const rendered = await offline.startRendering()
  return {
    buffer: rendered,
    duration: totalDuration,
  }
}

export function audioBufferToWavBlob(buffer) {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const bitDepth = 16
  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample
  const dataLength = buffer.length * blockAlign
  const arrayBuffer = new ArrayBuffer(44 + dataLength)
  const view = new DataView(arrayBuffer)

  function writeString(offset, text) {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeString(36, 'data')
  view.setUint32(40, dataLength, true)

  let offset = 44
  for (let index = 0; index < buffer.length; index += 1) {
    for (let channel = 0; channel < numChannels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[index]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

export async function buildSplicedMasterUrl(tracks) {
  const spliced = await spliceAudioTracks(tracks)
  if (!spliced) {
    return null
  }
  const blob = audioBufferToWavBlob(spliced.buffer)
  return {
    src: URL.createObjectURL(blob),
    duration: spliced.duration,
    name: tracks.length === 1 ? tracks[0].name : `Spliced (${tracks.length} files)`,
  }
}

export async function buildFinalAudio(shots, masterAudioSrc = null, sampleRate = 48000) {
  const videoDuration = totalDuration(shots)
  const length = Math.max(1, Math.ceil(videoDuration * sampleRate))
  const offline = new OfflineAudioContext(2, length, sampleRate)

  if (masterAudioSrc && !shots.some((shot) => shot.audioSrc)) {
    const master = await decodeAudio(masterAudioSrc)
    const source = offline.createBufferSource()
    source.buffer = master
    source.connect(offline.destination)
    source.start(0, 0, Math.min(master.duration, videoDuration))
  }

  const timeline = getShotStartTimes(shots)
  await Promise.all(
    timeline.map(async ({ shot, start }) => {
      if (!shot.audioSrc) {
        return
      }
      const buffer = await decodeAudio(shot.audioSrc)
      const source = offline.createBufferSource()
      source.buffer = buffer
      source.connect(offline.destination)
      source.start(start, 0, Math.min(buffer.duration, shot.duration))
    }),
  )

  return offline.startRendering()
}

export function encodeAudioBuffer(audioEncoder, audioBuffer, onProgress) {
  const sampleRate = audioBuffer.sampleRate
  const numberOfChannels = audioBuffer.numberOfChannels
  const totalFrames = audioBuffer.length
  const chunkFrames = 1024
  let offset = 0
  let timestamp = 0
  const frameDurationUs = Math.round(1_000_000 / sampleRate)

  while (offset < totalFrames) {
    const frames = Math.min(chunkFrames, totalFrames - offset)
    const planeData = []
    for (let channel = 0; channel < numberOfChannels; channel += 1) {
      planeData.push(audioBuffer.getChannelData(channel).subarray(offset, offset + frames))
    }

    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate,
      numberOfFrames: frames,
      numberOfChannels,
      timestamp,
      data: planeData,
    })

    audioEncoder.encode(audioData)
    audioData.close()

    offset += frames
    timestamp += frames * frameDurationUs
    onProgress?.(offset / totalFrames)
  }
}
