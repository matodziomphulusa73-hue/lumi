import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  define: {
    // Vercel provides process.env during build, which Vite injects here
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || '')
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  server: {
    port: 3000
  }
});