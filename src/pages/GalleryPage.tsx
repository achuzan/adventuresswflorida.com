import { useMemo, useState } from 'react'
import { photos } from '../data/photos'
import { PhotoFrame } from '../components/PhotoFrame'
import { Lightbox } from '../components/Lightbox'
import { site } from '../site'

export function GalleryPage() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const index = useMemo(
    () => (activeId ? photos.findIndex((p) => p.id === activeId) : -1),
    [activeId],
  )

  return (
    <div className="page">
      <header className="page-hero">
        <h1>Gallery</h1>
        <p>Wildlife and wild places across Southwest Florida — click any image to view larger.</p>
      </header>

      <div className="gallery-grid">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            className="gallery-card"
            style={{ animationDelay: `${Math.min(i, 8) * 0.05}s` }}
            onClick={() => setActiveId(photo.id)}
          >
            <PhotoFrame photo={photo} />
            <span className="gallery-card__meta">
              <strong>{photo.title}</strong>
              <span>{photo.location}</span>
            </span>
          </button>
        ))}
      </div>

      <p className="gallery-note">
        Bring home your piece of Southwest Florida.{' '}
        <a href={site.shopUrl} target="_blank" rel="noreferrer">
          Shop Adventures in Southwest Florida
        </a>
        .
      </p>

      {activeId && index >= 0 && (
        <Lightbox
          photoId={activeId}
          onClose={() => setActiveId(null)}
          onPrev={() =>
            setActiveId(photos[(index - 1 + photos.length) % photos.length]?.id ?? null)
          }
          onNext={() => setActiveId(photos[(index + 1) % photos.length]?.id ?? null)}
        />
      )}
    </div>
  )
}
