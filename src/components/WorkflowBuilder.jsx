import { useMemo, useState } from 'react'
import {
  WORKFLOW_PRESETS,
  WORKFLOW_STEP_DEFS,
  applyWorkflowPreset,
  getWorkflowDef,
  insertWorkflowStep,
  normalizeWorkflow,
  removeWorkflowStep,
  reorderWorkflow,
  syncStepsFromWorkflow,
  toggleWorkflowStep,
} from '../utils/workflowSteps'

function StepIcon({ stepId }) {
  const icons = {
    generateScript: '✎',
    generateImages: '▣',
    limitShots: '✂',
    applyTemplate: '▭',
    fitTargetDuration: '⏱',
    aiPlan: '◈',
    generateNarration: '✎',
    generateTts: '♫',
    spliceMaster: '⊞',
    fitToAudio: '⇄',
    exportVideo: '⬇',
  }
  return <span className="workflow-step-icon">{icons[stepId] ?? '•'}</span>
}

export default function WorkflowBuilder({
  settings,
  onChange,
  onSaveSettings,
  running = false,
  activeStepId = null,
  completedStepIds = [],
}) {
  const workflow = useMemo(() => normalizeWorkflow(settings.workflow), [settings.workflow])
  const [dragFromIndex, setDragFromIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [paletteDragId, setPaletteDragId] = useState(null)

  const paletteSteps = useMemo(
    () => Object.values(WORKFLOW_STEP_DEFS).filter((def) => !workflow.some((item) => item.id === def.id)),
    [workflow],
  )

  function commitWorkflow(nextWorkflow) {
    onChange({
      ...settings,
      workflow: nextWorkflow,
      steps: syncStepsFromWorkflow(nextWorkflow),
      useAiPlan: nextWorkflow.some((item) => item.id === 'aiPlan' && item.enabled),
    })
  }

  function applyPreset(presetId) {
    const nextWorkflow = applyWorkflowPreset(presetId)
    commitWorkflow(nextWorkflow)
    onSaveSettings()
  }

  function handleDrop(toIndex) {
    if (paletteDragId) {
      commitWorkflow(insertWorkflowStep(workflow, paletteDragId, toIndex))
      onSaveSettings()
    } else if (dragFromIndex !== null && dragFromIndex !== toIndex) {
      commitWorkflow(reorderWorkflow(workflow, dragFromIndex, toIndex))
      onSaveSettings()
    }
    setDragFromIndex(null)
    setDragOverIndex(null)
    setPaletteDragId(null)
  }

  return (
    <div className="workflow-builder">
      <div className="workflow-builder-head">
        <div>
          <span className="panel-kicker">Automation workflow</span>
          <strong>Drag & drop steps</strong>
        </div>
        <span className="muted workflow-step-count">{workflow.filter((item) => item.enabled).length} active</span>
      </div>

      <div className="workflow-presets">
        {Object.values(WORKFLOW_PRESETS).map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="workflow-preset-btn"
            disabled={running}
            title={preset.description}
            onClick={() => applyPreset(preset.id)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div
        className={`workflow-lane ${running ? 'running' : ''}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => handleDrop(workflow.length)}
      >
        {workflow.length === 0 ? (
          <div className="workflow-empty">Drag steps here to build your pipeline</div>
        ) : null}

        {workflow.map((item, index) => {
          const def = getWorkflowDef(item.id)
          const isActive = running && activeStepId === item.id
          const isDone = completedStepIds.includes(item.id)
          const isDropBefore = dragOverIndex === index && (paletteDragId || dragFromIndex !== null)

          return (
            <div key={`${item.id}-${index}`} className="workflow-node-wrap">
              {isDropBefore ? <div className="workflow-drop-indicator" /> : null}
              <article
                className={`workflow-node ${item.enabled ? '' : 'disabled'} ${isActive ? 'active' : ''} ${isDone ? 'done' : ''} ${dragFromIndex === index ? 'dragging' : ''}`}
                draggable={!running}
                onDragStart={() => setDragFromIndex(index)}
                onDragEnd={() => {
                  setDragFromIndex(null)
                  setDragOverIndex(null)
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragOverIndex(index)
                }}
                onDrop={(event) => {
                  event.stopPropagation()
                  handleDrop(index)
                }}
              >
                <div className="workflow-node-main">
                  <button type="button" className="workflow-drag-handle" title="Drag to reorder" tabIndex={-1}>
                    ⋮⋮
                  </button>
                  <StepIcon stepId={item.id} />
                  <div className="workflow-node-copy">
                    <strong>{def?.label ?? item.id}</strong>
                    <span className="muted">{def?.description}</span>
                  </div>
                  <label className="workflow-toggle" title={item.enabled ? 'Disable step' : 'Enable step'}>
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      disabled={running}
                      onChange={(event) => {
                        commitWorkflow(toggleWorkflowStep(workflow, index, event.target.checked))
                        onSaveSettings()
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="workflow-remove-btn"
                    disabled={running}
                    title="Remove from workflow"
                    onClick={() => {
                      commitWorkflow(removeWorkflowStep(workflow, index))
                      onSaveSettings()
                    }}
                  >
                    ×
                  </button>
                </div>
                {index < workflow.length - 1 ? <div className="workflow-connector" aria-hidden /> : null}
              </article>
            </div>
          )
        })}

        <div
          className={`workflow-drop-zone ${paletteDragId || dragFromIndex !== null ? 'ready' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setDragOverIndex(workflow.length)
          }}
          onDrop={(event) => {
            event.stopPropagation()
            handleDrop(workflow.length)
          }}
        >
          Drop step here
        </div>
      </div>

      {paletteSteps.length > 0 ? (
        <div className="workflow-palette">
          <span className="panel-kicker">Step library</span>
          <div className="workflow-palette-grid">
            {paletteSteps.map((def) => (
              <button
                key={def.id}
                type="button"
                className="workflow-palette-item"
                draggable={!running}
                disabled={running}
                title={def.description}
                onDragStart={() => setPaletteDragId(def.id)}
                onDragEnd={() => setPaletteDragId(null)}
                onClick={() => {
                  commitWorkflow(insertWorkflowStep(workflow, def.id))
                  onSaveSettings()
                }}
              >
                <StepIcon stepId={def.id} />
                <span>{def.shortLabel ?? def.label}</span>
              </button>
            ))}
          </div>
          <p className="hint workflow-palette-hint">Drag into the workflow or click to append.</p>
        </div>
      ) : null}
    </div>
  )
}
