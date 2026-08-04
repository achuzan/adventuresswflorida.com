import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { photos as seedPhotos, type Photo } from '../data/photos'

type PhotosContextValue = {
  photos: Photo[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const PhotosContext = createContext<PhotosContextValue | null>(null)

async function fetchCatalog(): Promise<Photo[]> {
  const res = await fetch('/api/photos', { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`Could not load photos (${res.status})`)
  const data = (await res.json()) as { photos?: Photo[] }
  if (!Array.isArray(data.photos)) throw new Error('Invalid photo catalog')
  return data.photos
}

export function PhotosProvider({ children }: { children: ReactNode }) {
  const [photos, setPhotos] = useState<Photo[]>(seedPhotos)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    try {
      const next = await fetchCatalog()
      setPhotos(next)
      setError(null)
    } catch (err) {
      // Fall back to the built-in seed catalog when the Worker API is offline (e.g. vite-only).
      setPhotos(seedPhotos)
      setError(err instanceof Error ? err.message : 'Could not load photos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  return (
    <PhotosContext.Provider value={{ photos, loading, error, refresh }}>
      {children}
    </PhotosContext.Provider>
  )
}

export function usePhotos() {
  const ctx = useContext(PhotosContext)
  if (!ctx) throw new Error('usePhotos must be used within PhotosProvider')
  return ctx
}

export function usePhoto(id: string) {
  const { photos, loading } = usePhotos()
  return { photo: photos.find((p) => p.id === id), loading }
}
