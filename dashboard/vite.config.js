import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative paths so it works from any folder (GitHub Pages, local, etc.)
  base: './',
  build: {
    // Output build files to the root Code folder (parent of dashboard)
    // so index.html is at the repo root for GitHub Pages
    outDir: path.resolve(__dirname, '..'),
    emptyOutDir: false, // Don't delete other files in the root folder
  },
})
