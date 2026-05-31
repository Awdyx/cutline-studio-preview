import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages base matches repo name; local dev stays at /
  base:
    process.env.GITHUB_PAGES === 'true'
      ? `/${process.env.GITHUB_PAGES_REPO ?? 'cutline-studio-demo'}/`
      : '/',
  plugins: [react()],
  server: {
    host: true,
  },
})
