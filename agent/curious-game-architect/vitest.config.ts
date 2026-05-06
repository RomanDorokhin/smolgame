import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Exclude client-side code from tests
    include: ['shared/**/*.test.ts', 'server/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  // Prevent vitest from picking up the root postcss.config.js
  css: {
    postcss: {
      plugins: [],
    },
  },
});
