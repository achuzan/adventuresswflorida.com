import { useEffect, useId, useState } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { site } from '../site'

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/gallery', label: 'Gallery', end: false },
  { to: '/about', label: 'About', end: false },
  { to: '/contact', label: 'Contact', end: false },
] as const

export function Header() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const panelId = useId()
  const overHero = pathname === '/'
  const solid = open || scrolled || !overHero

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [pathname])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <header className={`site-header${solid ? ' is-solid' : ''}`}>
      <div className="site-header__inner">
        <Link to="/" className="brand-lockup" onClick={() => setOpen(false)}>
          <img
            src="/brand/logo.png"
            alt=""
            className="brand-lockup__mark"
            width={56}
            height={56}
          />
          <span className="brand-lockup__text">
            <span className="brand-lockup__name">{site.brand}</span>
            <span className="brand-lockup__sub">Photography</span>
          </span>
        </Link>

        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
          <span className="nav-toggle__bars" aria-hidden />
        </button>

        <nav id={panelId} className={`site-nav${open ? ' is-open' : ''}`} aria-label="Primary">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => (isActive ? 'is-active' : undefined)}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </NavLink>
          ))}
          <a className="btn btn--accent site-nav__shop" href={site.shopUrl}>
            Shop Prints
          </a>
        </nav>
      </div>
    </header>
  )
}
