import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  define: {
    // Vite will replace this string during the build on Vercel
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