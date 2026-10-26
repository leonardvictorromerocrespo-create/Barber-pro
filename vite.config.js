import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(['localtest','localauth'].includes(mode) ? [{
    name: 'exclude-remote-supabase',
    generateBundle() {
      const remote = [...this.getModuleIds()].some(id => /\/src\/lib\/supabase\.js$/.test(id.replaceAll('\\', '/')) || (mode==='localtest'&&/\/node_modules\/@supabase\//.test(id.replaceAll('\\', '/'))))
      if (remote) this.error('El bundle local incluyo el cliente remoto de Supabase')
    },
  }] : [])],
  resolve: ['localtest','localauth'].includes(mode) ? { alias: [
    { find: /^(?:\.\.?\/)+lib\/supabase(?:\.js)?$/, replacement: fileURLToPath(new URL(mode==='localauth'?'./src/lib/supabase.auth-local.js':'./src/lib/supabase.local.js', import.meta.url)) },
  ] } : {},
}))
