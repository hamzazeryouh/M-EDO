import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const promptsPath = path.join(rootDir, 'viking-prompts.json')
const outDir = path.join(rootDir, '..', 'projects', 'viking-age')
const outPath = path.join(outDir, 'manifest.json')

export const VIKING_VISUAL_STYLE = `Cinematic historical realism, 9th–11th century Europe, historically inspired Viking clothing and weapons, realistic human proportions, dramatic natural lighting, cold Nordic atmosphere, detailed wooden Viking longships, realistic shields and axes, muddy battlefields, cinematic depth of field, epic scale, realistic medieval environments, dark dramatic atmosphere, 16:9 YouTube frame, ultra detailed, photorealistic, no fantasy armor, no modern objects, no horned helmets. Keep the main Viking characters visually consistent between consecutive scenes.`

const prompts = JSON.parse(fs.readFileSync(promptsPath, 'utf8'))
if (!Array.isArray(prompts) || prompts.length !== 299) {
  throw new Error(`Expected 299 prompts, got ${prompts?.length ?? 0}`)
}

const manifest = {
  title: 'Viking Age — Stamford Bridge to Hastings',
  visualStyle: VIKING_VISUAL_STYLE,
  generated_at: new Date().toISOString().slice(0, 10),
  format: 'jpg',
  aspect_ratio: '16:9',
  total_shots: 299,
  images: prompts.map((description, index) => {
    const shot = index + 1
    return {
      shot,
      file: `shot-${String(shot).padStart(3, '0')}.jpg`,
      voice: '',
      imagePrompt: `${VIKING_VISUAL_STYLE} ${description}`.trim(),
    }
  }),
}

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Wrote ${manifest.images.length} shots to ${outPath}`)
