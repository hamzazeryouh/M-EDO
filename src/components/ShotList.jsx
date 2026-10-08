import { animationLabel, formatTime, transitionLabel } from '../constants'

export default function ShotList({
  shots,
  selectedId,
  onSelect,
  onRemove,
  dragFromIndex,
  dragOverIndex,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDrop,
  onContextMenu,
}) {
  if (shots.length === 0) {
    return (
      <div className="empty-shots">
        <p>No images yet.</p>
        <p className="muted">Korea project auto-loads on start, or upload images manually.</p>
      </div>
    )
  }

  return (
    <>
      <div className="bin-list-header">
        <span>#</span>
        <span>Clip</span>
        <span>Duration</span>
      </div>
      <ol className="shot-list">
      {shots.map((shot, index) => (
        <li
          key={shot.id}
          className={`shot-item ${selectedId === shot.id ? 'selected' : ''} ${dragFromIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drop-target' : ''}`}
          draggable
          onDragStart={() => onDragStart(index)}
          onDragEnd={onDragEnd}
          onDragEnter={() => onDragEnter(index)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            onDrop(index)
          }}
          onContextMenu={(event) => onContextMenu?.(event, shot.id)}
        >
          <button type="button" className="shot-select" onClick={() => onSelect(shot.id)}>
            <span className="shot-index">{index + 1}</span>
            {shot.missingImage ? (
              <span className="thumb-missing" aria-hidden="true">?</span>
            ) : (
              <img src={shot.src} alt={shot.name} />
            )}
            <span className="shot-meta">
              <strong>{shot.name}</strong>
              <span>
                {formatTime(shot.duration)} · {animationLabel(shot.animation)}
                {index < shots.length - 1 ? ` → ${transitionLabel(shot.transition)}` : ''}
                {shot.missingImage ? ' · pending' : ''}
                {shot.audioSrc ? ' · audio' : ''}
              </span>
            </span>
          </button>
          <button
            type="button"
            className="icon-button danger"
            aria-label={`Remove ${shot.name}`}
            onClick={() => onRemove(shot.id)}
          >
            ×
          </button>
        </li>
      ))}
    </ol>
    </>
  )
}
