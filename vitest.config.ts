import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    clearMocks: true,
    include: ['src/**/__tests__/**/*.spec.ts', 'test/**/__tests__/**/*.spec.ts', 'scripts/**/__tests__/**/*.spec.ts', 'desktop/**/__tests__/**/*.spec.ts'],
    coverage: {
      exclude: ['test/**'],
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
