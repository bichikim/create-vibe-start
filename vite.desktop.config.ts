import {fileURLToPath, URL} from 'node:url'
import vue from '@vitejs/plugin-vue'
import {defineConfig} from 'vite'

export default defineConfig({
  root: 'desktop',
  plugins: [vue()],
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
    },
  },
  build: {
    emptyOutDir: true,
    outDir: '../dist-desktop',
    target: ['es2022', 'chrome105', 'safari13'],
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
})
