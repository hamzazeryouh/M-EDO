import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CostModeDialog from './components/CostModeDialog'
import ClipContextMenu from './components/ClipContextMenu'
import InspectorPanel from './components/InspectorPanel'
import LeftSidebar from './components/LeftSidebar'
import PreviewPanel from './components/PreviewPanel'
import StatusBar from './components/StatusBar'
import Timeline from './components/Timeline'
import ToolsBar from './components/ToolsBar'
import Toolbar from './components/Toolbar'
import {
  ANIMATIONS,
  DEFAULT_DURATION,
  DEFAULT_FPS,
  PRESETS,
  applyPreset,
  applyRandomMix,
  createGeneratedShot,
  createShot,
  formatTime,
} from './constants'
import { useHistoryState } from './hooks/useHistoryState'
import { buildSplicedMasterUrl, getAudioDuration } from './utils/audioMixer'
import { loadKoreaProject } from './utils/loadKoreaProject'
import { generateTTSForShots, synthesizeText } from './utils/textToSpeech'
import { duplicateShot, setShotDuration, splitShotsAtTime } from './utils/clipOps'
import { getShotStarts } from './utils/timeline'
import {
  DEFAULT_PLATFORM_TEMPLATE_ID,
  applyPlatformTemplateToShots,
  getPlatformTemplate,
} from './platformTemplates'
import { executeAgentStep } from './utils/agentPipeline'
import { isAgentStop } from './utils/agentStop'
import {
  getActiveTtsConfig,
  getMaxImages,
  loadAgentSettings,
  saveAgentSettings,
} from './utils/agentSettings'
import { getAudioMatchSlotDuration, matchShotsToAudio } from './utils/matchShotsToAudio'
import { loadVikingProject } from './utils/loadVikingProject'
import { applyCostMode } from './utils/costMode'
import { applyProductionDefaults } from './utils/productionDefaults'
import { revalidateShotImages } from './utils/shotImages'
import { VIKING_AGENT_PRESET, VIKING_PROJECT_BRIEF } from './utils/vikingProject'
import { applyWorkflowPreset, getEnabledWorkflowSteps, getWorkflowDef, syncStepsFromWorkflow } from './utils/workflowSteps'
import {
  buildProjectSnapshot,
  createEmptyProject,
  deleteProjectById,
  deserializeShots,
  duplicateProjectRecord,
  loadProjectById,
  loadRegistry,
  saveProjectRecord,
  setActiveProjectId,
  uniqueProjectName,
} from './utils/projectStore'
import { downloadBlob, exportVideo, supportsMp4Export } from './utils/videoExport'
import './index.css'

async function parseManifestFromFiles(files) {
  const manifestFile = files.find((file) => file.name === 'manifest.json')
  if (manifestFile) {
    return JSON.parse(await manifestFile.text())
  }
  const jsonFiles = files.filter((file) => file.name.toLowerCase().endsWith('.json'))
  if (jsonFiles.length === 1) {
    return JSON.parse(await jsonFiles[0].text())
  }
  return null
}

function buildShotsFromManifest(manifest, imageFiles) {
  const byName = new Map(imageFiles.map((file) => [file.name, file]))
  return manifest.images
    .map((entry) => {
      const file = byName.get(entry.file)
      if (file) {
        return createShot(file, {
          voice: entry.voice ?? '',
          imagePrompt: entry.imagePrompt ?? entry.prompt ?? '',
          name: `Shot ${String(entry.shot).padStart(3, '0')}`,
          shotNumber: entry.shot,
        })
      }
      return createGeneratedShot({
        shot: entry.shot,
        voice: entry.voice ?? '',
        imagePrompt: entry.imagePrompt ?? entry.prompt ?? '',
        src: null,
      })
    })
    .filter(Boolean)
}

function isVikingManifest(manifest) {
  const title = manifest.title ?? ''
  return Boolean(manifest.visualStyle) || /viking/i.test(title)
}

