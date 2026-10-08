import { useEffect, useState } from 'react'
import { formatTime } from '../constants'
import { useModalFocus } from '../hooks/useModalFocus'

function slugify(name) {
  return (name || 'video')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'video'
}

export default function ExportDialog({
  open,
  onClose,
  onExport,
  exporting,
  exportProgress,
  mp4Ready,
  shotsCount,
  sequenceDuration,
  projectName,
  platformLabel,
  exportWidth,
  exportHeight,
  exportFps,
}) {
  const dialogRef = useModalFocus(open, onClose)
  const [filename, setFilename] = useState('')
  const [shotLimit, setShotLimit] = useState('all')

  useEffect(() => {
    if (open) {
      setFilename(slugify(projectName))
      setShotLimit('all')
    }
  }, [open, projectName])

  if (!open) {
    return null
  }

  const limitedCount = shotLimit === 'all' ? shotsCount : Math.min(Number(shotLimit), shotsCount)
  const pct = Math.round(Math.max(0, Math.min(1, exportProgress)) * 100)

  function handleExport() {
    const safeName = filename.trim() || slugify(projectName)
    const maxShots = shotLimit === 'all' ? null : limitedCount
    onExport({ filename: safeName, maxShots })
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className="modal-card export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className="panel-kicker">Export</span>
        <h2 id="export-dialog-title">Export video</h2>
        <p className="export-dialog-summary">
          {platformLabel} · {exportWidth}×{exportHeight} · {exportFps} fps · {formatTime(sequenceDuration)} · {limitedCount} clip{limitedCount === 1 ? '' : 's'}
        </p>

        <label className="tool-field">
          <span>Filename</span>
          <div className="export-filename-row">
            <input
              type="text"
              value={filename}
              disabled={exporting}
              onChange={(event) => setFilename(event.target.value)}
              placeholder="my-video"
            />
            <span className="export-extension">.{mp4Ready ? 'mp4' : 'webm'}</span>
          </div>
        </label>

        <label className="tool-field">
          <span>Clips to include</span>
          <select value={shotLimit} disabled={exporting} onChange={(event) => setShotLimit(event.target.value)}>
            <option value="all">All clips ({shotsCount})</option>
            {import.meta.env.DEV && shotsCount > 8 ? <option value="8">First 8 clips (dev test)</option> : null}
            {shotsCount > 1 ? <option value="1">First clip only</option> : null}
          </select>
        </label>

        <p className="hint export-dialog-hint">
          {mp4Ready
            ? 'Exports H.264 MP4 with AAC audio when narration is present.'
            : 'MP4 requires Chrome/Edge with WebCodecs — this browser will download WebM instead.'}
        </p>

        {exporting ? (
          <div className="export-dialog-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="export-dialog-progress-fill" style={{ width: `${pct}%` }} />
            <span>Rendering… {pct}%</span>
          </div>
        ) : null}

        <div className="modal-actions">
          <button type="button" disabled={exporting} onClick={onClose}>Cancel</button>
          <button type="button" className="primary" disabled={exporting || shotsCount === 0} onClick={handleExport}>
            {exporting ? `Exporting ${pct}%` : 'Export'}
          </button>
        </div>
      </div>
    </div>
  )
}
