import { useEffect } from 'react'
import routes from '../seo-routes.json'

const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://memomind.space').replace(/\/$/, '')

function upsertMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

// Garde titre et balises à jour quand on navigue entre pages dans la SPA.
// Au premier chargement elles sont déjà justes : scripts/prerender-head.mjs écrit
// les mêmes valeurs dans le HTML statique de chaque route au build.
export function useRouteSeo(path) {
  useEffect(() => {
    const seo = routes[path]
    if (!seo) return
    const url = SITE_URL + path
    document.title = seo.title
    upsertMeta('name', 'description', seo.description)
    upsertMeta('name', 'robots', seo.noindex ? 'noindex, nofollow' : 'index, follow')
    upsertMeta('property', 'og:title', seo.title)
    upsertMeta('property', 'og:description', seo.description)
    upsertMeta('property', 'og:url', url)
    upsertMeta('name', 'twitter:title', seo.title)
    upsertMeta('name', 'twitter:description', seo.description)
    let canonical = document.head.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = url
  }, [path])
}
