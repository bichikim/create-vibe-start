import {fileURLToPath, URL} from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import {defineConfig, loadEnv} from 'vite'

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  if (mode === 'mobile' && !env.VITE_API_URL?.trim()) {
    throw new Error('VITE_API_URL is required for mobile production builds.')
  }

  return {
    plugins: [tailwindcss(), vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@server': fileURLToPath(new URL('./server', import.meta.url)),
      },
    },
  }
})
