import { useMemo, useState } from 'react'
import { formatTime, PRESETS } from '../constants'
import { getPlatformTemplate, PLATFORM_TEMPLATES } from '../platformTemplates'
import { TTS_PROVIDERS } from '../providers'
import { COST_MODES, estimateWorkflowCost, formatCost } from '../utils/costMode'
import { applyProductionDefaults, describeProductionSettings } from '../utils/productionDefaults'
import { calculateShotCount } from '../utils/scriptGenerator'
import { diagnoseWorkflowSteps, summarizeWorkflowIssues } from '../utils/workflowDiagnostics'
import MaxImagesInput from './MaxImagesInput'
import {
  applyWorkflowPreset,
  getEnabledWorkflowSteps,
  getWorkflowDef,
  syncStepsFromWorkflow,
  WORKFLOW_PRESETS,
} from '../utils/workflowSteps'
import WorkflowFlowEditor from './WorkflowFlowEditor'

const FEATURED_FLOWS = [
  { id: 'fullVideo', highlight: true },
  { id: 'vikingFull', highlight: false },
  { id: 'voiceOnly', highlight: false },
  { id: 'minimalCost', highlight: false },
]

const LANGUAGE_OPTIONS = [
  { id: 'ar', label: 'Arabic' },
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'French' },
]

