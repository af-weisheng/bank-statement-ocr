import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    // Make VITE_API_URL predictable in the test environment so MSW handlers
    // can intercept the exact URL that the axios instance constructs.
    'import.meta.env.VITE_API_URL': JSON.stringify('http://localhost:5000/api'),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.d.ts',
        'src/pages/**',           // page-level integration tests are separate
      ],
    },
  },
  resolve: {
    alias: {
      '@bank-statement-ocr/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
});
