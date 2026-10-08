import { COST_MODES } from '../utils/costMode'

export default function CostModeDialog({ modeId, maxImages, onCancel, onConfirm }) {
  const mode = COST_MODES[modeId]
  if (!mode) {
    return null
  }

  const shotLimit = mode.settings.maxShots > 0
    ? `${mode.settings.maxShots} shots`
    : `up to ${mode.settings.scriptMaxShots} shots`
  const images = mode.workflowPreset === 'minimalCost' ? 'AI images off' : 'AI images on'
  const speech = mode.settings.ttsProvider === 'edge' ? 'Free Edge speech' : 'OpenAI speech'

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cost-mode-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className="panel-kicker">Whole project</span>
        <h2 id="cost-mode-title">Switch to {mode.label}?</h2>
        <p>{mode.hint}</p>
        <ul>
          <li>Workflow, speech, and image quality change for this project.</li>
          <li>Shot budget: {shotLimit}.</li>
          <li>{images}. {speech}.</li>
          <li>Your max images stays at {maxImages}. You can still edit that number.</li>
        </ul>
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" className="primary" onClick={onConfirm}>Use {mode.label}</button>
        </div>
      </div>
    </div>
  )
}
