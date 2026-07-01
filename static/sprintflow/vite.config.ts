import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'build',
    rollupOptions: {},
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
});
