import type { PrintFile } from './gelato'

const INDEX_KEY = 'store:print-files'
const R2_MAX_BYTES = 40 * 1024 * 1024
const KV_MAX_BYTES = 20 * 1024 * 1024

export class PrintFileError extends Error {}

export type PrintAsset = {
  variantId: string
  productId: string
  name: string
  contentType: string
  bytes: number
  storage: 'r2' | 'kv' | 'url'
  key: string
  url: string
  updatedAt: string
}

export type PrintIndex = Record<string, PrintAsset>

type PrintEnv = {
  PHOTOS_KV: KVNamespace
  PRINT_FILES?: R2Bucket
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export function printByteLimit(env: PrintEnv) {
  return env.PRINT_FILES ? R2_MAX_BYTES : KV_MAX_BYTES
}

export function describePrintUpload(file: File) {
  const ext = (/\.([a-z0-9]+)$/i.exec(file.name)?.[1] ?? '').toLowerCase()
  if (ext === 'pdf' || file.type === 'application/pdf') return { contentType: 'application/pdf', ext: 'pdf' }
  if (ext === 'png' || file.type === 'image/png') return { contentType: 'image/png', ext: 'png' }
  if (ext === 'webp' || file.type === 'image/webp') return { contentType: 'image/webp', ext: 'webp' }
  if (ext === 'jpg' || ext === 'jpeg' || file.type === 'image/jpeg') return { contentType: 'image/jpeg', ext: 'jpg' }
  return null
}

export function safePrintName(name: string, ext: string) {
  const base = name.split(/[/\\]/).pop()?.replace(/[^\w.\- ()]+/g, '').trim() || `print-file.${ext}`
  const trimmed = base.slice(0, 120)
  return trimmed.toLowerCase().endsWith(`.${ext}`) ? trimmed : `${trimmed}.${ext}`
}

export function parsePrintLink(value: string) {
  const raw = value.trim()
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new PrintFileError('Paste a public https link to the print file')
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new PrintFileError('Gelato needs a public https link, with no password in the address')
  }
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
    throw new PrintFileError('Gelato cannot download a file from this computer. Use a public https link.')
  }
  if (host === 'dropbox.com' || host === 'www.dropbox.com') {
    url.hostname = 'www.dropbox.com'
    url.searchParams.set('dl', '1')
  }
  if (raw.length > 2000) throw new PrintFileError('That link is too long')
  const leaf = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || 'print-file').slice(0, 120)
  return { url: url.toString(), name: leaf || 'print-file' }
}

export function publicPrintUrl(origin: string, asset: PrintAsset) {
  return `${origin}/media/prints/${encodeURIComponent(asset.variantId)}?v=${encodeURIComponent(asset.updatedAt)}`
}

export function orderFiles(origin: string, asset: PrintAsset): PrintFile[] {
  const url = asset.storage === 'url' ? asset.url : publicPrintUrl(origin, asset)
  return [{ type: 'default', url }]
}

function readAsset(variantId: string, value: unknown): PrintAsset | null {
  if (!isRecord(value)) return null
  const storage = value.storage
  if (storage !== 'r2' && storage !== 'kv' && storage !== 'url') return null
  const name = text(value.name, 120)
  const contentType = text(value.contentType, 80)
  const key = text(value.key, 200)
  const url = text(value.url, 2000)
  const productId = text(value.productId, 80)
  const updatedAt = text(value.updatedAt, 40)
  const bytes = typeof value.bytes === 'number' && Number.isFinite(value.bytes) ? value.bytes : 0
  if (!name || !productId || !updatedAt) return null
  if (storage === 'url' && !url.startsWith('https://')) return null
  if (storage !== 'url' && !key) return null
  return {
    variantId,
    productId,
    name,
    contentType: contentType || 'application/octet-stream',
    bytes,
    storage,
    key,
    url,
    updatedAt,
  }
}

export async function getPrintIndex(kv: KVNamespace): Promise<PrintIndex> {
  const raw = await kv.get(INDEX_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) return {}
    const index: PrintIndex = {}
    for (const [id, value] of Object.entries(parsed)) {
      if (!/^[A-Za-z0-9_-]{1,120}$/.test(id)) continue
      const asset = readAsset(id, value)
      if (asset) index[id] = asset
    }
    return index
  } catch {
    return {}
  }
}

async function writeIndex(kv: KVNamespace, index: PrintIndex) {
  await kv.put(INDEX_KEY, JSON.stringify(index))
}

async function removeStored(env: PrintEnv, asset: PrintAsset | undefined) {
  if (!asset || asset.storage === 'url') return
  if (asset.storage === 'r2') {
    if (env.PRINT_FILES) await env.PRINT_FILES.delete(asset.key)
    return
  }
  await env.PHOTOS_KV.delete(asset.key)
}

