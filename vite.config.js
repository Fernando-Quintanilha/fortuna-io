import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' // Não esqueça do plugin do React!
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
})