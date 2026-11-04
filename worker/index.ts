import {
  clearSessionCookieHeader,
  createSessionToken,
  isAuthenticated,
  sessionCookieHeader,
  verifyPassword,
} from './auth'
import {
  deletePhoto,
  getCatalog,
  updatePhoto,
  upsertPhoto,
} from './catalog'
import { randomWash, slugify, type Photo } from '../src/shared/photo'
import { CALENDAR_SUBJECT_MAX, parseCalendarSlot } from '../src/shared/calendar'
import { validateCalendarNav } from '../src/shared/site-settings'
import { getCalendarSlot, listCalendars, saveCalendarSlot } from './calendars'
import { getSiteSettings, saveSiteSettings } from './settings'
import { servePrintRequest } from './print-files'
import { handleStoreRequest } from './store-api'

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024
const MAX_AUDIO_BYTES = 20 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('Cache-Control', 'no-store')
  return new Response(JSON.stringify(data), { ...init, headers })
}

function badRequest(message: string) {
  return json({ error: message }, { status: 400 })
}

function unauthorized(message = 'Unauthorized') {
  return json({ error: message }, { status: 401 })
}

async function requireAdmin(request: Request, env: Env) {
  const ok = await isAuthenticated(request, env.SESSION_SECRET || env.ADMIN_PASSWORD)
  if (!ok) return null
  return true
}

function extensionFor(type: string) {
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  return 'jpg'
}

function fileExtension(name: string) {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim())
  return match?.[1]?.toLowerCase() ?? ''
}

function describeImage(file: File) {
  const ext = fileExtension(file.name)
  if (ext === 'jpg' || ext === 'jpeg' || file.type === 'image/jpeg') {
    return { ext: 'jpg', contentType: 'image/jpeg' }
  }
  if (ext === 'png' || file.type === 'image/png') return { ext: 'png', contentType: 'image/png' }
  if (ext === 'webp' || file.type === 'image/webp') return { ext: 'webp', contentType: 'image/webp' }
  return null
}

function describeAudio(file: File) {
  const ext = fileExtension(file.name)
  if (ext === 'mp3' || file.type === 'audio/mpeg' || file.type === 'audio/mp3') {
    return { ext: 'mp3', contentType: 'audio/mpeg' }
  }
  if (ext === 'wav' || file.type === 'audio/wav' || file.type === 'audio/x-wav') {
    return { ext: 'wav', contentType: 'audio/wav' }
  }
  if (ext === 'm4a' || file.type === 'audio/mp4' || file.type === 'audio/x-m4a') {
    return { ext: 'm4a', contentType: 'audio/mp4' }
  }
  if (ext === 'aac' || file.type === 'audio/aac') return { ext: 'aac', contentType: 'audio/aac' }
  if (ext === 'ogg' || file.type === 'audio/ogg') return { ext: 'ogg', contentType: 'audio/ogg' }
  return null
}

async function deleteUploadedMedia(env: Env, src: string) {
  if (!src.startsWith('/media/')) return
  const key = src.slice('/media/'.length)
  if (!key || key.includes('..')) return
  await env.PHOTOS_KV.delete(mediaKvKey(key))
}

function uniqueId(base: string, existing: Set<string>) {
  let id = base || `photo-${crypto.randomUUID().slice(0, 8)}`
  if (!existing.has(id)) return id
  let n = 2
  while (existing.has(`${id}-${n}`)) n++
  return `${id}-${n}`
}

function mediaKvKey(objectKey: string) {
  return `media:${objectKey}`
}

