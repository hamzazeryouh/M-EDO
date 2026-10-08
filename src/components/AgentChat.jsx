import { useEffect, useRef, useState } from 'react'
import { getWorkflowDef, WORKFLOW_PRESETS } from '../utils/workflowSteps'
import MaxImagesInput from './MaxImagesInput'

const PIPELINE = [...WORKFLOW_PRESETS.fullCreate.steps, 'viewResult']
const EXAMPLES = [
  'A short Arabic documentary about daily life in a coastal city.',
  'The Viking Age, from Stamford Bridge to the battle of Hastings.',
  'A quiet night walk through a historic medina.',
]

function logClass(entry) {
  if (entry.startsWith('✓')) return 'ok'
  if (entry.startsWith('✗')) return 'err'
  if (entry.startsWith('ℹ') || entry.startsWith('→')) return 'info'
  return ''
}

function stepLabel(stepId) {
  if (stepId === 'viewResult') return 'View'
  return getWorkflowDef(stepId)?.shortLabel ?? stepId
}

export default function AgentChat({
  running,
  progress,
  activeStepId,
  completedStepIds,
  runs,
  onAccept,
  onStop,
  maxImages = 20,
  onMaxImagesChange,
  onShowEditor,
  onOpenMedia,
}) {
  const [draft, setDraft] = useState('')
  const threadRef = useRef(null)
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100)

  useEffect(() => {
    const node = threadRef.current
    if (!node) return
    if (runs.length === 0) {
      node.scrollTop = 0
      return
    }
    node.scrollTop = node.scrollHeight
  }, [runs, activeStepId])

  function submit(event) {
    event.preventDefault()
    const subject = draft.trim()
    if (!subject || running) return
    onAccept(subject)
    setDraft('')
  }

  return (
    <section className="agent-chat-page">
      <div className="agent-chat-thread" ref={threadRef}>
        {runs.length === 0 ? (
          <div className="agent-chat-stage">
            <p className="agent-chat-stage-kicker">Subject → finished video</p>
            <h2>Tell the agent the subject.</h2>
            <p className="agent-chat-stage-lead">
              It runs the whole path, then the video opens on this page.
            </p>
            <ol className="agent-chat-path" aria-label="Pipeline">
              {PIPELINE.map((stepId, index) => (
                <li key={stepId}>
                  <span>{index}</span>
                  {stepLabel(stepId)}
                </li>
              ))}
            </ol>
            <div className="agent-chat-examples">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="agent-chat-example"
                  onClick={() => setDraft(example)}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {runs.map((run) => {
          const live = run.status === 'running'
          const completed = live ? completedStepIds : run.completedStepIds ?? []
          const steps = [...run.steps, 'viewResult']
          return (
            <article key={run.id} className="agent-chat-run">
              <div className="agent-chat-bubble user">
                <p>{run.subject}</p>
              </div>

              <div className={`agent-chat-board ${live ? 'live' : ''} ${run.status}`}>
                <div className="agent-chat-board-head">
                  <strong>
                    {live ? 'Working' : run.status === 'stopped' ? 'Stopped' : run.status === 'error' ? 'Failed' : 'Finished'}
                  </strong>
                  <span>
                    {live ? `${pct}%` : null}
                    {run.imageProgress ? `${live ? ' · ' : ''}Images ${run.imageProgress.done}/${run.imageProgress.total}` : null}
                  </span>
                </div>
                {live ? (
                  <div className="agent-chat-meter" aria-hidden="true">
                    <span style={{ width: `${pct}%` }} />
                  </div>
                ) : null}
                <ol className="agent-chat-path compact">
                  {steps.map((stepId, index) => {
                    const done = stepId === 'viewResult' ? Boolean(run.result?.url) : completed.includes(stepId)
                    const active = live && activeStepId === stepId
                    return (
                      <li key={stepId} className={`${done ? 'done' : ''} ${active ? 'active' : ''}`}>
                        <span>{index}</span>
                        {stepLabel(stepId)}
                      </li>
                    )
                  })}
                </ol>
                {run.images?.length > 0 ? (
                  <div className="agent-chat-gallery">
                    <div className="agent-chat-gallery-head">
                      <strong>Generated images</strong>
                      <button type="button" className="tool-btn" onClick={onOpenMedia}>
                        Open Media
                      </button>
                    </div>
                    <div className="agent-chat-gallery-grid">
                      {run.images.map((image) => (
                        <figure key={image.id}>
                          <img src={image.src} alt={image.name} />
                          <figcaption>{image.name}</figcaption>
                        </figure>
                      ))}
                    </div>
                  </div>
                ) : null}
                {run.logs.length > 0 ? (
                  <ul className="agent-chat-log">
                    {run.logs.map((entry, index) => (
                      <li key={`${run.id}-log-${index}`} className={logClass(entry)}>{entry}</li>
                    ))}
                  </ul>
                ) : null}
              </div>

              {run.result?.url ? (
                <section className="agent-chat-result-page">
                  <header>
                    <span className="agent-chat-stage-kicker">Result</span>
                    <h3>{run.subject}</h3>
                  </header>
                  <video className="agent-chat-result-video" src={run.result.url} controls playsInline />
                  <div className="agent-chat-result-actions">
                    <a className="agent-run-btn primary" href={run.result.url} download={run.result.filename}>
                      Download
                    </a>
                    <button type="button" className="tool-btn" onClick={onShowEditor}>
                      Open in editor
                    </button>
                  </div>
                </section>
              ) : null}
            </article>
          )
        })}
      </div>

      <form className="agent-chat-composer" onSubmit={submit}>
        <textarea
          rows={2}
          value={draft}
          placeholder="Video subject…"
          disabled={running}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
        />
        <label className="agent-chat-max">
          <span>Max images</span>
          <MaxImagesInput
            value={maxImages}
            disabled={running}
            onCommit={(next) => onMaxImagesChange?.(next)}
          />
        </label>
        {running ? (
          <button type="button" className="agent-chat-stop" onClick={onStop}>
            Stop
          </button>
        ) : (
          <button type="submit" className="primary" disabled={!draft.trim()}>
            Accept
          </button>
        )}
      </form>
    </section>
  )
}
