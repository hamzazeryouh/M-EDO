import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { chatWithProvider, testAiProvider } from './server/aiProviders.js'
import { generateWithProvider, testImageProvider } from './server/imageProviders.js'
import { synthesizeWithProvider, testTtsProvider } from './server/ttsProviders.js'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const koreaImagesDir = path.resolve(
  rootDir,
  '../كُوريا الشمالية من الداخل - خطة فيديو AI كاملة/images',
)
const vikingProjectDir = path.resolve(rootDir, 'projects/viking-age')

const mimeTypes = {
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function aiApiPlugin() {
  return {
    name: 'ai-api',
    configureServer(server) {
      server.middlewares.use('/api/ai/chat', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }
        try {
          const { provider = 'openai', config = {}, messages } = await readJsonBody(req)
          if (!Array.isArray(messages) || messages.length === 0) {
            res.statusCode = 400
            res.end('Messages are required')
            return
          }
          const content = await chatWithProvider(provider, config, messages)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ content }))
        } catch (error) {
          res.statusCode = 500
          res.end(error instanceof Error ? error.message : 'AI request failed')
        }
      })

      server.middlewares.use('/api/ai/test', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }
        try {
          const { provider = 'openai', config = {} } = await readJsonBody(req)
          const message = await testAiProvider(provider, config)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message }))
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Test failed' }))
        }
      })
    },
  }
}

function ttsApiPlugin() {
  return {
    name: 'tts-api',
    configureServer(server) {
      // More specific path must be registered first — /api/tts also matches /api/tts/test
      server.middlewares.use('/api/tts/test', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }
        try {
          const { provider = 'edge', config = {} } = await readJsonBody(req)
          const message = await testTtsProvider(provider, config)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message }))
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Test failed' }))
        }
      })

      server.middlewares.use('/api/tts', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }
        try {
          const { text, provider = 'edge', config = {} } = await readJsonBody(req)
          if (!text?.trim()) {
            res.statusCode = 400
            res.end('Text is required — type narration in Speech preview or on each shot\'s Voice field.')
            return
          }
          const result = await synthesizeWithProvider(provider, config, text)
          res.setHeader('Content-Type', result.contentType)
          res.end(result.buffer)
        } catch (error) {
          console.error('TTS failed:', error)
          res.statusCode = 500
          res.end(error instanceof Error ? error.message : 'TTS failed')
        }
      })
    },
  }
}

function imageApiPlugin() {
  return {
    name: 'image-api',
    configureServer(server) {
      server.middlewares.use('/api/image/generate', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }
        try {
          const { provider = 'openaiImage', config = {}, prompt, width = 1920, height = 1080 } = await readJsonBody(req)
          if (!prompt?.trim()) {
            res.statusCode = 400
            res.end('Prompt is required')
            return
          }
          const result = await generateWithProvider(provider, config, prompt, { width, height })
          res.setHeader('Content-Type', result.contentType)
          res.end(result.buffer)
        } catch (error) {
          res.statusCode = 500
          res.end(error instanceof Error ? error.message : 'Image generation failed')
        }
      })

      server.middlewares.use('/api/image/test', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }
        try {
          const { provider = 'openaiImage', config = {} } = await readJsonBody(req)
          const message = await testImageProvider(provider, config)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message }))
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Test failed' }))
        }
      })
    },
  }
}

function staticProjectPlugin(route, baseDir) {
  return {
    name: `static-project-${route.slice(1)}`,
    configureServer(server) {
      server.middlewares.use(route, (req, res) => {
        const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0])
        const relativePath = urlPath.replace(/^\/+/, '')
        const filePath = path.resolve(baseDir, relativePath)

        if (!filePath.startsWith(baseDir)) {
          res.statusCode = 403
          res.end('Forbidden')
          return
        }

        if (req.method === 'HEAD') {
          fs.access(filePath, fs.constants.R_OK, (error) => {
            if (error) {
              res.statusCode = 404
              res.end()
              return
            }
            const ext = path.extname(filePath).toLowerCase()
            res.setHeader('Content-Type', mimeTypes[ext] ?? 'application/octet-stream')
            res.statusCode = 200
            res.end()
          })
          return
        }

        fs.readFile(filePath, (error, data) => {
          if (error) {
            res.statusCode = 404
            res.end('Not found')
            return
          }
          const ext = path.extname(filePath).toLowerCase()
          res.setHeader('Content-Type', mimeTypes[ext] ?? 'application/octet-stream')
          res.end(data)
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    staticProjectPlugin('/korea-project', koreaImagesDir),
    staticProjectPlugin('/viking-project', vikingProjectDir),
    ttsApiPlugin(),
    aiApiPlugin(),
    imageApiPlugin(),
  ],
  server: {
    port: 5174,
    open: true,
    fs: {
      allow: ['..'],
    },
  },
})
