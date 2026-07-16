import { useEffect } from 'react'
import { site } from './site'
import { absoluteUrl, type PageMeta } from './seo-meta'

export { pageMeta, photoPageMeta, homeJsonLd, photoJsonLd } from './seo-meta'
export type { PageMeta } from './seo-meta'

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/** Updates document title, description, canonical, and Open Graph / Twitter tags. */
export function SeoHead({ title, description, path = '/', image, type = 'website', noindex }: PageMeta) {
  useEffect(() => {
    const url = absoluteUrl(path)
    const ogImage = absoluteUrl(image ?? site.defaultOgImage)

    document.title = title
    setMeta('name', 'description', description)
    setMeta('name', 'robots', noindex ? 'noindex,nofollow' : 'index,follow')
    setLink('canonical', url)

    setMeta('property', 'og:site_name', site.brand)
    setMeta('property', 'og:title', title)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:type', type)
    setMeta('property', 'og:url', url)
    setMeta('property', 'og:image', ogImage)
    setMeta('property', 'og:locale', 'en_US')

    setMeta('name', 'twitter:card', 'summary_large_image')
    setMeta('name', 'twitter:title', title)
    setMeta('name', 'twitter:description', description)
    setMeta('name', 'twitter:image', ogImage)
  }, [title, description, path, image, type, noindex])

  return null
}

type JsonLdProps = {
  data: Record<string, unknown> | Record<string, unknown>[]
}

/** Injects JSON-LD structured data into the document head for the current page. */
export function JsonLd({ data }: JsonLdProps) {
  const serialized = JSON.stringify(data)

  useEffect(() => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.dataset.seoJsonLd = 'true'
    script.textContent = serialized
    document.head.appendChild(script)
    return () => {
      script.remove()
    }
  }, [serialized])

  return null
}
