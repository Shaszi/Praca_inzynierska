import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

const nodeStub = fileURLToPath(new URL('./src/stubs/node-stub.ts', import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      'node:fs': nodeStub,
      'node:path': nodeStub,
    },
  },
})
