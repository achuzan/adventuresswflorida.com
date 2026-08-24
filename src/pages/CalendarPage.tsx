import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getCalendarEntry } from '../data/calendars'
import { calendarPageMeta, SeoHead } from '../seo'
import { site } from '../site'
import { NotFoundPage } from './NotFoundPage'

export function CalendarPage() {
  const [params] = useSearchParams()
  const entry = getCalendarEntry(params.get('year'), params.get('month'))
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
    setPlaying(false)
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = 0
    void audio.play().catch(() => {
      /* Browsers often block autoplay from a QR scan; the play control remains. */
    })
  }, [entry?.audioSrc])

  if (!entry) {
    return <NotFoundPage />
  }

  async function togglePlayback() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      try {
        await audio.play()
      } catch {
        /* Native controls still work if play() is blocked. */
      }
      return
    }
    audio.pause()
  }

  return (
    <div className="page page--calendar">
      <SeoHead {...calendarPageMeta(entry)} />

      <div className="calendar-page__layout">
        <div className="calendar-page__media">
          <button
            type="button"
            className={`calendar-page__frame${entry.slot === 'logo' ? ' calendar-page__frame--logo' : ''}`}
            onClick={() => void togglePlayback()}
            aria-label={playing ? `Pause audio for ${entry.subject}` : `Play audio for ${entry.subject}`}
          >
            <img src={entry.photoSrc} alt={entry.alt} />
            {!playing && (
              <span className="calendar-page__play" aria-hidden>
                <span className="calendar-page__play-icon" />
              </span>
            )}
          </button>
        </div>

        <div className="calendar-page__copy">
          <p className="eyebrow">
            {entry.year} Calendar · {entry.label}
          </p>
          <h1>{entry.subject}</h1>
          <p className="calendar-page__lede">
            Photograph and audio from the {entry.year} {site.shortBrand} calendar
            {entry.slot === 'logo' ? '.' : ` — ${entry.label}.`}
          </p>

          <div className="calendar-page__audio">
            <p className="calendar-page__audio-label">Listen</p>
            <audio
              ref={audioRef}
              key={entry.audioSrc}
              controls
              preload="auto"
              src={entry.audioSrc}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
            >
              Your browser does not support audio playback.
            </audio>
          </div>

          <p className="calendar-page__credit">
            Wildlife photography by {site.photographer}. Part of {site.brand}.
          </p>
          <div className="calendar-page__actions">
            <a className="btn btn--accent" href={site.shopUrl}>
              Shop Prints
            </a>
            <Link className="text-link" to="/gallery">
              View Gallery
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
