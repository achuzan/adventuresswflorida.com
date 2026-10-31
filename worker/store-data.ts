import type { ShippingAddress } from '../src/shared/store'
import type { InternalProduct, PrintFile } from './gelato'
import { fetchUnitWholesaleCents, mapPool } from './gelato'

const SETTINGS_KEY = 'store:settings'
const CATALOG_KEY = 'store:catalog'
const PRICE_KEY = 'store:prices'
const ORDER_INDEX = 'store:order-index'
const PRICE_TTL_MS = 12 * 60 * 60 * 1000
const PRICE_MISS_TTL_MS = 10 * 60 * 1000

export type StoreSettings = {
  markupPercent: number
  shippingMarkupPercent: number
  storeId: string
  templateIds: string[]
  enabled: Record<string, boolean>
}

export type CatalogCache = {
  fetchedAt: string
  notes: string[]
  products: InternalProduct[]
}

export type OrderLine = {
  productId: string
  variantId: string
  itemReferenceId: string
  productUid: string
  title: string
  variantTitle: string
  quantity: number
  wholesaleCents: number
  retailCents: number
  files: PrintFile[]
  pageCount?: number
}

export type OrderLeg = {
  referenceId: string
  itemReferenceIds: string[]
  shipmentMethodUid: string
  name: string
  wholesaleCents: number
  gelatoOrderId?: string
  error?: string
}

export type StoreOrder = {
  id: string
  createdAt: string
  status: 'pending' | 'paid' | 'fulfilled' | 'fulfillment_failed' | 'payment_failed'
  email: string
  currency: 'usd'
  items: OrderLine[]
  legs: OrderLeg[]
  shippingLabel: string
  shippingRetailCents: number
  shippingWholesaleCents: number
  minDeliveryDays: number
  maxDeliveryDays: number
  address: ShippingAddress
  subtotalCents: number
  taxCents: number
  totalCents: number
  stripePaymentIntentId?: string
  stripeTaxCalculationId?: string
  gelatoError?: string
  fulfillClaim?: string
}

type PriceRow = { cents: number | null; at: number }

export function defaultSettings(): StoreSettings {
  return {
    markupPercent: 0,
    shippingMarkupPercent: 0,
    storeId: '',
    templateIds: [],
    enabled: {},
  }
}

export function clampPercent(value: unknown, max: number) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) return null
  return Math.round(parsed * 100) / 100
}

export async function getSettings(kv: KVNamespace): Promise<StoreSettings> {
  const raw = await kv.get(SETTINGS_KEY)
  const base = defaultSettings()
  if (!raw) return base
  try {
    const parsed = JSON.parse(raw) as Partial<StoreSettings>
    const markup = clampPercent(parsed.markupPercent, 400)
    const shipping = clampPercent(parsed.shippingMarkupPercent, 200)
    const templateIds = Array.isArray(parsed.templateIds)
      ? parsed.templateIds.map((id) => String(id).trim()).filter((id) => /^[A-Za-z0-9_-]{8,80}$/.test(id)).slice(0, 50)
      : []
    const enabled: Record<string, boolean> = {}
    if (parsed.enabled && typeof parsed.enabled === 'object') {
      for (const [id, value] of Object.entries(parsed.enabled)) {
        if (/^[A-Za-z0-9_-]{8,80}$/.test(id)) enabled[id] = Boolean(value)
      }
    }
    return {
      markupPercent: markup ?? 0,
      shippingMarkupPercent: shipping ?? 0,
      storeId: typeof parsed.storeId === 'string' ? parsed.storeId.trim() : '',
      templateIds,
      enabled,
    }
  } catch {
    return base
  }
}

export async function saveSettings(kv: KVNamespace, settings: StoreSettings) {
  await kv.put(SETTINGS_KEY, JSON.stringify(settings))
  return settings
}

export async function readCatalog(kv: KVNamespace): Promise<CatalogCache | null> {
  const raw = await kv.get(CATALOG_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as CatalogCache
    if (!parsed || !Array.isArray(parsed.products) || typeof parsed.fetchedAt !== 'string') return null
    return {
      fetchedAt: parsed.fetchedAt,
      notes: Array.isArray(parsed.notes) ? parsed.notes.map(String).slice(0, 30) : [],
      products: parsed.products,
    }
  } catch {
    return null
  }
}

export async function writeCatalog(kv: KVNamespace, catalog: CatalogCache) {
  await kv.put(CATALOG_KEY, JSON.stringify(catalog))
}

async function readPriceBook(kv: KVNamespace): Promise<Record<string, PriceRow>> {
  const raw = await kv.get(PRICE_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, PriceRow>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function priceState(row: PriceRow | undefined, now: number): number | null | undefined {
  if (!row || typeof row.at !== 'number') return undefined
  const ttl = row.cents == null ? PRICE_MISS_TTL_MS : PRICE_TTL_MS
  if (now - row.at > ttl) return undefined
  return row.cents
}

/** Wholesale unit cents for US quantity 1. Missing keys were not fetched. Null means Gelato had no price. */
export async function ensurePrices(kv: KVNamespace, apiKey: string, uids: string[], limit: number) {
  const book = await readPriceBook(kv)
  const now = Date.now()
  const known = new Map<string, number | null>()
  const missing: string[] = []
  for (const uid of [...new Set(uids)]) {
    const state = priceState(book[uid], now)
    if (state === undefined) missing.push(uid)
    else known.set(uid, state)
  }
  const batch = missing.slice(0, limit)
  if (batch.length && apiKey) {
    await mapPool(batch, 4, async (uid) => {
      try {
        book[uid] = { cents: await fetchUnitWholesaleCents(apiKey, uid), at: Date.now() }
      } catch (error) {
        console.error(JSON.stringify({ price: uid, message: error instanceof Error ? error.message : 'failed' }))
        book[uid] = { cents: null, at: Date.now() }
      }
    })
    await kv.put(PRICE_KEY, JSON.stringify(book))
    for (const uid of batch) known.set(uid, book[uid]?.cents ?? null)
  }
  return known
}

function orderKey(id: string) {
  return `store:order:${id}`
}

export async function getOrder(kv: KVNamespace, id: string): Promise<StoreOrder | null> {
  if (!/^ord_[A-Za-z0-9-]{8,80}$/.test(id)) return null
  const raw = await kv.get(orderKey(id))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as StoreOrder
    if (!parsed || parsed.id !== id || !Array.isArray(parsed.items)) return null
    return parsed
  } catch {
    return null
  }
}

export async function saveOrder(kv: KVNamespace, order: StoreOrder) {
  await kv.put(orderKey(order.id), JSON.stringify(order))
  const raw = await kv.get(ORDER_INDEX)
  let index: string[] = []
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    if (Array.isArray(parsed)) index = parsed.map(String)
  } catch {
    index = []
  }
  if (!index.includes(order.id)) {
    index.unshift(order.id)
    await kv.put(ORDER_INDEX, JSON.stringify(index.slice(0, 80)))
  }
}

export async function listOrders(kv: KVNamespace, limit: number) {
  const raw = await kv.get(ORDER_INDEX)
  let index: string[] = []
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    if (Array.isArray(parsed)) index = parsed.map(String)
  } catch {
    index = []
  }
  const ids = index.slice(0, limit)
  const orders = await Promise.all(ids.map((id) => getOrder(kv, id)))
  return orders.flatMap((order) => (order ? [order] : []))
}
