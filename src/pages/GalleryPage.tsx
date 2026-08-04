import { Link } from 'react-router-dom'
import { photoPath } from '../data/photos'
import { usePhotos } from '../data/PhotosProvider'
import { PhotoFrame } from '../components/PhotoFrame'
import { pageMeta, SeoHead } from '../seo'
import { site } from '../site'

export function GalleryPage() {
  const { photos } = usePhotos()

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
        {photos.map((photo, i) => (
          <Link
            key={photo.id}
            to={photoPath(photo.id)}
            className="gallery-tile"
            style={{ animationDelay: `${Math.min(i, 10) * 0.06}s` }}
          >
            <PhotoFrame photo={photo} sizes="(max-width: 720px) 50vw, 33vw" />
            <span className="gallery-tile__caption">
              <strong>{photo.title}</strong>
              <span>{photo.location}</span>
            </span>
          </Link>
        ))}
      </div>

      <p className="gallery-note">
        Bring home your piece of Southwest Florida.{' '}
        <a href={site.shopUrl}>Shop Adventures in Southwest Florida</a>.
      </p>
    </div>
  )
}
