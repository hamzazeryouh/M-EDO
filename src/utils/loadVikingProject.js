import { createShotFromUrl } from '../constants'
import { VIKING_PROJECT_BASE } from './vikingProject'

async function imageIsAvailable(url) {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return false
    }
    const contentType = response.headers.get('content-type') ?? ''
    return contentType.startsWith('image/')
  } catch {
    return false
  }
}

export async function loadVikingProject({ maxShots = 0 } = {}) {
  const manifestResponse = await fetch(`${VIKING_PROJECT_BASE}/manifest.json`)
  if (!manifestResponse.ok) {
    throw new Error('Viking project manifest not found. Run npm run build:viking then npm run dev.')
  }

  const manifest = await manifestResponse.json()
  if (!Array.isArray(manifest.images)) {
    throw new Error('Invalid Viking manifest.json format.')
  }

  let sortedEntries = [...manifest.images].sort((a, b) => a.shot - b.shot)
  if (maxShots > 0) {
    sortedEntries = sortedEntries.slice(0, maxShots)
  }

  const shots = []
  let readyCount = 0

  for (const entry of sortedEntries) {
    const imageUrl = `${VIKING_PROJECT_BASE}/${entry.file}`
    const hasImage = await imageIsAvailable(imageUrl)
    if (hasImage) {
      readyCount += 1
    }
    shots.push(
      createShotFromUrl(entry, VIKING_PROJECT_BASE, {
        missingImage: !hasImage,
        imagePrompt: entry.imagePrompt ?? '',
      }),
    )
  }

  if (shots.length === 0) {
    throw new Error('Viking manifest is empty.')
  }

  return {
    shots,
    manifest,
    readyCount,
    totalCount: shots.length,
    missingCount: shots.length - readyCount,
    title: manifest.title ?? 'Viking Age Documentary',
    visualStyle: manifest.visualStyle ?? '',
  }
}
