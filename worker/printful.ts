import { mapPool } from './gelato'
import type { InternalProduct } from './gelato'
import type { ShippingAddress } from '../src/shared/store'
import { toCents } from '../src/shared/store'

export class PrintfulError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const printfulId = /^\d{1,15}$/

const BASE = 'https://api.printful.com'

type CallEnv = { token: string; storeId: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function httpsUrl(value: unknown) {
  const raw = text(value)
  if (!raw) return ''
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' ? url.toString() : ''
  } catch {
    return ''
  }
}

async function call<T>(env: CallEnv, path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${env.token}`)
  if (env.storeId) headers.set('X-PF-Store-Id', env.storeId)
  if (init?.body) headers.set('Content-Type', 'application/json')
  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  const data = (await res.json().catch(() => null)) as {
    result?: T
    error?: { message?: string }
  } | null
  if (!res.ok || !data) {
    const message = data?.error?.message || `Printful request failed (${res.status})`
    throw new PrintfulError(res.status, message)
  }
  return data.result as T
}

export async function listPrintfulStores(token: string) {
  const rows = await call<unknown>({ token, storeId: '' }, '/stores')
  if (!Array.isArray(rows)) return []
  return rows.flatMap((row) => {
    if (!isRecord(row)) return []
    const id = String(row.id ?? '')
    if (!printfulId.test(id)) return []
    return [{ id, name: text(row.name) || `Store ${id}`, type: text(row.type) }]
  })
}

export async function resolvePrintfulStore(token: string, preferred: string) {
  const stores = await listPrintfulStores(token)
  const wanted = preferred.trim()
  if (wanted) {
    if (!printfulId.test(wanted)) throw new PrintfulError(400, 'Printful store id should be the number from the store')
    const match = stores.find((store) => store.id === wanted)
    if (!match) throw new PrintfulError(400, 'That Printful store id is not on this account')
    return match.id
  }
  if (stores.length === 1) return stores[0]!.id
  if (!stores.length) {
    throw new PrintfulError(400, 'This Printful account has no store. Create a Manual order / API store first.')
  }
  throw new PrintfulError(400, 'This account has more than one Printful store. Paste the Manual / API store id in settings.')
}

function synced(value: unknown) {
  return value === true || value === 1
}

function sizeOf(name: string) {
  const parts = name.split('/').map((part) => part.trim()).filter(Boolean)
  return parts.length > 1 ? parts[parts.length - 1]! : ''
}

function normalizeProduct(row: unknown): InternalProduct | null {
  if (!isRecord(row)) return null
  const sync = isRecord(row.sync_product) ? row.sync_product : null
  const variantsRaw = Array.isArray(row.sync_variants) ? row.sync_variants : []
  if (!sync) return null
  const id = String(sync.id ?? '')
  const title = text(sync.name) || 'Untitled product'
  if (!printfulId.test(id)) return null
  const variants = variantsRaw.flatMap((item) => {
    if (!isRecord(item) || item.is_ignored === true) return []
    const variantId = String(item.id ?? '')
    const catalogId = String(item.variant_id ?? '')
    if (!printfulId.test(variantId) || !printfulId.test(catalogId)) return []
    const name = text(item.name) || title
    const size = sizeOf(name)
    const product = isRecord(item.product) ? item.product : {}
    const files = Array.isArray(item.files) ? item.files : []
    const images = files.flatMap((file) => {
      if (!isRecord(file)) return []
      const url = httpsUrl(file.preview_url) || httpsUrl(file.thumbnail_url)
      return url ? [url] : []
    })
    const preview = httpsUrl(product.image) || images[0] || ''
    return [
      {
        id: variantId,
        title: size || name,
        productUid: catalogId,
        options: size ? [{ name: 'Size', value: size }] : [],
        previewUrl: preview,
        images,
        files: [],
        ready: synced(item.synced),
      },
    ]
  })
  if (!variants.length) return null
  const ready = variants.every((variant) => variant.ready)
  const previewUrl = httpsUrl(sync.thumbnail_url) || variants.find((variant) => variant.previewUrl)?.previewUrl || ''
  const images = [previewUrl, ...variants.flatMap((variant) => variant.images)].filter(
    (url, index, all) => url && all.indexOf(url) === index,
  )
  const sizes = variants.flatMap((variant) => variant.options.map((option) => option.value))
  const uniqueSizes = [...new Set(sizes)]
  return {
    id,
    source: 'store',
    title,
    description: '',
    previewUrl,
    productType: '',
    status: ready ? 'active' : 'unsynced',
    options: uniqueSizes.length ? [{ name: 'Size', values: uniqueSizes }] : [],
    images: images.slice(0, 12),
    variants: variants.map(({ ready: _ready, ...variant }) => variant),
  }
}

export async function pullPrintfulCatalog(token: string, preferredStoreId: string) {
  const notes: string[] = []
  const storeId = await resolvePrintfulStore(token, preferredStoreId)
  notes.push(`Using Printful store ${storeId}.`)
  const summaries: { id: string }[] = []
  for (let offset = 0; offset < 500; offset += 100) {
    const page = await call<unknown>({ token, storeId }, `/store/products?limit=100&offset=${offset}`)
    const rows = Array.isArray(page) ? page : []
    for (const row of rows) {
      if (!isRecord(row) || row.is_ignored === true) continue
      const id = String(row.id ?? '')
      if (printfulId.test(id)) summaries.push({ id })
    }
    if (rows.length < 100) break
  }
  const products: InternalProduct[] = []
  await mapPool(summaries, 4, async (summary) => {
    try {
      const detail = await call<unknown>({ token, storeId }, `/store/products/${summary.id}`)
      const product = normalizeProduct(detail)
      if (product) products.push(product)
      else notes.push(`Printful product ${summary.id} has no variants.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'request failed'
      notes.push(`Printful product ${summary.id} could not be loaded. ${message}`)
    }
  })
  products.sort((a, b) => a.title.localeCompare(b.title))
  notes.push(`Printful listed ${products.length} product${products.length === 1 ? '' : 's'}.`)
  return { products, notes, storeId }
}

