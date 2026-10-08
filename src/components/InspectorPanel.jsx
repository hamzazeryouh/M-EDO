import { IconChevronLeft, IconChevronRight } from './Icons'
import ShotEditor from './ShotEditor'

export default function InspectorPanel({ open, onToggle, ...props }) {
  return (
    <aside className={`inspector ${open ? 'open' : 'collapsed'}`}>
      <div className="panel-header inspector-header">
        <div>
          <span className="panel-kicker">Inspector</span>
          <strong>Properties</strong>
        </div>
        <button type="button" className="icon-btn sidebar-collapse-btn" title={open ? 'Hide inspector' : 'Show inspector'} onClick={onToggle}>
          {open ? <IconChevronRight size={16} /> : <IconChevronLeft size={16} />}
        </button>
      </div>

      <div className="inspector-body">
        <ShotEditor
          shot={props.shot}
          isLast={props.isLast}
          onChange={props.onChange}
          generatingTTS={props.generatingTTS}
          onGenerateTTS={props.onGenerateTTS}
        />
      </div>
    </aside>
  )
}
