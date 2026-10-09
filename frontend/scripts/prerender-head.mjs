// Après `vite build` : écrit un HTML statique par route avec son titre, ses balises,
// son canonical et une copie du h1/texte d'accroche, pour que les robots les lisent
// sans exécuter de JavaScript. React remplace cette copie dès qu'il démarre.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SITE_URL = (process.env.VITE_SITE_URL || 'https://memomind.space').replace(/\/$/, '')
const DIST = 'dist'
const OG_IMAGE = `${SITE_URL}/og-image.png`
const OG_ALT = 'MemoMind: chat with your voice memos'
const routes = JSON.parse(readFileSync('src/seo-routes.json', 'utf8'))
const template = readFileSync(join(DIST, 'index.html'), 'utf8')

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function render(path, seo) {
  const url = SITE_URL + path
  let html = template
    .replace(/<title>[\s\S]*?<\/title>\s*/, '')
    .replace(/<meta\s+name="description"[^>]*>\s*/, '')
    .replace(/<meta\s+name="robots"[^>]*>\s*/, '')
    .replace(/<link\s+rel="canonical"[^>]*>\s*/, '')
    .replace(/<meta\s+property="og:[^"]*"[^>]*>\s*/g, '')
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>\s*/g, '')
  // Données structurées de l'application : page d'accueil seulement
  if (path !== '/') html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/, '')

  const head = [
    `<title>${esc(seo.title)}</title>`,
    `<meta name="description" content="${esc(seo.description)}" />`,
    `<meta name="robots" content="${seo.noindex ? 'noindex, nofollow' : 'index, follow'}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="MemoMind" />`,
    `<meta property="og:title" content="${esc(seo.title)}" />`,
    `<meta property="og:description" content="${esc(seo.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(OG_IMAGE)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(OG_ALT)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(seo.title)}" />`,
    `<meta name="twitter:description" content="${esc(seo.description)}" />`,
    `<meta name="twitter:image" content="${esc(OG_IMAGE)}" />`,
  ].map((l) => '    ' + l).join('\n')

  const body = `<main><h1>${esc(seo.h1)}</h1>${seo.lead ? `<p>${esc(seo.lead)}</p>` : ''}</main>`
  if (!html.includes('<div id="root"></div>')) throw new Error('prerender-head: <div id="root"></div> introuvable dans dist/index.html')
  return html.replace('</head>', head + '\n  </head>').replace('<div id="root"></div>', `<div id="root">${body}</div>`)
}

for (const [path, seo] of Object.entries(routes)) {
  const out = path === '/' ? join(DIST, 'index.html') : join(DIST, path, 'index.html')
  if (path !== '/') mkdirSync(join(DIST, path), { recursive: true })
  writeFileSync(out, render(path, seo))
  console.log(`prerender-head: ${path} -> ${out}`)
}
