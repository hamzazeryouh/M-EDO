import { useCallback, useRef, useState } from 'react'
import { DEFAULT_FPS } from '../constants'
import { getPlatformTemplate } from '../platformTemplates'
import { executeAgentStep } from '../utils/agentPipeline'
import { isAgentStop } from '../utils/agentStop'
import { getMaxImages, saveAgentSettings } from '../utils/agentSettings'
import { applyCostMode } from '../utils/costMode'
import { applyProductionDefaults } from '../utils/productionDefaults'
import { getEnabledWorkflowSteps } from '../utils/workflowSteps'
import { downloadBlob, exportVideo } from '../utils/videoExport'

export function useAgentRunner({
  shots,
  setShots,
  assignShots,
  setSelectedId,
  setCurrentTime,
  setProjectName,
  setPlatformTemplateId,
  setPlaying,
  masterAudio,
  setAudioTracks,
  setMasterAudio,
  revokeMasterAudio,
  buildSplicedMasterUrl,
  getAudioDuration,
  getTtsOptions,
  setGeneratingTTS,
  setSplicing,
  setExporting,
  agentSettings,
  setAgentSettings,
  selectPlatformTemplate,
  notify,
  handleSidebarTabChange,
  handleProjectFocusChange,
  setCostModePrompt,
  costModePrompt,
}) {
  const [agentRunning, setAgentRunning] = useState(false)
  const [agentStopping, setAgentStopping] = useState(false)
  const [agentProgress, setAgentProgress] = useState(0)
  const [agentLogs, setAgentLogs] = useState([])
  const [agentActiveStep, setAgentActiveStep] = useState(null)
  const [agentCompletedSteps, setAgentCompletedSteps] = useState([])
  const [chatRuns, setChatRuns] = useState([])
  const chatSinkRef = useRef(null)
  const agentAbortRef = useRef(null)

  const appendAgentLog = useCallback((entry) => {
    setAgentLogs((current) => [...current, entry])
    const sink = chatSinkRef.current
    if (!sink) {
      return
    }
    sink.logs.push(entry)
    const snapshot = [...sink.logs]
    setChatRuns((current) => current.map((run) => (
      run.id === sink.id ? { ...run, logs: snapshot } : run
    )))
  }, [])

  const requestCostMode = useCallback((modeId) => {
    if (!modeId || modeId === agentSettings.costMode || agentRunning) {
      return
    }
    setCostModePrompt(modeId)
  }, [agentSettings.costMode, agentRunning, setCostModePrompt])

  const confirmCostMode = useCallback(() => {
    if (!costModePrompt) {
      return
    }
    const next = applyCostMode(agentSettings, costModePrompt)
    setAgentSettings(next)
    saveAgentSettings(next)
    setCostModePrompt(null)
    notify(`Cost mode is now ${next.costMode} for this project. Max images stays at ${next.maxImages}.`)
  }, [costModePrompt, agentSettings, setAgentSettings, setCostModePrompt, notify])

  const stopVideoAgent = useCallback(() => {
    if (!agentAbortRef.current && !agentRunning) {
      return
    }
    setAgentStopping(true)
    agentAbortRef.current?.abort()
    notify('Stopping agent task…')
  }, [agentRunning, notify])

  const openAgentTaskPage = useCallback(() => {
    handleSidebarTabChange('chat')
    handleProjectFocusChange(false)
  }, [handleSidebarTabChange, handleProjectFocusChange])

  const runVideoAgent = useCallback(async (settingsOverride = null, chatRunId = null) => {
    if (agentRunning) {
      return
    }

    const settings = settingsOverride ?? agentSettings
    if (!chatRunId) {
      chatSinkRef.current = null
    }
    const enabledSteps = getEnabledWorkflowSteps(settings)
    if (enabledSteps.length === 0) {
      notify('Add at least one enabled step to the workflow.')
      return
    }

    setAgentRunning(true)
    setAgentStopping(false)
    setAgentProgress(0)
    setAgentLogs([])
    setAgentActiveStep(null)
    setAgentCompletedSteps([])
    setPlaying(false)

    const controller = new AbortController()
    agentAbortRef.current = controller

    const template = getPlatformTemplate(settings.platformTemplateId)
    let workingShots = shots
    let workingMaster = masterAudio
    let exportResult = null
    const finishedSteps = []

    const pipelineCtx = {
      settings,
      template,
      workingShots,
      workingMaster,
      appendAgentLog,
      setAgentProgress,
      getTtsOptions,
      setGeneratingTTS,
      setSplicing,
      setExporting,
      setShots,
      assignShots,
      setSelectedId,
      setCurrentTime,
      setProjectName,
      setPlatformTemplateId,
      setAudioTracks,
      setMasterAudio,
      revokeMasterAudio,
      buildSplicedMasterUrl,
      getAudioDuration,
      exportVideo,
      downloadBlob,
      DEFAULT_FPS,
      onImageReady: (info) => {
        const sink = chatSinkRef.current
        if (!sink) {
          return
        }
        sink.images = info.images
        setChatRuns((current) => current.map((run) => (
          run.id === sink.id
            ? { ...run, images: info.images, imageProgress: { done: info.done, total: info.total } }
            : run
        )))
      },
      signal: controller.signal,
    }

    try {
      appendAgentLog(`Workflow: ${enabledSteps.length} steps`)

      for (let index = 0; index < enabledSteps.length; index += 1) {
        const stepId = enabledSteps[index]
        setAgentActiveStep(stepId)
        appendAgentLog(`→ Step ${index + 1}/${enabledSteps.length}`)

        pipelineCtx.progressBase = index / enabledSteps.length
        pipelineCtx.progressSpan = 1 / enabledSteps.length
        pipelineCtx.workingShots = workingShots
        pipelineCtx.workingMaster = workingMaster

        const result = await executeAgentStep(stepId, pipelineCtx)
        workingShots = result.workingShots
        workingMaster = result.workingMaster
        if (result.exportUrl) {
          exportResult = { url: result.exportUrl, filename: result.exportFilename }
        }

        finishedSteps.push(stepId)
        setAgentCompletedSteps((current) => [...current, stepId])
      }

      if (workingShots.length === 0) {
        throw new Error('Workflow finished but timeline has no shots.')
      }

      setAgentProgress(1)
      notify(exportResult ? 'Workflow finished. The video is in Chat.' : 'Workflow finished successfully.')
      appendAgentLog('Done — automation complete.')
      if (chatRunId) {
        setChatRuns((current) => current.map((run) => (
          run.id === chatRunId
            ? { ...run, status: 'done', result: exportResult, completedStepIds: finishedSteps }
            : run
        )))
      }
    } catch (error) {
      if (isAgentStop(error)) {
        appendAgentLog('Stopped. Images already generated stay in Media.')
        notify('Agent stopped.')
        if (chatRunId) {
          setChatRuns((current) => current.map((run) => (
            run.id === chatRunId ? { ...run, status: 'stopped', completedStepIds: finishedSteps } : run
          )))
        }
      } else {
        setAgentProgress(0)
        appendAgentLog(`✗ ${error instanceof Error ? error.message : 'Workflow failed'}`)
        notify(error instanceof Error ? error.message : 'Workflow failed.')
        if (chatRunId) {
          setChatRuns((current) => current.map((run) => (
            run.id === chatRunId ? { ...run, status: 'error', completedStepIds: finishedSteps } : run
          )))
        }
      }
    } finally {
      if (agentAbortRef.current === controller) {
        agentAbortRef.current = null
      }
      if (chatRunId && chatSinkRef.current?.id === chatRunId) {
        chatSinkRef.current = null
      }
      setAgentRunning(false)
      setAgentStopping(false)
      setAgentActiveStep(null)
      setGeneratingTTS(false)
      setSplicing(false)
      setExporting(false)
    }
  }, [
    agentRunning,
    agentSettings,
    shots,
    masterAudio,
    appendAgentLog,
    getTtsOptions,
    setGeneratingTTS,
    setSplicing,
    setExporting,
    setShots,
    assignShots,
    setSelectedId,
    setCurrentTime,
    setProjectName,
    setPlatformTemplateId,
    setAudioTracks,
    setMasterAudio,
    revokeMasterAudio,
    buildSplicedMasterUrl,
    getAudioDuration,
    notify,
  ])

  const acceptChatSubject = useCallback((subject) => {
    const trimmed = subject.trim()
    if (!trimmed || agentRunning) {
      return
    }
    const maxImages = getMaxImages(agentSettings) || 20
    const next = {
      ...applyProductionDefaults(
        { ...agentSettings, projectBrief: trimmed, maxImages },
        { workflowPreset: 'fullCreate' },
      ),
      maxImages,
      scriptMaxShots: maxImages,
      maxShots: maxImages,
    }
    setAgentSettings(next)
    saveAgentSettings(next)
    if (next.platformTemplateId) {
      selectPlatformTemplate(next.platformTemplateId)
    }
    const id = `${Date.now()}`
    const steps = getEnabledWorkflowSteps(next)
    chatSinkRef.current = { id, logs: [], images: [] }
    setChatRuns((current) => [
      ...current,
      { id, subject: trimmed, status: 'running', logs: [], images: [], imageProgress: null, result: null, steps, completedStepIds: [] },
    ])
    runVideoAgent(next, id)
  }, [agentRunning, agentSettings, setAgentSettings, selectPlatformTemplate, runVideoAgent])

  return {
    agentRunning,
    agentStopping,
    agentProgress,
    agentLogs,
    agentActiveStep,
    agentCompletedSteps,
    chatRuns,
    runVideoAgent,
    stopVideoAgent,
    openAgentTaskPage,
    acceptChatSubject,
    requestCostMode,
    confirmCostMode,
  }
}
