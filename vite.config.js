import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function imageProxyPlugin() {
  return {
    name: 'image-proxy',
    configureServer(server) {
      server.middlewares.use('/img-proxy', (req, res) => {
        const encodedUrl = req.url.slice(1)
        if (!encodedUrl) {
          res.statusCode = 400
          res.end('Missing URL')
          return
        }
        const url = decodeURIComponent(encodedUrl)
        fetch(url, { redirect: 'follow' })
          .then(response => {
            if (!response.ok) {
              res.statusCode = 502
              res.end(`Upstream ${response.status}`)
              return
            }
            const ct = response.headers.get('content-type') || 'image/jpeg'
            res.setHeader('Content-Type', ct)
            res.setHeader('Cache-Control', 'public, max-age=3600')
            res.setHeader('Access-Control-Allow-Origin', '*')
            return response.arrayBuffer().then(buf => {
              res.end(Buffer.from(buf))
            })
          })
          .catch(err => {
            res.statusCode = 500
            res.end(err.message)
          })
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), imageProxyPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    fs: {
      allow: ['..'],
    },
    proxy: {
      '/api': 'http://localhost:8787',
      '/health': 'http://localhost:8787'
    }
  }
})
