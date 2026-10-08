import { formatTime } from '../constants'
import { formatMaxDuration } from '../platformTemplates'
import { formatTimecode } from '../utils/timeline'

function messageClass(message) {
  if (!message) {
    return ''
  }
  if (/failed|error|could not|not found|no valid|unknown/i.test(message)) {
    return 'status-message-error'
  }
  if (/saved|created|opened|imported|generated|complete|finished|added|applied|ready|spliced|limited|renamed|duplicated|split|cleared|removed|updated|workflow finished/i.test(message)) {
    return 'status-message-success'
  }
  return 'status-message-info'
}

export default function StatusBar({
  currentTime,
  duration,
  shotsCount,
  readyCount,
  missingCount,
  message,
  projectName = 'Untitled Project',
  exportWidth,
  exportHeight,
  exportFps,
  platformLabel,
  maxDuration,
  saving = false,
}) {
  const overLimit = maxDuration && duration > maxDuration

  return (
    <footer className="statusbar">
      <div className="status-group">
        <span className="status-label">Project</span>
        <span>{projectName}</span>
        {saving ? <span className="status-saving">Saving…</span> : null}
      </div>
      <span className="status-sep" />
      <div className="status-group">
        <span className="status-label">Format</span>
        <span className="status-accent">{platformLabel}</span>
        <span>{exportWidth}×{exportHeight}</span>
        <span>{exportFps} fps</span>
      </div>
      <span className="status-sep" />
      <div className="status-group">
        <span className="status-label">Timecode</span>
        <span className="status-accent">{formatTimecode(currentTime)} / {formatTimecode(duration)}</span>
        {maxDuration ? <span>{formatMaxDuration(maxDuration)}</span> : null}
        {overLimit ? <span className="status-warn">Over limit</span> : null}
      </div>
      <span className="status-sep" />
      <div className="status-group">
        <span>{shotsCount} clips</span>
        <span>{readyCount} ready</span>
        {missingCount > 0 ? <span className="status-warn">{missingCount} pending</span> : null}
        <span>{formatTime(duration)} total</span>
      </div>
      {message ? (
        <span
          className={`status-message ${messageClass(message)}`}
          role="status"
          aria-live="polite"
        >
          {message}
        </span>
      ) : null}
    </footer>
  )
}
