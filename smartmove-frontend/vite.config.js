import { defineConfig } from 'vite';
// Two entry pages: admin (index.html) and client portal (portal.html)
export default defineConfig({ build: { rollupOptions: { input: { main: 'index.html', portal: 'portal.html' } } } });
