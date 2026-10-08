import { ANIMATIONS, DEFAULT_DURATION, PRESETS } from '../constants'
import { getTemplatesByGroup } from '../platformTemplates'

export default function ToolsBar({
  shotsCount,
  platformTemplateId,
  onPlatformTemplateChange,
  onApplyPreset,
  onRandomizeMix,
  onApplyDurationToAll,
  onApplyAnimationToAll,
}) {
  const templateGroups = getTemplatesByGroup()

  return (
    <section className="tools-bar">
      <div className="tool-group">
        <span className="tool-group-label">Export</span>
        <label className="tool-field">
          <span>Format</span>
          <select value={platformTemplateId} onChange={(event) => onPlatformTemplateChange(event.target.value)}>
            {templateGroups.map((group) => (
              <optgroup key={group.id} label={group.label}>
                {group.templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label} ({template.aspect})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      <span className="tool-divider" />

      <div className="tool-group">
        <span className="tool-group-label">Style</span>
        <label className="tool-field">
          <span>Preset</span>
          <select defaultValue="documentary" onChange={(event) => onApplyPreset(event.target.value)}>
            {PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.label}</option>
            ))}
          </select>
        </label>
        <button type="button" className="tool-btn accent" disabled={shotsCount === 0} onClick={onRandomizeMix}>
          Random mix
        </button>
      </div>

      <span className="tool-divider" />

      <div className="tool-group">
        <span className="tool-group-label">Batch</span>
        <label className="tool-field">
          <span>Duration</span>
          <input
            type="number"
            min="0.5"
            max="120"
            step="0.5"
            defaultValue={DEFAULT_DURATION}
            onBlur={(event) => onApplyDurationToAll(Number(event.target.value))}
          />
        </label>
        <label className="tool-field">
          <span>Animation</span>
          <select defaultValue="kenBurnsIn" onChange={(event) => onApplyAnimationToAll(event.target.value)}>
            {ANIMATIONS.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="tools-bar-hint">
        <kbd>Space</kbd> play
        <kbd>←</kbd><kbd>→</kbd> clip
        <kbd>S</kbd> split
        <kbd>Del</kbd> remove
      </div>
    </section>
  )
}
