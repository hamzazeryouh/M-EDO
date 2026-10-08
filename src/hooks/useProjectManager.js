import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyPreset } from '../constants'
import { DEFAULT_PLATFORM_TEMPLATE_ID, getPlatformTemplate } from '../platformTemplates'
import { loadAgentSettings, saveAgentSettings } from '../utils/agentSettings'
import { buildShotsFromManifest, parseManifestFromFiles } from '../utils/manifestImport'
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
} from '../utils/projectStore'
import { revalidateShotImages } from '../utils/shotImages'

export function useProjectManager({
  shots,
  replaceShots,
  setSelectedId,
  setCurrentTime,
  setPlaying,
  clearAllAudio,
  resetTimeline,
  notify,
}) {
  const [loadingProject, setLoadingProject] = useState(true)
  const [projectName, setProjectName] = useState('Untitled Project')
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

  const platformTemplate = useMemo(
    () => getPlatformTemplate(platformTemplateId),
    [platformTemplateId],
  )

  const refreshProjectList = useCallback((registry = loadRegistry()) => {
    setProjectList(registry.projects)
    return registry
  }, [])

  const applyProjectToEditor = useCallback(async (project) => {
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
  }, [replaceShots, setSelectedId, setCurrentTime, setPlaying, clearAllAudio])

  const saveCurrentProject = useCallback(async ({ silent = false } = {}) => {
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
        notify(`Saved "${snapshot.name}".`)
      }
      return snapshot
    } catch (error) {
      if (!silent) {
        notify(error instanceof Error ? error.message : 'Could not save project.')
      }
      return null
    } finally {
      setProjectSaving(false)
    }
  }, [activeProjectId, projectName, platformTemplateId, agentSettings.projectBrief, shots, projectCreatedAt, refreshProjectList, notify])

  const createProjectFromSnapshot = useCallback(async (snapshot) => {
    if (activeProjectId) {
      await saveCurrentProject({ silent: true })
    }
    saveProjectRecord(snapshot)
    setActiveProjectId(snapshot.id)
    setActiveProjectIdState(snapshot.id)
    await applyProjectToEditor(snapshot)
    refreshProjectList()
    notify(`Created "${snapshot.name}".`)
  }, [activeProjectId, saveCurrentProject, applyProjectToEditor, refreshProjectList, notify])

  const initializeProjects = useCallback(async () => {
    setLoadingProject(true)
    try {
      let registry = refreshProjectList()
      if (registry.projects.length === 0) {
        const empty = createEmptyProject('Untitled Project')
        const snapshot = await buildProjectSnapshot(empty)
        registry = saveProjectRecord(snapshot)
        setActiveProjectId(snapshot.id)
        setActiveProjectIdState(snapshot.id)
        await applyProjectToEditor(snapshot)
        refreshProjectList(registry)
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
      notify(error instanceof Error ? error.message : 'Could not load projects.')
      projectInitRef.current = true
    } finally {
      setLoadingProject(false)
    }
  }, [refreshProjectList, applyProjectToEditor, notify])

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
  }, [shots, projectName, platformTemplateId, agentSettings.projectBrief, activeProjectId, loadingProject, saveCurrentProject])

  const switchToProject = useCallback(async (projectId) => {
    if (projectId === activeProjectId) {
      return
    }
    if (activeProjectId) {
      await saveCurrentProject({ silent: true })
    }
    const project = loadProjectById(projectId)
    if (!project) {
      notify('Project not found.')
      return
    }
    setActiveProjectId(project.id)
    setActiveProjectIdState(project.id)
    await applyProjectToEditor(project)
    notify(`Opened "${project.name}".`)
  }, [activeProjectId, saveCurrentProject, applyProjectToEditor, notify])

  const createEmptyProjectAction = useCallback(async () => {
    const project = createEmptyProject(uniqueProjectName('Untitled Project', projectList))
    await createProjectFromSnapshot(project)
  }, [projectList, createProjectFromSnapshot])

  const duplicateActiveProjectAction = useCallback(async () => {
    const current = loadProjectById(activeProjectId)
    if (!current) {
      return
    }
    const duplicate = duplicateProjectRecord(
      current,
      uniqueProjectName(`${current.name} (copy)`, projectList),
    )
    await createProjectFromSnapshot(duplicate)
  }, [activeProjectId, projectList, createProjectFromSnapshot])

  const renameActiveProjectAction = useCallback(async (name) => {
    setProjectName(name)
    await saveCurrentProject()
  }, [saveCurrentProject])

  const deleteProjectAction = useCallback(async (projectId) => {
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
      resetTimeline()
      setProjectName('Untitled Project')
      clearAllAudio()
    }
    notify('Project deleted.')
  }, [activeProjectId, refreshProjectList, applyProjectToEditor, resetTimeline, clearAllAudio, notify])

  const importManifest = useCallback(async (fileList) => {
    const files = Array.from(fileList)
    let manifest
    try {
      manifest = await parseManifestFromFiles(files)
    } catch {
      notify('Could not parse manifest JSON.')
      return
    }
    if (!manifest?.images?.length) {
      notify('No valid manifest found. Select manifest.json or any .json with an images array.')
      return
    }
    const imageFiles = files.filter((file) => file.type.startsWith('image/'))
    const imported = buildShotsFromManifest(manifest, imageFiles)
    const presetId = manifest.visualStyle ? 'cinematic' : 'documentary'
    replaceShots(applyPreset(imported, presetId))
    setSelectedId(imported[0]?.id ?? null)
    setCurrentTime(0)
    setPlaying(false)
    clearAllAudio()
    setProjectName(manifest.title ?? 'Imported Project')

    if (manifest.visualStyle || manifest.title) {
      setAgentSettings((current) => {
        const briefParts = []
        if (manifest.title) {
          briefParts.push(manifest.title)
        }
        if (manifest.visualStyle) {
          briefParts.push(`Visual style:\n${manifest.visualStyle}`)
        }
        const next = {
          ...current,
          projectBrief: briefParts.join('\n\n'),
        }
        saveAgentSettings(next)
        return next
      })
    }

    const withImages = imported.filter((shot) => !shot.missingImage).length
    const promptOnly = imported.length - withImages
    await saveCurrentProject({ silent: true })
    notify(
      promptOnly > 0
        ? `Imported ${imported.length} shots (${promptOnly} prompts only — use Agent → Generate images).`
        : `Imported ${imported.length} shots with images from manifest.`,
    )
  }, [replaceShots, setSelectedId, setCurrentTime, setPlaying, clearAllAudio, saveCurrentProject, notify])

  const selectPlatformTemplate = useCallback((templateId, { adjustShots = false, applyPlatformToShots } = {}) => {
    const template = getPlatformTemplate(templateId)
    setPlatformTemplateId(template.id)
    window.localStorage.setItem('iv-platform-template', template.id)
    if (adjustShots && shots.length > 0 && applyPlatformToShots) {
      applyPlatformToShots(template.id)
      notify(`Applied ${template.label} — ${template.width}×${template.height}, ${template.defaultShotDuration}s clips.`)
    } else {
      notify(`Export format: ${template.label} (${template.width}×${template.height} · ${template.aspect}).`)
    }
  }, [shots.length, notify])

  const saveAgentSettingsSafe = useCallback((next) => {
    const resolved = next?.target || next?.nativeEvent ? agentSettings : (next ?? agentSettings)
    saveAgentSettings(resolved)
    return resolved
  }, [agentSettings])

  return {
    loadingProject,
    projectName,
    setProjectName,
    activeProjectId,
    projectList,
    projectSaving,
    projectCreatedAt,
    platformTemplateId,
    setPlatformTemplateId,
    platformTemplate,
    agentSettings,
    setAgentSettings,
    saveCurrentProject,
    switchToProject,
    createEmptyProjectAction,
    duplicateActiveProjectAction,
    renameActiveProjectAction,
    deleteProjectAction,
    importManifest,
    selectPlatformTemplate,
    saveAgentSettingsSafe,
  }
}
