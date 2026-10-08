import { formatTime } from '../constants'
import {
  formatMaxDuration,
  getPlatformTemplate,
  getTemplatesByGroup,
} from '../platformTemplates'

export default function TemplatesPanel({
  activeTemplateId,
  sequenceDuration,
  onSelectTemplate,
}) {
  const groups = getTemplatesByGroup()
  const active = getPlatformTemplate(activeTemplateId)

  return (
    <section className="templates-panel">
      <p className="templates-intro muted">
        Pick a platform template. Export size, preview aspect ratio, and recommended clip timing update automatically.
      </p>

      {active ? (
        <div className="template-active-card">
          <strong>{active.label}</strong>
          <span>{active.width}×{active.height} · {active.aspect} · {active.fps} fps</span>
          <span>{formatMaxDuration(active.maxDuration)} · {active.defaultShotDuration}s per clip</span>
          <span className="muted">Current sequence: {formatTime(sequenceDuration)}</span>
          {active.maxDuration && sequenceDuration > active.maxDuration ? (
            <span className="template-warn">Sequence exceeds platform limit — trim or shorten clips.</span>
          ) : null}
        </div>
      ) : null}

      <div className="template-groups">
        {groups.map((group) => (
          <div key={group.id} className="template-group">
            <h3 className="template-group-title">{group.label}</h3>
            <ul className="template-list">
              {group.templates.map((template) => (
                <li key={template.id}>
                  <button
                    type="button"
                    className={`template-card ${activeTemplateId === template.id ? 'active' : ''}`}
                    onClick={() => onSelectTemplate(template.id)}
                  >
                    <span className="template-card-head">
                      <strong>{template.label}</strong>
                      <span className="template-aspect">{template.aspect}</span>
                    </span>
                    <span className="template-meta">{template.width}×{template.height}</span>
                    <span className="template-meta">{formatMaxDuration(template.maxDuration)}</span>
                    <span className="template-desc">{template.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
