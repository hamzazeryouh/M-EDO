import { useMemo } from 'react'
import { PRESETS, formatTime } from '../constants'
import { getPlatformTemplate, getTemplatesByGroup } from '../platformTemplates'
import {
  DURATION_PRESETS,
  getTargetDurationSeconds,
} from '../utils/agentSettings'
import ProviderKeysPanel from './ProviderKeysPanel'
import WorkflowBuilder from './WorkflowBuilder'
import MaxImagesInput from './MaxImagesInput'
import { getAiProvider, getImageProvider, getTtsProvider } from '../providers'
import {
  COST_MODES,
  estimateWorkflowCost,
  formatCost,
  getCostSavingTips,
} from '../utils/costMode'
import { calculateShotCount } from '../utils/scriptGenerator'
import { applyWorkflowPreset, syncStepsFromWorkflow } from '../utils/workflowSteps'

export default function AgentPanel({
  settings,
  onChange,
  onSaveSettings,
  onRunAgent,
  onStopAgent,
  running,
  progress,
  logs,
  shotsCount,
  sequenceDuration,
  shotsWithVoice,
  activeStepId,
  completedStepIds,
  onRunVikingAutoTest,
  onRequestCostMode,
  loadingProject,
}) {
  const targetSeconds = useMemo(() => getTargetDurationSeconds(settings), [settings])
  const activeAi = getAiProvider(settings.aiProvider)
  const activeTts = getTtsProvider(settings.ttsProvider)
  const activeImage = getImageProvider(settings.imageProvider)
  const templateGroups = getTemplatesByGroup()
  const estimatedShots = calculateShotCount(settings)
  const perShot = shotsCount > 0 ? targetSeconds / shotsCount : targetSeconds / estimatedShots
  const platform = getPlatformTemplate(settings.platformTemplateId)
  const costEstimate = useMemo(
    () => estimateWorkflowCost(settings, { shotsCount: shotsCount || estimatedShots }),
    [settings, shotsCount, estimatedShots],
  )
  const costTips = useMemo(() => getCostSavingTips(settings), [settings])
  const activeCostMode = COST_MODES[settings.costMode] ?? COST_MODES.balanced

  function enableFullCreateMode() {
    onRequestCostMode?.('quality')
  }

  function selectCostMode(modeId) {
    onRequestCostMode?.(modeId)
  }

  function update(partial) {
    onChange({ ...settings, ...partial })
  }

  return (
    <section className="agent-panel">
      <div className="agent-hero">
        <div className="agent-hero-icon">AI</div>
        <div>
          <strong>AI Video Agent</strong>
          <p className="muted">Full pipeline: script → images → speech → shots → MP4 export.</p>
        </div>
      </div>

      <ProviderKeysPanel settings={settings} onChange={onChange} onSaveSettings={onSaveSettings} />

      <div className="agent-active-providers">
        <span className="muted">Script AI: <strong>{activeAi.label}</strong></span>
        <span className="muted">Images: <strong>{activeImage.label}</strong></span>
        <span className="muted">Speech: <strong>{activeTts.label}</strong></span>
      </div>

      <div className="agent-settings-card cost-mode-card">
        <span className="panel-kicker">Cost control</span>
        <div className="cost-mode-row">
          {Object.values(COST_MODES).map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`cost-mode-btn ${settings.costMode === mode.id ? 'active' : ''}`}
              title={mode.hint}
              onClick={() => selectCostMode(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <p className="hint agent-key-hint">{activeCostMode.hint}</p>
        <div className="cost-estimate">
          <strong>Estimated run: {formatCost(costEstimate.total)}</strong>
          <span className="muted">for {costEstimate.shots} shots · {costEstimate.enabled.length} workflow steps</span>
        </div>
        {costEstimate.breakdown.length > 0 ? (
          <ul className="cost-breakdown">
            {costEstimate.breakdown.map((item) => (
              <li key={item.label}>
                <span>{item.label}</span>
                <span>{formatCost(item.cost)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {costTips.length > 0 && settings.costMode !== 'minimal' ? (
          <div className="cost-tips">
            <span className="muted">Save more:</span>
            <ul>
              {costTips.slice(0, 3).map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="agent-settings-card viking-test-card">
        <span className="panel-kicker">Viking documentary test</span>
        <p className="hint agent-key-hint">
          299-shot Stamford Bridge → Hastings project with cinematic Viking visual style baked into every image prompt.
        </p>
        <button
          type="button"
          className="agent-run-btn primary"
          disabled={running || loadingProject}
          onClick={onRunVikingAutoTest}
        >
          {running ? 'Running…' : 'Auto-test Viking (10 shots → images → MP4)'}
        </button>
      </div>

      <div className="agent-settings-card">
        <div className="agent-card-head-row">
          <span className="panel-kicker">Video topic</span>
          <button type="button" className="tool-btn accent" onClick={enableFullCreateMode}>
            Full AI create
          </button>
        </div>
        <label className="tool-field agent-field">
          <span>Brief / topic</span>
          <textarea
            className="agent-brief-input"
            rows={4}
            value={settings.projectBrief}
            placeholder="Example: A 20-minute Arabic documentary about North Korea from the inside — daily life, quiet streets, and human stories."
            onChange={(event) => update({ projectBrief: event.target.value })}
            onBlur={() => onSaveSettings?.()}
          />
        </label>
        <div className="agent-duration-row">
          <label className="tool-field">
            <span>Narration language</span>
            <select
              value={settings.scriptLanguage}
              onChange={(event) => {
                update({ scriptLanguage: event.target.value })
                onSaveSettings()
              }}
            >
              <option value="ar">Arabic</option>
              <option value="en">English</option>
              <option value="fr">French</option>
            </select>
          </label>
          <label className="tool-field">
            <span>Script batch</span>
            <input
              type="number"
              min="4"
              max="20"
              value={settings.scriptBatchSize}
              title="Shots per AI script request"
              onChange={(event) => update({ scriptBatchSize: Number(event.target.value) })}
              onBlur={() => onSaveSettings?.()}
            />
          </label>
          <label className="tool-field">
            <span>Max images</span>
            <MaxImagesInput
              value={settings.maxImages ?? 20}
              onCommit={(next) => {
                const updated = { ...settings, maxImages: next }
                onChange(updated)
                onSaveSettings?.(updated)
              }}
            />
          </label>
          <label className="tool-field">
            <span>Max AI shots</span>
            <input
              type="number"
              min="4"
              max="240"
              value={settings.scriptMaxShots}
              title="Cap for from-scratch generation (cost control)"
              onChange={(event) => update({ scriptMaxShots: Number(event.target.value) })}
              onBlur={() => onSaveSettings?.()}
            />
          </label>
        </div>
        <p className="hint agent-key-hint">
          Full create needs AI + image + TTS keys. Estimated ~{estimatedShots} shots for {formatTime(targetSeconds)}.
        </p>
      </div>

      <div className="agent-settings-card">
        <span className="panel-kicker">Target video length</span>
        <div className="duration-preset-row">
          {DURATION_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`duration-preset ${settings.targetMinutes === preset.minutes && settings.targetSeconds === preset.seconds ? 'active' : ''}`}
              onClick={() => {
                update({ targetMinutes: preset.minutes, targetSeconds: preset.seconds })
                onSaveSettings()
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="agent-duration-row">
          <label className="tool-field">
            <span>Minutes</span>
            <input
              type="number"
              min="0"
              max="180"
              value={settings.targetMinutes}
              onChange={(event) => update({ targetMinutes: Number(event.target.value) })}
              onBlur={() => onSaveSettings?.()}
            />
          </label>
          <label className="tool-field">
            <span>Seconds</span>
            <input
              type="number"
              min="0"
              max="59"
              value={settings.targetSeconds}
              onChange={(event) => update({ targetSeconds: Number(event.target.value) })}
              onBlur={() => onSaveSettings?.()}
            />
          </label>
          <label className="tool-field">
            <span>Max shots</span>
            <input
              type="number"
              min="0"
              max="500"
              value={settings.maxShots}
              title="0 = use all shots"
              onChange={(event) => update({ maxShots: Number(event.target.value) })}
              onBlur={() => onSaveSettings?.()}
            />
          </label>
        </div>
        <div className="agent-duration-row">
          <label className="tool-field">
            <span>Long audio match</span>
            <select
              value={settings.audioMatchMode ?? 'loopRandom'}
              onChange={(event) => {
                update({ audioMatchMode: event.target.value })
                onSaveSettings()
              }}
            >
              <option value="loopRandom">Loop images + random mix</option>
              <option value="stretch">Stretch shots evenly</option>
            </select>
          </label>
          <label className="tool-field">
            <span>Sec / image</span>
            <input
              type="number"
              min="0"
              max="30"
              step="0.5"
              value={settings.audioMatchShotDuration ?? 0}
              title="0 = use style preset"
              onChange={(event) => update({ audioMatchShotDuration: Number(event.target.value) })}
              onBlur={() => onSaveSettings?.()}
            />
          </label>
        </div>
        <div className="agent-target-summary">
          <span><strong>{formatTime(targetSeconds)}</strong> total target</span>
          {shotsCount > 0 ? (
            <span className="muted">≈ {perShot.toFixed(1)}s × {settings.maxShots > 0 ? Math.min(settings.maxShots, shotsCount) : shotsCount} shots</span>
          ) : (
            <span className="muted">≈ {perShot.toFixed(1)}s × {estimatedShots} shots (estimated)</span>
          )}
          {platform.maxDuration && targetSeconds > platform.maxDuration ? (
            <span className="template-warn">Over {platform.label} limit ({formatTime(platform.maxDuration)})</span>
          ) : null}
        </div>
      </div>

      <div className="agent-settings-card">
        <span className="panel-kicker">Output format</span>
        <label className="tool-field agent-field">
          <span>Platform template</span>
          <select
            value={settings.platformTemplateId}
            onChange={(event) => {
              update({ platformTemplateId: event.target.value })
              onSaveSettings()
            }}
          >
            {templateGroups.map((group) => (
              <optgroup key={group.id} label={group.label}>
                {group.templates.map((template) => (
                  <option key={template.id} value={template.id}>{template.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="tool-field agent-field">
          <span>Style preset</span>
          <select
            value={settings.stylePresetId}
            onChange={(event) => {
              update({ stylePresetId: event.target.value })
              onSaveSettings()
            }}
          >
            {PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.label}</option>
            ))}
          </select>
        </label>
      </div>

      <WorkflowBuilder
        settings={settings}
        onChange={onChange}
        onSaveSettings={onSaveSettings}
        running={running}
        activeStepId={activeStepId}
        completedStepIds={completedStepIds}
      />

      <div className="audio-stats-row">
        <div className="audio-stat-card">
          <span className="stat-label">Shots</span>
          <strong>{shotsCount}</strong>
          <span className="muted">in timeline</span>
        </div>
        <div className="audio-stat-card">
          <span className="stat-label">Voice</span>
          <strong>{shotsWithVoice}</strong>
          <span className="muted">with text</span>
        </div>
        <div className="audio-stat-card">
          <span className="stat-label">Now</span>
          <strong>{formatTime(sequenceDuration)}</strong>
          <span className="muted">sequence</span>
        </div>
      </div>

      <button
        type="button"
        className={running ? 'agent-run-btn agent-stop-btn' : 'agent-run-btn primary'}
        onClick={running ? onStopAgent : onRunAgent}
      >
        {running ? 'Stop agent' : 'Run workflow'}
      </button>

      {logs.length > 0 ? (
        <div className="agent-log">
          <div className="agent-log-head">
            <strong>Agent log</strong>
            <span className="muted">{logs.length} steps</span>
          </div>
          <ol className="agent-log-list">
            {logs.map((entry, index) => (
              <li key={`${index}-${entry.slice(0, 24)}`} className={entry.startsWith('✓') ? 'ok' : entry.startsWith('✗') ? 'err' : ''}>
                {entry}
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="hint agent-hint">
          Drag steps to reorder, toggle on/off, or pick a preset. Run workflow to automate step-by-step.
        </p>
      )}
    </section>
  )
}
