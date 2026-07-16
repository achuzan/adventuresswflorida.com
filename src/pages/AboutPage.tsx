import { pageMeta, SeoHead } from '../seo'
import { site } from '../site'

export function AboutPage() {
  return (
    <div className="page page--narrow">
      <SeoHead {...pageMeta.about} />
      <header className="page-hero">
        <p className="eyebrow">About</p>
        <h1>{site.photographer}</h1>
        <p className="lede">{site.aboutIntro}</p>
      </header>

      <div className="prose">
        {site.aboutBody.map((paragraph) => (
          <p key={paragraph.slice(0, 32)}>{paragraph}</p>
        ))}
      </div>

      <aside className="about-locations">
        <h2>Where I wander</h2>
        <ul>
          <li>Lakes Park</li>
          <li>Six Mile Cypress Slough Preserve</li>
          <li>Southwest Florida beaches & wetlands</li>
          <li>Based in {site.baseLocation}</li>
        </ul>
      </aside>
    </div>
  )
}
