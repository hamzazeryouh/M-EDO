import { createGeneratedShot, createShot } from '../constants'

export async function parseManifestFromFiles(files) {
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

export function buildShotsFromManifest(manifest, imageFiles) {
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
