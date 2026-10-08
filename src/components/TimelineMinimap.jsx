import { formatTime } from '../constants'

export default function TimelineMinimap({
  duration,
  currentTime,
  viewportStart,
  viewportRatio,
  segments,
  onSeek,
}) {
  if (duration <= 0) {
    return null
  }

  const playheadPercent = (currentTime / duration) * 100
  const viewportLeft = viewportStart * 100
  const viewportWidth = Math.max(viewportRatio * 100, 1.5)

  function seekFromEvent(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    onSeek(ratio * duration)
  }

  return (
    <div className="timeline-minimap">
      <div className="minimap-label">
        <span>Overview</span>
        <span className="muted">{formatTime(duration)} total</span>
      </div>
      <div className="minimap-track" onClick={seekFromEvent} role="slider" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={currentTime}>
        <div className="minimap-clips">
          {segments.map(({ shot, start }) => (
            <span
              key={shot.id}
              className={`minimap-clip ${shot.missingImage ? 'pending' : ''}`}
              style={{
                left: `${(start / duration) * 100}%`,
                width: `${Math.max((shot.duration / duration) * 100, 0.15)}%`,
              }}
              title={shot.name}
            />
          ))}
        </div>
        <div
          className="minimap-viewport"
          style={{ left: `${viewportLeft}%`, width: `${viewportWidth}%` }}
        />
        <div className="minimap-playhead" style={{ left: `${playheadPercent}%` }} />
      </div>
    </div>
  )
}
