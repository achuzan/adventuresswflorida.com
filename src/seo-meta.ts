/**
 * SEO metadata shared by the React app (SeoHead/JsonLd) and the
 * build-time prerender plugin in vite.config.ts. Keep this file free of
 * DOM and React so it can run in Node during the build.
 */
import { site } from './site.ts'
import { featuredPhotoIds, photos, type Photo } from './data/photos.ts'

export type PageMeta = {
  title: string
  description: string
  path?: string
  image?: string
  type?: 'website' | 'article'
  noindex?: boolean
}

export function absoluteUrl(pathOrUrl: string) {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl
  }
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return `${site.siteUrl}${path}`
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
  notFound: {
    title: `Page Not Found · ${site.shortBrand}`,
    description: 'That page could not be found. Browse the wildlife photography gallery instead.',
    path: '/',
    noindex: true,
  },
} as const satisfies Record<string, PageMeta>

export function photoPageMeta(photo: Photo): PageMeta {
  const description =
    photo.story.length > 155 ? `${photo.story.slice(0, 155).trim()}…` : photo.story
  return {
    title: `${photo.title} · ${photo.location} Wildlife Photography`,
    description,
    path: `/gallery/${photo.id}`,
    image: `/photos/${photo.file}`,
    type: 'article',
  }
}

export function homeJsonLd(): Record<string, unknown>[] {
  const featured = featuredPhotoIds
    .map((id) => photos.find((p) => p.id === id))
    .filter((p): p is Photo => Boolean(p))

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: site.brand,
      url: site.siteUrl,
      description: site.tagline,
      publisher: {
        '@type': 'Person',
        name: site.photographer,
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: site.photographer,
      jobTitle: 'Wildlife Photographer',
      url: site.siteUrl,
      email: site.email,
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Lehigh Acres',
        addressRegion: 'FL',
        addressCountry: 'US',
      },
      image: `${site.siteUrl}/brand/logo.png`,
      sameAs: Object.values(site.socials),
      knowsAbout: [
        'Wildlife photography',
        'Southwest Florida',
        'Fine art prints',
        'Bird photography',
        'Wetland ecosystems',
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ProfessionalService',
      name: site.brand,
      url: site.siteUrl,
      image: `${site.siteUrl}${site.defaultOgImage}`,
      description: site.tagline,
      areaServed: {
        '@type': 'AdministrativeArea',
        name: 'Southwest Florida',
      },
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Lehigh Acres',
        addressRegion: 'FL',
        addressCountry: 'US',
      },
      founder: {
        '@type': 'Person',
        name: site.photographer,
      },
      makesOffer: {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Product',
          name: 'Wildlife fine art prints',
          url: site.shopUrl,
        },
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ImageGallery',
      name: `${site.brand} Gallery`,
      url: `${site.siteUrl}/gallery`,
      description: 'Wildlife photography from Southwest Florida preserves, parks, and shoreline.',
      associatedMedia: featured.map((photo) => ({
        '@type': 'ImageObject',
        contentUrl: `${site.siteUrl}/photos/${photo.file}`,
        name: photo.title,
        description: photo.alt,
        contentLocation: photo.location,
      })),
    },
  ]
}

export function photoJsonLd(photo: Photo): Record<string, unknown>[] {
  const pageUrl = `${site.siteUrl}/gallery/${photo.id}`
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Photograph',
      name: photo.title,
      description: photo.story,
      image: `${site.siteUrl}/photos/${photo.file}`,
      contentLocation: {
        '@type': 'Place',
        name: photo.location,
      },
      creator: {
        '@type': 'Person',
        name: site.photographer,
        url: site.siteUrl,
      },
      copyrightHolder: {
        '@type': 'Person',
        name: site.photographer,
      },
      url: pageUrl,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: site.siteUrl,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Gallery',
          item: `${site.siteUrl}/gallery`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: photo.title,
          item: pageUrl,
        },
      ],
    },
  ]
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** Renders the full SEO head block for build-time prerendering. */
export function renderHeadTags(meta: PageMeta, jsonLd?: Record<string, unknown>[]) {
  const url = absoluteUrl(meta.path ?? '/')
  const image = absoluteUrl(meta.image ?? site.defaultOgImage)
  const title = escapeHtml(meta.title)
  const description = escapeHtml(meta.description)

  const lines = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta name="robots" content="${meta.noindex ? 'noindex,nofollow' : 'index,follow'}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:site_name" content="${escapeHtml(site.brand)}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:type" content="${meta.type ?? 'website'}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${image}" />`,
  ]

  if (jsonLd && jsonLd.length > 0) {
    lines.push(
      `<script type="application/ld+json" data-seo-static="true">${JSON.stringify(jsonLd)}</script>`,
    )
  }

  return lines.join('\n    ')
}

/** Every statically prerendered route: output file relative to dist/, meta, and structured data. */
export function prerenderRoutes(): { file: string; head: string }[] {
  const routes: { file: string; meta: PageMeta; jsonLd?: Record<string, unknown>[] }[] = [
    { file: 'index.html', meta: pageMeta.home, jsonLd: homeJsonLd() },
    { file: 'gallery.html', meta: pageMeta.gallery },
    { file: 'about.html', meta: pageMeta.about },
    { file: 'contact.html', meta: pageMeta.contact },
    ...photos.map((photo) => ({
      file: `gallery/${photo.id}.html`,
      meta: photoPageMeta(photo),
      jsonLd: photoJsonLd(photo),
    })),
  ]

  return routes.map(({ file, meta, jsonLd }) => ({
    file,
    head: renderHeadTags(meta, jsonLd),
  }))
}
