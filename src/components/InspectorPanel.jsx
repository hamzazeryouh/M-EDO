import { useState } from 'react'
import { IconChevronLeft, IconChevronRight } from './Icons'
import ShotEditor from './ShotEditor'

const INSPECTOR_TABS = [
  { id: 'clip', label: 'Clip' },
  { id: 'narration', label: 'Narration' },
  { id: 'image', label: 'Image' },
]

export default function InspectorPanel({
  open,
  onToggle,
  shot,
  isLast,
  onChange,
  generatingTTS,
  onGenerateTTS,
  generatingImage,
  onRegenerateImage,
  canRegenerateImage,
}) {
  const [activeTab, setActiveTab] = useState('clip')

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

      {shot ? (
        <div className="inspector-tabs" role="tablist" aria-label="Inspector sections">
          {INSPECTOR_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={activeTab === tab.id ? 'active' : ''}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="inspector-body">
        <ShotEditor
          shot={shot}
          isLast={isLast}
          activeTab={activeTab}
          onChange={onChange}
          generatingTTS={generatingTTS}
          onGenerateTTS={onGenerateTTS}
          generatingImage={generatingImage}
          onRegenerateImage={onRegenerateImage}
          canRegenerateImage={canRegenerateImage}
        />
      </div>
    </aside>
  )
}