export async function savePrintUpload(
  env: PrintEnv,
  input: { productId: string; variantId: string; name: string; contentType: string; bytes: ArrayBuffer },
): Promise<PrintAsset> {
  const limit = printByteLimit(env)
  if (input.bytes.byteLength < 1) throw new PrintFileError('That file is empty')
  if (input.bytes.byteLength > limit) {
    const mb = Math.round(limit / (1024 * 1024))
    throw new PrintFileError(`That file is over ${mb} MB. Paste a public https link to it instead.`)
  }
  const index = await getPrintIndex(env.PHOTOS_KV)
  const previous = index[input.variantId]
  const updatedAt = new Date().toISOString()
  let asset: PrintAsset
  if (env.PRINT_FILES) {
    const key = `prints/${input.variantId}`
    await env.PRINT_FILES.put(key, input.bytes, { httpMetadata: { contentType: input.contentType } })
    if (previous?.storage === 'kv') await env.PHOTOS_KV.delete(previous.key)
    asset = {
      variantId: input.variantId,
      productId: input.productId,
      name: input.name,
      contentType: input.contentType,
      bytes: input.bytes.byteLength,
      storage: 'r2',
      key,
      url: '',
      updatedAt,
    }
  } else {
    const key = `media:prints:${input.variantId}`
    await env.PHOTOS_KV.put(key, input.bytes, { metadata: { contentType: input.contentType } })
    asset = {
      variantId: input.variantId,
      productId: input.productId,
      name: input.name,
      contentType: input.contentType,
      bytes: input.bytes.byteLength,
      storage: 'kv',
      key,
      url: '',
      updatedAt,
    }
  }
  index[input.variantId] = asset
  await writeIndex(env.PHOTOS_KV, index)
  return asset
}

export async function savePrintLink(
  env: PrintEnv,
  input: { productId: string; variantId: string; name: string; url: string },
): Promise<PrintAsset> {
  const parsed = parsePrintLink(input.url)
  const index = await getPrintIndex(env.PHOTOS_KV)
  await removeStored(env, index[input.variantId])
  const asset: PrintAsset = {
    variantId: input.variantId,
    productId: input.productId,
    name: input.name || parsed.name,
    contentType: parsed.url.toLowerCase().includes('.pdf') ? 'application/pdf' : 'application/octet-stream',
    bytes: 0,
    storage: 'url',
    key: '',
    url: parsed.url,
    updatedAt: new Date().toISOString(),
  }
  index[input.variantId] = asset
  await writeIndex(env.PHOTOS_KV, index)
  return asset
}

export async function deletePrintAsset(env: PrintEnv, variantId: string) {
  const index = await getPrintIndex(env.PHOTOS_KV)
  await removeStored(env, index[variantId])
  delete index[variantId]
  await writeIndex(env.PHOTOS_KV, index)
}

function printIdFromPath(path: string) {
  const raw = path.slice('/media/prints/'.length).split('/')[0] ?? ''
  if (!raw) return ''
  try {
    const id = decodeURIComponent(raw)
    return /^[A-Za-z0-9_-]{1,120}$/.test(id) ? id : ''
  } catch {
    return ''
  }
}

function disposition(name: string) {
  const clean = name.replace(/["\r\n]/g, '') || 'print-file'
  return `inline; filename="${clean}"`
}

export async function servePrintRequest(request: Request, env: PrintEnv, path: string) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405 })
  }
  const variantId = printIdFromPath(path)
  if (!variantId) return new Response('Not Found', { status: 404 })
  const asset = (await getPrintIndex(env.PHOTOS_KV))[variantId]
  if (!asset || asset.storage === 'url') return new Response('Not Found', { status: 404 })

  const headers = new Headers()
  headers.set('Content-Type', asset.contentType || 'application/octet-stream')
  headers.set('Content-Disposition', disposition(asset.name))
  headers.set('Cache-Control', 'public, max-age=86400')
  headers.set('X-Content-Type-Options', 'nosniff')

  if (asset.storage === 'r2') {
    if (!env.PRINT_FILES) return new Response('Not Found', { status: 404 })
    const object = await env.PRINT_FILES.get(asset.key)
    if (!object) return new Response('Not Found', { status: 404 })
    headers.set('Content-Length', String(object.size))
    if (request.method === 'HEAD') return new Response(null, { headers })
    return new Response(object.body, { headers })
  }

  const stored = await env.PHOTOS_KV.getWithMetadata<{ contentType?: string }>(asset.key, 'arrayBuffer')
  if (stored.value === null) return new Response('Not Found', { status: 404 })
  if (stored.metadata?.contentType) headers.set('Content-Type', stored.metadata.contentType)
  headers.set('Content-Length', String(stored.value.byteLength))
  if (request.method === 'HEAD') return new Response(null, { headers })
  return new Response(stored.value, { headers })
}
