import { useMemo } from 'react'
import {
  getWorkflowDef,
  insertWorkflowStep,
  normalizeWorkflow,
  removeWorkflowStep,
  reorderWorkflow,
  syncStepsFromWorkflow,
  toggleWorkflowStep,
  WORKFLOW_STEP_DEFS,
} from '../utils/workflowSteps'

const STEP_ICONS = {
  generateScript: '1',
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

export default function WorkflowFlowEditor({
  settings,
  onChange,
  onSaveSettings,
  running = false,
  activeStepId = null,
  completedStepIds = [],
  stepStatus = {},
}) {
  const workflow = useMemo(() => normalizeWorkflow(settings.workflow), [settings.workflow])
  const availableSteps = useMemo(
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

  function moveStep(index, direction) {
    const target = index + direction
    if (target < 0 || target >= workflow.length) {
      return
    }
    commitWorkflow(reorderWorkflow(workflow, index, target))
    onSaveSettings?.()
  }

  function addStep(stepId) {
    if (!stepId) {
      return
    }
    commitWorkflow(insertWorkflowStep(workflow, stepId))
    onSaveSettings?.()
  }

  function newCustomFlow() {
    commitWorkflow([])
    onSaveSettings?.()
  }

  return (
    <div className="flow-editor">
      <div className="flow-editor-toolbar">
        <span className="panel-kicker">Step order</span>
        <button type="button" className="tool-btn" disabled={running} onClick={newCustomFlow}>
          + New custom flow
        </button>
      </div>

      {workflow.length === 0 ? (
        <p className="hint flow-editor-empty">Empty flow — pick a template above or add steps below.</p>
      ) : (
        <ol className="flow-editor-list">
          {workflow.map((item, index) => {
            const def = getWorkflowDef(item.id)
            const status = stepStatus[item.id]
            const active = running && activeStepId === item.id
            const done = completedStepIds.includes(item.id)
            return (
              <li
                key={`${item.id}-${index}`}
                className={`flow-editor-item ${item.enabled ? '' : 'off'} ${active ? 'active' : ''} ${done ? 'done' : ''}`}
              >
                <span className="flow-editor-num">{index + 1}</span>
                <span className="flow-editor-icon">{STEP_ICONS[item.id] ?? '•'}</span>
                <div className="flow-editor-copy">
                  <strong>{def?.label ?? item.id}</strong>
                  <span className="muted">{status?.reason ?? def?.description}</span>
                </div>
                {status?.status ? (
                  <span className={`flow-status-pill ${status.status}`}>{status.status}</span>
                ) : null}
                <div className="flow-editor-actions">
                  <button type="button" className="flow-icon-btn" disabled={running || index === 0} title="Move up" onClick={() => moveStep(index, -1)}>↑</button>
                  <button type="button" className="flow-icon-btn" disabled={running || index === workflow.length - 1} title="Move down" onClick={() => moveStep(index, 1)}>↓</button>
                  <label className="flow-toggle" title={item.enabled ? 'Disable' : 'Enable'}>
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      disabled={running}
                      onChange={(event) => {
                        commitWorkflow(toggleWorkflowStep(workflow, index, event.target.checked))
                        onSaveSettings?.()
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="flow-icon-btn danger"
                    disabled={running}
                    title="Remove"
                    onClick={() => {
                      commitWorkflow(removeWorkflowStep(workflow, index))
                      onSaveSettings?.()
                    }}
                  >
                    ×
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {availableSteps.length > 0 ? (
        <label className="flow-add-step">
          <span>Add step</span>
          <select
            defaultValue=""
            disabled={running}
            onChange={(event) => {
              addStep(event.target.value)
              event.target.value = ''
            }}
          >
            <option value="">Choose a step…</option>
            {availableSteps.map((def) => (
              <option key={def.id} value={def.id}>{def.label}</option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  )
}
