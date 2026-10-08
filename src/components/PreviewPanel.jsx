import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_TRANSITION_DURATION, formatTime, totalDuration } from '../constants'
import { getPreviewCanvasSize } from '../platformTemplates'
import { findShotAtTime, preloadImages, renderFrame } from '../utils/canvasRenderer'
import { formatTimecode } from '../utils/timeline'

const MONITOR_CHROME_HEIGHT = 108

const SCALE_OPTIONS = [
  { id: 'fit', label: 'Fit' },
  { id: '0.5', label: '50%' },
  { id: '0.75', label: '75%' },
  { id: '1', label: '100%' },
  { id: '1.25', label: '125%' },
]

function computeMonitorSize(availableWidth, availableHeight, scaleMode, previewBaseWidth, previewBaseHeight) {
  const aspect = previewBaseWidth / previewBaseHeight
  const safeWidth = Math.max(280, availableWidth - 16)
  const safeHeight = Math.max(160, availableHeight - MONITOR_CHROME_HEIGHT)

  if (scaleMode === 'fit') {
    let frameWidth = Math.min(safeWidth, previewBaseWidth, safeHeight * aspect)
    let frameHeight = frameWidth / aspect
    if (frameHeight > safeHeight) {
      frameHeight = safeHeight
      frameWidth = frameHeight * aspect
    }
    return {
      frameWidth: Math.floor(frameWidth),
      frameHeight: Math.floor(frameHeight),
      dockWidth: Math.floor(frameWidth),
    }
  }

  const scale = Number(scaleMode)
  let frameWidth = Math.min(previewBaseWidth * scale, safeWidth)
  let frameHeight = frameWidth / aspect
  if (frameHeight > safeHeight) {
    frameHeight = safeHeight
    frameWidth = frameHeight * aspect
  }
  return {
    frameWidth: Math.floor(frameWidth),
    frameHeight: Math.floor(frameHeight),
    dockWidth: Math.floor(frameWidth),
  }
}

