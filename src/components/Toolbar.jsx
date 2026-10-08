import {
  IconExport,
  IconImport,
  IconPanelLeft,
  IconPanelRight,
  IconPause,
  IconPlay,
  IconRedo,
  IconSkipNext,
  IconSkipPrev,
  IconSkipStart,
  IconUndo,
} from './Icons'

function IconButton({ title, active, primary, disabled, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      className={`icon-btn ${primary ? 'primary' : ''} ${active ? 'active' : ''} ${className}`.trim()}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export default function Toolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  playing,
  onTogglePlay,
  onPrevShot,
  onNextShot,
  onGoStart,
  onImportImages,
  onImportManifest,
  onImportAudio,
  onExportTest,
  onExport,
  exporting,
  exportProgress,
  mp4Ready,
  shotsCount,
  leftSidebarOpen,
  rightSidebarOpen,
  onToggleLeftSidebar,
  onToggleRightSidebar,
  projectName = 'Untitled Sequence',
  agentRunning = false,
  agentProgress = 0,
  agentStepLabel = '',
  agentTitle = 'Agent task',
  agentStopping = false,
  onOpenAgentPage,
  onStopAgent,
}) {
  return (
    <header className="menubar">
      <div className="menubar-start">
        <div className="app-brand">
          <span className="brand-mark">IV</span>
          <div>
            <strong>Image Video Editor</strong>
            <span className="project-name">{projectName}</span>
          </div>
        </div>

        {agentRunning ? (
          <div className="header-agent-page" role="tab" aria-selected="true">
            <button type="button" className="header-agent-page-open" onClick={onOpenAgentPage} title="Open the agent task">
              <span className="header-agent-page-dot" aria-hidden="true" />
              <span className="header-agent-page-title">{agentTitle}</span>
              <span className="header-agent-page-meta">
                {Math.round(agentProgress * 100)}%{agentStepLabel ? ` · ${agentStepLabel}` : ''}
              </span>
            </button>
            <button
              type="button"
              className="header-agent-kill"
              onClick={onStopAgent}
              disabled={agentStopping}
              title="Kill this agent task"
            >
              {agentStopping ? 'Killing…' : 'Kill'}
            </button>
          </div>
        ) : null}

        <nav className="menu-group">
          <IconButton title="Toggle project panel" active={leftSidebarOpen} onClick={onToggleLeftSidebar}>
            <IconPanelLeft size={18} />
          </IconButton>
          <IconButton title="Toggle inspector" active={rightSidebarOpen} onClick={onToggleRightSidebar}>
            <IconPanelRight size={18} />
          </IconButton>
          <span className="menu-divider" />
          <button type="button" className="menu-btn" onClick={onImportImages}>
            <IconImport size={16} />
            <span>Images</span>
          </button>
          <button type="button" className="menu-btn" onClick={onImportManifest} title="Import manifest.json — works with prompts only (no images required)">
            <IconImport size={16} />
            <span>Manifest</span>
          </button>
          <button type="button" className="menu-btn" onClick={onImportAudio}>
            <IconImport size={16} />
            <span>Audio</span>
          </button>
        </nav>
      </div>

      <div className="transport-block">
        <div className="transport">
          <IconButton title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={onUndo}>
            <IconUndo size={18} />
          </IconButton>
          <IconButton title="Redo (Ctrl+Y)" disabled={!canRedo} onClick={onRedo}>
            <IconRedo size={18} />
          </IconButton>
          <span className="transport-divider" />
          <IconButton title="Go to start (Home)" onClick={onGoStart}>
            <IconSkipStart size={18} />
          </IconButton>
          <IconButton title="Previous clip (←)" onClick={onPrevShot}>
            <IconSkipPrev size={18} />
          </IconButton>
          <IconButton
            title="Play/Pause (Space)"
            primary
            className="transport-play-btn"
            onClick={onTogglePlay}
          >
            {playing ? <IconPause size={20} /> : <IconPlay size={20} />}
          </IconButton>
          <IconButton title="Next clip (→)" onClick={onNextShot}>
            <IconSkipNext size={18} />
          </IconButton>
        </div>
      </div>

      <div className="menubar-end">
        <button type="button" className="menu-btn" disabled={exporting || shotsCount === 0} onClick={onExportTest}>
          Test 8
        </button>
        <button
          type="button"
          className="export-btn primary"
          disabled={exporting || shotsCount === 0}
          onClick={onExport}
        >
          <IconExport size={16} />
          <span>
            {exporting ? `${Math.round(exportProgress * 100)}%` : mp4Ready ? 'Export MP4' : 'Export'}
          </span>
        </button>
      </div>
    </header>
  )
}
