import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  build: {
    cssTarget: 'chrome80',
    rollupOptions: {
      input: 'build.html',
      output: {
        entryFileNames: 'assets/app-mobile.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: (assetInfo) => (
          assetInfo.name && assetInfo.name.endsWith('.css')
            ? 'assets/app-mobile.css'
            : 'assets/[name][extname]'
        ),
      },
    },
  },
  plugins: [react()],
});
