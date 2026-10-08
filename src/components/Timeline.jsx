import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { animationLabel, formatTime } from '../constants'
import { getShotStarts } from '../utils/timeline'
import {
  TRACK_HEADER_WIDTH,
  buildRulerTicks,
  clampZoom,
  formatRulerTime,
  getClipMinWidth,
  getFitZoom,
  getPxPerSecond,
  getTimelineDuration,
  getTimelineWidth,
  isCompactTimeline,
  timeToScrollLeft,
  zoomToPercent,
} from '../utils/timelineView'
import { IconDuplicate, IconScissors, IconZoomIn, IconZoomOut } from './Icons'
import TimelineMinimap from './TimelineMinimap'

function WaveformBars({ seed = 0, compact = false }) {
  const count = compact ? 12 : 24
  const bars = useMemo(() => {
    const items = []
    let value = seed || 1
    for (let index = 0; index < count; index += 1) {
      value = (value * 9301 + 49297) % 233280
      items.push(20 + (value % 60))
    }
    return items
  }, [seed, count])

  return (
    <div className="waveform-bars" aria-hidden="true">
      {bars.map((height, index) => (
        <span key={index} style={{ height: `${height}%` }} />
      ))}
    </div>
  )
}

function TimelineClip({
  shot,
  index,
  start,
  pxPerSecond,
  compact,
  selected,
  dragging,
  onSelect,
  onSeek,
  onDurationChange,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDrop,
  onContextMenu,
}) {
  const [editingDuration, setEditingDuration] = useState(false)
  const [draftDuration, setDraftDuration] = useState(String(shot.duration))
  const resizeRef = useRef({ startX: 0, startDuration: shot.duration })
  const minWidth = getClipMinWidth(pxPerSecond)

  useEffect(() => {
    if (!editingDuration) {
      setDraftDuration(String(shot.duration))
    }
  }, [shot.duration, editingDuration])

  function commitDuration() {
    const value = Number(draftDuration)
    if (Number.isFinite(value) && value >= 0.5) {
      onDurationChange(shot.id, value)
    }
    setEditingDuration(false)
  }

  function startResize(event) {
    event.preventDefault()
    event.stopPropagation()
    onSelect(shot.id)

    resizeRef.current = { startX: event.clientX, startDuration: shot.duration }

    function onMove(moveEvent) {
      const delta = (moveEvent.clientX - resizeRef.current.startX) / pxPerSecond
      onDurationChange(shot.id, Math.max(0.5, Math.round((resizeRef.current.startDuration + delta) * 10) / 10))
    }

    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      className={`timeline-clip ${compact ? 'compact' : ''} ${selected ? 'selected' : ''} ${dragging ? 'dragging' : ''} ${shot.missingImage ? 'pending' : ''}`}
      style={{
        left: start * pxPerSecond,
        width: Math.max(shot.duration * pxPerSecond - (compact ? 0 : 2), minWidth),
      }}
      title={`${shot.name} · ${formatTime(shot.duration)} · ${animationLabel(shot.animation)}`}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(shot.id)
        onSeek(start)
      }}
      onContextMenu={(event) => onContextMenu?.(event, shot.id)}
    >
      {!compact ? (
        <button
          type="button"
          className="clip-drag-handle"
          draggable
          aria-label={`Reorder ${shot.name}`}
          onDragStart={() => onDragStart(index)}
          onDragEnd={onDragEnd}
          onDragEnter={() => onDragEnter(index)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onDrop(index)
          }}
        >
          ⋮⋮
        </button>
      ) : null}

      {!compact && !shot.missingImage ? (
        <img src={shot.src} alt="" draggable={false} />
      ) : null}
      {!compact && shot.missingImage ? (
        <span className="clip-placeholder">?</span>
      ) : null}

      {!compact ? (
        <div className="clip-footer">
          <span className="clip-label">{shot.name}</span>
          {selected && editingDuration ? (
            <input
              className="clip-duration-input"
              type="number"
              min="0.5"
              max="120"
              step="0.1"
              value={draftDuration}
              autoFocus
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => setDraftDuration(event.target.value)}
              onBlur={commitDuration}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  commitDuration()
                }
                if (event.key === 'Escape') {
                  setEditingDuration(false)
                  setDraftDuration(String(shot.duration))
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="clip-duration"
              onClick={(event) => {
                event.stopPropagation()
                onSelect(shot.id)
                setEditingDuration(true)
              }}
            >
              {formatTime(shot.duration)}
            </button>
          )}
        </div>
      ) : (
        <span className="clip-compact-label">{shot.name}</span>
      )}

      {!compact ? (
        <span
          className="resize-handle"
          role="separator"
          aria-label={`Resize ${shot.name}`}
          onPointerDown={startResize}
        />
      ) : null}
    </div>
  )
}

