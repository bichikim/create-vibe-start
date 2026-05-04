import {builtinModules, createRequire} from 'node:module'
import {resolve} from 'node:path'
import dts from 'unplugin-dts/vite'
import {defineConfig} from 'vite'

const require = createRequire(import.meta.url)
const packageJson = require('./package.json') as {dependencies?: Record<string, string>}
const externalPackages = Object.keys(packageJson.dependencies ?? {})

export default defineConfig({
  plugins: [
    dts({
      entryRoot: 'src',
      tsconfigPath: './tsconfig.json',
    }),
  ],
  build: {
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/cli.ts'),
      fileName: () => 'cli.js',
      formats: ['es'],
    },
    minify: false,
    rollupOptions: {
      external: (id) =>
        id.startsWith('node:') ||
        builtinModules.includes(id) ||
        externalPackages.some((dependency) => id === dependency || id.startsWith(`${dependency}/`)),
      treeshake: false,
    },
    sourcemap: true,
    target: 'node20',
  },
})
