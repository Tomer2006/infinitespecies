import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    strictPort: false,
    hmr: {
      protocol: 'ws',
      host: 'localhost'
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
