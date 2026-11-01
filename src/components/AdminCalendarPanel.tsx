import { useEffect, useState, type FormEvent } from 'react'
import {
  CALENDAR_SUBJECT_MAX,
  calendarPath,
  calendarSlots,
  parseCalendarCatalog,
  parseCalendarEntry,
  type CalendarEntry,
  type CalendarSlot,
} from '../data/calendars'

const monthSlots = calendarSlots.filter(
  (slot) => slot !== 'front' && slot !== 'back' && slot !== 'logo',
)
const coverSlots = calendarSlots.filter(
  (slot) => slot === 'front' || slot === 'back' || slot === 'logo',
)

export function AdminCalendarPanel() {
  const [calendars, setCalendars] = useState<{ year: number; entries: CalendarEntry[] }[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [year, setYear] = useState<number | null>(null)
  const [slot, setSlot] = useState<CalendarSlot>('january')
  const [subject, setSubject] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [audioPreview, setAudioPreview] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [pickerKey, setPickerKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const res = await fetch('/api/calendars', { credentials: 'same-origin', cache: 'no-store' })
        if (!res.ok) throw new Error('Could not load calendar pages')
        const parsed = parseCalendarCatalog(await res.json())
        if (!parsed || parsed.length === 0) throw new Error('Could not load calendar pages')
        if (cancelled) return
        setCalendars(parsed)
        setYear((current) => (parsed.some((item) => item.year === current) ? current : parsed[0]!.year))
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Could not load calendar pages')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null)
      return
    }
    const url = URL.createObjectURL(photoFile)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photoFile])

  useEffect(() => {
    if (!audioFile) {
      setAudioPreview(null)
      return
    }
    const url = URL.createObjectURL(audioFile)
    setAudioPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [audioFile])

  const selected = calendars.find((item) => item.year === year) ?? null
  const entry = selected?.entries.find((item) => item.slot === slot) ?? selected?.entries[0] ?? null

  useEffect(() => {
    if (entry) setSubject(entry.subject)
  }, [entry])

  const dirty =
    entry !== null &&
    (subject.trim() !== entry.subject || photoFile !== null || audioFile !== null)

  function confirmDiscard() {
    if (!dirty) return true
    return window.confirm('Discard unsaved changes to this calendar page?')
  }

  function resetFiles() {
    setPhotoFile(null)
    setAudioFile(null)
    setFormKey((current) => current + 1)
  }

  function changeYear(nextYear: number) {
    if (nextYear === year) return
    if (!confirmDiscard()) {
      setPickerKey((current) => current + 1)
      return
    }
    const nextCalendar = calendars.find((item) => item.year === nextYear)
    const nextEntry = nextCalendar?.entries.find((item) => item.slot === 'january') ?? nextCalendar?.entries[0]
    setYear(nextYear)
    setSlot(nextEntry?.slot ?? 'january')
    setSubject(nextEntry?.subject ?? '')
    setNotice(null)
    setError(null)
    resetFiles()
  }

  function changeSlot(nextSlot: CalendarSlot) {
    if (nextSlot === entry?.slot) return
    if (!confirmDiscard()) {
      setPickerKey((current) => current + 1)
      return
    }
    const nextEntry = selected?.entries.find((item) => item.slot === nextSlot)
    setSlot(nextSlot)
    setSubject(nextEntry?.subject ?? '')
    setNotice(null)
    setError(null)
    resetFiles()
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!entry) return
    const nextSubject = subject.trim()
    if (!nextSubject) {
      setError('Subject is required')
      return
    }
    setSaving(true)
    setNotice(null)
    setError(null)
    try {
      const body = new FormData()
      body.set('subject', nextSubject)
      if (photoFile) body.set('photo', photoFile)
      if (audioFile) body.set('audio', audioFile)
      const res = await fetch(`/api/admin/calendars/${entry.year}/${entry.slot}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        body,
      })
      const data = (await res.json().catch(() => null)) as { error?: string; entry?: unknown } | null
      if (res.status === 401) {
        setError('Your session expired. Sign in again.')
        return
      }
      if (!res.ok) {
        setError(data?.error ?? 'Could not save this calendar page')
        return
      }
      const saved = parseCalendarEntry(data?.entry)
      if (!saved) {
        setError('Saved, but the updated page could not be read. Reload and check it.')
        return
      }
      setCalendars((current) =>
        current.map((item) =>
          item.year !== saved.year
            ? item
            : {
                ...item,
                entries: item.entries.map((page) => (page.slot === saved.slot ? saved : page)),
              },
        ),
      )
      setSubject(saved.subject)
      resetFiles()
      setNotice(`Saved ${saved.label}. The QR code for this page now shows the update.`)
    } catch {
      setError('Could not save. Is the Worker running?')
    } finally {
      setSaving(false)
    }
  }

  if (calendars.length === 0) {
    return (
      <section className="admin-card">
        <h2>Calendar pages</h2>
        {loading ? (
          <p className="admin-status">Loading calendar pages…</p>
        ) : (
          <p className="admin-error">{loadError ?? 'Could not load calendar pages'}</p>
        )}
        {loadError && (
          <button type="button" className="btn btn--accent" onClick={() => setReloadKey((current) => current + 1)}>
            Try again
          </button>
        )}
      </section>
    )
  }

  return (
    <form className="admin-card" onSubmit={(e) => void onSubmit(e)}>
      <h2>Calendar pages</h2>
      <p className="admin-hint">
        QR codes open these pages. Change the subject, photo, or audio. The QR code address stays the same.
        Leave a file blank to keep the current one.
      </p>

      {(notice || error) && (
        <div className="admin-flash" role="status">
          {notice && <p className="admin-notice">{notice}</p>}
          {error && <p className="admin-error">{error}</p>}
        </div>
      )}

      <div className="admin-grid">
        {calendars.length > 1 && (
          <label>
            Calendar
            <select
              key={`year-${pickerKey}`}
              value={selected?.year ?? ''}
              onChange={(e) => changeYear(Number(e.target.value))}
            >
              {calendars.map((item) => (
                <option key={item.year} value={item.year}>
                  {item.year}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={calendars.length > 1 ? undefined : 'admin-span-2'}>
          Page
          <select
            key={`page-${pickerKey}`}
            value={entry?.slot ?? slot}
            onChange={(e) => changeSlot(e.target.value as CalendarSlot)}
          >
            <optgroup label="Months">
              {monthSlots.map((month) => {
                const page = selected?.entries.find((item) => item.slot === month)
                return (
                  <option key={month} value={month}>
                    {page ? `${page.label} — ${page.subject}` : month}
                  </option>
                )
              })}
            </optgroup>
            <optgroup label="Covers">
              {coverSlots.map((cover) => {
                const page = selected?.entries.find((item) => item.slot === cover)
                return (
                  <option key={cover} value={cover}>
                    {page ? `${page.label} — ${page.subject}` : cover}
                  </option>
                )
              })}
            </optgroup>
          </select>
        </label>
      </div>

      {entry && (
        <div className="admin-calendar-editor">
          <img
            src={photoPreview ?? entry.photoSrc}
            alt=""
            className={entry.slot === 'logo' ? 'is-logo' : undefined}
          />
          <div className="admin-calendar-fields">
            <label>
              Subject
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={CALENDAR_SUBJECT_MAX}
                required
              />
            </label>
            <label>
              Replace photo
              <input
                key={`${entry.year}-${entry.slot}-photo-${formKey}`}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <p className="admin-file-note">
              {photoFile ? 'New photo selected. Save to publish it.' : 'JPG, PNG, or WebP. Blank keeps the current photo.'}
            </p>
            <div>
              <p className="admin-file-note">{audioFile ? 'New audio' : 'Current audio'}</p>
              <audio
                key={audioPreview ?? entry.audioSrc}
                controls
                preload="metadata"
                src={audioPreview ?? entry.audioSrc}
              />
            </div>
            <label>
              Replace audio
              <input
                key={`${entry.year}-${entry.slot}-audio-${formKey}`}
                type="file"
                accept="audio/mpeg,audio/mp4,audio/wav,audio/aac,audio/ogg,.mp3,.m4a,.wav,.aac,.ogg"
                onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <p className="admin-file-note">
              {audioFile
                ? 'New audio selected. Save to publish it. You can press play above to check it first.'
                : 'MP3, M4A, WAV, AAC, or OGG. Blank keeps the current audio.'}
            </p>
            <div className="admin-photo-row__actions">
              <button className="btn btn--accent" type="submit" disabled={saving || !dirty || !subject.trim()}>
                {saving ? 'Saving…' : `Save ${entry.label}`}
              </button>
              <a className="text-link" href={calendarPath(entry.year, entry.slot)} target="_blank" rel="noreferrer">
                View page
              </a>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
