import { createShotFromUrl, KOREA_PROJECT_BASE } from '../constants'

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

export async function loadKoreaProject() {
  const manifestResponse = await fetch(`${KOREA_PROJECT_BASE}/manifest.json`)
  if (!manifestResponse.ok) {
    throw new Error('Korea project manifest not found. Run the dev server from image-video-editor.')
  }

  const manifest = await manifestResponse.json()
  if (!Array.isArray(manifest.images)) {
    throw new Error('Invalid manifest.json format.')
  }

  const sortedEntries = [...manifest.images].sort((a, b) => a.shot - b.shot)
  const shots = []
  let readyCount = 0

  for (const entry of sortedEntries) {
    const imageUrl = `${KOREA_PROJECT_BASE}/${entry.file}`
    const hasImage = await imageIsAvailable(imageUrl)
    if (hasImage) {
      readyCount += 1
    }
    shots.push(
      createShotFromUrl(entry, KOREA_PROJECT_BASE, {
        missingImage: !hasImage,
      }),
    )
  }

  if (shots.length === 0) {
    throw new Error('Manifest is empty.')
  }

  return {
    shots,
    manifest,
    readyCount,
    totalCount: shots.length,
    missingCount: shots.length - readyCount,
  }
}
