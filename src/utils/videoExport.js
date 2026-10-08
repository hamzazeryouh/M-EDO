import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import {
  DEFAULT_FPS,
  DEFAULT_TRANSITION_DURATION,
  EXPORT_HEIGHT,
  EXPORT_WIDTH,
  totalDuration,
} from '../constants'
import { buildFinalAudio, encodeAudioBuffer, hasAnyAudio } from './audioMixer'
import { preloadImages, renderFrame } from './canvasRenderer'
import { throwIfStopped } from './agentStop'

function pickWebmMimeType() {
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

export async function supportsMp4Export(width = EXPORT_WIDTH, height = EXPORT_HEIGHT) {
  if (typeof VideoEncoder === 'undefined') {
    return false
  }
  try {
    const result = await VideoEncoder.isConfigSupported({
      codec: 'avc1.42001f',
      width,
      height,
      bitrate: 8_000_000,
      framerate: DEFAULT_FPS,
    })
    return result.supported
  } catch {
    return false
  }
}

async function exportMp4(shots, options) {
  const fps = options.fps ?? DEFAULT_FPS
  const width = options.width ?? EXPORT_WIDTH
  const height = options.height ?? EXPORT_HEIGHT
  const transitionDuration = options.transitionDuration ?? DEFAULT_TRANSITION_DURATION
  const onProgress = options.onProgress ?? (() => {})

  const images = await preloadImages(shots)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { alpha: false })

  const masterAudioSrc = options.masterAudioSrc ?? null
  const includeAudio = hasAnyAudio(shots, masterAudioSrc)
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width, height },
    audio: includeAudio
      ? { codec: 'aac', sampleRate: 48000, numberOfChannels: 2 }
      : undefined,
    fastStart: 'in-memory',
  })

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => {
      throw error
    },
  })

  videoEncoder.configure({
    codec: 'avc1.42001f',
    width,
    height,
    bitrate: 8_000_000,
    framerate: fps,
  })

  let audioEncoder = null
  if (includeAudio) {
    audioEncoder = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      error: (error) => {
        throw error
      },
    })
    audioEncoder.configure({
      codec: 'mp4a.40.2',
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: 192_000,
    })
  }

  const duration = totalDuration(shots)
  const totalFrames = Math.ceil(duration * fps)
  const frameDurationUs = Math.round(1_000_000 / fps)

  for (let frameIndex = 0; frameIndex <= totalFrames; frameIndex += 1) {
    throwIfStopped(options.signal)
    const time = Math.min(frameIndex / fps, duration - 0.001)
    renderFrame(ctx, shots, images, time, width, height, transitionDuration)

    const frame = new VideoFrame(canvas, {
      timestamp: frameIndex * frameDurationUs,
      duration: frameDurationUs,
    })
    videoEncoder.encode(frame, { keyFrame: frameIndex % (fps * 2) === 0 })
    frame.close()

    onProgress(Math.min(0.85, frameIndex / totalFrames))
    if (frameIndex % 3 === 0) {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    }
  }

  await videoEncoder.flush()
  videoEncoder.close()

  if (includeAudio && audioEncoder) {
    onProgress(0.9)
    const mixedAudio = await buildFinalAudio(shots, masterAudioSrc)
    encodeAudioBuffer(audioEncoder, mixedAudio, (audioProgress) => {
      onProgress(0.85 + audioProgress * 0.14)
    })
    await audioEncoder.flush()
    audioEncoder.close()
  }

  muxer.finalize()
  onProgress(1)
  return new Blob([muxer.target.buffer], { type: 'video/mp4' })
}

async function exportWebm(shots, options) {
  const fps = options.fps ?? DEFAULT_FPS
  const width = options.width ?? EXPORT_WIDTH
  const height = options.height ?? EXPORT_HEIGHT
  const transitionDuration = options.transitionDuration ?? DEFAULT_TRANSITION_DURATION
  const onProgress = options.onProgress ?? (() => {})

  const images = await preloadImages(shots)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { alpha: false })

  const mimeType = pickWebmMimeType()
  if (!mimeType) {
    throw new Error('This browser does not support video recording.')
  }

  const stream = canvas.captureStream(fps)
  const masterAudioSrc = options.masterAudioSrc ?? null
  const shotsHaveAudio = shots.some((shot) => shot.audioSrc)
  let audioContext = null
  let audioSource = null
  if (hasAnyAudio(shots, shotsHaveAudio ? null : masterAudioSrc)) {
    const mixed = await buildFinalAudio(shots, shotsHaveAudio ? null : masterAudioSrc)
    audioContext = new AudioContext()
    const destination = audioContext.createMediaStreamDestination()
    audioSource = audioContext.createBufferSource()
    audioSource.buffer = mixed
    audioSource.connect(destination)
    destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track))
    audioSource.start()
  }
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  })

  const chunks = []
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data)
    }
  }

  const finished = new Promise((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }))
    recorder.onerror = () => reject(new Error('Recording failed.'))
  })

  recorder.start(200)

  const duration = totalDuration(shots)
  const frameDuration = 1 / fps
  let time = 0

  while (time <= duration) {
    throwIfStopped(options.signal)
    renderFrame(ctx, shots, images, Math.min(time, duration - 0.001), width, height, transitionDuration)
    onProgress(Math.min(1, time / duration))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    time += frameDuration
  }

  recorder.stop()
  const blob = await finished
  try {
    audioSource?.stop()
  } catch {
    // The speech buffer can already be finished when the recorder stops.
  }
  await audioContext?.close()
  return blob
}

export async function exportVideo(shots, options = {}) {
  if (shots.length === 0) {
    throw new Error('Add at least one image before exporting.')
  }

  const width = options.width ?? EXPORT_WIDTH
  const height = options.height ?? EXPORT_HEIGHT
  const preferMp4 = options.format !== 'webm'
  if (preferMp4 && (await supportsMp4Export(width, height))) {
    return exportMp4(shots, options)
  }

  if (preferMp4 && options.onFallback) {
    options.onFallback('webm')
  }

  return exportWebm(shots, options)
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
