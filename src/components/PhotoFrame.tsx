import { useEffect, useState } from 'react'
import type { Photo } from '../data/photos'

type Props = {
  photo: Photo
  className?: string
  sizes?: string
  priority?: boolean
}

export function PhotoFrame({ photo, className = '', sizes, priority }: Props) {
  const src = `/photos/${photo.file}`
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading')

  useEffect(() => {
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (!cancelled) setStatus('ready')
    }
    img.onerror = () => {
      if (!cancelled) setStatus('missing')
    }
    img.src = src
    return () => {
      cancelled = true
    }
  }, [src])

  return (
    <div className={`photo-frame ${className}`.trim()} style={{ backgroundImage: photo.wash }}>
      {status === 'ready' ? (
        <img
          src={src}
          alt={photo.alt}
          sizes={sizes}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
        />
      ) : (
        <div className="photo-frame__placeholder" aria-hidden={status === 'loading'}>
          <span className="photo-frame__mark">Photo coming soon</span>
          <span className="photo-frame__title">{photo.title}</span>
        </div>
      )}
    </div>
  )
}
