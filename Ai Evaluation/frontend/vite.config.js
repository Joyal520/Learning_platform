import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/ocr-grading/',
  build: {
    outDir: '../../ocr-grading',
    emptyOutDir: true,
  },
  plugins: [react()],
})
