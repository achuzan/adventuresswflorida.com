import { Link } from 'react-router-dom'
import { pageMeta, SeoHead } from '../seo'

export function NotFoundPage() {
  return (
    <div className="page page--narrow">
      <SeoHead {...pageMeta.notFound} />
      <header className="page-hero">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p>
          That trail doesn’t lead anywhere. Head back to the gallery to keep exploring Southwest
          Florida wildlife.
        </p>
      </header>
      <div className="hero__actions">
        <Link className="btn btn--accent" to="/gallery">
          View Gallery
        </Link>
        <Link className="text-link" to="/">
          Back Home
        </Link>
      </div>
    </div>
  )
}
