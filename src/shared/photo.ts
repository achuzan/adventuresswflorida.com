/** Shared photo shape used by the Worker API and the React app. */
export type Photo = {
  id: string
  /** Filenames under /public/photos/ for seed images */
  file: string
  title: string
  location: string
  alt: string
  story: string
  wash: string
  /** Optional Printify / shop product or collection URL */
  shopUrl?: string
  /** When set (uploaded via admin), used instead of /photos/{file} */
  imageUrl?: string
}

export const CATALOG_KEY = 'photos:catalog'

const WASHES = [
  'linear-gradient(145deg, #1e4d45 0%, #3d6b5c 40%, #e07020 100%)',
  'linear-gradient(160deg, #2a1f18 0%, #4a3428 45%, #c45c20 100%)',
  'linear-gradient(135deg, #5c2a3a 0%, #e07020 50%, #e8b84a 100%)',
  'linear-gradient(150deg, #243028 0%, #5c4033 55%, #8a6a4a 100%)',
  'linear-gradient(160deg, #0f2a28 0%, #1e4d45 50%, #6b8f71 100%)',
  'linear-gradient(145deg, #163a36 0%, #2a6b6e 40%, #a8c4b8 100%)',
  'linear-gradient(140deg, #1a4a2e 0%, #3d7a4a 50%, #c4d46a 100%)',
  'linear-gradient(155deg, #1a2430 0%, #3d4a5c 40%, #e07020 95%)',
] as const

export function randomWash() {
  return WASHES[Math.floor(Math.random() * WASHES.length)]!
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

export function photoImageSrc(photo: Photo) {
  if (photo.imageUrl) return photo.imageUrl
  return `/photos/${photo.file}`
}
