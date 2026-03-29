import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/pto-aux-tracker/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'src/index.jsx',
      output: {
        entryFileNames: 'js/[name].js',
        assetFileNames: 'css/[name][extname]',
        format: 'iife'
      }
    }
  }
});
