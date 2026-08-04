import { seedPhotos } from '../src/shared/seed-photos'
import { CATALOG_KEY, type Photo } from '../src/shared/photo'

export async function getCatalog(kv: KVNamespace): Promise<Photo[]> {
  const raw = await kv.get(CATALOG_KEY)
  if (!raw) {
    await kv.put(CATALOG_KEY, JSON.stringify(seedPhotos))
    return structuredClone(seedPhotos)
  }
  try {
    const parsed = JSON.parse(raw) as Photo[]
    if (!Array.isArray(parsed)) throw new Error('invalid catalog')
    return parsed
  } catch {
    await kv.put(CATALOG_KEY, JSON.stringify(seedPhotos))
    return structuredClone(seedPhotos)
  }
}

export async function saveCatalog(kv: KVNamespace, photos: Photo[]) {
  await kv.put(CATALOG_KEY, JSON.stringify(photos))
}

export async function upsertPhoto(kv: KVNamespace, photo: Photo) {
  const catalog = await getCatalog(kv)
  const index = catalog.findIndex((p) => p.id === photo.id)
  if (index >= 0) {
    catalog[index] = photo
  } else {
    catalog.push(photo)
  }
  await saveCatalog(kv, catalog)
  return photo
}

export async function updatePhoto(
  kv: KVNamespace,
  id: string,
  patch: Partial<Omit<Photo, 'id'>>,
) {
  const catalog = await getCatalog(kv)
  const index = catalog.findIndex((p) => p.id === id)
  if (index < 0) return null
  const next = { ...catalog[index]!, ...patch, id }
  catalog[index] = next
  await saveCatalog(kv, catalog)
  return next
}

export async function deletePhoto(kv: KVNamespace, id: string) {
  const catalog = await getCatalog(kv)
  const photo = catalog.find((p) => p.id === id)
  if (!photo) return null
  const next = catalog.filter((p) => p.id !== id)
  await saveCatalog(kv, next)
  return photo
}
