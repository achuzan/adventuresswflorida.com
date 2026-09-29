import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { usePhotos } from '../data/PhotosProvider'
import { useSiteSettings } from '../data/SiteSettingsProvider'
import { photoImageSrc, photoPath, type Photo } from '../data/photos'
import { SeoHead } from '../seo'
import { site } from '../site'
import type { CalendarNav } from '../shared/site-settings'

type SessionState = 'checking' | 'guest' | 'authed'

export function AdminPage() {
  const { photos, refresh } = usePhotos()
  const [session, setSession] = useState<SessionState>('checking')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [alt, setAlt] = useState('')
  const [story, setStory] = useState('')
  const [shopUrl, setShopUrl] = useState<string>(site.shopUrl)
  const [image, setImage] = useState<File | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin/session', { credentials: 'same-origin' })
        const data = (await res.json()) as { authenticated?: boolean }
        if (!cancelled) setSession(data.authenticated ? 'authed' : 'guest')
      } catch {
        if (!cancelled) setSession('guest')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function onLogin(e: FormEvent) {
    e.preventDefault()
    setLoginError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setLoginError(data?.error ?? 'Login failed')
        return
      }
      setPassword('')
      setSession('authed')
      await refresh()
    } catch {
      setLoginError('Could not reach the admin API. Run wrangler (npm run dev:full).')
    } finally {
      setBusy(false)
    }
  }

  async function onLogout() {
    setBusy(true)
    try {
      await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' })
    } finally {
      setSession('guest')
      setBusy(false)
    }
  }

  async function onAddPhoto(e: FormEvent) {
    e.preventDefault()
    if (!image) {
      setFormError('Choose a photo file to upload')
      return
    }
    setFormError(null)
    setNotice(null)
    setBusy(true)
    try {
      const body = new FormData()
      body.set('title', title)
      body.set('location', location)
      body.set('alt', alt || title)
      body.set('story', story)
      body.set('shopUrl', shopUrl)
      body.set('image', image)

      const res = await fetch('/api/admin/photos', {
        method: 'POST',
        credentials: 'same-origin',
        body,
      })
      const data = (await res.json().catch(() => null)) as
        | { error?: string; photo?: Photo }
        | null
      if (!res.ok) {
        setFormError(data?.error ?? 'Upload failed')
        return
      }
      setTitle('')
      setLocation('')
      setAlt('')
      setStory('')
      setShopUrl(site.shopUrl)
      setImage(null)
      setNotice(`Added “${data?.photo?.title ?? 'photo'}” to the gallery.`)
      await refresh()
    } catch {
      setFormError('Could not upload. Is the Worker running?')
    } finally {
      setBusy(false)
    }
  }

  async function savePhoto(
    photo: Photo,
    patch: Pick<Photo, 'title' | 'location' | 'alt' | 'story'> & { shopUrl: string },
  ) {
    setBusy(true)
    setNotice(null)
    setFormError(null)
    try {
      const res = await fetch(`/api/admin/photos/${encodeURIComponent(photo.id)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: patch.title.trim(),
          location: patch.location.trim(),
          alt: patch.alt.trim(),
          story: patch.story.trim(),
          shopUrl: patch.shopUrl.trim(),
        }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        setFormError(data?.error ?? `Could not update ${photo.title}`)
        return
      }
      setNotice(`Updated “${patch.title.trim() || photo.title}”.`)
      await refresh()
    } catch {
      setFormError('Could not save photo')
    } finally {
      setBusy(false)
    }
  }

  async function removePhoto(photo: Photo) {
    if (!photo.imageUrl) {
      setFormError('Seed photos ship with the site build. Remove them from src/shared/seed-photos.ts instead.')
      return
    }
    if (!window.confirm(`Delete “${photo.title}” from the gallery?`)) return
    setBusy(true)
    setFormError(null)
    try {
      const res = await fetch(`/api/admin/photos/${encodeURIComponent(photo.id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setFormError(data?.error ?? 'Delete failed')
        return
      }
      setNotice(`Deleted “${photo.title}”.`)
      await refresh()
    } catch {
      setFormError('Could not delete photo')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page page--admin">
      <SeoHead
        title={`Admin · ${site.shortBrand}`}
        description="Private gallery admin"
        path="/admin"
        noindex
      />

      <header className="page-hero admin-intro">
        <p className="eyebrow">Private</p>
        <h1>Gallery admin</h1>
        <p>
          Add photos, edit existing ones, and control the calendar link in the site menu.
        </p>
      </header>

      {session === 'checking' && <p className="admin-status">Checking session…</p>}

      {session === 'guest' && (
        <form className="admin-card admin-login" onSubmit={onLogin}>
          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {loginError && <p className="admin-error">{loginError}</p>}
          <button className="btn btn--accent" type="submit" disabled={busy}>
            Sign in
          </button>
        </form>
      )}

      {session === 'authed' && (
        <div className="admin-layout">
          <div className="admin-toolbar">
            <p className="admin-status">Signed in</p>
            <button type="button" className="text-link" onClick={() => void onLogout()} disabled={busy}>
              Sign out
            </button>
          </div>

          {(notice || formError) && (
            <div className="admin-flash" role="status">
              {notice && <p className="admin-notice">{notice}</p>}
              {formError && <p className="admin-error">{formError}</p>}
            </div>
          )}

          <CalendarNavCard
            busy={busy}
            onSaved={(label) => {
              setFormError(null)
              setNotice(`Updated the “${label}” menu link.`)
            }}
            onError={(message) => {
              setNotice(null)
              setFormError(message)
            }}
          />

          <form className="admin-card" onSubmit={onAddPhoto}>
            <h2>Add a photo</h2>
            <div className="admin-grid">
              <label>
                Title
                <input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </label>
              <label>
                Location
                <input value={location} onChange={(e) => setLocation(e.target.value)} required />
              </label>
              <label className="admin-span-2">
                Alt text
                <input
                  value={alt}
                  onChange={(e) => setAlt(e.target.value)}
                  placeholder="Describe the image for accessibility"
                  required
                />
              </label>
              <label className="admin-span-2">
                Story
                <textarea
                  value={story}
                  onChange={(e) => setStory(e.target.value)}
                  rows={4}
                  required
                />
              </label>
              <label className="admin-span-2">
                Shop / collection link
                <input
                  type="url"
                  value={shopUrl}
                  onChange={(e) => setShopUrl(e.target.value)}
                  placeholder="https://shop.adventuresswflorida.com/..."
                  required
                />
              </label>
              <label className="admin-span-2">
                Photo file
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setImage(e.target.files?.[0] ?? null)}
                  required
                />
              </label>
            </div>
            <button className="btn btn--accent" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Add to gallery'}
            </button>
          </form>

          <section className="admin-card">
            <h2>Edit photos</h2>
            <p className="admin-hint">
              Update title, location, alt text, story, and shop link. Leave the shop link blank to use
              the main shop URL.
            </p>
            <ul className="admin-photo-list">
              {photos.map((photo) => (
                <AdminPhotoRow
                  key={photo.id}
                  photo={photo}
                  busy={busy}
                  onSave={(patch) => void savePhoto(photo, patch)}
                  onDelete={() => void removePhoto(photo)}
                />
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  )
}

function CalendarNavCard({
  busy,
  onSaved,
  onError,
}: {
  busy: boolean
  onSaved: (label: string) => void
  onError: (message: string) => void
}) {
  const { settings, refresh } = useSiteSettings()
  const saved = settings.calendarNav
  const [enabled, setEnabled] = useState(saved.enabled)
  const [label, setLabel] = useState(saved.label)
  const [url, setUrl] = useState(saved.url)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setEnabled(saved.enabled)
    setLabel(saved.label)
    setUrl(saved.url)
  }, [saved])

  const dirty =
    enabled !== saved.enabled || label !== saved.label || url !== saved.url

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarNav: {
            enabled,
            label: label.trim(),
            url: url.trim(),
          } satisfies CalendarNav,
        }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        onError(data?.error ?? 'Could not update the menu link')
        return
      }
      await refresh()
      onSaved(label.trim())
    } catch {
      onError('Could not save the menu link. Is the Worker running?')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="admin-card" onSubmit={(e) => void onSubmit(e)}>
      <h2>Menu link</h2>
      <p className="admin-hint">
        Show, rename, or change the calendar link in the navigation menu and footer.
      </p>
      <label className="admin-check">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Show in the navigation menu
      </label>
      <div className="admin-grid">
        <label>
          Link name
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={80}
            required
          />
        </label>
        <label className="admin-span-2">
          Link URL
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://shop.adventuresswflorida.com/..."
            required
          />
        </label>
      </div>
      <button
        className="btn btn--accent"
        type="submit"
        disabled={busy || saving || !dirty || !label.trim() || !url.trim()}
      >
        {saving ? 'Saving…' : 'Save menu link'}
      </button>
    </form>
  )
}

type PhotoEditPatch = Pick<Photo, 'title' | 'location' | 'alt' | 'story'> & { shopUrl: string }

function AdminPhotoRow({
  photo,
  busy,
  onSave,
  onDelete,
}: {
  photo: Photo
  busy: boolean
  onSave: (patch: PhotoEditPatch) => void
  onDelete: () => void
}) {
  const [title, setTitle] = useState(photo.title)
  const [location, setLocation] = useState(photo.location)
  const [alt, setAlt] = useState(photo.alt)
  const [story, setStory] = useState(photo.story)
  const [shopUrl, setShopUrl] = useState(photo.shopUrl ?? '')

  useEffect(() => {
    setTitle(photo.title)
    setLocation(photo.location)
    setAlt(photo.alt)
    setStory(photo.story)
    setShopUrl(photo.shopUrl ?? '')
  }, [photo])

  const dirty =
    title !== photo.title ||
    location !== photo.location ||
    alt !== photo.alt ||
    story !== photo.story ||
    shopUrl !== (photo.shopUrl ?? '')

  return (
    <li className="admin-photo-row">
      <img src={photoImageSrc(photo)} alt="" className="admin-photo-row__thumb" />
      <div className="admin-photo-row__body">
        <div className="admin-photo-row__meta">
          <strong>{photo.title}</strong>
          <Link to={photoPath(photo.id)} className="text-link">
            View page
          </Link>
        </div>
        <div className="admin-grid">
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label>
            Location
            <input value={location} onChange={(e) => setLocation(e.target.value)} required />
          </label>
          <label className="admin-span-2">
            Alt text
            <input value={alt} onChange={(e) => setAlt(e.target.value)} required />
          </label>
          <label className="admin-span-2">
            Story
            <textarea value={story} onChange={(e) => setStory(e.target.value)} rows={3} required />
          </label>
          <label className="admin-span-2">
            Shop / collection link
            <input
              type="url"
              value={shopUrl}
              onChange={(e) => setShopUrl(e.target.value)}
              placeholder={site.shopUrl}
            />
          </label>
        </div>
        <div className="admin-photo-row__actions">
          <button
            type="button"
            className="btn btn--accent"
            disabled={busy || !dirty || !title.trim() || !location.trim() || !alt.trim() || !story.trim()}
            onClick={() => onSave({ title, location, alt, story, shopUrl })}
          >
            Save changes
          </button>
          {photo.imageUrl ? (
            <button type="button" className="text-link" disabled={busy} onClick={onDelete}>
              Delete
            </button>
          ) : null}
        </div>
      </div>
    </li>
  )
}
