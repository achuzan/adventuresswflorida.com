import { isCouponCode, type ShippingAddress } from '../src/shared/store'
import type { InternalProduct, PrintFile } from './gelato'
import { fetchUnitWholesaleCents, mapPool } from './gelato'

const SETTINGS_KEY = 'store:settings'
const COUPONS_KEY = 'store:coupons'
const GROUPS_KEY = 'store:groups'
const COPY_KEY = 'store:copy'
const CATALOG_KEY = 'store:catalog'
const PRICE_KEY = 'store:prices'
const ORDER_INDEX = 'store:order-index'
const PRICE_TTL_MS = 12 * 60 * 60 * 1000
const PRICE_MISS_TTL_MS = 10 * 60 * 1000

export type StoreCoupon = {
  code: string
  percent: number
  active: boolean
}

export type StoreGroup = {
  id: string
  name: string
  description: string
  productIds: string[]
}

export type StoreGroups = {
  categories: StoreGroup[]
  collections: StoreGroup[]
}

export type StoreSettings = {
  markupPercent: number
  shippingMarkupPercent: number
  storeId: string
  templateIds: string[]
  enabled: Record<string, boolean>
  openaiKey: string
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
  discountCents?: number
  couponCode?: string
  couponPercent?: number
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
    openaiKey: '',
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
      openaiKey: typeof parsed.openaiKey === 'string' ? parsed.openaiKey.trim().slice(0, 200) : '',
    }
  } catch {
    return base
  }
}

export async function saveSettings(kv: KVNamespace, settings: StoreSettings) {
  await kv.put(SETTINGS_KEY, JSON.stringify(settings))
  return settings
}

export function couponPercent(value: unknown) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) return null
  return parsed
}

export async function getCoupons(kv: KVNamespace): Promise<StoreCoupon[]> {
  const raw = await kv.get(COUPONS_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const coupons: StoreCoupon[] = []
    for (const row of parsed) {
      if (!row || typeof row !== 'object') continue
      const item = row as Partial<StoreCoupon>
      const code = typeof item.code === 'string' ? item.code : ''
      const percent = couponPercent(item.percent)
      if (!isCouponCode(code) || percent == null) continue
      coupons.push({ code, percent, active: item.active !== false })
    }
    return coupons.slice(0, 40)
  } catch {
    return []
  }
}

export async function saveCoupons(kv: KVNamespace, coupons: StoreCoupon[]) {
  await kv.put(COUPONS_KEY, JSON.stringify(coupons.slice(0, 40)))
  return coupons.slice(0, 40)
}

function emptyGroups(): StoreGroups {
  return { categories: [], collections: [] }
}

function parseGroup(row: unknown): StoreGroup | null {
  if (!row || typeof row !== 'object') return null
  const item = row as Partial<StoreGroup>
  const id = typeof item.id === 'string' ? item.id : ''
  const name = typeof item.name === 'string' ? item.name.trim() : ''
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || id.length > 40 || name.length < 2) return null
  const productIds = Array.isArray(item.productIds)
    ? [...new Set(item.productIds.map(String).filter((productId) => /^[A-Za-z0-9_-]{8,80}$/.test(productId)))].slice(0, 80)
    : []
  return {
    id,
    name: name.slice(0, 60),
    description: typeof item.description === 'string' ? item.description.trim().slice(0, 240) : '',
    productIds,
  }
}

export function groupSlug(name: string, existing: string[]) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'group'
  let id = base.length >= 2 ? base : `${base}-shop`
  let n = 2
  while (existing.includes(id)) {
    id = `${base.slice(0, 34)}-${n}`
    n += 1
  }
  return id
}

export async function getGroups(kv: KVNamespace): Promise<StoreGroups> {
  const raw = await kv.get(GROUPS_KEY)
  if (!raw) return emptyGroups()
  try {
    const parsed = JSON.parse(raw) as Partial<StoreGroups>
    const categories = Array.isArray(parsed.categories) ? parsed.categories.flatMap((row) => {
      const group = parseGroup(row)
      return group ? [group] : []
    }).slice(0, 30) : []
    const collections = Array.isArray(parsed.collections) ? parsed.collections.flatMap((row) => {
      const group = parseGroup(row)
      return group ? [group] : []
    }).slice(0, 30) : []
    return { categories, collections }
  } catch {
    return emptyGroups()
  }
}

export type ProductCopy = {
  description: string
  source: 'openai' | 'edited'
  updatedAt: string
}

export async function getCopy(kv: KVNamespace): Promise<Record<string, ProductCopy>> {
  const raw = await kv.get(COPY_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<ProductCopy>>
    if (!parsed || typeof parsed !== 'object') return {}
    const copy: Record<string, ProductCopy> = {}
    for (const [id, row] of Object.entries(parsed)) {
      if (!/^[A-Za-z0-9_-]{8,80}$/.test(id) || !row || typeof row.description !== 'string') continue
      const description = row.description.trim().slice(0, 4000)
      if (!description) continue
      copy[id] = {
        description,
        source: row.source === 'edited' ? 'edited' : 'openai',
        updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : '',
      }
    }
    return copy
  } catch {
    return {}
  }
}

export async function saveCopy(kv: KVNamespace, copy: Record<string, ProductCopy>) {
  await kv.put(COPY_KEY, JSON.stringify(copy))
  return copy
}

export async function saveGroups(kv: KVNamespace, groups: StoreGroups) {
  const next = {
    categories: groups.categories.slice(0, 30),
    collections: groups.collections.slice(0, 30),
  }
  await kv.put(GROUPS_KEY, JSON.stringify(next))
  return next
}

export function assignProduct(groups: StoreGroup[], productId: string, selectedIds: string[]) {
  const allowed = new Set(selectedIds.filter((id) => groups.some((group) => group.id === id)))
  return groups.map((group) => ({
    ...group,
    productIds: allowed.has(group.id)
      ? group.productIds.includes(productId)
        ? group.productIds
        : [...group.productIds, productId].slice(0, 80)
      : group.productIds.filter((id) => id !== productId),
  }))
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
