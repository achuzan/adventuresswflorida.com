import { Link } from 'react-router-dom'
import { featuredPhotoIds, photos } from '../data/photos'
import { PhotoFrame } from '../components/PhotoFrame'
import { site } from '../site'

export function HomePage() {
  const featured = featuredPhotoIds
    .map((id) => photos.find((p) => p.id === id))
    .filter((p): p is (typeof photos)[number] => Boolean(p))
  const hero = photos.find((p) => p.id === 'alligator') ?? photos[0]
  const shopBand = photos.find((p) => p.id === 'scrub-jay') ?? photos[1] ?? hero

  return (
    <>
      <section className="hero">
        <div className="hero__media" aria-hidden>
          <PhotoFrame photo={hero} className="hero__frame" priority />
          <div className="hero__veil" />
        </div>

        <div className="hero__content">
          <img
            className="hero__logo"
            src="/brand/logo.png"
            alt={site.brand}
            width={160}
            height={160}
          />
          <h1 className="hero__brand">{site.brand}</h1>
          <p className="hero__lede">{site.tagline}</p>
          <div className="hero__actions">
            <Link className="btn btn--light" to="/gallery">
              View Gallery
            </Link>
            <a className="btn btn--accent" href={site.shopUrl} target="_blank" rel="noreferrer">
              Shop Prints
            </a>
          </div>
        </div>
      </section>

      <section className="section featured">
        <div className="section__intro">
          <h2>Featured work</h2>
          <p>Moments from the preserves, parks, and shoreline of Southwest Florida.</p>
        </div>
        <div className="featured__grid">
          {featured.map((photo, i) => (
            <Link
              key={photo.id}
              to="/gallery"
              className={`featured__item featured__item--${i + 1}`}
              style={{ animationDelay: `${0.08 * i}s` }}
            >
              <PhotoFrame photo={photo} />
              <span className="featured__caption">
                <strong>{photo.title}</strong>
                <span>{photo.location}</span>
              </span>
            </Link>
          ))}
        </div>
        <div className="section__cta">
          <Link className="text-link" to="/gallery">
            Browse the full gallery
          </Link>
        </div>
      </section>

      <section className="section band band--photo">
        <div className="band__media" aria-hidden>
          <PhotoFrame photo={shopBand} className="band__frame" />
          <div className="band__veil" />
        </div>
        <div className="band__copy">
          <h2>Prints that bring the wild indoors</h2>
          <p>
            Choose a favorite image from the gallery, then order museum-quality prints, canvases,
            and more from the shop — fulfilled through Printify.
          </p>
          <a className="btn btn--accent" href={site.shopUrl} target="_blank" rel="noreferrer">
            Visit the Print Shop
          </a>
        </div>
      </section>

      <section className="section about-teaser">
        <div className="about-teaser__copy">
          <h2>Meet Brad</h2>
          <p>{site.aboutIntro}</p>
          <Link className="text-link" to="/about">
            Read the full story
          </Link>
        </div>
      </section>
    </>
  )
}