async function handleApi(request: Request, env: Env, path: string) {
  if (
    path.startsWith('/api/store') ||
    path.startsWith('/api/admin/store') ||
    path === '/api/stripe/webhook'
  ) {
    return handleStoreRequest(request, env)
  }

  if (path === '/api/photos' && request.method === 'GET') {
    const photos = await getCatalog(env.PHOTOS_KV)
    return json({ photos })
  }

  if (path === '/api/settings' && request.method === 'GET') {
    const settings = await getSiteSettings(env.PHOTOS_KV)
    return json({ settings })
  }

  if (path === '/api/admin/settings' && request.method === 'PATCH') {
    if (!(await requireAdmin(request, env))) return unauthorized()

    let body: { calendarNav?: unknown }
    try {
      body = (await request.json()) as { calendarNav?: unknown }
    } catch {
      return badRequest('Invalid JSON body')
    }

    const validated = validateCalendarNav(body.calendarNav)
    if (!validated.ok) return badRequest(validated.error)

    const current = await getSiteSettings(env.PHOTOS_KV)
    const settings = await saveSiteSettings(env.PHOTOS_KV, {
      ...current,
      calendarNav: validated.value,
    })
    return json({ settings })
  }

  if (path === '/api/admin/login' && request.method === 'POST') {
    let body: { password?: string }
    try {
      body = (await request.json()) as { password?: string }
    } catch {
      return badRequest('Invalid JSON body')
    }
    const password = body.password ?? ''
    const ok = await verifyPassword(password, env.ADMIN_PASSWORD ?? '')
    if (!ok) return unauthorized('Incorrect password')
    const secret = env.SESSION_SECRET || env.ADMIN_PASSWORD
    const token = await createSessionToken(secret)
    const secure = new URL(request.url).protocol === 'https:'
    return json(
      { ok: true },
      { headers: { 'Set-Cookie': sessionCookieHeader(token, secure) } },
    )
  }

  if (path === '/api/admin/logout' && request.method === 'POST') {
    const secure = new URL(request.url).protocol === 'https:'
    return json(
      { ok: true },
      { headers: { 'Set-Cookie': clearSessionCookieHeader(secure) } },
    )
  }

  if (path === '/api/admin/session' && request.method === 'GET') {
    const ok = await requireAdmin(request, env)
    return json({ authenticated: Boolean(ok) })
  }

  if (path === '/api/admin/photos' && request.method === 'POST') {
    if (!(await requireAdmin(request, env))) return unauthorized()

    const form = await request.formData()
    const title = String(form.get('title') ?? '').trim()
    const location = String(form.get('location') ?? '').trim()
    const alt = String(form.get('alt') ?? '').trim()
    const story = String(form.get('story') ?? '').trim()
    const shopUrl = String(form.get('shopUrl') ?? '').trim()
    const file = form.get('image')

    if (!title) return badRequest('Title is required')
    if (!location) return badRequest('Location is required')
    if (!alt) return badRequest('Alt text is required')
    if (!story) return badRequest('Story is required')
    if (!shopUrl) return badRequest('Shop link is required')
    if (!(file instanceof File) || file.size === 0) {
      return badRequest('Photo file is required')
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return badRequest('Photo must be 12 MB or smaller')
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return badRequest('Use a JPG, PNG, or WebP image')
    }
    try {
      new URL(shopUrl)
    } catch {
      return badRequest('Shop link must be a valid URL')
    }

    const catalog = await getCatalog(env.PHOTOS_KV)
    const ids = new Set(catalog.map((p) => p.id))
    const id = uniqueId(slugify(title), ids)
    const ext = extensionFor(file.type)
    const objectKey = `uploads/${id}-${crypto.randomUUID().slice(0, 8)}.${ext}`

    await env.PHOTOS_KV.put(mediaKvKey(objectKey), await file.arrayBuffer(), {
      metadata: { contentType: file.type },
    })

    const photo: Photo = {
      id,
      file: `${id}.${ext}`,
      title,
      location,
      alt,
      story,
      shopUrl,
      wash: randomWash(),
      imageUrl: `/media/${objectKey}`,
    }

    await upsertPhoto(env.PHOTOS_KV, photo)
    return json({ photo }, { status: 201 })
  }

  const photoMatch = path.match(/^\/api\/admin\/photos\/([^/]+)$/)
  if (photoMatch) {
    if (!(await requireAdmin(request, env))) return unauthorized()
    const id = decodeURIComponent(photoMatch[1]!)

    if (request.method === 'PATCH') {
      let body: Partial<Photo>
      try {
        body = (await request.json()) as Partial<Photo>
      } catch {
        return badRequest('Invalid JSON body')
      }

      const patch: Partial<Omit<Photo, 'id'>> = {}
      for (const key of ['title', 'location', 'alt', 'story', 'shopUrl', 'wash'] as const) {
        if (typeof body[key] === 'string') {
          patch[key] = body[key]!.trim()
        }
      }
      if (patch.shopUrl === '') {
        patch.shopUrl = undefined
      }
      if (patch.shopUrl) {
        try {
          new URL(patch.shopUrl)
        } catch {
          return badRequest('Shop link must be a valid URL')
        }
      }

      const updated = await updatePhoto(env.PHOTOS_KV, id, patch)
      if (!updated) return json({ error: 'Photo not found' }, { status: 404 })
      return json({ photo: updated })
    }

    if (request.method === 'DELETE') {
      const removed = await deletePhoto(env.PHOTOS_KV, id)
      if (!removed) return json({ error: 'Photo not found' }, { status: 404 })
      if (removed.imageUrl?.startsWith('/media/')) {
        const key = removed.imageUrl.slice('/media/'.length)
        await env.PHOTOS_KV.delete(mediaKvKey(key))
      }
      return json({ ok: true })
    }
  }

  if (path === '/api/calendars' && request.method === 'GET') {
    const calendars = await listCalendars(env.PHOTOS_KV)
    return json({ calendars })
  }

  const calendarMatch = path.match(/^\/api\/calendars\/(\d{4})\/([a-z]+)$/)
  if (calendarMatch && request.method === 'GET') {
    const year = Number(calendarMatch[1])
    const slot = parseCalendarSlot(calendarMatch[2] ?? null)
    if (!slot) return json({ error: 'Calendar page not found' }, { status: 404 })
    const entry = await getCalendarSlot(env.PHOTOS_KV, year, slot)
    if (!entry) return json({ error: 'Calendar page not found' }, { status: 404 })
    return json({ entry })
  }

  const adminCalendarMatch = path.match(/^\/api\/admin\/calendars\/(\d{4})\/([a-z]+)$/)
  if (adminCalendarMatch && request.method === 'PATCH') {
    if (!(await requireAdmin(request, env))) return unauthorized()
    const year = Number(adminCalendarMatch[1])
    const slot = parseCalendarSlot(adminCalendarMatch[2] ?? null)
    if (!slot) return json({ error: 'Calendar page not found' }, { status: 404 })

    const current = await getCalendarSlot(env.PHOTOS_KV, year, slot)
    if (!current) return json({ error: 'Calendar page not found' }, { status: 404 })

    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return badRequest('Invalid form body')
    }

    const subject = String(form.get('subject') ?? '').trim()
    if (!subject) return badRequest('Subject is required')
    if (subject.length > CALENDAR_SUBJECT_MAX) {
      return badRequest(`Subject must be ${CALENDAR_SUBJECT_MAX} characters or fewer`)
    }

    const photo = form.get('photo')
    const audio = form.get('audio')
    let photoUpload: { file: File; ext: string; contentType: string } | null = null
    let audioUpload: { file: File; ext: string; contentType: string } | null = null

    if (photo instanceof File && photo.size > 0) {
      if (photo.size > MAX_UPLOAD_BYTES) return badRequest('Photo must be 12 MB or smaller')
      const described = describeImage(photo)
      if (!described) return badRequest('Use a JPG, PNG, or WebP image')
      photoUpload = { file: photo, ...described }
    }

    if (audio instanceof File && audio.size > 0) {
      if (audio.size > MAX_AUDIO_BYTES) return badRequest('Audio must be 20 MB or smaller')
      const described = describeAudio(audio)
      if (!described) return badRequest('Use an MP3, M4A, WAV, AAC, or OGG audio file')
      audioUpload = { file: audio, ...described }
    }

    let photoSrc = current.photoSrc
    let audioSrc = current.audioSrc
    let uploadedPhotoKey: string | null = null
    let uploadedAudioKey: string | null = null

    if (photoUpload) {
      uploadedPhotoKey = `calendars/${year}/${slot}-${crypto.randomUUID().slice(0, 8)}.${photoUpload.ext}`
      await env.PHOTOS_KV.put(mediaKvKey(uploadedPhotoKey), await photoUpload.file.arrayBuffer(), {
        metadata: { contentType: photoUpload.contentType },
      })
      photoSrc = `/media/${uploadedPhotoKey}`
    }

    if (audioUpload) {
      uploadedAudioKey = `calendars/${year}/${slot}-${crypto.randomUUID().slice(0, 8)}.${audioUpload.ext}`
      await env.PHOTOS_KV.put(mediaKvKey(uploadedAudioKey), await audioUpload.file.arrayBuffer(), {
        metadata: { contentType: audioUpload.contentType },
      })
      audioSrc = `/media/${uploadedAudioKey}`
    }

    const entry = await saveCalendarSlot(env.PHOTOS_KV, year, slot, { subject, photoSrc, audioSrc })
    if (!entry) {
      if (uploadedPhotoKey) await env.PHOTOS_KV.delete(mediaKvKey(uploadedPhotoKey))
      if (uploadedAudioKey) await env.PHOTOS_KV.delete(mediaKvKey(uploadedAudioKey))
      return badRequest('Could not save this calendar page')
    }

    if (uploadedPhotoKey) await deleteUploadedMedia(env, current.photoSrc)
    if (uploadedAudioKey) await deleteUploadedMedia(env, current.audioSrc)
    return json({ entry })
  }

  return json({ error: 'Not found' }, { status: 404 })
}

async function handleMedia(request: Request, env: Env, path: string) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405 })
  }
  const key = path.slice('/media/'.length)
  if (!key || key.includes('..')) {
    return new Response('Not Found', { status: 404 })
  }
  const object = await env.PHOTOS_KV.getWithMetadata<{ contentType?: string }>(
    mediaKvKey(key),
    'arrayBuffer',
  )
  if (object.value === null) return new Response('Not Found', { status: 404 })

  const headers = new Headers()
  headers.set(
    'Content-Type',
    object.metadata?.contentType || 'application/octet-stream',
  )
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  if (request.method === 'HEAD') {
    return new Response(null, { headers })
  }
  return new Response(object.value, { headers })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    if (path.startsWith('/api/')) {
      return handleApi(request, env, path)
    }

    if (path.startsWith('/media/prints/')) {
      return servePrintRequest(request, env, path)
    }

    if (path.startsWith('/media/')) {
      return handleMedia(request, env, path)
    }

    return env.ASSETS.fetch(request)
  },
}
