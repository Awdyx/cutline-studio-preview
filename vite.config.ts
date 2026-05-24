import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves from /cutline-studio-demo/; local dev stays at /
  base: process.env.GITHUB_PAGES === 'true' ? '/cutline-studio-demo/' : '/',
  plugins: [react()],
  server: {
    host: true,
  },
})
