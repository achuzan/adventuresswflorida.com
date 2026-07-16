import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { prerenderRoutes } from './src/seo-meta.ts'

/**
 * Writes a static HTML file per route with route-specific title, meta,
 * canonical, Open Graph, and JSON-LD baked in, so crawlers get correct
 * head tags without executing JavaScript. Cloudflare serves /gallery from
 * gallery.html (auto-trailing-slash); unknown paths fall back to the SPA.
 */
function prerenderSeo(): Plugin {
  return {
    name: 'prerender-seo',
    apply: 'build',
    async closeBundle() {
      const distDir = join(import.meta.dirname, 'dist')
      const template = await readFile(join(distDir, 'index.html'), 'utf8')
      const marker = /<!-- seo:start -->[\s\S]*?<!-- seo:end -->/
      if (!marker.test(template)) {
        console.warn('[prerender-seo] SEO markers missing from index.html; skipped')
        return
      }
      for (const { file, head } of prerenderRoutes()) {
        const html = template.replace(marker, head)
        const outPath = join(distDir, file)
        await mkdir(dirname(outPath), { recursive: true })
        await writeFile(outPath, html, 'utf8')
      }
      console.log(`[prerender-seo] wrote ${prerenderRoutes().length} route pages`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), prerenderSeo()],
})
