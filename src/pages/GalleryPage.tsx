import { useMemo, useState } from 'react'
import { photos } from '../data/photos'
import { PhotoFrame } from '../components/PhotoFrame'
import { Lightbox } from '../components/Lightbox'
import { site } from '../site'

/** Visual rhythm for the mosaic — pattern repeats as the gallery grows */
const tileSizes = ['hero', 'tall', 'wide', 'std', 'tall', 'std', 'wide', 'std', 'tall', 'std', 'wide', 'std'] as const

export function GalleryPage() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const index = useMemo(
    () => (activeId ? photos.findIndex((p) => p.id === activeId) : -1),
    [activeId],
  )

  return (
    <div className="page page--gallery">
      <header className="page-hero gallery-intro">
        <p className="eyebrow">Field notes in light</p>
        <h1>Gallery</h1>
        <p>
          Alligators in still water, scrub jays with acorns, evenings on the Gulf — browse the
          frames, then open any image full-screen.
        </p>
      </header>

      <div className="gallery-mosaic">
        {photos.map((photo, i) => {
          const size = tileSizes[i % tileSizes.length]
          return (
            <button
              key={photo.id}
              type="button"
              className={`gallery-tile gallery-tile--${size}`}
              style={{ animationDelay: `${Math.min(i, 10) * 0.06}s` }}
              onClick={() => setActiveId(photo.id)}
            >
              <PhotoFrame photo={photo} sizes="(max-width: 720px) 100vw, 50vw" />
              <span className="gallery-tile__caption">
                <strong>{photo.title}</strong>
                <span>{photo.location}</span>
              </span>
            </button>
          )
        })}
      </div>

      <p className="gallery-note">
        Bring home your piece of Southwest Florida.{' '}
        <a href={site.shopUrl}>Shop Adventures in Southwest Florida</a>.
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