export default function PreviewPanel({
  shots,
  masterAudioSrc,
  currentTime,
  playing,
  exportWidth,
  exportHeight,
  exportFps,
  aspectLabel,
  platformLabel,
  onTimeChange,
  onPlayingChange,
  onTogglePlay,
}) {
  const canvasRef = useRef(null)
  const wellRef = useRef(null)
  const rafRef = useRef(null)
  const startRef = useRef(null)
  const currentTimeRef = useRef(currentTime)
  const imagesRef = useRef(new Map())
  const audioRef = useRef(null)
  const activeAudioKeyRef = useRef(null)
  const [showSafeArea, setShowSafeArea] = useState(false)
  const [scaleMode, setScaleMode] = useState('fit')
  const [wellSize, setWellSize] = useState({ width: 960, height: 640 })

  const duration = totalDuration(shots)
  const currentShot = findShotAtTime(shots, currentTime)
  const previewCanvasSize = useMemo(
    () => getPreviewCanvasSize(exportWidth, exportHeight),
    [exportWidth, exportHeight],
  )

  const monitorSize = useMemo(
    () => computeMonitorSize(
      wellSize.width,
      wellSize.height,
      scaleMode,
      previewCanvasSize.width,
      previewCanvasSize.height,
    ),
    [wellSize.width, wellSize.height, scaleMode, previewCanvasSize.width, previewCanvasSize.height],
  )

  useEffect(() => {
    currentTimeRef.current = currentTime
  }, [currentTime])

  useEffect(() => {
    const element = wellRef.current
    if (!element) {
      return undefined
    }

    function updateSize() {
      const rect = element.getBoundingClientRect()
      setWellSize({ width: rect.width, height: rect.height })
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (shots.length === 0) {
        imagesRef.current = new Map()
        return
      }
      const images = await preloadImages(shots)
      if (!cancelled) {
        imagesRef.current = images
        drawFrame(currentTimeRef.current)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [shots])

  useEffect(() => {
    stopAudio()
  }, [masterAudioSrc])

  useEffect(() => {
    return () => stopAudio()
  }, [])

  useEffect(() => {
    if (!playing) {
      return undefined
    }

    function tick(timestamp) {
      if (!startRef.current) {
        startRef.current = timestamp - currentTimeRef.current * 1000
      }
      const elapsed = (timestamp - startRef.current) / 1000
      const nextTime = duration > 0 ? Math.min(elapsed, duration) : 0
      currentTimeRef.current = nextTime
      drawFrame(nextTime)
      syncAudio(nextTime, true)
      onTimeChange(nextTime)
      if (nextTime >= duration) {
        onPlayingChange(false)
        startRef.current = null
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [playing, shots, duration, masterAudioSrc, onTimeChange, onPlayingChange])

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      canvas.width = previewCanvasSize.width
      canvas.height = previewCanvasSize.height
    }
    drawFrame(currentTime)
  }, [currentTime, shots, previewCanvasSize.width, previewCanvasSize.height])

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    activeAudioKeyRef.current = null
  }

  function syncAudio(time, autoplay) {
    if (masterAudioSrc) {
      const key = `master:${masterAudioSrc}`
      if (activeAudioKeyRef.current !== key) {
        stopAudio()
        audioRef.current = new Audio(masterAudioSrc)
        activeAudioKeyRef.current = key
      }
      if (audioRef.current) {
        const drift = Math.abs(audioRef.current.currentTime - time)
        if (drift > 0.15) {
          audioRef.current.currentTime = time
        }
        if (playing && autoplay && audioRef.current.paused) {
          audioRef.current.play().catch(() => {})
        }
      }
      return
    }

    const current = findShotAtTime(shots, time)
    if (!current?.shot.audioSrc) {
      stopAudio()
      return
    }

    const key = `shot:${current.shot.id}`
    if (activeAudioKeyRef.current === key) {
      if (audioRef.current && playing && autoplay && audioRef.current.paused) {
        audioRef.current.play().catch(() => {})
      }
      return
    }

    stopAudio()
    activeAudioKeyRef.current = key
    const audio = new Audio(current.shot.audioSrc)
    audio.currentTime = Math.min(current.localTime, audio.duration || current.localTime)
    audioRef.current = audio
    if (playing && autoplay) {
      audio.play().catch(() => {})
    }
  }

  function drawFrame(time) {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    renderFrame(ctx, shots, imagesRef.current, time, canvas.width, canvas.height, DEFAULT_TRANSITION_DURATION)
  }

  function handleSeek(event) {
    const value = Number(event.target.value)
    currentTimeRef.current = value
    startRef.current = null
    drawFrame(value)
    stopAudio()
    syncAudio(value, false)
    onTimeChange(value)
    if (playing) {
      onPlayingChange(false)
    }
  }

  const scalePercent = scaleMode === 'fit'
    ? Math.round((monitorSize.frameWidth / previewCanvasSize.width) * 100)
    : Math.round(Number(scaleMode) * 100)

  return (
    <section className="preview-panel">
      <div ref={wellRef} className="monitor-well">
        <aside className="monitor-side-rail" aria-hidden="true">
          <span className="rail-label">Viewer</span>
        </aside>

        <div className="monitor-dock" style={{ width: monitorSize.dockWidth }}>
          <div className="monitor-stack">
            <div className="monitor-chrome">
              <div className="monitor-title">
                <span className="monitor-badge">Program</span>
                <strong>Monitor</strong>
              </div>

              <div className="monitor-controls">
                <label className="monitor-scale">
                  <span>Zoom</span>
                  <select value={scaleMode} onChange={(event) => setScaleMode(event.target.value)}>
                    {SCALE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <span className="monitor-chip" title={platformLabel}>{exportWidth}×{exportHeight}</span>
                <span className="monitor-chip">{aspectLabel}</span>
                <span className="monitor-chip">{exportFps} fps</span>
                <button
                  type="button"
                  className={`monitor-chip toggle ${showSafeArea ? 'active' : ''}`}
                  onClick={() => setShowSafeArea((value) => !value)}
                >
                  Safe area
                </button>
              </div>

              <div className="monitor-timecode">
                <span className="timecode-current">{formatTimecode(currentTime)}</span>
                <span className="timecode-sep">/</span>
                <span className="timecode-total">{formatTimecode(duration)}</span>
              </div>
            </div>

            <div
              className="preview-frame"
              style={{ width: monitorSize.frameWidth, height: monitorSize.frameHeight }}
            >
              <div className="preview-bezel">
                <canvas ref={canvasRef} width={previewCanvasSize.width} height={previewCanvasSize.height} />
                <div className="monitor-corners" aria-hidden="true">
                  <span /><span /><span /><span />
                </div>
                {showSafeArea ? (
                  <div className="safe-area-overlay" aria-hidden="true">
                    <div className="safe-area-box" />
                    <div className="safe-area-title">Title safe</div>
                    <div className="safe-area-action">Action safe</div>
                  </div>
                ) : null}
                {currentShot ? (
                  <div className="monitor-overlay-info">
                    <span>{currentShot.shot.name}</span>
                    <span>{formatTime(currentShot.localTime)} in clip</span>
                  </div>
                ) : null}
                {shots.length === 0 ? (
                  <div className="preview-placeholder">
                    <strong>No sequence loaded</strong>
                    <span>Import images or reload the Korea project</span>
                  </div>
                ) : null}
              </div>
              <div className="monitor-size-readout">
                {monitorSize.frameWidth}×{monitorSize.frameHeight} · {scalePercent}%
              </div>
            </div>

            <div className="monitor-transport">
              <button type="button" className="monitor-play" onClick={onTogglePlay} disabled={shots.length === 0}>
                {playing ? 'Pause' : 'Play'}
              </button>
              <div className="scrubber-wrap">
                <input
                  className="scrubber"
                  type="range"
                  min="0"
                  max={Math.max(duration, 0.1)}
                  step="0.05"
                  value={currentTime}
                  onChange={handleSeek}
                  disabled={shots.length === 0}
                />
              </div>
              <span className="scrubber-readout">{formatTime(currentTime)}</span>
            </div>
          </div>
        </div>

        <aside className="monitor-side-rail monitor-side-rail-right" aria-hidden="true">
          <span className="rail-meta">{aspectLabel}</span>
          <span className="rail-meta">{scaleMode === 'fit' ? 'Fit' : `${scalePercent}%`}</span>
        </aside>
      </div>
    </section>
  )
}
