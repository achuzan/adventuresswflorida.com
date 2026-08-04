export type { Photo } from '../shared/photo.ts'
export { photoImageSrc } from '../shared/photo.ts'
export { featuredPhotoIds, seedPhotos as photos } from '../shared/seed-photos.ts'

import { seedPhotos } from '../shared/seed-photos.ts'
import type { Photo } from '../shared/photo.ts'

export function getPhotoById(id: string, list: Photo[] = seedPhotos) {
  return list.find((p) => p.id === id)
}

export function photoPath(id: string) {
  return `/gallery/${id}`
}

export function photoImageUrl(photo: Photo, origin = '') {
  if (photo.imageUrl) {
    return photo.imageUrl.startsWith('http') ? photo.imageUrl : `${origin}${photo.imageUrl}`
  }
  return `${origin}/photos/${photo.file}`
}