export async function fetchPrintfulVariantCents(token: string, variantId: string) {
  const data = await call<unknown>({ token, storeId: '' }, `/products/variant/${encodeURIComponent(variantId)}`)
  if (!isRecord(data)) return null
  const variant = isRecord(data.variant) ? data.variant : data
  const product = isRecord(data.product) ? data.product : {}
  const price = Number(variant.price)
  const currency = (text(variant.currency) || text(product.currency) || 'USD').toUpperCase()
  if (!Number.isFinite(price) || price < 0 || currency !== 'USD') return null
  return toCents(price)
}

export type PrintfulRate = {
  id: string
  name: string
  rate: string
  currency: string
  minDeliveryDays: number
  maxDeliveryDays: number
}

export async function printfulShippingRates(
  token: string,
  storeId: string,
  address: ShippingAddress,
  items: { variantId: string; quantity: number }[],
) {
  const rows = await call<unknown[]>({ token, storeId }, '/shipping/rates', {
    method: 'POST',
    body: JSON.stringify({
      recipient: {
        address1: address.line1,
        city: address.city,
        country_code: address.country,
        state_code: address.state,
        zip: address.postalCode,
      },
      items: items.map((item) => ({ variant_id: Number(item.variantId), quantity: item.quantity })),
      currency: 'USD',
    }),
  })
  if (!Array.isArray(rows)) return []
  return rows.flatMap((row) => {
    if (!isRecord(row)) return []
    const id = text(row.id)
    const rate = Number(row.rate)
    if (!id || !Number.isFinite(rate)) return []
    return [
      {
        id,
        name: text(row.name) || id,
        rate: String(rate),
        currency: (text(row.currency) || 'USD').toUpperCase(),
        minDeliveryDays: Number(row.minDeliveryDays) || 0,
        maxDeliveryDays: Number(row.maxDeliveryDays) || Number(row.minDeliveryDays) || 0,
      },
    ]
  })
}

export async function findPrintfulOrder(token: string, storeId: string, externalId: string) {
  try {
    const data = await call<unknown>(
      { token, storeId },
      `/orders/@${encodeURIComponent(externalId)}`,
    )
    if (!isRecord(data)) return null
    const id = String(data.id ?? '')
    return printfulId.test(id) ? id : null
  } catch (error) {
    if (error instanceof PrintfulError && error.status === 404) return null
    throw error
  }
}

export async function createPrintfulDraft(
  token: string,
  storeId: string,
  externalId: string,
  shipping: string,
  address: ShippingAddress,
  items: { syncVariantId: string; quantity: number }[],
) {
  const data = await call<unknown>({ token, storeId }, '/orders', {
    method: 'POST',
    body: JSON.stringify({
      external_id: externalId,
      confirm: false,
      shipping,
      recipient: {
        name: `${address.firstName} ${address.lastName}`.trim(),
        address1: address.line1,
        ...(address.line2 ? { address2: address.line2 } : {}),
        city: address.city,
        state_code: address.state,
        country_code: address.country,
        zip: address.postalCode,
        email: address.email,
        phone: address.phone,
      },
      items: items.map((item) => ({
        sync_variant_id: Number(item.syncVariantId),
        quantity: item.quantity,
      })),
    }),
  })
  if (!isRecord(data)) throw new PrintfulError(502, 'Printful accepted the order but did not return an id')
  const id = String(data.id ?? '')
  if (!printfulId.test(id)) throw new PrintfulError(502, 'Printful accepted the order but did not return an id')
  return id
}

export async function confirmPrintfulOrder(token: string, storeId: string, orderId: string) {
  await call({ token, storeId }, `/orders/${encodeURIComponent(orderId)}/confirm`, { method: 'POST' })
}

export async function cancelPrintfulOrder(token: string, storeId: string, orderId: string) {
  await call({ token, storeId }, `/orders/${encodeURIComponent(orderId)}`, { method: 'DELETE' })
}
