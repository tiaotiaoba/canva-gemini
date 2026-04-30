import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      '@components': path.resolve(__dirname, 'src/components'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@utils': path.resolve(__dirname, 'src/utils'),
    }
  },
  build: {
    emptyOutDir: false,
    minify: true,
    cssCodeSplit: false, // Ensure CSS is inlined
    assetsInlineLimit: 100000000, // Large limit to ensure assets are inlined
  }
})
