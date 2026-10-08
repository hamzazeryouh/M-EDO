import AgentChat from './AgentChat'
import AudioPanel from './AudioPanel'
import AgentPanel from './AgentPanel'
import { IconAgent, IconAudio, IconChat, IconChevronLeft, IconChevronRight, IconExport, IconFolder, IconMedia, IconPanelRight, IconSpeech, IconTemplate } from './Icons'
import MediaBin from './MediaBin'
import ProjectsPanel from './ProjectsPanel'
import TemplatesPanel from './TemplatesPanel'
import TTSPanel from './TTSPanel'
import WorkflowStudio from './WorkflowStudio'

const TABS = [
  { id: 'projects', label: 'Projects', title: 'Multi-project manager', Icon: IconFolder },
  { id: 'media', label: 'Media', title: 'Media bin', Icon: IconMedia },
  { id: 'studio', label: 'Studio', title: 'Full workflow studio — images, speech, export', Icon: IconExport },
  { id: 'chat', label: 'Chat', title: 'Accept a subject — agent runs every step to export', Icon: IconChat },
  { id: 'agent', label: 'Agent', title: 'AI video agent', Icon: IconAgent },
  { id: 'templates', label: 'Formats', title: 'Platform templates', Icon: IconTemplate },
  { id: 'audio', label: 'Audio', title: 'Audio tracks', Icon: IconAudio },
  { id: 'speech', label: 'Speech', title: 'Text to speech', Icon: IconSpeech },
]

export default function LeftSidebar({
  open,
  onToggle,
  activeTab: activeTabId = 'projects',
  onTabChange,
  projectFocusMode = false,
  onProjectFocusChange,
  mediaProps,
  agentProps,
  templateProps,
  audioProps,
  speechProps,
  projectsProps,
  studioProps,
  chatProps,
}) {
  const activeTab = TABS.find((item) => item.id === activeTabId) ?? TABS[0]

  function selectTab(id) {
    if (id === activeTabId && open) {
      onToggle()
      return
    }
    onTabChange?.(id)
  }

  return (
    <aside className={`left-sidebar ${open ? 'open' : 'collapsed'} ${projectFocusMode ? 'expanded-panel' : ''}`}>
      <nav className="sidebar-rail" aria-label="Sidebar">
        <button
          type="button"
          className="sidebar-rail-toggle"
          title={open ? 'Hide sidebar' : 'Show sidebar'}
          aria-expanded={open}
          onClick={onToggle}
        >
          {open ? <IconChevronLeft size={16} /> : <IconChevronRight size={16} />}
        </button>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`sidebar-rail-btn ${activeTabId === item.id ? 'active' : ''}`}
            title={
              activeTabId === item.id && open
                ? `${item.title} — click again to hide panel`
                : `${item.title} — show panel`
            }
            aria-current={activeTabId === item.id ? 'page' : undefined}
            onClick={() => selectTab(item.id)}
          >
            <span className="sidebar-rail-icon">
              <item.Icon size={18} />
            </span>
            <span className="sidebar-rail-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-panel">
        <div className="panel-header">
          <div className="panel-header-title">
            <span className="panel-kicker">{activeTab?.title}</span>
            <strong>{activeTab?.label}</strong>
          </div>
          <div className="panel-header-actions">
            {activeTabId === 'media' ? (
              <span className="muted panel-header-meta">{mediaProps.shots.length} items</span>
            ) : null}
            {onProjectFocusChange ? (
              <button
                type="button"
                className={projectFocusMode ? 'tool-btn accent' : 'icon-btn'}
                title={projectFocusMode ? 'Show timeline and preview' : 'Expand this panel over the timeline'}
                aria-label={projectFocusMode ? 'Show editor' : 'Hide editor'}
                aria-pressed={projectFocusMode}
                onClick={() => onProjectFocusChange(!projectFocusMode)}
              >
                {projectFocusMode ? 'Show editor' : <IconPanelRight size={16} />}
              </button>
            ) : null}
            <button
              type="button"
              className="icon-btn"
              title="Hide panel"
              aria-label="Hide panel"
              onClick={onToggle}
            >
              <IconChevronLeft size={16} />
            </button>
          </div>
        </div>

        <div className="sidebar-panel-body">
          {activeTabId === 'projects' ? (
            <ProjectsPanel
              {...projectsProps}
              focusMode={projectFocusMode}
            />
          ) : null}
          {activeTabId === 'media' ? <MediaBin {...mediaProps} hideHeader /> : null}
          {activeTabId === 'studio' ? <WorkflowStudio {...studioProps} /> : null}
          {activeTabId === 'chat' ? <AgentChat {...chatProps} /> : null}
          {activeTabId === 'agent' ? <AgentPanel {...agentProps} /> : null}
          {activeTabId === 'templates' ? <TemplatesPanel {...templateProps} /> : null}
          {activeTabId === 'audio' ? <AudioPanel {...audioProps} /> : null}
          {activeTabId === 'speech' ? <TTSPanel {...speechProps} /> : null}
        </div>
      </div>
    </aside>
  )
}
