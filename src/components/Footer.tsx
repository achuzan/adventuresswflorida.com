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
              <a href={site.shopUrl}>
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
            <li>
              <a href={site.socials.youtube} target="_blank" rel="noreferrer">
                YouTube
              </a>
            </li>
            <li>
              <a href={site.socials.threads} target="_blank" rel="noreferrer">
                Threads
              </a>
            </li>
            <li>
              <a href={site.socials.pinterest} target="_blank" rel="noreferrer">
                Pinterest
              </a>
            </li>
            <li>
              <a href={site.socials.bluesky} target="_blank" rel="noreferrer">
                Bluesky
              </a>
            </li>
            <li>
              <a href={site.socials.tiktok} target="_blank" rel="noreferrer">
                TikTok
              </a>
            </li>
            <li>
              <a href={site.socials.blog} target="_blank" rel="noreferrer">
                Blog
              </a>
            </li>
            <li>
              <a href={site.socials.spotify} target="_blank" rel="noreferrer">
                Spotify
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
