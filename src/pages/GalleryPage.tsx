import { Link } from 'react-router-dom'
import { photoPath, photos } from '../data/photos'
import { PhotoFrame } from '../components/PhotoFrame'
import { pageMeta, SeoHead } from '../seo'
import { site } from '../site'

/** Visual rhythm for the mosaic — pattern repeats as the gallery grows */
const tileSizes = ['hero', 'tall', 'wide', 'std', 'tall', 'std', 'wide', 'std', 'tall', 'std', 'wide', 'std'] as const

export function GalleryPage() {
  return (
    <div className="page page--gallery">
      <SeoHead {...pageMeta.gallery} />

      <header className="page-hero gallery-intro">
        <p className="eyebrow">Field notes in light</p>
        <h1>Gallery</h1>
        <p>
          Alligators in still water, scrub jays with acorns, evenings on the Gulf — browse the
          frames, then open any image for the story and print options.
        </p>
      </header>

      <div className="gallery-mosaic">
        {photos.map((photo, i) => {
          const size = tileSizes[i % tileSizes.length]
          return (
            <Link
              key={photo.id}
              to={photoPath(photo.id)}
              className={`gallery-tile gallery-tile--${size}`}
              style={{ animationDelay: `${Math.min(i, 10) * 0.06}s` }}
            >
              <PhotoFrame photo={photo} sizes="(max-width: 720px) 100vw, 50vw" />
              <span className="gallery-tile__caption">
                <strong>{photo.title}</strong>
                <span>{photo.location}</span>
              </span>
            </Link>
          )
        })}
      </div>

      <p className="gallery-note">
        Bring home your piece of Southwest Florida.{' '}
        <a href={site.shopUrl}>Shop Adventures in Southwest Florida</a>.
      </p>
    </div>
  )
}
