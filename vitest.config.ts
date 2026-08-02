import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    clearMocks: true,
    coverage: {
      exclude: ['.agents/**'],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
    restoreMocks: true,
  },
})
