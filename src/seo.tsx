import { useEffect } from 'react'
import { site } from './site'

export type PageMeta = {
  title: string
  description: string
  path?: string
  image?: string
  type?: 'website' | 'article'
  noindex?: boolean
}

function absoluteUrl(pathOrUrl: string) {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl
  }
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return `${site.siteUrl}${path}`
}

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

export const pageMeta = {
  home: {
    title: 'Wildlife Photography & Fine Art Prints | Adventures in Southwest Florida',
    description:
      'Wildlife photography by Brad Kemp — Adventures in Southwest Florida. Explore the gallery and shop fine-art prints from sloughs, beaches, and wild edges.',
    path: '/',
    image: site.defaultOgImage,
  },
  gallery: {
    title: `Southwest Florida Wildlife Photo Gallery · ${site.shortBrand}`,
    description:
      'Browse wildlife photography from Southwest Florida — alligators, scrub jays, egrets, and wetland moments. Open any image for the story and shop prints.',
    path: '/gallery',
    image: '/photos/florida-scrub-jay.jpg',
  },
  about: {
    title: `About Brad Kemp · Wildlife Photographer · ${site.shortBrand}`,
    description:
      'Meet Brad Kemp, wildlife photographer based in Lehigh Acres, Florida. Adventures in Southwest Florida captures alligators, birds, and wild edges across Lee County and beyond.',
    path: '/about',
    image: site.defaultOgImage,
  },
  contact: {
    title: `Contact Brad Kemp · ${site.shortBrand}`,
    description:
      'Contact Brad Kemp for wildlife photography questions, print licensing, and custom orders. Adventures in Southwest Florida — Lehigh Acres, Florida.',
    path: '/contact',
    image: site.defaultOgImage,
  },
} as const