export default function WorkflowStudio({
  settings,
  onChange,
  onSaveSettings,
  onRunAgent,
  onStopAgent,
  onRequestCostMode,
  running,
  progress,
  logs,
  activeStepId,
  completedStepIds,
  projectName,
  shots = [],
  shotsCount,
  readyCount,
  missingCount,
  shotsWithVoice,
  audioCount,
  sequenceDuration,
  masterAudio,
  onApplyProductionDefaults,
}) {
  const [logOpen, setLogOpen] = useState(true)
  const production = describeProductionSettings(settings)
  const platform = getPlatformTemplate(settings.platformTemplateId)
  const enabledSteps = useMemo(() => getEnabledWorkflowSteps(settings), [settings.workflow])
  const diagnostics = useMemo(
    () => diagnoseWorkflowSteps(settings, {
      shots,
      readyCount,
      missingCount,
      shotsWithVoice,
      audioCount,
      masterAudio,
    }),
    [settings, shots, readyCount, missingCount, shotsWithVoice, audioCount, masterAudio],
  )
  const stepStatus = useMemo(
    () => Object.fromEntries(diagnostics.map((item) => [item.stepId, item])),
    [diagnostics],
  )
  const summary = useMemo(() => summarizeWorkflowIssues(diagnostics), [diagnostics])
  const costEstimate = useMemo(
    () => estimateWorkflowCost(settings, { shotsCount: shotsCount || calculateShotCount(settings) }),
    [settings, shotsCount],
  )
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100)

  function patchSettings(partial) {
    const next = { ...settings, ...partial }
    onChange(next)
    onSaveSettings?.()
  }

  function applyPreset(presetId) {
    const workflow = applyWorkflowPreset(presetId)
    patchSettings({
      workflow,
      steps: syncStepsFromWorkflow(workflow),
      useAiPlan: workflow.some((item) => item.id === 'aiPlan' && item.enabled),
    })
  }

  function applyProduction() {
    const next = applyProductionDefaults(settings, { workflowPreset: 'fullVideo' })
    onChange(next)
    onSaveSettings?.()
    onApplyProductionDefaults?.(next)
  }

  const canRun = summary.ready.length > 0

  return (
    <section className="workflow-studio workflow-studio-simple">
      <header className="studio-run-bar">
        <div>
          <h2>Workflow Studio</h2>
          <p className="muted">{projectName} · {shotsCount} shots · {formatCost(costEstimate.total)} est.</p>
        </div>
        <button
          type="button"
          className={running ? 'agent-run-btn agent-stop-btn' : 'agent-run-btn primary'}
          disabled={!running && !canRun}
          onClick={running ? onStopAgent : onRunAgent}
        >
          {running ? 'Stop agent' : `Run ${enabledSteps.length} steps`}
        </button>
      </header>

      {(running || progress > 0) ? (
        <div className="studio-progress-wrap">
          <div className="project-progress-bar" role="progressbar" aria-valuenow={pct}>
            <div className="project-progress-bar-fill workflow" style={{ width: `${pct}%` }} />
          </div>
          {activeStepId ? (
            <p className="hint studio-active-step">
              Now: <strong>{getWorkflowDef(activeStepId)?.label}</strong>
            </p>
          ) : null}
        </div>
      ) : null}

      {summary.blocked.length > 0 && !running ? (
        <p className="studio-alert">{summary.blocked.length} step(s) need API keys or project data — see status pills below.</p>
      ) : null}

      <section className="studio-panel">
        <h3 className="studio-panel-title">1 · Configuration</h3>
        <div className="studio-config-grid">
          <label className="studio-field">
            <span>Language</span>
            <select value={settings.scriptLanguage} onChange={(e) => patchSettings({ scriptLanguage: e.target.value })}>
              {LANGUAGE_OPTIONS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="studio-field">
            <span>Speech</span>
            <select value={settings.ttsProvider} onChange={(e) => patchSettings({ ttsProvider: e.target.value })}>
              {TTS_PROVIDERS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="studio-field">
            <span>Video format</span>
            <select value={settings.platformTemplateId} onChange={(e) => patchSettings({ platformTemplateId: e.target.value })}>
              {PLATFORM_TEMPLATES.filter((t) => ['youtube', 'social'].includes(t.group)).map((item) => (
                <option key={item.id} value={item.id}>{item.label} ({item.width}×{item.height})</option>
              ))}
            </select>
          </label>
          <label className="studio-field">
            <span>Style</span>
            <select value={settings.stylePresetId} onChange={(e) => patchSettings({ stylePresetId: e.target.value })}>
              {PRESETS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="studio-field">
            <span>Max shots</span>
            <input
              type="number"
              min="0"
              max="999"
              value={settings.maxShots ?? 0}
              onChange={(e) => patchSettings({ maxShots: Number(e.target.value) || 0 })}
            />
            <span className="hint">0 = all</span>
          </label>
          <label className="studio-field">
            <span>Max images</span>
            <MaxImagesInput
              value={settings.maxImages ?? 20}
              disabled={running}
              onCommit={(next) => {
                const updated = { ...settings, maxImages: next }
                onChange(updated)
                onSaveSettings?.(updated)
              }}
            />
          </label>
          <label className="studio-field">
            <span>Cost mode</span>
            <select
              value={settings.costMode ?? 'quality'}
              disabled={running}
              onChange={(event) => onRequestCostMode?.(event.target.value)}
            >
              {Object.values(COST_MODES).map((mode) => (
                <option key={mode.id} value={mode.id}>{mode.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="studio-config-summary">
          <span>{production.language}</span>
          <span>{production.tts}</span>
          <span>{platform.label}</span>
          <span>{production.imageModel} {production.imageSize}</span>
          <button type="button" className="tool-btn accent" disabled={running} onClick={applyProduction}>
            Apply Arabic + OpenAI
          </button>
        </div>
        <div className="studio-readiness">
          <span>Images {readyCount}/{shotsCount}</span>
          <span>Voice {shotsWithVoice}/{shotsCount}</span>
          <span>Audio {audioCount}</span>
          {missingCount > 0 ? <span className="studio-warn">{missingCount} images pending</span> : null}
        </div>
      </section>

      <section className="studio-panel">
        <h3 className="studio-panel-title">2 · Choose a flow</h3>
        <div className="studio-flow-cards">
          {FEATURED_FLOWS.map(({ id, highlight }) => {
            const preset = WORKFLOW_PRESETS[id]
            if (!preset) {
              return null
            }
            return (
              <button
                key={id}
                type="button"
                className={`studio-flow-card ${highlight ? 'featured' : ''}`}
                disabled={running}
                onClick={() => applyPreset(id)}
              >
                <strong>{preset.label}</strong>
                <span className="muted">{preset.description}</span>
                <span className="studio-flow-steps">{preset.steps.length} steps</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="studio-panel">
        <h3 className="studio-panel-title">3 · Order &amp; steps</h3>
        <WorkflowFlowEditor
          settings={settings}
          onChange={onChange}
          onSaveSettings={onSaveSettings}
          running={running}
          activeStepId={activeStepId}
          completedStepIds={completedStepIds}
          stepStatus={stepStatus}
        />
      </section>

      <section className="studio-panel studio-log-panel">
        <button type="button" className="studio-log-toggle" onClick={() => setLogOpen((v) => !v)}>
          <h3 className="studio-panel-title">Run log {logs.length ? `(${logs.length})` : ''}</h3>
          <span>{logOpen ? 'Hide' : 'Show'}</span>
        </button>
        {logOpen ? (
          logs.length > 0 ? (
            <ol className="workflow-studio-log">
              {logs.map((entry, index) => (
                <li
                  key={`${index}-${entry.slice(0, 24)}`}
                  className={entry.startsWith('✓') ? 'ok' : entry.startsWith('✗') ? 'err' : entry.startsWith('ℹ') ? 'info' : ''}
                >
                  {entry}
                </li>
              ))}
            </ol>
          ) : (
            <p className="hint">Run the workflow to see step-by-step output here.</p>
          )
        ) : null}
      </section>
    </section>
  )
}
