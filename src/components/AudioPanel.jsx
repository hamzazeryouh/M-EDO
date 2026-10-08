import { useMemo, useRef, useState } from 'react'
import { formatTime } from '../constants'
import { describeAudioMatch } from '../utils/matchShotsToAudio'
import { IconAudio, IconImport, IconPlay } from './Icons'

function MiniWaveform({ seed = 1 }) {
  const bars = useMemo(() => {
    const items = []
    let value = seed
    for (let index = 0; index < 16; index += 1) {
      value = (value * 9301 + 49297) % 233280
      items.push(18 + (value % 55))
    }
    return items
  }, [seed])

  return (
    <div className="mini-waveform" aria-hidden="true">
      {bars.map((height, index) => (
        <span key={index} style={{ height: `${height}%` }} />
      ))}
    </div>
  )
}

export default function AudioPanel({
  tracks,
  masterAudio,
  onAddTracks,
  onRemoveTrack,
  onMoveUp,
  onMoveDown,
  onSplice,
  onFitShots,
  onClearAll,
  dragFromIndex,
  dragOverIndex,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDrop,
  splicing,
  shotsCount = 0,
  sequenceDuration = 0,
  audioMatchMode = 'loopRandom',
  audioMatchShotDuration = 0,
  stylePresetId = 'documentary',
  onMatchSettingsChange,
}) {
  const inputRef = useRef(null)
  const [dragOverZone, setDragOverZone] = useState(false)

  const totalDuration = tracks.reduce((sum, track) => sum + track.duration, 0)

  function handleDropFiles(event) {
    event.preventDefault()
    setDragOverZone(false)
    if (event.dataTransfer.files?.length) {
      onAddTracks(event.dataTransfer.files)
    }
  }

  function previewTrack(src) {
    const audio = new Audio(src)
    audio.play().catch(() => {})
  }

  return (
    <section className="audio-panel">
      <ol className="audio-workflow-steps">
        <li className={tracks.length > 0 ? 'done' : 'active'}>
          <span className="step-num">1</span>
          <span>Import files</span>
        </li>
        <li className={tracks.length > 1 ? 'done' : tracks.length === 1 ? 'active' : ''}>
          <span className="step-num">2</span>
          <span>Set order</span>
        </li>
        <li className={masterAudio ? 'done' : tracks.length > 0 ? 'active' : ''}>
          <span className="step-num">3</span>
          <span>Splice master</span>
        </li>
      </ol>

      <div
        className={`audio-dropzone ${dragOverZone ? 'active' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          setDragOverZone(true)
        }}
        onDragLeave={() => setDragOverZone(false)}
        onDrop={handleDropFiles}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div className="dropzone-icon">
          <IconAudio size={28} />
        </div>
        <div className="dropzone-copy">
          <strong>Drop audio files here</strong>
          <span className="muted">or click to browse</span>
        </div>
        <div className="dropzone-formats">
          <span>MP3</span>
          <span>WAV</span>
          <span>M4A</span>
          <span>AAC</span>
          <span>OGG</span>
        </div>
        <button
          type="button"
          className="dropzone-btn accent"
          onClick={(event) => {
            event.stopPropagation()
            inputRef.current?.click()
          }}
        >
          <IconImport size={16} />
          Import audio
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg"
        multiple
        hidden
        onChange={(event) => {
          if (event.target.files) {
            onAddTracks(event.target.files)
          }
          event.target.value = ''
        }}
      />

      <div className="audio-stats-row">
        <div className="audio-stat-card">
          <span className="stat-label">Queue</span>
          <strong>{tracks.length}</strong>
          <span className="muted">file{tracks.length === 1 ? '' : 's'}</span>
        </div>
        <div className="audio-stat-card">
          <span className="stat-label">Length</span>
          <strong>{formatTime(totalDuration)}</strong>
          <span className="muted">splice order</span>
        </div>
        <div className={`audio-stat-card ${masterAudio ? 'ready' : ''}`}>
          <span className="stat-label">Master</span>
          <strong>{masterAudio ? 'Ready' : '—'}</strong>
          <span className="muted">{masterAudio ? formatTime(masterAudio.duration) : 'not built'}</span>
        </div>
      </div>

      <div className="audio-panel-actions">
        <button
          type="button"
          className="audio-splice-btn primary"
          disabled={tracks.length === 0 || splicing}
          onClick={onSplice}
        >
          {splicing ? 'Splicing…' : `Splice ${tracks.length} file${tracks.length === 1 ? '' : 's'} into master`}
        </button>
        <button type="button" className="tool-btn" disabled={!masterAudio || shotsCount === 0} onClick={onFitShots}>
          {audioMatchMode === 'stretch' ? 'Stretch shots to audio' : 'Loop & mix to audio'}
        </button>
        {tracks.length > 0 ? (
          <button type="button" className="tool-btn danger-text" onClick={onClearAll}>
            Clear queue
          </button>
        ) : null}
      </div>

      {masterAudio && shotsCount > 0 ? (
        <div className="audio-match-card">
          <span className="panel-kicker">Long audio sync</span>
          <label className="tool-field">
            <span>Match mode</span>
            <select
              value={audioMatchMode}
              onChange={(event) => onMatchSettingsChange?.({ audioMatchMode: event.target.value })}
            >
              <option value="loopRandom">Loop images + random mix</option>
              <option value="stretch">Stretch existing shots</option>
            </select>
          </label>
          <label className="tool-field">
            <span>Seconds per image</span>
            <input
              type="number"
              min="0"
              max="30"
              step="0.5"
              value={audioMatchShotDuration}
              title="0 = use style preset duration"
              onChange={(event) => onMatchSettingsChange?.({ audioMatchShotDuration: Number(event.target.value) })}
            />
          </label>
          <p className="hint audio-match-hint">
            {describeAudioMatch(
              Array.from({ length: shotsCount }, (_, index) => ({ duration: sequenceDuration / Math.max(shotsCount, 1), id: index })),
              masterAudio.duration,
              { mode: audioMatchMode, perShotDuration: audioMatchShotDuration, stylePresetId },
            )}
          </p>
        </div>
      ) : null}

      {masterAudio ? (
        <div className="master-audio-banner">
          <div className="master-banner-head">
            <span className="master-badge">A1 Master</span>
            <strong>{masterAudio.name}</strong>
          </div>
          <MiniWaveform seed={99} />
          <div className="master-banner-meta">
            <span>{formatTime(masterAudio.duration)}</span>
            <span className="muted">Timeline mix track</span>
          </div>
        </div>
      ) : null}

      {tracks.length === 0 ? (
        <div className="audio-empty">
          <IconAudio size={22} />
          <p>No audio in queue yet.</p>
          <span className="muted">Import narration, music, or voice clips — then splice into one master track.</span>
        </div>
      ) : (
        <div className="audio-tracks-section">
          <div className="audio-section-head">
            <strong>Import queue</strong>
            <span className="muted">{tracks.length} items · {formatTime(totalDuration)}</span>
          </div>

          <div className="audio-list-header">
            <span aria-hidden="true" />
            <span>#</span>
            <span>File</span>
            <span>Duration</span>
            <span>Actions</span>
          </div>

          <ol className="audio-track-list">
            {tracks.map((track, index) => (
              <li
                key={track.id}
                className={`audio-track-item ${dragFromIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drop-target' : ''}`}
                onDragEnter={() => onDragEnter(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  onDrop(index)
                }}
              >
                <button
                  type="button"
                  className="audio-drag-handle"
                  draggable
                  aria-label={`Reorder ${track.name}`}
                  onDragStart={() => onDragStart(index)}
                  onDragEnd={onDragEnd}
                >
                  ⋮⋮
                </button>
                <span className="track-index">{index + 1}</span>
                <div className="track-main">
                  <span className="track-name" title={track.name}>{track.name}</span>
                  <MiniWaveform seed={index + track.name.length} />
                </div>
                <span className="track-duration">{formatTime(track.duration)}</span>
                <div className="track-actions">
                  <button type="button" className="icon-btn" title="Move up" disabled={index === 0} onClick={() => onMoveUp(index)}>↑</button>
                  <button type="button" className="icon-btn" title="Move down" disabled={index === tracks.length - 1} onClick={() => onMoveDown(index)}>↓</button>
                  <button type="button" className="icon-btn" title="Preview" onClick={() => previewTrack(track.src)}>
                    <IconPlay size={14} />
                  </button>
                  <button type="button" className="icon-btn danger" aria-label={`Remove ${track.name}`} onClick={() => onRemoveTrack(track.id)}>×</button>
                </div>
              </li>
            ))}
          </ol>

          <p className="hint audio-queue-hint">
            Drag ⋮⋮ to reorder · top to bottom = splice order · then click Splice into master
          </p>
        </div>
      )}
    </section>
  )
}
