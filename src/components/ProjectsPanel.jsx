import { useEffect, useMemo, useState } from 'react'
import { formatTime } from '../constants'
import { formatProjectDate } from '../utils/projectStore'
import { getWorkflowDef } from '../utils/workflowSteps'
import { IconDuplicate, IconFolder } from './Icons'

function ProgressBar({ value, label }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <div className="project-progress-bar-wrap">
      <div className="project-progress-bar-head">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="project-progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="project-progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ReadinessSection({ shotsCount, readyCount, missingCount, shotsWithVoice, audioCount }) {
  const imagePct = shotsCount > 0 ? readyCount / shotsCount : 0
  const voicePct = shotsCount > 0 ? shotsWithVoice / shotsCount : 0
  const audioPct = shotsWithVoice > 0 ? audioCount / shotsWithVoice : shotsCount > 0 ? audioCount / shotsCount : 0
  const overall = shotsCount > 0
    ? (imagePct + voicePct + audioPct) / 3
    : 0

  return (
    <div className="project-readiness">
      <div className="project-readiness-head">
        <span className="panel-kicker">Sequence</span>
        <strong>{Math.round(overall * 100)}% ready</strong>
      </div>
      <ProgressBar value={imagePct} label={`Images ${readyCount}/${shotsCount}`} />
      <ProgressBar value={voicePct} label={`Narration ${shotsWithVoice}/${shotsCount}`} />
      <ProgressBar value={audioPct} label={`Audio ${audioCount}/${shotsWithVoice || shotsCount}`} />
      {missingCount > 0 ? (
        <p className="hint project-missing-line">
          {missingCount} images are still placeholders. Generate them in Studio after adding an image API key.
        </p>
      ) : null}
    </div>
  )
}

function RunProgressSection({
  running,
  progress,
  logs,
  activeStepId,
  completedStepIds,
  workflowSteps,
  onRunAgent,
  onStopAgent,
}) {
  const activeDef = activeStepId ? getWorkflowDef(activeStepId) : null
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100)
  const lastLog = logs.length > 0 ? logs[logs.length - 1] : null
  const finishedOk = !running && progress >= 1 && logs.some((entry) => entry.includes('Done'))
  const showDetail = running || progress > 0 || logs.length > 0

  return (
    <div className={`project-run-section ${running ? 'running' : ''} ${finishedOk ? 'done' : ''}`}>
      <div className="project-run-head">
        <span className="panel-kicker">Workflow</span>
        {running ? (
          <span className="projects-saving-badge">Running {pct}%</span>
        ) : finishedOk ? (
          <span className="projects-done-badge">Complete</span>
        ) : null}
      </div>

      <button
        type="button"
        className={running ? 'agent-run-btn agent-stop-btn project-run-btn' : 'primary project-run-btn'}
        onClick={running ? onStopAgent : onRunAgent}
      >
        {running ? 'Stop workflow' : finishedOk ? 'Run again' : 'Run workflow'}
      </button>

      {showDetail ? (
        <>
          <div className="project-progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="project-progress-bar-fill workflow" style={{ width: `${pct}%` }} />
          </div>
          {activeDef ? (
            <p className="project-run-active">
              Now: <strong>{activeDef.label}</strong>
            </p>
          ) : null}
          {workflowSteps.length > 0 ? (
            <ul className="project-workflow-steps">
              {workflowSteps.map((stepId) => {
                const def = getWorkflowDef(stepId)
                const done = completedStepIds.includes(stepId)
                const active = activeStepId === stepId
                return (
                  <li key={stepId} className={done ? 'done' : active ? 'active' : ''}>
                    <span className="project-step-dot" />
                    <span>{def?.shortLabel ?? stepId}</span>
                  </li>
                )
              })}
            </ul>
          ) : null}
          {lastLog ? <p className="hint project-run-last">{lastLog}</p> : null}
        </>
      ) : (
        <p className="hint project-run-hint">Script, images, speech, then export.</p>
      )}
    </div>
  )
}

