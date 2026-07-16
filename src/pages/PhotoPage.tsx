import { Link, Navigate, useParams } from 'react-router-dom'
import { PhotoFrame } from '../components/PhotoFrame'
import { getPhotoById, photoImageUrl, photoPath, photos } from '../data/photos'
import { JsonLd, SeoHead } from '../seo'
import { site } from '../site'

export function PhotoPage() {
  const { photoId = '' } = useParams()
  const photo = getPhotoById(photoId)

  if (!photo) {
    return <Navigate to="/gallery" replace />
  }

  const index = photos.findIndex((p) => p.id === photo.id)
  const prev = photos[(index - 1 + photos.length) % photos.length]
  const next = photos[(index + 1) % photos.length]
  const imagePath = photoImageUrl(photo)
  const pagePath = photoPath(photo.id)
  const title = `${photo.title} · ${photo.location} Wildlife Photography`
  const description = `${photo.story.slice(0, 155).trim()}${photo.story.length > 155 ? '…' : ''}`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Photograph',
    name: photo.title,
    description: photo.story,
    image: `${site.siteUrl}${imagePath}`,
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
    url: `${site.siteUrl}${pagePath}`,
  }

  return (
    <div className="page page--photo">
      <SeoHead
        title={title}
        description={description}
        path={pagePath}
        image={imagePath}
        type="article"
      />
      <JsonLd data={jsonLd} />

      <nav className="photo-page__crumbs" aria-label="Breadcrumb">
        <Link to="/gallery">Gallery</Link>
        <span aria-hidden>/</span>
        <span>{photo.title}</span>
      </nav>

      <div className="photo-page__layout">
        <div className="photo-page__media">
          <PhotoFrame photo={photo} className="photo-page__frame" priority sizes="(max-width: 900px) 100vw, 70vw" />
        </div>

        <div className="photo-page__copy">
          <p className="eyebrow">{photo.location}</p>
          <h1>{photo.title}</h1>
          <p className="photo-page__story">{photo.story}</p>
          <p className="photo-page__credit">
            Wildlife photography by {site.photographer}. Part of {site.brand}.
          </p>
          <div className="photo-page__actions">
            <a className="btn btn--accent" href={site.shopUrl}>
              Shop Prints
            </a>
            <Link className="text-link" to="/gallery">
              Back to Gallery
            </Link>
          </div>
        </div>
      </div>

      <nav className="photo-page__pager" aria-label="Other photographs">
        <Link to={photoPath(prev.id)} className="photo-page__nav">
          <span className="photo-page__nav-label">Previous</span>
          <strong>{prev.title}</strong>
        </Link>
        <Link to={photoPath(next.id)} className="photo-page__nav photo-page__nav--next">
          <span className="photo-page__nav-label">Next</span>
          <strong>{next.title}</strong>
        </Link>
      </nav>
    </div>
  )
}
