import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/ · https://vitest.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Put every vi.spyOn() back after each test, even when an assertion fails mid-test.
    restoreMocks: true,
    // Points at the local Supabase stack's URL so MSW handlers can match real client requests.
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    },
    coverage: {
      provider: 'v8',
      include: [
        'src/features/**',
        'src/lib/**',
        'src/app/**',
        'src/hooks/**',
        'src/context/**',
        'src/components/common/**',
      ],
      exclude: ['**/__tests__/**', '**/*.test.{ts,tsx}'],
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      thresholds: {
        lines: 80,
      },
    },
  },
});
