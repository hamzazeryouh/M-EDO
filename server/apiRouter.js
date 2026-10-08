import express from 'express'
import { chatWithProvider, testAiProvider } from './aiProviders.js'
import { generateWithProvider, testImageProvider } from './imageProviders.js'
import { synthesizeWithProvider, testTtsProvider } from './ttsProviders.js'

export function createApiRouter() {
  const router = express.Router()
  router.use(express.json({ limit: '12mb' }))

  router.post('/api/ai/chat', async (req, res) => {
    try {
      const { provider = 'openai', config = {}, messages } = req.body ?? {}
      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).send('Messages are required')
        return
      }
      const content = await chatWithProvider(provider, config, messages)
      res.json({ content })
    } catch (error) {
      res.status(500).send(error instanceof Error ? error.message : 'AI request failed')
    }
  })

  router.post('/api/ai/test', async (req, res) => {
    try {
      const { provider = 'openai', config = {} } = req.body ?? {}
      const message = await testAiProvider(provider, config)
      res.json({ message })
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Test failed' })
    }
  })

  router.post('/api/tts/test', async (req, res) => {
    try {
      const { provider = 'edge', config = {} } = req.body ?? {}
      const message = await testTtsProvider(provider, config)
      res.json({ message })
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Test failed' })
    }
  })

  router.post('/api/tts', async (req, res) => {
    try {
      const { text, provider = 'edge', config = {} } = req.body ?? {}
      if (!text?.trim()) {
        res.status(400).send('Text is required — type narration in Speech preview or on each shot\'s Voice field.')
        return
      }
      const result = await synthesizeWithProvider(provider, config, text)
      res.setHeader('Content-Type', result.contentType)
      res.end(result.buffer)
    } catch (error) {
      console.error('TTS failed:', error)
      res.status(500).send(error instanceof Error ? error.message : 'TTS failed')
    }
  })

  router.post('/api/image/generate', async (req, res) => {
    try {
      const { provider = 'openaiImage', config = {}, prompt, width = 1920, height = 1080 } = req.body ?? {}
      if (!prompt?.trim()) {
        res.status(400).send('Prompt is required')
        return
      }
      const result = await generateWithProvider(provider, config, prompt, { width, height })
      res.setHeader('Content-Type', result.contentType)
      res.end(result.buffer)
    } catch (error) {
      res.status(500).send(error instanceof Error ? error.message : 'Image generation failed')
    }
  })

  router.post('/api/image/test', async (req, res) => {
    try {
      const { provider = 'openaiImage', config = {} } = req.body ?? {}
      const message = await testImageProvider(provider, config)
      res.json({ message })
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Test failed' })
    }
  })

  return router
}
