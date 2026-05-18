import {fileURLToPath, URL} from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import {nitro} from 'nitro/vite'
import {defineConfig} from 'vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    vue(),
    nitro({
      preset: process.env.VERCEL ? 'vercel' : 'node_server',
      serverDir: './server',
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@server': fileURLToPath(new URL('./server', import.meta.url)),
    },
  },
})
