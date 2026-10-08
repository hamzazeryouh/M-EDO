import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { createApiRouter } from './apiRouter.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distDir = path.resolve(rootDir, 'dist')
const port = Number(process.env.PORT) || 4174

const app = express()
app.use(createApiRouter())
app.use(express.static(distDir, { index: false }))

app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'))
})

app.listen(port, () => {
  console.log(`M-EDO running at http://localhost:${port}`)
  console.log('AI / TTS / image API routes enabled at /api/*')
})
