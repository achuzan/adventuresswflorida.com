import { Link } from 'react-router-dom'
import { site } from '../site'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="site-footer__grid">
        <div className="site-footer__brand">
          <img src="/brand/logo.png" alt={site.brand} width={88} height={88} />
          <p>
            Wildlife photography by {site.photographer}. Based in {site.baseLocation}.
          </p>
        </div>

        <div>
          <h2 className="site-footer__heading">Explore</h2>
          <ul className="site-footer__links">
            <li>
              <Link to="/gallery">Gallery</Link>
            </li>
            <li>
              <Link to="/about">About</Link>
            </li>
            <li>
              <Link to="/contact">Contact</Link>
            </li>
            <li>
              <a href={site.shopUrl} target="_blank" rel="noreferrer">
                Print Shop
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="site-footer__heading">Connect</h2>
          <ul className="site-footer__links">
            <li>
              <a href={`mailto:${site.email}`}>{site.email}</a>
            </li>
            <li>
              <a href={site.socials.instagram} target="_blank" rel="noreferrer">
                Instagram
              </a>
            </li>
            <li>
              <a href={site.socials.facebook} target="_blank" rel="noreferrer">
                Facebook
              </a>
            </li>
          </ul>
        </div>
      </div>
      <p className="site-footer__legal">
        © {year} {site.brand}. All rights reserved.
      </p>
    </footer>
  )
}
