import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createApiRouter } from './server/apiRouter.js'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'api-routes',
      configureServer(server) {
        server.middlewares.use(createApiRouter())
      },
    },
  ],
  server: {
    port: 5174,
    open: true,
  },
})
