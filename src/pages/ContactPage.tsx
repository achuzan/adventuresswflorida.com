import { pageMeta, SeoHead } from '../seo'
import { site } from '../site'

const contactLinks = [
  { label: 'Email', value: site.email, href: `mailto:${site.email}`, external: false },
  {
    label: 'Instagram',
    value: '@adventuresswflorida',
    href: site.socials.instagram,
    external: true,
  },
  {
    label: 'Facebook',
    value: 'Adventures SW Florida',
    href: site.socials.facebook,
    external: true,
  },
  {
    label: 'YouTube',
    value: '@AdventuresSWFlorida',
    href: site.socials.youtube,
    external: true,
  },
  {
    label: 'Threads',
    value: '@adventuresswflorida',
    href: site.socials.threads,
    external: true,
  },
  {
    label: 'Pinterest',
    value: 'adventuresswflorida',
    href: site.socials.pinterest,
    external: true,
  },
  {
    label: 'Bluesky',
    value: '@adventuresswfl.bsky.social',
    href: site.socials.bluesky,
    external: true,
  },
  {
    label: 'TikTok',
    value: '@adventuresswflori4',
    href: site.socials.tiktok,
    external: true,
  },
  {
    label: 'Blog',
    value: 'adventuresswflorida.blogspot.com',
    href: site.socials.blog,
    external: true,
  },
  {
    label: 'Spotify',
    value: 'Listen',
    href: site.socials.spotify,
    external: true,
  },
  {
    label: 'Print Shop',
    value: 'shop.adventuresswflorida.com',
    href: site.shopUrl,
    external: false,
  },
] as const

export function ContactPage() {
  return (
    <div className="page page--narrow">
      <SeoHead {...pageMeta.contact} />
      <header className="page-hero">
        <h1>Contact</h1>
        <p>
          Questions about a photograph, print licensing, or a custom order? Reach out — I would love
          to hear from you.
        </p>
      </header>

      <div className="contact-list">
        {contactLinks.map((link) => (
          <a
            key={link.label}
            className="contact-row"
            href={link.href}
            {...(link.external ? { target: '_blank', rel: 'noreferrer' } : {})}
          >
            <span>{link.label}</span>
            <strong>{link.value}</strong>
          </a>
        ))}
      </div>
    </div>
  )
}
