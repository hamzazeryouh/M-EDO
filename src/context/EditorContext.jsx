import { createContext, useContext, useMemo, useRef } from 'react'
import { useAgentRunner } from '../hooks/useAgentRunner'
import { useAudioPipeline } from '../hooks/useAudioPipeline'
import { useExport } from '../hooks/useExport'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useProjectManager } from '../hooks/useProjectManager'
import { useTimelineState } from '../hooks/useTimelineState'
import { useUILayout } from '../hooks/useUILayout'

const EditorContext = createContext(null)

export function useEditor() {
  const context = useContext(EditorContext)
  if (!context) {
    throw new Error('useEditor must be used within EditorProvider')
  }
  return context
}

export function EditorProvider({ children }) {
  const ui = useUILayout()
  const timeline = useTimelineState({ notify: ui.notify })
  const audioRef = useRef(null)

  const project = useProjectManager({
    shots: timeline.shots,
    replaceShots: timeline.replaceShots,
    setSelectedId: timeline.setSelectedId,
    setCurrentTime: timeline.setCurrentTime,
    setPlaying: timeline.setPlaying,
    clearAllAudio: () => audioRef.current?.clearAllAudio(),
    resetTimeline: timeline.resetTimeline,
    notify: ui.notify,
  })

  const audio = useAudioPipeline({
    shots: timeline.shots,
    setShots: timeline.setShots,
    updateShot: timeline.updateShot,
    selectedShot: timeline.selectedShot,
    shotsWithVoice: timeline.shotsWithVoice,
    agentSettings: project.agentSettings,
    notify: ui.notify,
  })
  audioRef.current = audio

  const exportState = useExport({
    shots: timeline.shots,
    selectedShot: timeline.selectedShot,
    updateShot: timeline.updateShot,
    platformTemplate: project.platformTemplate,
    masterAudio: audio.masterAudio,
    setPlaying: timeline.setPlaying,
    agentSettings: project.agentSettings,
    notify: ui.notify,
    setExportDialogOpen: ui.setExportDialogOpen,
  })

  const agent = useAgentRunner({
    shots: timeline.shots,
    setShots: timeline.setShots,
    assignShots: timeline.assignShots,
    setSelectedId: timeline.setSelectedId,
    setCurrentTime: timeline.setCurrentTime,
    setProjectName: project.setProjectName,
    setPlatformTemplateId: project.setPlatformTemplateId,
    setPlaying: timeline.setPlaying,
    masterAudio: audio.masterAudio,
    setAudioTracks: audio.setAudioTracks,
    setMasterAudio: audio.setMasterAudio,
    revokeMasterAudio: audio.revokeMasterAudio,
    buildSplicedMasterUrl: audio.buildSplicedMasterUrl,
    getAudioDuration: audio.getAudioDuration,
    getTtsOptions: audio.getTtsOptions,
    setGeneratingTTS: audio.setGeneratingTTS,
    setSplicing: audio.setSplicing,
    setExporting: exportState.setExporting,
    agentSettings: project.agentSettings,
    setAgentSettings: project.setAgentSettings,
    selectPlatformTemplate: project.selectPlatformTemplate,
    notify: ui.notify,
    handleSidebarTabChange: ui.handleSidebarTabChange,
    handleProjectFocusChange: ui.handleProjectFocusChange,
    setCostModePrompt: ui.setCostModePrompt,
    costModePrompt: ui.costModePrompt,
  })

  useKeyboardShortcuts({
    togglePlay: timeline.togglePlay,
    goToPrevShot: timeline.goToPrevShot,
    goToNextShot: timeline.goToNextShot,
    goToStart: timeline.goToStart,
    splitAtPlayhead: timeline.splitAtPlayhead,
    removeShot: timeline.removeShot,
    undo: timeline.undo,
    redo: timeline.redo,
    saveCurrentProject: project.saveCurrentProject,
    selectedId: timeline.selectedId,
  })

  const value = useMemo(() => ({
    ui,
    timeline,
    project,
    audio,
    export: exportState,
    agent,
  }), [ui, timeline, project, audio, exportState, agent])

  return (
    <EditorContext.Provider value={value}>
      {children}
    </EditorContext.Provider>
  )
}
