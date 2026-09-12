import {builtinModules, createRequire} from 'node:module'
import {resolve} from 'node:path'
import dts from 'unplugin-dts/vite'
import {defineConfig} from 'vite'
import {viteStaticCopy} from 'vite-plugin-static-copy'

const require = createRequire(import.meta.url)
const packageJson = require('./package.json') as {dependencies?: Record<string, string>}
const externalPackages = Object.keys(packageJson.dependencies ?? {})

export default defineConfig({
  plugins: [
    dts({
      entryRoot: 'src',
      tsconfigPath: './tsconfig.json',
    }),
    viteStaticCopy({
      targets: [
        {
          src: ['templates/**/{*,.*}', '!templates/**/node_modules/**'],
          dest: 'templates',
          rename: {stripBase: 1},
        },
        {
          src: '.agents/skills/**/{*,.*}',
          dest: '.agents/skills',
          rename: {stripBase: 2},
        },
        {
          src: 'oxlint.config.ts',
          dest: './',
        },
        {
          src: '.oxfmtrc.json',
          dest: './',
        },
      ],
    }),
  ],
  build: {
    emptyOutDir: true,
    lib: {
      entry: {cli: resolve(__dirname, 'src/cli.ts')},
      fileName: (_format, entryName) => `${entryName}.js`,
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
    target: 'node22',
  },
})
