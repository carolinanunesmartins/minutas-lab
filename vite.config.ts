/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    // Never inline assets as base64 data: URIs — the app's CSP meta tag
    // (index.html) sets connect-src 'self', which blocks fetch() on data:
    // URIs, and template.docx files are fetched at runtime (src/ui/App.tsx).
    // Small templates (<4KB, Vite's default inline threshold) would
    // otherwise silently fail to load in production builds only.
    assetsInlineLimit: 0,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx', 'tests/property/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/vite-env.d.ts'],
    },
  },
});
