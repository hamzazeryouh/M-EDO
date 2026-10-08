const REGISTRY_KEY = 'iv-project-registry'
const PROJECT_PREFIX = 'iv-project-'
const MAX_BLOB_BYTES = 2 * 1024 * 1024

function readJson(key, fallback) {
  if (typeof window === 'undefined') {
    return fallback
  }
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(key, JSON.stringify(value))
}

function projectKey(id) {
  return `${PROJECT_PREFIX}${id}`
}

async function blobUrlToDataUrl(url) {
  const response = await fetch(url)
  const blob = await response.blob()
  if (blob.size > MAX_BLOB_BYTES) {
    return ''
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function persistMediaUrl(url) {
  if (!url) {
    return ''
  }
  if (url.startsWith('/') || url.startsWith('http') || url.startsWith('data:')) {
    return url
  }
  if (url.startsWith('blob:')) {
    try {
      return await blobUrlToDataUrl(url)
    } catch {
      return ''
    }
  }
  return url
}

export function loadRegistry() {
  return readJson(REGISTRY_KEY, { activeId: null, projects: [] })
}

export function saveRegistry(registry) {
  writeJson(REGISTRY_KEY, registry)
}

export function loadProjectById(id) {
  if (!id) {
    return null
  }
  return readJson(projectKey(id), null)
}

export function saveProjectRecord(project) {
  writeJson(projectKey(project.id), project)
  const registry = loadRegistry()
  const summary = {
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt,
    shotCount: project.shots?.length ?? 0,
  }
  const index = registry.projects.findIndex((item) => item.id === project.id)
  if (index >= 0) {
    registry.projects[index] = summary
  } else {
    registry.projects.unshift(summary)
  }
  registry.projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
  saveRegistry(registry)
  return registry
}

export function setActiveProjectId(id) {
  const registry = loadRegistry()
  registry.activeId = id
  saveRegistry(registry)
}

export function getActiveProjectId() {
  return loadRegistry().activeId
}

export function uniqueProjectName(baseName, projects = []) {
  const names = new Set(projects.map((project) => project.name))
  const base = baseName?.trim() || 'Untitled Project'
  if (!names.has(base)) {
    return base
  }
  let index = 2
  while (names.has(`${base} (${index})`)) {
    index += 1
  }
  return `${base} (${index})`
}

export function createEmptyProject(name = 'Untitled Project') {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    platformTemplateId: 'documentary',
    projectBrief: '',
    shots: [],
  }
}

export async function serializeShotsForStorage(shots) {
  const serialized = []
  for (const shot of shots) {
    const src = await persistMediaUrl(shot.src)
    serialized.push({
      id: shot.id,
      name: shot.name,
      voice: shot.voice ?? '',
      imagePrompt: shot.imagePrompt ?? '',
      duration: shot.duration,
      animation: shot.animation,
      transition: shot.transition,
      shotNumber: shot.shotNumber ?? null,
      missingImage: Boolean(shot.missingImage),
      audioName: shot.audioName ?? '',
      src,
      audioSrc: await persistMediaUrl(shot.audioSrc) || null,
      file: null,
    })
  }
  return serialized
}

export function deserializeShots(storedShots = []) {
  return storedShots.map((shot) => ({
    ...shot,
    file: null,
    missingImage: shot.missingImage === true,
    audioSrc: shot.audioSrc || null,
  }))
}

export async function buildProjectSnapshot({
  id,
  name,
  platformTemplateId,
  projectBrief,
  shots,
  createdAt,
}) {
  const now = new Date().toISOString()
  return {
    id,
    name,
    createdAt: createdAt ?? now,
    updatedAt: now,
    platformTemplateId,
    projectBrief: projectBrief ?? '',
    shots: await serializeShotsForStorage(shots),
  }
}

export function deleteProjectById(id) {
  if (typeof window === 'undefined') {
    return loadRegistry()
  }
  window.localStorage.removeItem(projectKey(id))
  const registry = loadRegistry()
  registry.projects = registry.projects.filter((item) => item.id !== id)
  if (registry.activeId === id) {
    registry.activeId = registry.projects[0]?.id ?? null
  }
  saveRegistry(registry)
  return registry
}

export function duplicateProjectRecord(sourceProject, name) {
  const now = new Date().toISOString()
  return {
    ...sourceProject,
    id: crypto.randomUUID(),
    name: name ?? `${sourceProject.name} (copy)`,
    createdAt: now,
    updatedAt: now,
    shots: deserializeShots(sourceProject.shots).map((shot) => ({
      ...shot,
      id: crypto.randomUUID(),
    })),
  }
}

export function formatProjectDate(iso) {
  if (!iso) {
    return '—'
  }
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
