import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'localtest' ? [{
    name: 'exclude-remote-supabase',
    generateBundle() {
      const remote = [...this.getModuleIds()].some(id => /\/src\/lib\/supabase\.js$|\/node_modules\/@supabase\//.test(id.replaceAll('\\', '/')))
      if (remote) this.error('El bundle local incluyo el cliente remoto de Supabase')
    },
  }] : [])],
  resolve: mode === 'localtest' ? { alias: [
    { find: /^(?:\.\.?\/)+lib\/supabase(?:\.js)?$/, replacement: fileURLToPath(new URL('./src/lib/supabase.local.js', import.meta.url)) },
  ] } : {},
}))
