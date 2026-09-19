import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // OSMD is large and only needed once notation is first shown; keep it in its
    // own chunk so the practice screen paints without waiting for it.
    rollupOptions: {
      output: {
        manualChunks: {
          osmd: ['opensheetmusicdisplay'],
        },
      },
    },
    chunkSizeWarningLimit: 1500,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
