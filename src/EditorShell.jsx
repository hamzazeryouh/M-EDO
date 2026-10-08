import { useRef } from 'react'
import CostModeDialog from './components/CostModeDialog'
import ExportDialog from './components/ExportDialog'
import ClipContextMenu from './components/ClipContextMenu'
import InspectorPanel from './components/InspectorPanel'
import LeftSidebar from './components/LeftSidebar'
import PreviewPanel from './components/PreviewPanel'
import StatusBar from './components/StatusBar'
import Timeline from './components/Timeline'
import ToolsBar from './components/ToolsBar'
import Toolbar from './components/Toolbar'
import { DEFAULT_DURATION, DEFAULT_FPS } from './constants'
import { useEditor } from './context/EditorContext'
import { getActiveImageConfig, getMaxImages, saveAgentSettings } from './utils/agentSettings'
import { getShotStarts } from './utils/timeline'
import { getEnabledWorkflowSteps, getWorkflowDef } from './utils/workflowSteps'

export default function EditorShell() {
  const { ui, timeline, project, audio, export: exportState, agent } = useEditor()
  const imageInputRef = useRef(null)
  const manifestInputRef = useRef(null)
  const audioInputRef = useRef(null)

  const batchDuration = timeline.selectedShot?.duration ?? timeline.shots[0]?.duration ?? DEFAULT_DURATION
  const batchAnimation = timeline.selectedShot?.animation ?? timeline.shots[0]?.animation ?? 'kenBurnsIn'

  return (
    <div className={`app pro-editor ${ui.leftSidebarOpen ? 'left-sidebar-open' : 'left-sidebar-closed'} ${ui.rightSidebarOpen ? 'right-sidebar-open' : 'right-sidebar-closed'} ${ui.projectFocusMode ? 'project-panel-focus' : ''} ${agent.agentRunning ? 'agent-running' : ''}`}>
      {project.loadingProject ? (
        <div className="app-loading" aria-busy="true" aria-label="Loading project">
          <div className="app-loading-spinner" aria-hidden="true" />
          <span>Loading project…</span>
        </div>
      ) : null}

      <Toolbar
        leftSidebarOpen={ui.leftSidebarOpen}
        rightSidebarOpen={ui.rightSidebarOpen}
        onToggleLeftSidebar={ui.toggleLeftSidebar}
        onToggleRightSidebar={ui.toggleRightSidebar}
        canUndo={timeline.canUndo}
        canRedo={timeline.canRedo}
        onUndo={timeline.undo}
        onRedo={timeline.redo}
        playing={timeline.playing}
        onTogglePlay={timeline.togglePlay}
        onPrevShot={timeline.goToPrevShot}
        onNextShot={timeline.goToNextShot}
        onGoStart={timeline.goToStart}
        onImportImages={() => imageInputRef.current?.click()}
        onImportManifest={() => manifestInputRef.current?.click()}
        onImportAudio={() => audioInputRef.current?.click()}
        onExportTest={() => ui.setExportDialogOpen(true)}
        onExport={() => ui.setExportDialogOpen(true)}
        exporting={exportState.exporting}
        exportProgress={exportState.exportProgress}
        mp4Ready={exportState.mp4Ready}
        shotsCount={timeline.shots.length}
        projectName={project.projectName}
        projectSaving={project.projectSaving}
        agentRunning={agent.agentRunning}
        agentProgress={agent.agentProgress}
        agentStepLabel={agent.agentActiveStep ? getWorkflowDef(agent.agentActiveStep)?.shortLabel : ''}
        agentTitle={agent.chatRuns.find((run) => run.status === 'running')?.subject || 'Agent task'}
        agentStopping={agent.agentStopping}
        onOpenAgentPage={agent.openAgentTaskPage}
        onStopAgent={agent.stopVideoAgent}
      />

      <ToolsBar
        shotsCount={timeline.shots.length}
        platformTemplateId={project.platformTemplateId}
        batchDuration={batchDuration}
        batchAnimation={batchAnimation}
        toolsKey={project.activeProjectId ?? 'default'}
        onPlatformTemplateChange={(templateId) => project.selectPlatformTemplate(templateId)}
        onApplyPreset={timeline.applySelectedPreset}
        onRandomizeMix={timeline.randomizeMix}
        onApplyDurationToAll={timeline.applyDurationToAll}
        onApplyAnimationToAll={timeline.applyAnimationToAll}
      />

      <input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={(event) => { if (event.target.files) timeline.addFiles(event.target.files); event.target.value = '' }} />
      <input ref={manifestInputRef} type="file" accept="image/*,.json,application/json" multiple hidden onChange={(event) => { if (event.target.files) project.importManifest(event.target.files); event.target.value = '' }} />
      <input ref={audioInputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg" multiple hidden onChange={(event) => { if (event.target.files) audio.addAudioTracks(event.target.files); event.target.value = '' }} />

      <div className="editor-body">
        <LeftSidebar
          open={ui.leftSidebarOpen}
          onToggle={ui.toggleLeftSidebar}
          activeTab={ui.sidebarTab}
          onTabChange={ui.handleSidebarTabChange}
          projectFocusMode={ui.projectFocusMode}
          onProjectFocusChange={ui.handleProjectFocusChange}
          projectsProps={{
            projects: project.projectList,
            activeProjectId: project.activeProjectId,
            projectName: project.projectName,
            shotsCount: timeline.shots.length,
            sequenceDuration: timeline.duration,
            readyCount: timeline.readyCount,
            missingCount: timeline.missingCount,
            shotsWithVoice: timeline.shotsWithVoice,
            audioCount: timeline.audioCount,
            saving: project.projectSaving,
            running: agent.agentRunning,
            progress: agent.agentProgress,
            logs: agent.agentLogs,
            activeStepId: agent.agentActiveStep,
            completedStepIds: agent.agentCompletedSteps,
            workflowSteps: getEnabledWorkflowSteps(project.agentSettings),
            onSelectProject: project.switchToProject,
            onCreateEmpty: project.createEmptyProjectAction,
            onDuplicateActive: project.duplicateActiveProjectAction,
            onRenameActive: project.renameActiveProjectAction,
            onDeleteProject: project.deleteProjectAction,
            onSaveNow: () => project.saveCurrentProject(),
            onRunAgent: agent.runVideoAgent,
            onStopAgent: agent.stopVideoAgent,
          }}
          mediaProps={{
            shots: timeline.shots,
            selectedId: timeline.selectedId,
            onSelect: timeline.selectShot,
            onRemove: timeline.removeShot,
            dragFromIndex: timeline.dragFromIndex,
            dragOverIndex: timeline.dragOverIndex,
            onDragStart: timeline.setDragFromIndex,
            onDragEnter: timeline.setDragOverIndex,
            onDragEnd: () => { timeline.setDragFromIndex(null); timeline.setDragOverIndex(null) },
            onDrop: timeline.reorderShots,
            onContextMenu: timeline.openClipMenu,
          }}
          chatProps={{
            running: agent.agentRunning,
            progress: agent.agentProgress,
            activeStepId: agent.agentActiveStep,
            completedStepIds: agent.agentCompletedSteps,
            runs: agent.chatRuns,
            onAccept: agent.acceptChatSubject,
            onStop: agent.stopVideoAgent,
            maxImages: getMaxImages(project.agentSettings) || 20,
            onMaxImagesChange: (value) => {
              project.setAgentSettings((current) => {
                const next = { ...current, maxImages: value }
                saveAgentSettings(next)
                return next
              })
            },
            onShowEditor: () => ui.handleProjectFocusChange(false),
            onOpenMedia: () => ui.handleSidebarTabChange('media'),
          }}
          studioProps={{
            settings: project.agentSettings,
            onChange: project.setAgentSettings,
            onSaveSettings: project.saveAgentSettingsSafe,
            onRunAgent: agent.runVideoAgent,
            onStopAgent: agent.stopVideoAgent,
            running: agent.agentRunning,
            progress: agent.agentProgress,
            logs: agent.agentLogs,
            activeStepId: agent.agentActiveStep,
            completedStepIds: agent.agentCompletedSteps,
            projectName: project.projectName,
            shots: timeline.shots,
            shotsCount: timeline.shots.length,
            readyCount: timeline.readyCount,
            missingCount: timeline.missingCount,
            shotsWithVoice: timeline.shotsWithVoice,
            audioCount: timeline.audioCount,
            sequenceDuration: timeline.duration,
            masterAudio: audio.masterAudio,
            onApplyProductionDefaults: (next) => {
              project.selectPlatformTemplate(next.platformTemplateId, {
                adjustShots: true,
                applyPlatformToShots: timeline.applyPlatformToShots,
              })
            },
            onRequestCostMode: agent.requestCostMode,
          }}
          agentProps={{
            settings: project.agentSettings,
            onChange: project.setAgentSettings,
            onSaveSettings: project.saveAgentSettingsSafe,
            onRunAgent: agent.runVideoAgent,
            onStopAgent: agent.stopVideoAgent,
            running: agent.agentRunning,
            progress: agent.agentProgress,
            logs: agent.agentLogs,
            shotsCount: timeline.shots.length,
            sequenceDuration: timeline.duration,
            shotsWithVoice: timeline.shotsWithVoice,
            activeStepId: agent.agentActiveStep,
            completedStepIds: agent.agentCompletedSteps,
            onRequestCostMode: agent.requestCostMode,
          }}
          templateProps={{
            activeTemplateId: project.platformTemplateId,
            sequenceDuration: timeline.duration,
            onSelectTemplate: (templateId) => project.selectPlatformTemplate(templateId, {
              adjustShots: true,
              applyPlatformToShots: timeline.applyPlatformToShots,
            }),
          }}
          audioProps={{
            tracks: audio.audioTracks,
            masterAudio: audio.masterAudio,
            splicing: audio.splicing,
            dragFromIndex: audio.audioDragFromIndex,
            dragOverIndex: audio.audioDragOverIndex,
            onAddTracks: audio.addAudioTracks,
            onRemoveTrack: audio.removeAudioTrack,
            onMoveUp: (index) => audio.moveAudioTrack(index, -1),
            onMoveDown: (index) => audio.moveAudioTrack(index, 1),
            onSplice: () => audio.spliceAudioTracksNow(),
            onFitShots: audio.fitShotsToMasterAudio,
            onClearAll: audio.clearAllAudio,
            onDragStart: audio.setAudioDragFromIndex,
            onDragEnter: audio.setAudioDragOverIndex,
            onDragEnd: () => { audio.setAudioDragFromIndex(null); audio.setAudioDragOverIndex(null) },
            onDrop: audio.reorderAudioTracks,
            shotsCount: timeline.shots.length,
            sequenceDuration: timeline.duration,
            audioMatchMode: project.agentSettings.audioMatchMode,
            audioMatchShotDuration: project.agentSettings.audioMatchShotDuration,
            stylePresetId: project.agentSettings.stylePresetId,
            onMatchSettingsChange: (partial) => {
              project.setAgentSettings((current) => {
                const next = { ...current, ...partial }
                saveAgentSettings(next)
                return next
              })
            },
          }}
          speechProps={{
            settings: project.agentSettings,
            onSettingsChange: project.setAgentSettings,
            onSaveSettings: project.saveAgentSettingsSafe,
            voice: audio.ttsVoice,
            rate: audio.ttsRate,
            delivery: audio.ttsDelivery,
            matchDuration: audio.ttsMatchDuration,
            generating: audio.generatingTTS,
            progress: audio.ttsProgress,
            shotsWithVoice: timeline.shotsWithVoice,
            selectedHasVoice: Boolean(timeline.selectedShot?.voice?.trim()),
            onVoiceChange: audio.setTtsVoice,
            onRateChange: audio.setTtsRate,
            onDeliveryChange: audio.setTtsDelivery,
            onMatchDurationChange: audio.setTtsMatchDuration,
            onGenerateAll: audio.generateTTSForAllShots,
            onGenerateSelected: audio.generateTTSForSelectedShot,
            onSynthesizePreview: audio.synthesizePreview,
            onGenerateOnShot: audio.generatePreviewOnShot,
            hasSelectedShot: Boolean(timeline.selectedShot),
            onSpliceToMaster: audio.spliceShotsAudioToMaster,
            selectedVoice: timeline.selectedShot?.voice ?? '',
            selectedAudioSrc: timeline.selectedShot?.audioSrc ?? '',
          }}
        />

        <div className="center-column">
          <PreviewPanel
            shots={timeline.shots}
            masterAudioSrc={audio.masterAudio?.src ?? null}
            currentTime={timeline.currentTime}
            playing={timeline.playing}
            exportWidth={project.platformTemplate.width}
            exportHeight={project.platformTemplate.height}
            exportFps={project.platformTemplate.fps ?? DEFAULT_FPS}
            aspectLabel={project.platformTemplate.aspect}
            platformLabel={project.platformTemplate.label}
            onTimeChange={timeline.setCurrentTime}
            onPlayingChange={timeline.setPlaying}
            onTogglePlay={timeline.togglePlay}
          />
          <Timeline
            shots={timeline.shots}
            selectedId={timeline.selectedId}
            currentTime={timeline.currentTime}
            duration={timeline.duration}
            zoom={timeline.timelineZoom}
            onZoomChange={timeline.setTimelineZoom}
            masterAudio={audio.masterAudio}
            audioTracks={audio.audioTracks}
            height={ui.timelineHeight}
            onResizeStart={ui.startTimelineResize}
            onSelect={timeline.setSelectedId}
            onSeek={(time) => { timeline.setCurrentTime(time); timeline.setPlaying(false) }}
            onDurationChange={timeline.changeShotDuration}
            onSplit={timeline.splitAtPlayhead}
            onDuplicate={timeline.duplicateSelectedShot}
            dragFromIndex={timeline.dragFromIndex}
            onDragStart={timeline.setDragFromIndex}
            onDragEnter={timeline.setDragOverIndex}
            onDragEnd={() => { timeline.setDragFromIndex(null); timeline.setDragOverIndex(null) }}
            onDrop={timeline.reorderShots}
            onContextMenu={timeline.openClipMenu}
          />
        </div>

        <InspectorPanel
          open={ui.rightSidebarOpen}
          onToggle={ui.toggleRightSidebar}
          shot={timeline.selectedShot}
          isLast={timeline.selectedIndex === timeline.shots.length - 1}
          onChange={timeline.updateShot}
          generatingTTS={audio.generatingTTS}
          onGenerateTTS={audio.generateTTSForSelectedShot}
          generatingImage={exportState.generatingImage}
          onRegenerateImage={exportState.regenerateImageForSelectedShot}
          canRegenerateImage={Boolean(getActiveImageConfig(project.agentSettings).config.apiKey?.trim())}
        />
      </div>

      {timeline.clipMenu && timeline.shots.some((shot) => shot.id === timeline.clipMenu.shotId) ? (
        <ClipContextMenu
          x={timeline.clipMenu.x}
          y={timeline.clipMenu.y}
          shot={timeline.shots.find((shot) => shot.id === timeline.clipMenu.shotId)}
          canSplit={(() => {
            const segment = getShotStarts(timeline.shots).find((item) => item.shot.id === timeline.clipMenu.shotId)
            if (!segment) {
              return false
            }
            return timeline.currentTime > segment.start + 0.25 && timeline.currentTime < segment.end - 0.25
          })()}
          onClose={() => timeline.setClipMenu(null)}
          onRename={timeline.renameShot}
          onDuplicate={timeline.duplicateShotById}
          onSplit={timeline.splitAtPlayhead}
          onClearAudio={timeline.clearShotAudio}
          onDelete={timeline.removeShot}
        />
      ) : null}

      <ExportDialog
        open={ui.exportDialogOpen}
        onClose={() => { if (!exportState.exporting) ui.setExportDialogOpen(false) }}
        onExport={exportState.handleExport}
        exporting={exportState.exporting}
        exportProgress={exportState.exportProgress}
        mp4Ready={exportState.mp4Ready}
        shotsCount={timeline.shots.length}
        sequenceDuration={timeline.duration}
        projectName={project.projectName}
        platformLabel={project.platformTemplate.label}
        exportWidth={project.platformTemplate.width}
        exportHeight={project.platformTemplate.height}
        exportFps={project.platformTemplate.fps ?? DEFAULT_FPS}
      />

      <CostModeDialog
        modeId={ui.costModePrompt}
        maxImages={getMaxImages(project.agentSettings) || 20}
        onCancel={() => ui.setCostModePrompt(null)}
        onConfirm={agent.confirmCostMode}
      />

      <StatusBar
        currentTime={timeline.currentTime}
        duration={timeline.duration}
        shotsCount={timeline.shots.length}
        readyCount={timeline.readyCount}
        missingCount={timeline.missingCount}
        message={ui.message}
        projectName={project.projectName}
        saving={project.projectSaving}
        exportWidth={project.platformTemplate.width}
        exportHeight={project.platformTemplate.height}
        exportFps={project.platformTemplate.fps ?? DEFAULT_FPS}
        platformLabel={project.platformTemplate.label}
        maxDuration={project.platformTemplate.maxDuration}
      />
    </div>
  )
}