function ProjectList({
  projects,
  activeProjectId,
  confirmDeleteId,
  setConfirmDeleteId,
  onSelectProject,
  onDeleteProject,
}) {
  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    [projects],
  )
  const duplicateNames = useMemo(() => {
    const counts = new Map()
    for (const project of projects) {
      counts.set(project.name, (counts.get(project.name) ?? 0) + 1)
    }
    return counts
  }, [projects])

  if (sortedProjects.length === 0) {
    return <p className="hint projects-empty">No saved projects yet. Create one to get started.</p>
  }

  return (
    <ul className="projects-list">
      {sortedProjects.map((project) => {
        const isActive = project.id === activeProjectId
        const confirming = confirmDeleteId === project.id
        const sharedName = (duplicateNames.get(project.name) ?? 0) > 1
        return (
          <li key={project.id} className={`projects-list-item ${isActive ? 'active' : ''} ${confirming ? 'confirming' : ''}`}>
            <button
              type="button"
              className="projects-list-main"
              onClick={() => onSelectProject(project.id)}
            >
              <strong>{project.name}</strong>
              <span className="muted">
                {project.shotCount} shots · {formatProjectDate(project.updatedAt)}
                {sharedName ? ` · ${project.id.slice(0, 4)}` : ''}
              </span>
            </button>
            <div className="projects-list-actions">
              {confirming ? (
                <>
                  <button type="button" className="tool-btn danger-text" onClick={() => onDeleteProject(project.id)}>
                    Delete
                  </button>
                  <button type="button" className="tool-btn" onClick={() => setConfirmDeleteId(null)}>
                    Keep
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="icon-btn project-delete-btn"
                  title="Delete project"
                  aria-label={`Delete ${project.name}`}
                  onClick={() => setConfirmDeleteId(project.id)}
                >
                  ×
                </button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default function ProjectsPanel({
  projects,
  activeProjectId,
  projectName,
  shotsCount,
  sequenceDuration,
  readyCount = 0,
  missingCount = 0,
  shotsWithVoice = 0,
  audioCount = 0,
  saving,
  running = false,
  progress = 0,
  logs = [],
  activeStepId = null,
  completedStepIds = [],
  workflowSteps = [],
  onSelectProject,
  onCreateEmpty,
  onDuplicateActive,
  onRenameActive,
  onDeleteProject,
  onSaveNow,
  onRunAgent,
  onStopAgent,
  focusMode = false,
}) {
  const [renameValue, setRenameValue] = useState(projectName)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  useEffect(() => {
    setRenameValue(projectName)
  }, [projectName])

  function commitRename() {
    const nextName = renameValue.trim()
    if (!nextName || nextName === projectName) {
      setRenameValue(projectName)
      return
    }
    onRenameActive(nextName)
  }

  return (
    <section className={`projects-panel ${focusMode ? 'focus-mode' : ''}`}>
      <div className="projects-toolbar">
        <button type="button" className="tool-btn accent" onClick={onCreateEmpty}>
          New
        </button>
        <button type="button" className="tool-btn" disabled={!activeProjectId} onClick={onDuplicateActive}>
          <IconDuplicate size={14} />
          Duplicate
        </button>
        <button type="button" className="tool-btn" onClick={onSaveNow}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="projects-workspace">
        <div className="projects-library">
          <div className="projects-library-head">
            <span className="panel-kicker">Library</span>
            <span className="muted">{projects.length} saved</span>
          </div>
          <ProjectList
            projects={projects}
            activeProjectId={activeProjectId}
            confirmDeleteId={confirmDeleteId}
            setConfirmDeleteId={setConfirmDeleteId}
            onSelectProject={onSelectProject}
            onDeleteProject={onDeleteProject}
          />
        </div>

        <div className="projects-inspector">
          <form
            className="projects-sequence-card"
            onSubmit={(event) => {
              event.preventDefault()
              event.currentTarget.querySelector('input')?.blur()
            }}
          >
            <div className="projects-sequence-icon">
              <IconFolder size={18} />
            </div>
            <div className="projects-sequence-copy">
              <label className="tool-field projects-rename-field">
                <span>Sequence</span>
                <input
                  type="text"
                  value={renameValue}
                  aria-label="Active project name"
                  onChange={(event) => setRenameValue(event.target.value)}
                  onBlur={commitRename}
                />
              </label>
              <p className="muted">
                {shotsCount} shots · {formatTime(sequenceDuration)}
              </p>
            </div>
          </form>

          <div className="audio-stats-row">
            <div className="audio-stat-card">
              <span className="stat-label">Shots</span>
              <strong>{shotsCount}</strong>
              <span className="muted">timeline</span>
            </div>
            <div className="audio-stat-card">
              <span className="stat-label">Length</span>
              <strong>{formatTime(sequenceDuration)}</strong>
              <span className="muted">sequence</span>
            </div>
            <div className={`audio-stat-card ${missingCount === 0 && shotsCount > 0 ? 'ready' : ''}`}>
              <span className="stat-label">Images</span>
              <strong>{readyCount}/{shotsCount}</strong>
              <span className="muted">{missingCount > 0 ? `${missingCount} pending` : 'ready'}</span>
            </div>
          </div>

          <RunProgressSection
            running={running}
            progress={progress}
            logs={logs}
            activeStepId={activeStepId}
            completedStepIds={completedStepIds}
            workflowSteps={workflowSteps}
            onRunAgent={onRunAgent}
            onStopAgent={onStopAgent}
          />

          <ReadinessSection
            shotsCount={shotsCount}
            readyCount={readyCount}
            missingCount={missingCount}
            shotsWithVoice={shotsWithVoice}
            audioCount={audioCount}
          />

          <p className="hint projects-hint">
            Projects auto-save in this browser. Very large uploaded files may be skipped.
          </p>
        </div>
      </div>
    </section>
  )
}
