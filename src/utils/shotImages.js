/** True when this shot still needs GPT Image / DALL·E generation. */
export function shotNeedsImageGeneration(shot) {
  if (!shot?.imagePrompt?.trim()) {
    return false
  }
  if (shot.missingImage) {
    return true
  }
  if (!shot.src) {
    return true
  }
  if (shot.src.startsWith('blob:') || shot.src.startsWith('data:')) {
    return false
  }
  return false
}

export async function imageUrlAvailable(url) {
  if (!url) {
    return false
  }
  try {
    const response = await fetch(url, { method: 'HEAD' })
    if (!response.ok) {
      return false
    }
    const contentType = response.headers.get('content-type') ?? ''
    return contentType.startsWith('image/')
  } catch {
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
}

/** Re-check disk/HTTP image URLs and fix missingImage flags after loading a saved project. */
export async function revalidateShotImages(shots) {
  const updated = []
  for (const shot of shots) {
    if (!shot.src || shot.src.startsWith('blob:') || shot.src.startsWith('data:')) {
      updated.push({
        ...shot,
        missingImage: shot.src ? false : Boolean(shot.missingImage),
      })
      continue
    }
    const hasImage = await imageUrlAvailable(shot.src)
    updated.push({
      ...shot,
      missingImage: !hasImage,
    })
  }
  return updated
}

export function countShotsNeedingImages(shots) {
  return shots.filter(shotNeedsImageGeneration).length
}
