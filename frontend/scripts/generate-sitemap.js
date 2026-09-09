import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const siteUrl = (process.env.VITE_SITE_URL || 'https://app.yourdomain.com').replace(/\/$/, '')

const publicRoutes = ['/login', '/privacy', '/forgot-password', '/reset-password']

const urls = publicRoutes
  .map((route) => `  <url>\n    <loc>${siteUrl}${route}</loc>\n  </url>`)
  .join('\n')

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`

fs.writeFileSync(path.join(__dirname, '..', 'public', 'sitemap.xml'), sitemap)

console.log(`sitemap.xml generated for ${siteUrl}`)
