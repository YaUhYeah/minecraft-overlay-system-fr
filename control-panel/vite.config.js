import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  server: {
    host: '0.0.0.0',
    port: 58038,
    allowedHosts: true,
    cors: true
  },
  preview: {
    host: '0.0.0.0',
    port: 58038,
    allowedHosts: true,
    cors: true
  }
})