export default function App() {
  const { value: shots, set: setShots, assign: assignShots, replace: replaceShots, undo, redo, canUndo, canRedo } = useHistoryState([])
  const [selectedId, setSelectedId] = useState(null)
  const [clipMenu, setClipMenu] = useState(null)
  const [dragFromIndex, setDragFromIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [timelineZoom, setTimelineZoom] = useState(1)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [loadingProject, setLoadingProject] = useState(true)
  const [mp4Ready, setMp4Ready] = useState(false)
  const [message, setMessage] = useState('')
  const [audioTracks, setAudioTracks] = useState([])
  const [masterAudio, setMasterAudio] = useState(null)
  const [splicing, setSplicing] = useState(false)
  const [audioDragFromIndex, setAudioDragFromIndex] = useState(null)
  const [audioDragOverIndex, setAudioDragOverIndex] = useState(null)
  const [ttsVoice, setTtsVoice] = useState('ar-MA-MounaNeural')
  const [ttsRate, setTtsRate] = useState('+0%')
  const [ttsDelivery, setTtsDelivery] = useState('human')
  const [ttsMatchDuration, setTtsMatchDuration] = useState(true)
  const [generatingTTS, setGeneratingTTS] = useState(false)
  const [ttsProgress, setTtsProgress] = useState(0)
  const [sidebarTab, setSidebarTab] = useState(() => {
    if (typeof window === 'undefined') {
      return 'projects'
    }
    return window.localStorage.getItem('iv-sidebar-tab') || 'projects'
  })
  const [projectFocusMode, setProjectFocusMode] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }
    return window.localStorage.getItem('iv-project-focus') === 'on'
  })
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') {
      return true
    }
    return window.localStorage.getItem('iv-left-sidebar') !== 'closed'
  })
  const [rightSidebarOpen, setRightSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') {
      return true
    }
    return window.localStorage.getItem('iv-right-sidebar') !== 'closed'
  })
  const [timelineHeight, setTimelineHeight] = useState(() => {
    if (typeof window === 'undefined') {
      return 280
    }
    const saved = Number(window.localStorage.getItem('iv-timeline-height'))
    return Number.isFinite(saved) && saved >= 180 ? saved : 280
  })
  const [projectName, setProjectName] = useState('Untitled Sequence')
  const [activeProjectId, setActiveProjectIdState] = useState(null)
  const [projectList, setProjectList] = useState([])
  const [projectSaving, setProjectSaving] = useState(false)
  const [projectCreatedAt, setProjectCreatedAt] = useState(null)
  const projectInitRef = useRef(false)
  const [platformTemplateId, setPlatformTemplateId] = useState(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_PLATFORM_TEMPLATE_ID
    }
    return window.localStorage.getItem('iv-platform-template') || DEFAULT_PLATFORM_TEMPLATE_ID
  })
  const [agentSettings, setAgentSettings] = useState(loadAgentSettings)
  const [agentRunning, setAgentRunning] = useState(false)
  const [agentStopping, setAgentStopping] = useState(false)
  const [agentProgress, setAgentProgress] = useState(0)
  const [agentLogs, setAgentLogs] = useState([])
  const [agentActiveStep, setAgentActiveStep] = useState(null)
  const [agentCompletedSteps, setAgentCompletedSteps] = useState([])
  const [chatRuns, setChatRuns] = useState([])
  const [costModePrompt, setCostModePrompt] = useState(null)
  const chatSinkRef = useRef(null)
  const agentAbortRef = useRef(null)
  const imageInputRef = useRef(null)
  const manifestInputRef = useRef(null)
  const audioInputRef = useRef(null)

  const selectedShot = useMemo(
    () => shots.find((shot) => shot.id === selectedId) ?? null,
    [shots, selectedId],
  )
  const selectedIndex = shots.findIndex((shot) => shot.id === selectedId)
  const duration = useMemo(() => shots.reduce((sum, shot) => sum + shot.duration, 0), [shots])
  const audioCount = shots.filter((shot) => shot.audioSrc).length
  const readyCount = shots.filter((shot) => !shot.missingImage).length
  const missingCount = shots.filter((shot) => shot.missingImage).length
  const shotsWithVoice = shots.filter((shot) => shot.voice?.trim()).length
  const platformTemplate = useMemo(
    () => getPlatformTemplate(platformTemplateId),
    [platformTemplateId],
  )

  useEffect(() => {
    supportsMp4Export(platformTemplate.width, platformTemplate.height).then(setMp4Ready)
  }, [platformTemplate.width, platformTemplate.height])

  useEffect(() => {
    initializeProjects()
  }, [])

  useEffect(() => {
    if (!activeProjectId || loadingProject || !projectInitRef.current) {
      return undefined
    }
    const timer = window.setTimeout(() => {
      saveCurrentProject({ silent: true })
    }, 1800)
    return () => window.clearTimeout(timer)
  }, [shots, projectName, platformTemplateId, agentSettings.projectBrief, activeProjectId])

  useEffect(() => {
    if (currentTime > duration) {
      setCurrentTime(duration)
    }
  }, [duration, currentTime])

  const togglePlay = useCallback(() => {
    if (shots.length === 0) {
      return
    }
    setPlaying((value) => !value)
  }, [shots.length])

  const goToStart = useCallback(() => {
    setCurrentTime(0)
    setPlaying(false)
  }, [])

  const goToPrevShot = useCallback(() => {
    const segments = getShotStarts(shots)
    const currentIndex = segments.findIndex(({ start, end }) => currentTime >= start && currentTime < end)
    const target = currentIndex > 0 ? segments[currentIndex - 1] : segments[0]
    if (target) {
      setSelectedId(target.shot.id)
      setCurrentTime(target.start)
      setPlaying(false)
    }
  }, [shots, currentTime])

  const goToNextShot = useCallback(() => {
    const segments = getShotStarts(shots)
    const currentIndex = segments.findIndex(({ start, end }) => currentTime >= start && currentTime < end)
    const target = currentIndex >= 0 && currentIndex < segments.length - 1 ? segments[currentIndex + 1] : segments.at(-1)
    if (target) {
      setSelectedId(target.shot.id)
      setCurrentTime(target.start)
      setPlaying(false)
    }
  }, [shots, currentTime])

  useEffect(() => {
    function onKeyDown(event) {
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return
      }
      if (event.code === 'Space') {
        event.preventDefault()
        togglePlay()
      } else if (event.code === 'ArrowLeft') {
        event.preventDefault()
        goToPrevShot()
      } else if (event.code === 'ArrowRight') {
        event.preventDefault()
        goToNextShot()
      } else if (event.code === 'Home') {
        event.preventDefault()
        goToStart()
      } else if ((event.code === 'KeyS' || event.key === 's') && !event.ctrlKey) {
        event.preventDefault()
        splitAtPlayhead()
      } else if (event.code === 'Delete' && selectedId) {
        event.preventDefault()
        removeShot(selectedId)
      } else if (event.ctrlKey && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undo()
      } else if (event.ctrlKey && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [togglePlay, goToPrevShot, goToNextShot, goToStart, selectedId, undo, redo])

  function refreshProjectList(registry = loadRegistry()) {
    setProjectList(registry.projects)
    return registry
  }

  async function applyProjectToEditor(project) {
    const loaded = await revalidateShotImages(deserializeShots(project.shots))
    replaceShots(loaded)
    setProjectName(project.name)
    setPlatformTemplateId(project.platformTemplateId || DEFAULT_PLATFORM_TEMPLATE_ID)
    setProjectCreatedAt(project.createdAt)
    setAgentSettings((current) => {
      const next = { ...current, projectBrief: project.projectBrief ?? '' }
      saveAgentSettings(next)
      return next
    })
    setSelectedId(project.shots[0]?.id ?? null)
    setCurrentTime(0)
    setPlaying(false)
    clearAllAudio()
  }

  async function saveCurrentProject({ silent = false } = {}) {
    if (!activeProjectId) {
      return null
    }
    setProjectSaving(true)
    try {
      const snapshot = await buildProjectSnapshot({
        id: activeProjectId,
        name: projectName,
        platformTemplateId,
        projectBrief: agentSettings.projectBrief,
        shots,
        createdAt: projectCreatedAt,
      })
      const registry = saveProjectRecord(snapshot)
      setActiveProjectId(snapshot.id)
      setActiveProjectIdState(snapshot.id)
      refreshProjectList(registry)
      if (!silent) {
        setMessage(`Saved "${snapshot.name}".`)
      }
      return snapshot
    } catch (error) {
      if (!silent) {
        setMessage(error instanceof Error ? error.message : 'Could not save project.')
      }
      return null
    } finally {
      setProjectSaving(false)
    }
  }

  async function switchToProject(projectId) {
    if (projectId === activeProjectId) {
      return
    }
    if (activeProjectId) {
      await saveCurrentProject({ silent: true })
    }
    const project = loadProjectById(projectId)
    if (!project) {
      setMessage('Project not found.')
      return
    }
    setActiveProjectId(project.id)
    setActiveProjectIdState(project.id)
    await applyProjectToEditor(project)
    setMessage(`Opened "${project.name}".`)
  }

  async function createProjectFromSnapshot(snapshot) {
    if (activeProjectId) {
      await saveCurrentProject({ silent: true })
    }
    saveProjectRecord(snapshot)
    setActiveProjectId(snapshot.id)
    setActiveProjectIdState(snapshot.id)
    await applyProjectToEditor(snapshot)
    refreshProjectList()
    setMessage(`Created "${snapshot.name}".`)
  }

  async function initializeProjects() {
    setLoadingProject(true)
    try {
      let registry = refreshProjectList()
      if (registry.projects.length === 0) {
        const { shots: loadedShots } = await loadKoreaProject()
        const snapshot = await buildProjectSnapshot({
          id: crypto.randomUUID(),
          name: 'Korea Documentary',
          platformTemplateId: DEFAULT_PLATFORM_TEMPLATE_ID,
          projectBrief: '',
          shots: applyPreset(loadedShots, 'documentary'),
          createdAt: new Date().toISOString(),
        })
        registry = saveProjectRecord(snapshot)
        setActiveProjectId(snapshot.id)
        setActiveProjectIdState(snapshot.id)
        await applyProjectToEditor(snapshot)
        refreshProjectList(registry)
        setMessage(`Loaded ${snapshot.shots.length} shots into your first project.`)
      } else {
        const activeId = registry.activeId ?? registry.projects[0]?.id
        const project = loadProjectById(activeId)
        if (project) {
          setActiveProjectId(project.id)
          setActiveProjectIdState(project.id)
          await applyProjectToEditor(project)
        }
      }
      projectInitRef.current = true
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load projects.')
      projectInitRef.current = true
    } finally {
      setLoadingProject(false)
    }
  }

  async function createEmptyProjectAction() {
    const project = createEmptyProject(uniqueProjectName('Untitled Project', projectList))
    await createProjectFromSnapshot(project)
  }

  async function createVikingProjectAction(maxShots = 0) {
    setLoadingProject(true)
    try {
      const { shots: loadedShots, title, totalCount, missingCount } = await loadVikingProject({ maxShots })
      const workflow = applyWorkflowPreset(maxShots > 0 ? 'vikingTest' : 'fullVideo')
      const snapshot = await buildProjectSnapshot({
        id: crypto.randomUUID(),
        name: uniqueProjectName(maxShots > 0 ? `Viking Test (${maxShots})` : title, projectList),
        platformTemplateId: VIKING_AGENT_PRESET.platformTemplateId,
        projectBrief: VIKING_PROJECT_BRIEF,
        shots: applyPreset(loadedShots, 'cinematic'),
        createdAt: new Date().toISOString(),
      })
      await createProjectFromSnapshot(snapshot)
      setPlatformTemplateId(VIKING_AGENT_PRESET.platformTemplateId)
      setAgentSettings((current) => {
        const next = applyProductionDefaults(
          {
            ...current,
            ...VIKING_AGENT_PRESET,
            maxShots: maxShots > 0 ? maxShots : VIKING_AGENT_PRESET.maxShots,
            scriptMaxShots: maxShots > 0 ? maxShots : VIKING_AGENT_PRESET.scriptMaxShots,
            workflow,
          },
          { workflowPreset: maxShots > 0 ? 'vikingTest' : 'fullVideo' },
        )
        saveAgentSettings(next)
        return next
      })
      setMessage(
        `Viking: ${totalCount} shots, ${missingCount} need images. Arabic OpenAI TTS · YouTube HD · gpt-image-1.`,
      )
      return snapshot
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load Viking project.')
      return null
    } finally {
      setLoadingProject(false)
    }
  }

  async function runVikingAutoTest(shotCount = 10) {
    const snapshot = await createVikingProjectAction(shotCount)
    if (!snapshot) {
      return
    }
    const workflow = applyWorkflowPreset('vikingTest')
    const settings = {
      ...agentSettings,
      ...VIKING_AGENT_PRESET,
      maxShots: shotCount,
      scriptMaxShots: shotCount,
      workflow,
      steps: syncStepsFromWorkflow(workflow),
    }
    setAgentSettings(settings)
    saveAgentSettings(settings)
    setMessage(`Auto-testing Viking shots 1–${shotCount} — generating images + export…`)
    await runVideoAgent(settings)
  }

  async function createKoreaProjectAction() {
    setLoadingProject(true)
    try {
      const { shots: loadedShots } = await loadKoreaProject()
      const snapshot = await buildProjectSnapshot({
        id: crypto.randomUUID(),
        name: uniqueProjectName('Korea Documentary', projectList),
        platformTemplateId: DEFAULT_PLATFORM_TEMPLATE_ID,
        projectBrief: '',
        shots: applyPreset(loadedShots, 'documentary'),
        createdAt: new Date().toISOString(),
      })
      await createProjectFromSnapshot(snapshot)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load Korea template.')
    } finally {
      setLoadingProject(false)
    }
  }

  async function duplicateActiveProjectAction() {
    const current = loadProjectById(activeProjectId)
    if (!current) {
      return
    }
    const duplicate = duplicateProjectRecord(
      current,
      uniqueProjectName(`${current.name} (copy)`, projectList),
    )
    await createProjectFromSnapshot(duplicate)
  }

  async function renameActiveProjectAction(name) {
    setProjectName(name)
    await saveCurrentProject()
  }

  async function deleteProjectAction(projectId) {
    const registry = deleteProjectById(projectId)
    refreshProjectList(registry)
    if (registry.activeId && registry.activeId !== activeProjectId) {
      const project = loadProjectById(registry.activeId)
      if (project) {
        setActiveProjectId(project.id)
        setActiveProjectIdState(project.id)
        await applyProjectToEditor(project)
      }
    } else if (!registry.activeId) {
      setActiveProjectIdState(null)
      replaceShots([])
      setProjectName('Untitled Sequence')
      setSelectedId(null)
      clearAllAudio()
    }
    setMessage('Project deleted.')
  }

  async function loadKoreaProjectOnStart() {
    setLoadingProject(true)
    try {
      const { shots: loadedShots, readyCount, missingCount } = await loadKoreaProject()
      replaceShots(applyPreset(loadedShots, 'documentary'))
      setSelectedId(loadedShots[0]?.id ?? null)
      setCurrentTime(0)
      setProjectName('Korea Documentary')
      await saveCurrentProject({ silent: true })
      setMessage(
        missingCount === 0
          ? `Loaded ${readyCount} shots into current project.`
          : `Loaded ${loadedShots.length} shots — ${readyCount} ready, ${missingCount} pending.`,
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load Korea project.')
    } finally {
      setLoadingProject(false)
    }
  }

  function addFiles(fileList) {
    const files = Array.from(fileList).filter((file) => file.type.startsWith('image/'))
    if (files.length === 0) {
      setMessage('No image files found.')
      return
    }
    const nextShots = files
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      .map((file) => createShot(file))
    setShots((current) => [...current, ...nextShots])
    setSelectedId((current) => current ?? nextShots[0]?.id ?? null)
    setMessage(`Added ${nextShots.length} image${nextShots.length === 1 ? '' : 's'}.`)
  }

  async function importManifest(fileList) {
    const files = Array.from(fileList)
    let manifest
    try {
      manifest = await parseManifestFromFiles(files)
    } catch {
      setMessage('Could not parse manifest JSON.')
      return
    }
    if (!manifest?.images?.length) {
      setMessage('No valid manifest found. Select manifest.json or any .json with an images array.')
      return
    }
    const imageFiles = files.filter((file) => file.type.startsWith('image/'))
    const imported = buildShotsFromManifest(manifest, imageFiles)
    const presetId = isVikingManifest(manifest) ? 'cinematic' : 'documentary'
    replaceShots(applyPreset(imported, presetId))
    setSelectedId(imported[0]?.id ?? null)
    setCurrentTime(0)
    setPlaying(false)
    clearAllAudio()
    setProjectName(manifest.title ?? 'Imported Project')

    if (isVikingManifest(manifest)) {
      const workflow = applyWorkflowPreset(imported.length <= 12 ? 'vikingTest' : 'vikingFull')
      setAgentSettings((current) => {
        const next = {
          ...current,
          ...VIKING_AGENT_PRESET,
          projectBrief: manifest.visualStyle
            ? `${VIKING_PROJECT_BRIEF}\n\nVisual style:\n${manifest.visualStyle}`
            : VIKING_PROJECT_BRIEF,
          maxShots: imported.length <= 12 ? imported.length : 0,
          workflow,
          steps: syncStepsFromWorkflow(workflow),
        }
        saveAgentSettings(next)
        return next
      })
    }

    const withImages = imported.filter((shot) => !shot.missingImage).length
    const promptOnly = imported.length - withImages
    await saveCurrentProject({ silent: true })
    setMessage(
      promptOnly > 0
        ? `Imported ${imported.length} shots (${promptOnly} prompts only — use Agent → Generate images).`
        : `Imported ${imported.length} shots with images from manifest.`,
    )
  }

  function updateShot(id, patch) {
    setShots((current) => current.map((shot) => (shot.id === id ? { ...shot, ...patch } : shot)))
  }

  function changeShotDuration(id, seconds) {
    if (!Number.isFinite(seconds) || seconds < 0.5) {
      return
    }
    setShots((current) => setShotDuration(current, id, seconds))
  }

  function splitAtPlayhead() {
    const result = splitShotsAtTime(shots, currentTime)
    if (result.error) {
      setMessage(result.error)
      return
    }
    setShots(result.shots)
    setSelectedId(result.selectedId)
    setCurrentTime(result.seekTime)
    setPlaying(false)
    setMessage('Clip split at playhead.')
  }

  function duplicateSelectedShot() {
    if (!selectedId) {
      return
    }
    setShots((current) => duplicateShot(current, selectedId))
    setMessage('Clip duplicated.')
  }

  function openClipMenu(event, shotId) {
    event.preventDefault()
    event.stopPropagation()
    setSelectedId(shotId)
    const menuWidth = 248
    const menuHeight = 320
    setClipMenu({
      shotId,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
    })
  }

  function renameShot(id, name) {
    updateShot(id, { name })
    setMessage(`Renamed clip to "${name}".`)
  }

  function duplicateShotById(id) {
    setShots((current) => duplicateShot(current, id))
    setMessage('Clip duplicated.')
  }

  function clearShotAudio(id) {
    setShots((current) => current.map((shot) => {
      if (shot.id !== id) {
        return shot
      }
      if (shot.audioSrc?.startsWith('blob:')) {
        URL.revokeObjectURL(shot.audioSrc)
      }
      return { ...shot, audioSrc: null, audioName: '' }
    }))
    setMessage('Narration removed from clip.')
  }

  function removeShot(id) {
    setShots((current) => {
      const removed = current.find((shot) => shot.id === id)
      if (removed?.audioSrc) {
        URL.revokeObjectURL(removed.audioSrc)
      }
      const next = current.filter((shot) => shot.id !== id)
      if (selectedId === id) {
        setSelectedId(next[0]?.id ?? null)
      }
      return next
    })
  }

  function reorderShots(toIndex) {
    if (dragFromIndex === null || dragFromIndex === toIndex) {
      setDragFromIndex(null)
      setDragOverIndex(null)
      return
    }
    setShots((current) => {
      const next = [...current]
      const [moved] = next.splice(dragFromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
    setDragFromIndex(null)
    setDragOverIndex(null)
  }

  function applyAnimationToAll(animation) {
    setShots((current) => current.map((shot) => ({ ...shot, animation })))
    setMessage(`Applied "${animation}" to all shots.`)
  }

  function applyDurationToAll(seconds) {
    setShots((current) => current.map((shot) => ({ ...shot, duration: seconds })))
    setMessage(`Set ${seconds}s duration on all shots.`)
  }

  function applySelectedPreset(presetId) {
    setShots((current) => applyPreset(current, presetId))
    setMessage(`Applied "${PRESETS.find((item) => item.id === presetId)?.label ?? presetId}" preset.`)
  }

  function selectPlatformTemplate(templateId, { adjustShots = false } = {}) {
    const template = getPlatformTemplate(templateId)
    setPlatformTemplateId(template.id)
    window.localStorage.setItem('iv-platform-template', template.id)
    if (adjustShots && shots.length > 0) {
      setShots((current) => applyPlatformTemplateToShots(current, template.id))
      setMessage(`Applied ${template.label} — ${template.width}×${template.height}, ${template.defaultShotDuration}s clips.`)
    } else {
      setMessage(`Export format: ${template.label} (${template.width}×${template.height} · ${template.aspect}).`)
    }
  }

  function randomizeMix() {
    setShots((current) => applyRandomMix(current))
    setMessage('Random animation & transition applied.')
  }

  function revokeMasterAudio() {
    if (masterAudio?.src) {
      URL.revokeObjectURL(masterAudio.src)
    }
  }

  async function addAudioTracks(fileList) {
    const files = Array.from(fileList).filter((file) => file.type.startsWith('audio/'))
    if (files.length === 0) {
      setMessage('No audio files found.')
      return
    }
    const nextTracks = await Promise.all(
      files.map(async (file) => {
        const src = URL.createObjectURL(file)
        return { id: crypto.randomUUID(), name: file.name, src, duration: await getAudioDuration(src).catch(() => 0) }
      }),
    )
    const combined = [...audioTracks, ...nextTracks]
    setAudioTracks(combined)
    setMessage(`Imported ${nextTracks.length} audio file${nextTracks.length === 1 ? '' : 's'}. Drag ↑↓ to reorder, then Splice.`)
  }

  async function spliceAudioTracksNow(tracks = audioTracks) {
    if (tracks.length === 0) {
      revokeMasterAudio()
      setMasterAudio(null)
      return
    }
    setSplicing(true)
    try {
      revokeMasterAudio()
      const spliced = await buildSplicedMasterUrl(tracks)
      setMasterAudio(spliced)
      setMessage(`Master audio ready: ${spliced.name}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Audio splice failed.')
    } finally {
      setSplicing(false)
    }
  }

  function removeAudioTrack(id) {
    const removed = audioTracks.find((track) => track.id === id)
    if (removed?.src) {
      URL.revokeObjectURL(removed.src)
    }
    const next = audioTracks.filter((track) => track.id !== id)
    setAudioTracks(next)
    revokeMasterAudio()
    setMasterAudio(null)
    setMessage('Audio removed. Click Splice again after reordering.')
  }

  function reorderAudioTracks(toIndex) {
    if (audioDragFromIndex === null || audioDragFromIndex === toIndex) {
      setAudioDragFromIndex(null)
      setAudioDragOverIndex(null)
      return
    }
    const next = [...audioTracks]
    const [moved] = next.splice(audioDragFromIndex, 1)
    next.splice(toIndex, 0, moved)
    setAudioTracks(next)
    revokeMasterAudio()
    setMasterAudio(null)
    setMessage('Audio order updated. Click Splice to rebuild master track.')
    setAudioDragFromIndex(null)
    setAudioDragOverIndex(null)
  }

  function moveAudioTrack(index, direction) {
    const target = index + direction
    if (target < 0 || target >= audioTracks.length) {
      return
    }
    const next = [...audioTracks]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    setAudioTracks(next)
    revokeMasterAudio()
    setMasterAudio(null)
    setMessage('Audio order updated. Click Splice to rebuild master track.')
  }

  function clearAllAudio() {
    audioTracks.forEach((track) => {
      if (track.src) {
        URL.revokeObjectURL(track.src)
      }
    })
    revokeMasterAudio()
    setAudioTracks([])
    setMasterAudio(null)
    setMessage('Cleared all audio tracks.')
  }

  function getTtsOptions(overrides = {}) {
    const { provider, config } = getActiveTtsConfig(agentSettings)
    return {
      provider,
      config,
      voice: ttsVoice,
      rate: ttsRate,
      delivery: ttsDelivery,
      ...overrides,
    }
  }

  async function generateTTSForAllShots() {
    if (shotsWithVoice === 0) {
      setMessage('No voice text found on shots.')
      return
    }
    setGeneratingTTS(true)
    setTtsProgress(0)
    try {
      const updated = await generateTTSForShots(shots, {
        ...getTtsOptions(),
        matchDuration: ttsMatchDuration,
        onProgress: (progress) => setTtsProgress(progress),
      })
      setShots(updated)
      setMessage(`Generated TTS for ${shotsWithVoice} shots.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'TTS generation failed.')
    } finally {
      setGeneratingTTS(false)
      setTtsProgress(0)
    }
  }

  async function generateTTSForSelectedShot() {
    if (!selectedShot?.voice?.trim()) {
      setMessage('Selected shot has no voice text.')
      return
    }
    setGeneratingTTS(true)
    try {
      if (selectedShot.audioSrc?.startsWith('blob:')) {
        URL.revokeObjectURL(selectedShot.audioSrc)
      }
      const result = await synthesizeText(selectedShot.voice, getTtsOptions())
      updateShot(selectedShot.id, {
        audioSrc: result.src,
        audioName: `TTS ${selectedShot.name}`,
        duration: ttsMatchDuration
          ? Math.max(0.5, Math.round((result.duration + 0.25) * 10) / 10)
          : selectedShot.duration,
      })
      setMessage(`TTS generated for ${selectedShot.name}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'TTS generation failed.')
    } finally {
      setGeneratingTTS(false)
    }
  }

  function synthesizePreview(text, overrides = {}) {
    return synthesizeText(text, getTtsOptions(overrides))
  }

  async function generatePreviewOnShot(text, overrides = {}) {
    if (!selectedShot) {
      throw new Error('Select a shot first.')
    }
    const trimmed = text.trim()
    if (!trimmed) {
      throw new Error('Type narration text first.')
    }
    setGeneratingTTS(true)
    try {
      if (selectedShot.audioSrc?.startsWith('blob:')) {
        URL.revokeObjectURL(selectedShot.audioSrc)
      }
      const result = await synthesizeText(trimmed, getTtsOptions(overrides))
      updateShot(selectedShot.id, {
        voice: trimmed,
        audioSrc: result.src,
        audioName: `TTS ${selectedShot.name}`,
        duration: ttsMatchDuration
          ? Math.max(0.5, Math.round((result.duration + 0.25) * 10) / 10)
          : selectedShot.duration,
      })
      setMessage(`Audio added to ${selectedShot.name}.`)
      return result
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'TTS generation failed.')
      throw error
    } finally {
      setGeneratingTTS(false)
    }
  }

  async function spliceShotsAudioToMaster() {    const withAudio = shots.filter((shot) => shot.audioSrc)
    if (withAudio.length === 0) {
      setMessage('Generate or upload per-shot audio first.')
      return
    }
    setSplicing(true)
    try {
      const tracks = await Promise.all(
        withAudio.map(async (shot) => ({
          id: shot.id,
          name: shot.audioName || shot.name,
          src: shot.audioSrc,
          duration: await getAudioDuration(shot.audioSrc).catch(() => shot.duration),
        })),
      )
      setAudioTracks(tracks)
      await spliceAudioTracksNow(tracks)
      setMessage(`Spliced ${tracks.length} clips into master track.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Splice failed.')
    } finally {
      setSplicing(false)
    }
  }

  function fitShotsToMasterAudio() {
    if (!masterAudio) {
      setMessage('Splice audio first, then fit shots.')
      return
    }
    const slotDuration = getAudioMatchSlotDuration(agentSettings)
    setShots((current) => matchShotsToAudio(current, masterAudio.duration, {
      mode: agentSettings.audioMatchMode ?? 'loopRandom',
      perShotDuration: slotDuration,
      stylePresetId: agentSettings.stylePresetId,
      randomize: true,
    }))
    setMessage(
      agentSettings.audioMatchMode === 'stretch'
        ? 'Shot lengths stretched to master audio.'
        : 'Images looped & mixed randomly to match long audio.',
    )
  }

  function appendAgentLog(entry) {
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
  }

  function requestCostMode(modeId) {
    if (!modeId || modeId === agentSettings.costMode || agentRunning) {
      return
    }
    setCostModePrompt(modeId)
  }

  function confirmCostMode() {
    if (!costModePrompt) {
      return
    }
    const next = applyCostMode(agentSettings, costModePrompt)
    setAgentSettings(next)
    saveAgentSettings(next)
    setCostModePrompt(null)
    setMessage(`Cost mode is now ${next.costMode} for this project. Max images stays at ${next.maxImages}.`)
  }

  function acceptChatSubject(subject) {
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
  }

  function stopVideoAgent() {
    if (!agentAbortRef.current && !agentRunning) {
      return
    }
    setAgentStopping(true)
    agentAbortRef.current?.abort()
    setMessage('Killing agent task…')
  }

  function openAgentTaskPage() {
    handleSidebarTabChange('chat')
    handleProjectFocusChange(false)
  }

  async function runVideoAgent(settingsOverride = null, chatRunId = null) {
    if (agentRunning) {
      return
    }

    const settings = settingsOverride ?? agentSettings
    if (!chatRunId) {
      chatSinkRef.current = null
    }
    const enabledSteps = getEnabledWorkflowSteps(settings)
    if (enabledSteps.length === 0) {
      setMessage('Add at least one enabled step to the workflow.')
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
      setMessage(exportResult ? 'Workflow finished. The video is in Chat.' : 'Workflow finished successfully.')
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
        setMessage('Agent stopped.')
        if (chatRunId) {
          setChatRuns((current) => current.map((run) => (
            run.id === chatRunId ? { ...run, status: 'stopped', completedStepIds: finishedSteps } : run
          )))
        }
      } else {
        setAgentProgress(0)
        appendAgentLog(`✗ ${error instanceof Error ? error.message : 'Workflow failed'}`)
        setMessage(error instanceof Error ? error.message : 'Workflow failed.')
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
  }

  async function handleExport(testShotCount = null) {
    const exportShots = testShotCount ? shots.slice(0, testShotCount) : shots
    if (exportShots.length === 0) {
      return
    }
    setExporting(true)
    setExportProgress(0)
    setPlaying(false)
    try {
      let usedWebmFallback = false
      const blob = await exportVideo(exportShots, {
        fps: platformTemplate.fps ?? DEFAULT_FPS,
        width: platformTemplate.width,
        height: platformTemplate.height,
        format: 'mp4',
        masterAudioSrc: masterAudio?.src ?? null,
        onProgress: setExportProgress,
        onFallback: () => {
          usedWebmFallback = true
        },
      })
      const extension = blob.type.includes('mp4') ? 'mp4' : 'webm'
      downloadBlob(blob, `${testShotCount ? `test-${testShotCount}shots` : 'video'}-${Date.now()}.${extension}`)
      setMessage(
        usedWebmFallback
          ? `Export complete — WebM downloaded (MP4 needs Chrome/Edge with WebCodecs).`
          : `Export complete — ${extension.toUpperCase()} downloaded.`,
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Export failed.')
    } finally {
      setExporting(false)
      setExportProgress(0)
    }
  }

  const handleSidebarTabChange = useCallback((tabId) => {
    setSidebarTab(tabId)
    window.localStorage.setItem('iv-sidebar-tab', tabId)
    setLeftSidebarOpen(true)
    window.localStorage.setItem('iv-left-sidebar', 'open')
  }, [])

  const handleProjectFocusChange = useCallback((enabled) => {
    setProjectFocusMode(enabled)
    window.localStorage.setItem('iv-project-focus', enabled ? 'on' : 'off')
    if (enabled) {
      setLeftSidebarOpen(true)
      window.localStorage.setItem('iv-left-sidebar', 'open')
    }
  }, [])

  const toggleLeftSidebar = useCallback(() => {
    setLeftSidebarOpen((open) => {
      const next = !open
      window.localStorage.setItem('iv-left-sidebar', next ? 'open' : 'closed')
      return next
    })
  }, [])

  const toggleRightSidebar = useCallback(() => {
    setRightSidebarOpen((open) => {
      const next = !open
      window.localStorage.setItem('iv-right-sidebar', next ? 'open' : 'closed')
      return next
    })
  }, [])

  const startTimelineResize = useCallback((event) => {
    event.preventDefault()
    const startY = event.clientY
    const startHeight = timelineHeight

    function onMove(moveEvent) {
      const next = Math.max(180, Math.min(520, startHeight + (startY - moveEvent.clientY)))
      setTimelineHeight(next)
    }

    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setTimelineHeight((height) => {
        window.localStorage.setItem('iv-timeline-height', String(height))
        return height
      })
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [timelineHeight])

  return (
    <div className={`app pro-editor ${leftSidebarOpen ? 'left-sidebar-open' : 'left-sidebar-closed'} ${rightSidebarOpen ? 'right-sidebar-open' : 'right-sidebar-closed'} ${projectFocusMode ? 'project-panel-focus' : ''} ${agentRunning ? 'agent-running' : ''}`}>
      <Toolbar
        leftSidebarOpen={leftSidebarOpen}
        rightSidebarOpen={rightSidebarOpen}
        onToggleLeftSidebar={toggleLeftSidebar}
        onToggleRightSidebar={toggleRightSidebar}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        playing={playing}
        onTogglePlay={togglePlay}
        onPrevShot={goToPrevShot}
        onNextShot={goToNextShot}
        onGoStart={goToStart}
        onImportImages={() => imageInputRef.current?.click()}
        onImportManifest={() => manifestInputRef.current?.click()}
        onImportAudio={() => audioInputRef.current?.click()}
        onReloadProject={loadKoreaProjectOnStart}
        loadingProject={loadingProject}
        onExportTest={() => handleExport(8)}
        onExport={() => handleExport()}
        exporting={exporting}
        exportProgress={exportProgress}
        mp4Ready={mp4Ready}
        shotsCount={shots.length}
        projectName={projectName}
        agentRunning={agentRunning}
        agentProgress={agentProgress}
        agentStepLabel={agentActiveStep ? getWorkflowDef(agentActiveStep)?.shortLabel : ''}
        agentTitle={chatRuns.find((run) => run.status === 'running')?.subject || 'Agent task'}
        agentStopping={agentStopping}
        onOpenAgentPage={openAgentTaskPage}
        onStopAgent={stopVideoAgent}
      />

      <ToolsBar
        shotsCount={shots.length}
        platformTemplateId={platformTemplateId}
        onPlatformTemplateChange={(templateId) => selectPlatformTemplate(templateId)}
        onApplyPreset={applySelectedPreset}
        onRandomizeMix={randomizeMix}
        onApplyDurationToAll={applyDurationToAll}
        onApplyAnimationToAll={applyAnimationToAll}
      />

      <input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = '' }} />
      <input ref={manifestInputRef} type="file" accept="image/*,.json,application/json" multiple hidden onChange={(event) => { if (event.target.files) importManifest(event.target.files); event.target.value = '' }} />
      <input ref={audioInputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg" multiple hidden onChange={(event) => { if (event.target.files) addAudioTracks(event.target.files); event.target.value = '' }} />

      <div className="editor-body">
        <LeftSidebar
          open={leftSidebarOpen}
          onToggle={toggleLeftSidebar}
          activeTab={sidebarTab}
          onTabChange={handleSidebarTabChange}
          projectFocusMode={projectFocusMode}
          onProjectFocusChange={handleProjectFocusChange}
          projectsProps={{
            projects: projectList,
            activeProjectId,
            projectName,
            shotsCount: shots.length,
            sequenceDuration: duration,
            readyCount,
            missingCount,
            shotsWithVoice,
            audioCount,
            saving: projectSaving,
            running: agentRunning,
            progress: agentProgress,
            logs: agentLogs,
            activeStepId: agentActiveStep,
            completedStepIds: agentCompletedSteps,
            workflowSteps: getEnabledWorkflowSteps(agentSettings),
            onSelectProject: switchToProject,
            onCreateEmpty: createEmptyProjectAction,
            onCreateFromKorea: createKoreaProjectAction,
            onDuplicateActive: duplicateActiveProjectAction,
            onRenameActive: renameActiveProjectAction,
            onDeleteProject: deleteProjectAction,
            onSaveNow: () => saveCurrentProject(),
            onLoadVikingFull: () => createVikingProjectAction(0),
            onLoadVikingTest: () => createVikingProjectAction(10),
            onRunVikingAutoTest: () => runVikingAutoTest(10),
            onRunAgent: runVideoAgent,
            onStopAgent: stopVideoAgent,
          }}
          mediaProps={{
            shots,
            selectedId,
            onSelect: (id) => {
              setSelectedId(id)
              const segment = getShotStarts(shots).find((item) => item.shot.id === id)
              if (segment) {
                setCurrentTime(segment.start)
                setPlaying(false)
              }
            },
            onRemove: removeShot,
            dragFromIndex,
            dragOverIndex,
            onDragStart: setDragFromIndex,
            onDragEnter: setDragOverIndex,
            onDragEnd: () => { setDragFromIndex(null); setDragOverIndex(null) },
            onDrop: reorderShots,
            onContextMenu: openClipMenu,
          }}
          chatProps={{
            running: agentRunning,
            progress: agentProgress,
            activeStepId: agentActiveStep,
            completedStepIds: agentCompletedSteps,
            runs: chatRuns,
            onAccept: acceptChatSubject,
            onStop: stopVideoAgent,
            maxImages: getMaxImages(agentSettings) || 20,
            onMaxImagesChange: (value) => {
              setAgentSettings((current) => {
                const next = { ...current, maxImages: value }
                saveAgentSettings(next)
                return next
              })
            },
            onShowEditor: () => handleProjectFocusChange(false),
            onOpenMedia: () => handleSidebarTabChange('media'),
          }}
          studioProps={{
            settings: agentSettings,
            onChange: setAgentSettings,
            onSaveSettings: (next) => saveAgentSettings(next?.target || next?.nativeEvent ? agentSettings : (next ?? agentSettings)),
            onRunAgent: runVideoAgent,
            onStopAgent: stopVideoAgent,
            running: agentRunning,
            progress: agentProgress,
            logs: agentLogs,
            activeStepId: agentActiveStep,
            completedStepIds: agentCompletedSteps,
            projectName,
            shots,
            shotsCount: shots.length,
            readyCount,
            missingCount,
            shotsWithVoice,
            audioCount,
            sequenceDuration: duration,
            masterAudio,
            onApplyProductionDefaults: (next) => {
              selectPlatformTemplate(next.platformTemplateId, { adjustShots: true })
            },
            onRequestCostMode: requestCostMode,
          }}
          agentProps={{
            settings: agentSettings,
            onChange: setAgentSettings,
            onSaveSettings: (next) => saveAgentSettings(next?.target || next?.nativeEvent ? agentSettings : (next ?? agentSettings)),
            onRunAgent: runVideoAgent,
            onStopAgent: stopVideoAgent,
            running: agentRunning,
            progress: agentProgress,
            logs: agentLogs,
            shotsCount: shots.length,
            sequenceDuration: duration,
            shotsWithVoice,
            activeStepId: agentActiveStep,
            completedStepIds: agentCompletedSteps,
            onRunVikingAutoTest: () => runVikingAutoTest(10),
            onRequestCostMode: requestCostMode,
            loadingProject,
          }}
          templateProps={{
            activeTemplateId: platformTemplateId,
            sequenceDuration: duration,
            onSelectTemplate: (templateId) => selectPlatformTemplate(templateId, { adjustShots: true }),
          }}
          audioProps={{
            tracks: audioTracks,
            masterAudio,
            splicing,
            dragFromIndex: audioDragFromIndex,
            dragOverIndex: audioDragOverIndex,
            onAddTracks: addAudioTracks,
            onRemoveTrack: removeAudioTrack,
            onMoveUp: (index) => moveAudioTrack(index, -1),
            onMoveDown: (index) => moveAudioTrack(index, 1),
            onSplice: () => spliceAudioTracksNow(),
            onFitShots: fitShotsToMasterAudio,
            onClearAll: clearAllAudio,
            onDragStart: setAudioDragFromIndex,
            onDragEnter: setAudioDragOverIndex,
            onDragEnd: () => { setAudioDragFromIndex(null); setAudioDragOverIndex(null) },
            onDrop: reorderAudioTracks,
            shotsCount: shots.length,
            sequenceDuration: duration,
            audioMatchMode: agentSettings.audioMatchMode,
            audioMatchShotDuration: agentSettings.audioMatchShotDuration,
            stylePresetId: agentSettings.stylePresetId,
            onMatchSettingsChange: (partial) => {
              setAgentSettings((current) => {
                const next = { ...current, ...partial }
                saveAgentSettings(next)
                return next
              })
            },
          }}
          speechProps={{
            settings: agentSettings,
            onSettingsChange: setAgentSettings,
            onSaveSettings: (next) => saveAgentSettings(next?.target || next?.nativeEvent ? agentSettings : (next ?? agentSettings)),
            voice: ttsVoice,
            rate: ttsRate,
            delivery: ttsDelivery,
            matchDuration: ttsMatchDuration,
            generating: generatingTTS,
            progress: ttsProgress,
            shotsWithVoice,
            selectedHasVoice: Boolean(selectedShot?.voice?.trim()),
            onVoiceChange: setTtsVoice,
            onRateChange: setTtsRate,
            onDeliveryChange: setTtsDelivery,
            onMatchDurationChange: setTtsMatchDuration,
            onGenerateAll: generateTTSForAllShots,
            onGenerateSelected: generateTTSForSelectedShot,
            onSynthesizePreview: synthesizePreview,
            onGenerateOnShot: generatePreviewOnShot,
            hasSelectedShot: Boolean(selectedShot),
            onSpliceToMaster: spliceShotsAudioToMaster,
            selectedVoice: selectedShot?.voice ?? '',
            selectedAudioSrc: selectedShot?.audioSrc ?? '',
          }}
        />

        <div className="center-column">
          <PreviewPanel
            shots={shots}
            masterAudioSrc={masterAudio?.src ?? null}
            currentTime={currentTime}
            playing={playing}
            exportWidth={platformTemplate.width}
            exportHeight={platformTemplate.height}
            exportFps={platformTemplate.fps ?? DEFAULT_FPS}
            aspectLabel={platformTemplate.aspect}
            platformLabel={platformTemplate.label}
            onTimeChange={setCurrentTime}
            onPlayingChange={setPlaying}
            onTogglePlay={togglePlay}
          />
          <Timeline
            shots={shots}
            selectedId={selectedId}
            currentTime={currentTime}
            duration={duration}
            zoom={timelineZoom}
            onZoomChange={setTimelineZoom}
            masterAudio={masterAudio}
            audioTracks={audioTracks}
            height={timelineHeight}
            onResizeStart={startTimelineResize}
            onSelect={setSelectedId}
            onSeek={(time) => { setCurrentTime(time); setPlaying(false) }}
            onDurationChange={changeShotDuration}
            onSplit={splitAtPlayhead}
            onDuplicate={duplicateSelectedShot}
            dragFromIndex={dragFromIndex}
            onDragStart={setDragFromIndex}
            onDragEnter={setDragOverIndex}
            onDragEnd={() => { setDragFromIndex(null); setDragOverIndex(null) }}
            onDrop={reorderShots}
            onContextMenu={openClipMenu}
          />
        </div>

        <InspectorPanel
          open={rightSidebarOpen}
          onToggle={toggleRightSidebar}
          shot={selectedShot}
          isLast={selectedIndex === shots.length - 1}
          onChange={updateShot}
          generatingTTS={generatingTTS}
          onGenerateTTS={generateTTSForSelectedShot}
        />
      </div>

      {clipMenu && shots.some((shot) => shot.id === clipMenu.shotId) ? (
        <ClipContextMenu
          x={clipMenu.x}
          y={clipMenu.y}
          shot={shots.find((shot) => shot.id === clipMenu.shotId)}
          canSplit={(() => {
            const segment = getShotStarts(shots).find((item) => item.shot.id === clipMenu.shotId)
            if (!segment) {
              return false
            }
            return currentTime > segment.start + 0.25 && currentTime < segment.end - 0.25
          })()}
          onClose={() => setClipMenu(null)}
          onRename={renameShot}
          onDuplicate={duplicateShotById}
          onSplit={splitAtPlayhead}
          onClearAudio={clearShotAudio}
          onDelete={removeShot}
        />
      ) : null}

      <CostModeDialog
        modeId={costModePrompt}
        maxImages={getMaxImages(agentSettings) || 20}
        onCancel={() => setCostModePrompt(null)}
        onConfirm={confirmCostMode}
      />

      <StatusBar
        currentTime={currentTime}
        duration={duration}
        shotsCount={shots.length}
        readyCount={readyCount}
        missingCount={missingCount}
        message={message}
        projectName={projectName}
        exportWidth={platformTemplate.width}
        exportHeight={platformTemplate.height}
        exportFps={platformTemplate.fps ?? DEFAULT_FPS}
        platformLabel={platformTemplate.label}
        maxDuration={platformTemplate.maxDuration}
      />
    </div>
  )
}
