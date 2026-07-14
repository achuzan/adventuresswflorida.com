import { useEffect } from 'react'
import { photos } from '../data/photos'
import { PhotoFrame } from './PhotoFrame'

type Props = {
  photoId: string
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}

export function Lightbox({ photoId, onClose, onPrev, onNext }: Props) {
  const photo = photos.find((p) => p.id === photoId)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onPrev()
      if (e.key === 'ArrowRight') onNext()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, onPrev, onNext])

  if (!photo) return null

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={photo.title}>
      <button type="button" className="lightbox__scrim" aria-label="Close" onClick={onClose} />
      <div className="lightbox__panel">
        <PhotoFrame photo={photo} className="lightbox__frame" priority />
        <div className="lightbox__meta">
          <h2>{photo.title}</h2>
          <p>{photo.location}</p>
        </div>
        <div className="lightbox__controls">
          <button type="button" onClick={onPrev}>
            Previous
          </button>
          <button type="button" onClick={onClose}>
            Close
          </button>
          <button type="button" onClick={onNext}>
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
