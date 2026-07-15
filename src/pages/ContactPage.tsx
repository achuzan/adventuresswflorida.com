import { site } from '../site'

export function ContactPage() {
  return (
    <div className="page page--narrow">
      <header className="page-hero">
        <h1>Contact</h1>
        <p>
          Questions about a photograph, print licensing, or a custom order? Reach out — I would love
          to hear from you.
        </p>
      </header>

      <div className="contact-list">
        <a className="contact-row" href={`mailto:${site.email}`}>
          <span>Email</span>
          <strong>{site.email}</strong>
        </a>
        <a
          className="contact-row"
          href={site.socials.instagram}
          target="_blank"
          rel="noreferrer"
        >
          <span>Instagram</span>
          <strong>@adventuresswflorida</strong>
        </a>
        <a
          className="contact-row"
          href={site.socials.facebook}
          target="_blank"
          rel="noreferrer"
        >
          <span>Facebook</span>
          <strong>Adventures SW Florida</strong>
        </a>
        <a className="contact-row" href={site.shopUrl}>
          <span>Print Shop</span>
          <strong>shop.adventuresswflorida.com</strong>
        </a>
      </div>
    </div>
  )
}
