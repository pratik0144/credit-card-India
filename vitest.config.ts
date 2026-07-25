import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts', 'scripts/lib/**/*.ts'],
      exclude: ['src/lib/seed-data.ts', 'src/lib/database.types.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@lib': path.resolve(__dirname, 'src/lib'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@islands': path.resolve(__dirname, 'src/islands'),
      '@layouts': path.resolve(__dirname, 'src/layouts'),
    },
  },
});
