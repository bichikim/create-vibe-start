import {fileURLToPath, URL} from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import {nitro} from 'nitro/vite'
import {defineConfig} from 'vite'
import {capacitorRun} from 'vite-capacitor'

export default defineConfig(({mode}) => ({
  plugins: [
    capacitorRun(mode),
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
}))