export default function Timeline({
  shots,
  selectedId,
  currentTime,
  duration,
  zoom,
  onZoomChange,
  onSelect,
  onSeek,
  onDurationChange,
  onSplit,
  onDuplicate,
  dragFromIndex,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDrop,
  onContextMenu,
  masterAudio,
  audioTracks = [],
  height = 280,
  onResizeStart,
}) {
  const scrollRef = useRef(null)
  const contentRef = useRef(null)
  const [scrollState, setScrollState] = useState({ left: 0, width: 1, clientWidth: 1 })

  const importedAudioDuration = audioTracks.reduce((sum, track) => sum + track.duration, 0)
  const totalDuration = getTimelineDuration(duration, importedAudioDuration, masterAudio?.duration)
  const pxPerSecond = getPxPerSecond(zoom)
  const compact = isCompactTimeline(pxPerSecond)
  const timelineWidth = getTimelineWidth(totalDuration, zoom)
  const playheadLeft = currentTime * pxPerSecond

  const segments = useMemo(() => getShotStarts(shots), [shots])
  const audioSegments = useMemo(() => {
    let start = 0
    return audioTracks.map((track) => {
      const item = { track, start, end: start + track.duration }
      start += track.duration
      return item
    })
  }, [audioTracks])
  const selectedShot = shots.find((shot) => shot.id === selectedId)
  const ticks = useMemo(() => buildRulerTicks(totalDuration, pxPerSecond), [totalDuration, pxPerSecond])

  const updateScrollState = useCallback(() => {
    const element = scrollRef.current
    if (!element) {
      return
    }
    setScrollState({
      left: element.scrollLeft,
      width: element.scrollWidth,
      clientWidth: element.clientWidth,
    })
  }, [])

  useEffect(() => {
    updateScrollState()
  }, [timelineWidth, updateScrollState])

  useEffect(() => {
    const element = scrollRef.current
    if (!element) {
      return undefined
    }

    element.addEventListener('scroll', updateScrollState, { passive: true })

    function onWheel(event) {
      const horizontal = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)
      if (!horizontal) {
        return
      }
      element.scrollLeft += event.deltaX || event.deltaY
      event.preventDefault()
    }

    element.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      element.removeEventListener('scroll', updateScrollState)
      element.removeEventListener('wheel', onWheel)
    }
  }, [updateScrollState])

  useEffect(() => {
    const element = scrollRef.current
    if (!element) {
      return
    }
    const targetLeft = timeToScrollLeft(
      currentTime,
      pxPerSecond,
      element.scrollWidth,
      element.clientWidth,
      0,
    )
    const delta = Math.abs(element.scrollLeft - targetLeft)
    if (delta > element.clientWidth * 0.45) {
      element.scrollLeft = targetLeft
    }
  }, [currentTime, pxPerSecond])

  function seekFromEvent(event) {
    const content = contentRef.current
    const scroll = scrollRef.current
    if (!content || !scroll) {
      return
    }
    const rect = content.getBoundingClientRect()
    const x = event.clientX - rect.left + scroll.scrollLeft
    const time = Math.max(0, Math.min(totalDuration, x / pxPerSecond))
    onSeek(time)
  }

  function nudgeZoom(delta) {
    onZoomChange(clampZoom(Math.round((zoom + delta) * 100) / 100))
  }

  function fitSequenceToView() {
    const element = scrollRef.current
    if (!element || totalDuration <= 0) {
      return
    }
    const fitZoom = getFitZoom(totalDuration, element.clientWidth + TRACK_HEADER_WIDTH, 0)
    onZoomChange(fitZoom)
    window.requestAnimationFrame(() => {
      element.scrollLeft = 0
      updateScrollState()
    })
  }

  const viewportRatio = scrollState.width > 0 ? scrollState.clientWidth / scrollState.width : 1
  const viewportStart = scrollState.width > 0 ? scrollState.left / scrollState.width : 0

  return (
    <section className="timeline-panel" style={{ height }}>
      <div
        className="timeline-resize-handle"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize timeline height"
        onPointerDown={onResizeStart}
      />

      <div className="timeline-toolbar">
        <div className="timeline-toolbar-left">
          <strong className="timeline-title">Timeline</strong>
          <span className="timeline-stats">{shots.length} clips · {formatTime(totalDuration)}</span>
        </div>

        <div className="timeline-tools">
          <button type="button" className="tool-btn accent" disabled={shots.length === 0} onClick={onSplit} title="Split at playhead (S)">
            <IconScissors size={16} />
            <span>Split</span>
          </button>
          <button type="button" className="tool-btn" disabled={!selectedId} onClick={onDuplicate} title="Duplicate selected clip">
            <IconDuplicate size={16} />
            <span>Duplicate</span>
          </button>
          {selectedShot ? (
            <label className="clip-duration-control">
              <span>Duration</span>
              <input
                type="number"
                min="0.5"
                max="120"
                step="0.1"
                value={selectedShot.duration}
                onChange={(event) => onDurationChange(selectedShot.id, Number(event.target.value))}
              />
            </label>
          ) : null}
        </div>

        <div className="zoom-control">
          <button type="button" className="tool-btn" title="Fit entire sequence in view" disabled={totalDuration <= 0} onClick={fitSequenceToView}>
            Fit
          </button>
          <button type="button" className="icon-btn" title="Zoom out" onClick={() => nudgeZoom(-0.1)}>
            <IconZoomOut size={16} />
          </button>
          <input
            type="range"
            min={0.02}
            max={4}
            step="0.01"
            value={zoom}
            onChange={(event) => onZoomChange(clampZoom(Number(event.target.value)))}
          />
          <button type="button" className="icon-btn" title="Zoom in" onClick={() => nudgeZoom(0.1)}>
            <IconZoomIn size={16} />
          </button>
          <span className="zoom-label">{zoomToPercent(zoom)}%</span>
          <span className="zoom-px-label">{pxPerSecond.toFixed(1)} px/s</span>
        </div>
      </div>

      <TimelineMinimap
        duration={totalDuration}
        currentTime={currentTime}
        viewportStart={viewportStart}
        viewportRatio={viewportRatio}
        segments={segments}
        onSeek={onSeek}
      />

      <div className={`timeline-workspace ${compact ? 'compact' : ''}`}>
        <div className="timeline-fixed-col" style={{ width: TRACK_HEADER_WIDTH }}>
          <div className="track-header-spacer" />
          <div className="track-header-cell video-header">
            <span className="track-label">V1</span>
            <span className="track-sublabel">Video</span>
          </div>
          {audioSegments.length > 0 ? (
            <div className="track-header-cell import-header">
              <span className="track-label">A0</span>
              <span className="track-sublabel">Import</span>
            </div>
          ) : null}
          <div className="track-header-cell audio-header">
            <span className="track-label">A1</span>
            <span className="track-sublabel">Mix</span>
          </div>
        </div>

        <div ref={scrollRef} className="timeline-scroll">
          <div ref={contentRef} className="timeline-content" style={{ width: timelineWidth }}>
            <div className="timeline-ruler">
              {ticks.map((tick) => (
                <div key={tick} className="ruler-mark" style={{ left: tick * pxPerSecond }}>
                  <span className="ruler-tick">{formatRulerTime(tick)}</span>
                </div>
              ))}
            </div>

            <div className="timeline-track video-track" onClick={seekFromEvent}>
              <div className="track-clips">
                {segments.length === 0 ? (
                  <div className="timeline-empty-track">
                    <span>Import images or a manifest from the toolbar to start editing</span>
                  </div>
                ) : null}
                {segments.map(({ shot, index, start }) => (
                  <TimelineClip
                    key={shot.id}
                    shot={shot}
                    index={index}
                    start={start}
                    pxPerSecond={pxPerSecond}
                    compact={compact}
                    selected={selectedId === shot.id}
                    dragging={dragFromIndex === index}
                    onSelect={onSelect}
                    onSeek={onSeek}
                    onDurationChange={onDurationChange}
                    onDragStart={onDragStart}
                    onDragEnter={onDragEnter}
                    onDragEnd={onDragEnd}
                    onDrop={onDrop}
                    onContextMenu={onContextMenu}
                  />
                ))}
              </div>
            </div>

            {audioSegments.length > 0 ? (
              <div className="timeline-track import-audio-track">
                <div className="track-clips">
                  {audioSegments.map(({ track, start }, index) => (
                    <div
                      key={track.id}
                      className="timeline-audio-block imported"
                      style={{
                        left: start * pxPerSecond,
                        width: Math.max(track.duration * pxPerSecond - 2, getClipMinWidth(pxPerSecond)),
                      }}
                      title={`${index + 1}. ${track.name}`}
                    >
                      <WaveformBars seed={index + 1} compact={compact} />
                      {!compact ? <span className="audio-block-label">{index + 1}. {track.name}</span> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="timeline-track audio-track" onClick={seekFromEvent}>
              <div className="track-clips">
                {masterAudio ? (
                  <div
                    className="timeline-audio-block master"
                    style={{ left: 0, width: Math.max(masterAudio.duration * pxPerSecond - 2, getClipMinWidth(pxPerSecond)) }}
                  >
                    <WaveformBars seed={99} compact={compact} />
                    {!compact ? <span className="audio-block-label">Master · {formatTime(masterAudio.duration)}</span> : null}
                  </div>
                ) : null}
                {segments.map(({ shot, start }) =>
                  shot.audioSrc ? (
                    <div
                      key={`${shot.id}-audio`}
                      className="timeline-audio-block shot-audio"
                      style={{
                        left: start * pxPerSecond,
                        width: Math.max(shot.duration * pxPerSecond - 2, getClipMinWidth(pxPerSecond)),
                      }}
                      title={shot.audioName || shot.name}
                      onContextMenu={(event) => onContextMenu?.(event, shot.id)}
                    >
                      <WaveformBars seed={shot.name.length} compact={compact} />
                    </div>
                  ) : null,
                )}
              </div>
            </div>

            <div className="playhead" style={{ left: playheadLeft }} aria-hidden="true">
              <div className="playhead-head" />
              <div className="playhead-line" />
            </div>
          </div>
        </div>
      </div>

      <div className="timeline-scroll-hint muted">
        Shift + mouse wheel to scroll horizontally · drag top edge to resize timeline · click Fit to see full {formatTime(totalDuration)} sequence
      </div>
    </section>
  )
}
