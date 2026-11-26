import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Welke versie draait er? Te zien in Instellingen → App-versie. Cloudflare Pages geeft de
// commit mee in CF_PAGES_COMMIT_SHA (Netlify: COMMIT_REF, GitHub Actions: GITHUB_SHA).
const commit = (process.env.CF_PAGES_COMMIT_SHA || process.env.COMMIT_REF || process.env.GITHUB_SHA || '').slice(0, 7)

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSIE__: JSON.stringify({ commit, gebouwd: new Date().toISOString() }),
  },
})
