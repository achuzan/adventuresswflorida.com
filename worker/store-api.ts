import { isAuthenticated } from './auth'
import { testOpenAiKey, writeProductDescription } from './openai'
import { testConnections } from './connection-tests'
import {
  createGelatoOrder,
  findGelatoOrder,
  GelatoError,
  pullCatalog,
  quoteOrderResolvingPages,
  type GelatoQuoteGroup,
  type InternalProduct,
  type QuotedMethod,
} from './gelato'
import {
  createPaymentIntent,
  createTaxCalculation,
  createTaxTransaction,
  getPaymentIntent,
  verifyStripeSignature,
} from './stripe-api'
import {
  clampPercent,
  ensurePrices,
  couponPercent,
  getCoupons,
  getCopy,
  getGroups,
  getOrder,
  getSettings,
  listOrders,
  saveCoupons,
  saveCopy,
  saveGroups,
  assignProduct,
  groupSlug,
  readCatalog,
  saveOrder,
  saveSettings,
  writeCatalog,
  type OrderLeg,
  type ProductCopy,
  type StoreCoupon,
  type StoreGroup,
  type StoreGroups,
  type StoreOrder,
  type StoreSettings,
} from './store-data'
import {
  deliveryLabel,
  isCouponCode,
  markupDiscountCents,
  normalizeCouponCode,
  sanitizeHtml,
  toCents,
  validateAddress,
  withMarkup,
  type PublicOrder,
  type ShippingAddress,
  type StoreProductPublic,
} from '../src/shared/store'

const CATALOG_TTL_MS = 15 * 60 * 1000

class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function publishableKey(env: Env) {
  const key = env.STRIPE_PUBLISHABLE_KEY?.trim() ?? ''
  return key.startsWith('pk_') ? key : null
}

function isSellable(product: InternalProduct) {
  if (product.variants.length === 0) return false
  return product.status !== 'publishing' && product.status !== 'publishing_error'
}

function configuredStoreIds(env: Env, settings: StoreSettings) {
  return [
    ...new Set(
      [env.GELATO_STORE_ID ?? '', settings.storeId]
        .map((id) => id.trim())
        .filter((id) => /^[A-Za-z0-9_-]{8,80}$/.test(id)),
    ),
  ]
}

async function loadCatalog(env: Env, refresh: boolean) {
  const cached = await readCatalog(env.PHOTOS_KV)
  const fresh = cached != null && Date.now() - Date.parse(cached.fetchedAt) < CATALOG_TTL_MS
  if (cached && fresh && !refresh) return cached
  if (!env.GELATO_API_KEY) {
    if (cached) return cached
    return { fetchedAt: new Date().toISOString(), notes: [] as string[], products: [] as InternalProduct[] }
  }
  try {
    const settings = await getSettings(env.PHOTOS_KV)
    const pulled = await pullCatalog(
      env.GELATO_API_KEY,
      configuredStoreIds(env, settings),
      settings.templateIds,
    )
    const next = { fetchedAt: new Date().toISOString(), notes: pulled.notes, products: pulled.products }
    await writeCatalog(env.PHOTOS_KV, next)
    return next
  } catch (error) {
    if (cached && !refresh) return cached
    throw error
  }
}

function productImages(product: InternalProduct) {
  const images: string[] = []
  const extra = Array.isArray(product.images) ? product.images : []
  for (const url of [product.previewUrl, ...extra, ...product.variants.map((variant) => variant.previewUrl)]) {
    if (url && !images.includes(url)) images.push(url)
  }
  return images.slice(0, 12)
}

function shownDescription(product: InternalProduct, copy: Record<string, ProductCopy>) {
  return copy[product.id]?.description || product.description
}

function toPublic(
  product: InternalProduct,
  markupPercent: number,
  prices: Map<string, number | null>,
  categoryIds: string[],
  copy: Record<string, ProductCopy>,
): StoreProductPublic {
  return {
    id: product.id,
    title: product.title,
    description: shownDescription(product, copy),
    previewUrl: product.previewUrl,
    productType: product.productType,
    options: product.options,
    images: productImages(product),
    categoryIds,
    variants: product.variants.map((variant) => {
      const wholesale = prices.get(variant.productUid)
      return {
        id: variant.id,
        title: variant.title,
        options: variant.options,
        previewUrl: variant.previewUrl,
        priceCents: wholesale == null ? null : withMarkup(wholesale, markupPercent),
        pricePending: !prices.has(variant.productUid),
      }
    }),
  }
}

async function requireAdmin(request: Request, env: Env) {
  const ok = await isAuthenticated(request, env.SESSION_SECRET || env.ADMIN_PASSWORD)
  if (!ok) throw new HttpError(401, 'Unauthorized')
}

async function readJson(request: Request) {
  try {
    return await request.json()
  } catch {
    throw new HttpError(400, 'Invalid JSON body')
  }
}

type IncomingLine = { productId: string; variantId: string; quantity: number }

function parseLines(body: unknown): IncomingLine[] {
  if (!body || typeof body !== 'object' || !Array.isArray((body as { lines?: unknown }).lines)) {
    throw new HttpError(400, 'Your cart is empty')
  }
  const raw = (body as { lines: unknown[] }).lines
  if (!raw.length) throw new HttpError(400, 'Your cart is empty')
  if (raw.length > 15) throw new HttpError(400, 'Checkout up to 15 products at a time')
  const merged = new Map<string, IncomingLine>()
  for (const row of raw) {
    if (!row || typeof row !== 'object') throw new HttpError(400, 'A cart line is invalid')
    const productId = String((row as { productId?: unknown }).productId ?? '')
    const variantId = String((row as { variantId?: unknown }).variantId ?? '')
    const quantity = Number((row as { quantity?: unknown }).quantity)
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(productId) || !/^[A-Za-z0-9_-]{8,80}$/.test(variantId)) {
      throw new HttpError(400, 'A product in the cart is not valid')
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw new HttpError(400, 'Quantity must be between 1 and 20')
    }
    const key = `${productId}:${variantId}`
    const prev = merged.get(key)
    if (prev) prev.quantity = Math.min(20, prev.quantity + quantity)
    else merged.set(key, { productId, variantId, quantity })
  }
  return [...merged.values()]
}

function customerMethods(methods: QuotedMethod[]) {
  const shippable = methods.filter((method) => method.type !== 'pallet' && method.type !== 'pick_up')
  const residential = shippable.filter((method) => method.isPrivate !== false)
  const pool = residential.length ? residential : shippable
  return [...pool].sort((a, b) => a.price - b.price)
}

function assertUsd(currency: string) {
  if (currency !== 'USD') {
    throw new HttpError(400, `Gelato quoted ${currency}. This store charges US dollars.`)
  }
}

type BuiltOption = {
  id: string
  label: string
  wholesaleCents: number
  retailCents: number
  minDeliveryDays: number
  maxDeliveryDays: number
  legs: {
    itemReferenceIds: string[]
    shipmentMethodUid: string
    name: string
    wholesaleCents: number
  }[]
}

function itemIds(quote: GelatoQuoteGroup) {
  if (quote.itemReferenceIds.length) return quote.itemReferenceIds
  return quote.products.map((product) => product.itemReferenceId)
}

function buildShippingOptions(quotes: GelatoQuoteGroup[], shippingMarkup: number): BuiltOption[] {
  const groups = quotes.map((quote) => ({ quote, methods: customerMethods(quote.shipmentMethods) }))
  if (groups.some((group) => !group.methods.length)) {
    throw new HttpError(400, 'Gelato has no shipping method for that address')
  }
  for (const group of groups) {
    for (const method of group.methods) assertUsd(method.currency)
  }

  const toOption = (
    id: string,
    label: string,
    legs: BuiltOption['legs'],
    minDeliveryDays: number,
    maxDeliveryDays: number,
  ): BuiltOption => {
    const wholesaleCents = legs.reduce((sum, leg) => sum + leg.wholesaleCents, 0)
    return {
      id,
      label,
      wholesaleCents,
      retailCents: withMarkup(wholesaleCents, shippingMarkup),
      minDeliveryDays,
      maxDeliveryDays,
      legs,
    }
  }

  if (groups.length === 1) {
    const group = groups[0]!
    const ids = itemIds(group.quote)
    return group.methods.slice(0, 12).map((method) =>
      toOption(
        method.shipmentMethodUid,
        `${method.name} · ${deliveryLabel(method.minDeliveryDays, method.maxDeliveryDays)}`,
        [
          {
            itemReferenceIds: ids,
            shipmentMethodUid: method.shipmentMethodUid,
            name: method.name,
            wholesaleCents: toCents(method.price),
          },
        ],
        method.minDeliveryDays,
        method.maxDeliveryDays,
      ),
    )
  }

  const tiers = [
    { id: 'type:standard', label: 'Standard shipping', types: ['normal', 'standard'] },
    { id: 'type:express', label: 'Express shipping', types: ['express'] },
  ]
  const options: BuiltOption[] = []
  for (const tier of tiers) {
    const picks = groups.map(
      (group) =>
        group.methods.filter((method) => tier.types.includes(method.type)).sort((a, b) => a.price - b.price)[0],
    )
    if (picks.some((pick) => !pick)) continue
    const legs = picks.map((pick, index) => ({
      itemReferenceIds: itemIds(groups[index]!.quote),
      shipmentMethodUid: pick!.shipmentMethodUid,
      name: pick!.name,
      wholesaleCents: toCents(pick!.price),
    }))
    options.push(
      toOption(
        tier.id,
        `${tier.label} · ${deliveryLabel(
          Math.min(...picks.map((pick) => pick!.minDeliveryDays)),
          Math.max(...picks.map((pick) => pick!.maxDeliveryDays)),
        )}`,
        legs,
        Math.min(...picks.map((pick) => pick!.minDeliveryDays)),
        Math.max(...picks.map((pick) => pick!.maxDeliveryDays)),
      ),
    )
  }
  if (!options.length) throw new HttpError(400, 'Gelato has no shipping method for that address')
  return options
}

async function priceCart(env: Env, lines: IncomingLine[], address: ShippingAddress, coupon: StoreCoupon | null) {
  if (!env.GELATO_API_KEY) throw new HttpError(503, 'The store is not available right now')
  const settings = await getSettings(env.PHOTOS_KV)
  const catalog = await loadCatalog(env, false)
  const resolved = lines.map((line) => {
    const product = catalog.products.find((item) => item.id === line.productId)
    if (!product || settings.enabled[product.id] !== true || !isSellable(product)) {
      throw new HttpError(400, 'One of those products is not for sale')
    }
    const variant = product.variants.find((item) => item.id === line.variantId)
    if (!variant) throw new HttpError(400, 'Choose an available option')
    return {
      productId: product.id,
      variantId: variant.id,
      itemReferenceId: `${product.id}:${variant.id}`,
      productUid: variant.productUid,
      title: product.title,
      variantTitle: variant.title,
      quantity: line.quantity,
      files: variant.files,
      pageCount: undefined as number | undefined,
    }
  })

  const quoted = await quoteOrderResolvingPages(
    env.GELATO_API_KEY,
    resolved.map((line) => ({
      itemReferenceId: line.itemReferenceId,
      productUid: line.productUid,
      quantity: line.quantity,
      files: line.files,
      pageCount: line.pageCount,
    })),
    address,
  )
  const pages = new Map(quoted.lines.map((line) => [line.itemReferenceId, line.pageCount]))
  const wholesale = new Map<string, number>()
  for (const quote of quoted.quotes) {
    for (const product of quote.products) {
      assertUsd(product.currency)
      if (!wholesale.has(product.itemReferenceId)) wholesale.set(product.itemReferenceId, toCents(product.price))
    }
  }

  const pricedLines = resolved.map((line) => {
    const wholesaleCents = wholesale.get(line.itemReferenceId)
    if (wholesaleCents == null) throw new HttpError(502, 'Gelato did not price one of the items')
    const retailCents = withMarkup(wholesaleCents, settings.markupPercent)
    const discountCents = markupDiscountCents(wholesaleCents, retailCents, coupon?.percent ?? 0)
    return {
      ...line,
      pageCount: pages.get(line.itemReferenceId),
      wholesaleCents,
      retailCents,
      discountCents,
      unitPriceCents: Math.max(0, Math.round(retailCents / line.quantity)),
    }
  })

  const shipping = buildShippingOptions(quoted.quotes, settings.shippingMarkupPercent).map((option) => ({
    ...option,
    discountCents: markupDiscountCents(option.wholesaleCents, option.retailCents, coupon?.percent ?? 0),
  }))

  return {
    settings,
    coupon,
    lines: pricedLines,
    shipping,
    subtotalCents: pricedLines.reduce((sum, line) => sum + line.retailCents, 0),
    discountCents: pricedLines.reduce((sum, line) => sum + line.discountCents, 0),
  }
}

async function readCoupon(env: Env, body: unknown): Promise<StoreCoupon | null> {
  const raw = body && typeof body === 'object' ? (body as { coupon?: unknown }).coupon : ''
  const code = normalizeCouponCode(typeof raw === 'string' ? raw : '')
  if (!code) return null
  if (!isCouponCode(code)) throw new HttpError(400, 'That coupon code is not valid')
  const coupon = (await getCoupons(env.PHOTOS_KV)).find((item) => item.code === code)
  if (!coupon?.active) throw new HttpError(400, 'That coupon code is not valid')
  return coupon
}

function couponPublic(coupon: StoreCoupon | null) {
  return coupon ? { code: coupon.code, percent: coupon.percent } : null
}

function publicOrder(order: StoreOrder): PublicOrder {
  const printStatus =
    order.status === 'fulfilled'
      ? 'sent'
      : order.status === 'fulfillment_failed'
        ? 'needs_attention'
        : order.status === 'payment_failed'
          ? 'payment_failed'
          : order.status === 'paid'
            ? 'sending'
            : 'pending'
  return {
    id: order.id,
    status: order.status,
    printStatus,
    email: order.email,
    items: order.items.map((item) => ({
      title: item.title,
      variantTitle: item.variantTitle,
      quantity: item.quantity,
      linePriceCents: item.retailCents,
    })),
    shippingLabel: order.shippingLabel,
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingRetailCents,
    discountCents: order.discountCents ?? 0,
    couponCode: order.couponCode ?? '',
    taxCents: order.taxCents,
    totalCents: order.totalCents,
    minDeliveryDays: order.minDeliveryDays,
    maxDeliveryDays: order.maxDeliveryDays,
    city: order.address.city,
    country: order.address.country,
  }
}

function itemsForLeg(order: StoreOrder, leg: OrderLeg) {
  const matched = order.items.filter((item) => leg.itemReferenceIds.includes(item.itemReferenceId))
  if (matched.length) return matched
  if (order.legs.length === 1) return order.items
  throw new HttpError(502, 'The shipping quote did not include every item')
}

async function fulfill(env: Env, order: StoreOrder) {
  if (order.status === 'fulfilled' || order.status === 'payment_failed') return order
  if (order.legs.length > 0 && order.legs.every((leg) => leg.gelatoOrderId)) {
    order.status = 'fulfilled'
    order.gelatoError = undefined
    order.fulfillClaim = undefined
    await saveOrder(env.PHOTOS_KV, order)
    return order
  }
  if (order.fulfillClaim && order.status === 'paid') {
    const age = Date.now() - Date.parse(order.fulfillClaim)
    if (age >= 0 && age < 45_000) return order
  }
  if (!env.GELATO_API_KEY) {
    order.status = 'fulfillment_failed'
    order.gelatoError = 'GELATO_API_KEY is not set'
    await saveOrder(env.PHOTOS_KV, order)
    return order
  }

  order.status = 'paid'
  order.fulfillClaim = new Date().toISOString()
  order.gelatoError = undefined
  await saveOrder(env.PHOTOS_KV, order)

  if (order.stripeTaxCalculationId && env.STRIPE_SECRET_KEY) {
    try {
      await createTaxTransaction(env.STRIPE_SECRET_KEY, order.stripeTaxCalculationId, order.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (!/already/i.test(message)) console.error(message)
    }
  }

  const errors: string[] = []
  for (const leg of order.legs) {
    if (leg.gelatoOrderId) continue
    try {
      const existing = await findGelatoOrder(env.GELATO_API_KEY, leg.referenceId)
      if (existing) {
        leg.gelatoOrderId = existing
        leg.error = undefined
        continue
      }
      leg.gelatoOrderId = await createGelatoOrder(
        env.GELATO_API_KEY,
        leg.referenceId,
        order.email,
        leg.shipmentMethodUid,
        order.address,
        itemsForLeg(order, leg).map((item) => ({
          itemReferenceId: item.itemReferenceId,
          productUid: item.productUid,
          quantity: item.quantity,
          files: item.files,
          pageCount: item.pageCount,
        })),
      )
      leg.error = undefined
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gelato order failed'
      try {
        const existing = await findGelatoOrder(env.GELATO_API_KEY, leg.referenceId)
        if (existing) {
          leg.gelatoOrderId = existing
          leg.error = undefined
          continue
        }
      } catch (searchError) {
        console.error(searchError instanceof Error ? searchError.message : 'Gelato search failed')
      }
      leg.error = message
      errors.push(message)
    }
  }

  if (order.legs.every((leg) => leg.gelatoOrderId)) {
    order.status = 'fulfilled'
    order.gelatoError = undefined
  } else {
    order.status = 'fulfillment_failed'
    order.gelatoError = errors[0] || 'Gelato did not accept the order'
  }
  order.fulfillClaim = undefined
  await saveOrder(env.PHOTOS_KV, order)
  return order
}

async function syncFromStripe(env: Env, order: StoreOrder, paymentIntentId: string) {
  if (!env.STRIPE_SECRET_KEY) throw new HttpError(503, 'Card payments are not available right now')
  if (order.stripePaymentIntentId && order.stripePaymentIntentId !== paymentIntentId) {
    throw new HttpError(400, 'That payment does not match this order')
  }
  const intent = await getPaymentIntent(env.STRIPE_SECRET_KEY, paymentIntentId)
  if (intent.metadata.orderId !== order.id) throw new HttpError(400, 'That payment does not match this order')
  if (intent.status === 'succeeded') {
    if (intent.amount !== order.totalCents || intent.currency !== 'usd') {
      order.status = 'fulfillment_failed'
      order.gelatoError = 'The Stripe payment amount does not match this order'
      await saveOrder(env.PHOTOS_KV, order)
      return order
    }
    return fulfill(env, order)
  }
  if (intent.status === 'canceled' && order.status === 'pending') {
    order.status = 'payment_failed'
    await saveOrder(env.PHOTOS_KV, order)
  }
  return order
}

function stripeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : 'Stripe request failed'
  if (/tax/i.test(message) && /(not active|inactive|not enabled|not been|has not|set up|configured)/i.test(message)) {
    return 'Turn on Stripe Tax in the Stripe Dashboard, then try checkout again.'
  }
  return message
}

function lowestWholesale(product: InternalProduct, prices: Map<string, number | null>) {
  const values = product.variants.flatMap((variant) => {
    const cents = prices.get(variant.productUid)
    return cents == null ? [] : [cents]
  })
  if (!values.length) return null
  return Math.min(...values)
}

function adminOrder(order: StoreOrder) {
  return {
    id: order.id,
    createdAt: order.createdAt,
    status: order.status,
    email: order.email,
    totalCents: order.totalCents,
    itemSummary: order.items.map((item) => `${item.quantity}× ${item.title}`).join(', '),
    gelatoOrderIds: order.legs.flatMap((leg) => (leg.gelatoOrderId ? [leg.gelatoOrderId] : [])),
    gelatoError: order.gelatoError ?? '',
    stripePaymentIntentId: order.stripePaymentIntentId ?? '',
  }
}

async function adminPayload(env: Env, refresh: boolean) {
  const settings = await getSettings(env.PHOTOS_KV)
  const catalog = await loadCatalog(env, refresh)
  const uids = catalog.products.flatMap((product) => product.variants.map((variant) => variant.productUid))
  const prices = env.GELATO_API_KEY ? await ensurePrices(env.PHOTOS_KV, env.GELATO_API_KEY, uids, 10) : new Map()
  const orders = await listOrders(env.PHOTOS_KV, 15)
  const copy = await getCopy(env.PHOTOS_KV)
  return {
    settings: {
      markupPercent: settings.markupPercent,
      shippingMarkupPercent: settings.shippingMarkupPercent,
      storeId: settings.storeId,
      templateIds: settings.templateIds,
    },
    notes: env.GELATO_API_KEY
      ? catalog.notes
      : ['Set GELATO_API_KEY with wrangler secret put, then refresh.'],
    fetchedAt: catalog.fetchedAt,
    coupons: await getCoupons(env.PHOTOS_KV),
    groups: await getGroups(env.PHOTOS_KV),
    secrets: {
      gelato: Boolean(env.GELATO_API_KEY),
      stripeSecret: Boolean(env.STRIPE_SECRET_KEY),
      stripePublishable: Boolean(publishableKey(env)),
      stripeWebhook: Boolean(env.STRIPE_WEBHOOK_SECRET),
      openai: Boolean(env.OPENAI_API_KEY || settings.openaiKey),
      openaiSource: env.OPENAI_API_KEY ? 'cloudflare' : settings.openaiKey ? 'admin' : 'none',
    },
    products: catalog.products.map((product) => {
      const wholesale = lowestWholesale(product, prices)
      return {
        id: product.id,
        title: product.title,
        previewUrl: product.previewUrl,
        productType: product.productType,
        status: product.status,
        source: product.source,
        enabled: settings.enabled[product.id] === true,
        sellable: isSellable(product),
        variantCount: product.variants.length,
        hasPrintFile: product.variants.some((variant) => variant.files.length > 0),
        imageCount: productImages(product).length,
        description: shownDescription(product, copy),
        descriptionSource: copy[product.id]?.source ?? 'gelato',
        pricePending: product.variants.some((variant) => !prices.has(variant.productUid)),
        wholesaleCents: wholesale,
        retailCents: wholesale == null ? null : withMarkup(wholesale, settings.markupPercent),
      }
    }),
    orders: orders.map(adminOrder),
  }
}

function caught(error: unknown, admin: boolean) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status)
  if (error instanceof GelatoError) {
    console.error(JSON.stringify({ gelato: error.status, message: error.message }))
    if (!admin && (error.status === 401 || error.status === 403)) {
      return json({ error: 'The store is not available right now.' }, 503)
    }
    return json({ error: error.message }, error.status >= 500 ? 502 : 400)
  }
  const message = error instanceof Error ? error.message : 'Something went wrong'
  console.error(message)
  if (/Turn on Stripe Tax/i.test(message) || /Gelato quoted/i.test(message)) {
    return json({ error: message }, 400)
  }
  if (admin) return json({ error: message }, 500)
  return json({ error: 'Something went wrong. Please try again.' }, 500)
}

export async function handleStoreRequest(request: Request, env: Env) {
  const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/'
  try {
    if (path === '/api/stripe/webhook') return await webhook(request, env)
    if (path === '/api/store/config' && request.method === 'GET') {
      return json({ publishableKey: publishableKey(env) })
    }
    if (path === '/api/store/products' && request.method === 'GET') return await publicList(env)
    const productMatch = /^\/api\/store\/products\/([A-Za-z0-9_-]{8,80})$/.exec(path)
    if (productMatch && request.method === 'GET') return await publicOne(env, productMatch[1]!)
    if (path === '/api/store/quote' && request.method === 'POST') return await quote(request, env)
    if (path === '/api/store/checkout' && request.method === 'POST') return await checkout(request, env)
    const confirmMatch = /^\/api\/store\/orders\/(ord_[A-Za-z0-9_-]{8,80})\/confirm$/.exec(path)
    if (confirmMatch && request.method === 'POST') return await confirm(request, env, confirmMatch[1]!)
    if (path === '/api/admin/store' && request.method === 'GET') return await adminGet(request, env, false)
    if (path === '/api/admin/store/refresh' && request.method === 'POST') return await adminGet(request, env, true)
    if (path === '/api/admin/store/settings' && request.method === 'PATCH') return await adminSettings(request, env)
    if (path === '/api/admin/store/test' && request.method === 'POST') return await adminTest(request, env)
    if (path === '/api/admin/store/coupons' && request.method === 'POST') return await adminCreateCoupon(request, env)
    const couponMatch = /^\/api\/admin\/store\/coupons\/([A-Za-z0-9-]{3,24})$/.exec(path)
    if (couponMatch && request.method === 'PATCH') return await adminUpdateCoupon(request, env, couponMatch[1]!)
    if (couponMatch && request.method === 'DELETE') return await adminDeleteCoupon(request, env, couponMatch[1]!)
    if (path === '/api/admin/store/categories' && request.method === 'POST') return await adminCreateGroup(request, env, 'categories')
    if (path === '/api/admin/store/collections' && request.method === 'POST') return await adminCreateGroup(request, env, 'collections')
    const categoryMatch = /^\/api\/admin\/store\/categories\/([a-z0-9-]{2,40})$/.exec(path)
    if (categoryMatch && request.method === 'PATCH') return await adminUpdateGroup(request, env, 'categories', categoryMatch[1]!)
    if (categoryMatch && request.method === 'DELETE') return await adminDeleteGroup(request, env, 'categories', categoryMatch[1]!)
    const collectionMatch = /^\/api\/admin\/store\/collections\/([a-z0-9-]{2,40})$/.exec(path)
    if (collectionMatch && request.method === 'PATCH') return await adminUpdateGroup(request, env, 'collections', collectionMatch[1]!)
    if (collectionMatch && request.method === 'DELETE') return await adminDeleteGroup(request, env, 'collections', collectionMatch[1]!)
    if (path === '/api/admin/store/descriptions' && request.method === 'POST') return await adminDescriptions(request, env)
    const toggle = /^\/api\/admin\/store\/products\/([A-Za-z0-9_-]{8,80})$/.exec(path)
    if (toggle && request.method === 'PATCH') return await adminToggle(request, env, toggle[1]!)
    const sync = /^\/api\/admin\/store\/orders\/(ord_[A-Za-z0-9_-]{8,80})\/sync$/.exec(path)
    if (sync && request.method === 'POST') return await adminSync(request, env, sync[1]!)
    return json({ error: 'Not found' }, 404)
  } catch (error) {
    return caught(error, path.startsWith('/api/admin/'))
  }
}

function categoryIdsFor(groups: StoreGroups, productId: string) {
  return groups.categories.filter((group) => group.productIds.includes(productId)).map((group) => group.id)
}

function publicGroups(groups: StoreGroups) {
  const shape = (group: StoreGroup) => ({
    id: group.id,
    name: group.name,
    description: group.description,
    productIds: group.productIds,
  })
  return {
    categories: groups.categories.map(shape),
    collections: groups.collections.map(shape),
  }
}

async function publicList(env: Env) {
  const settings = await getSettings(env.PHOTOS_KV)
  const groups = await getGroups(env.PHOTOS_KV)
  const copy = await getCopy(env.PHOTOS_KV)
  const catalog = await loadCatalog(env, false)
  const visible = catalog.products.filter((product) => settings.enabled[product.id] === true && isSellable(product))
  const prices = env.GELATO_API_KEY
    ? await ensurePrices(
        env.PHOTOS_KV,
        env.GELATO_API_KEY,
        visible.flatMap((product) => product.variants.map((variant) => variant.productUid)),
        10,
      )
    : new Map<string, number | null>()
  const products = visible.map((product) =>
    toPublic(product, settings.markupPercent, prices, categoryIdsFor(groups, product.id), copy),
  )
  return json({
    products,
    ...publicGroups(groups),
    pricesPending: products.some((product) => product.variants.some((variant) => variant.pricePending)),
  })
}

async function publicOne(env: Env, id: string) {
  const settings = await getSettings(env.PHOTOS_KV)
  const groups = await getGroups(env.PHOTOS_KV)
  const copy = await getCopy(env.PHOTOS_KV)
  const catalog = await loadCatalog(env, false)
  const product = catalog.products.find((item) => item.id === id)
  if (!product || settings.enabled[product.id] !== true || !isSellable(product)) {
    return json({ error: 'That product is not in the store' }, 404)
  }
  const prices = env.GELATO_API_KEY
    ? await ensurePrices(
        env.PHOTOS_KV,
        env.GELATO_API_KEY,
        product.variants.map((variant) => variant.productUid),
        20,
      )
    : new Map<string, number | null>()
  const pub = toPublic(product, settings.markupPercent, prices, categoryIdsFor(groups, product.id), copy)
  return json({
    product: pub,
    categories: groups.categories
      .filter((group) => pub.categoryIds.includes(group.id))
      .map((group) => ({ id: group.id, name: group.name })),
    pricesPending: pub.variants.some((variant) => variant.pricePending),
  })
}

async function quote(request: Request, env: Env) {
  const body = await readJson(request)
  const address = validateAddress((body as { address?: unknown }).address)
  if (!address.ok) throw new HttpError(400, address.error)
  const coupon = await readCoupon(env, body)
  const priced = await priceCart(env, parseLines(body), address.address, coupon)
  return json({
    lines: priced.lines.map((line) => ({
      productId: line.productId,
      variantId: line.variantId,
      title: line.title,
      variantTitle: line.variantTitle,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      linePriceCents: line.retailCents,
    })),
    subtotalCents: priced.subtotalCents,
    discountCents: priced.discountCents,
    coupon: couponPublic(priced.coupon),
    shipping: priced.shipping.map((option) => ({
      id: option.id,
      label: option.label,
      priceCents: option.retailCents,
      discountCents: option.discountCents,
      minDeliveryDays: option.minDeliveryDays,
      maxDeliveryDays: option.maxDeliveryDays,
    })),
  })
}

async function checkout(request: Request, env: Env) {
  const body = (await readJson(request)) as { address?: unknown; shippingOptionId?: unknown }
  const address = validateAddress(body.address)
  if (!address.ok) throw new HttpError(400, address.error)
  const shippingOptionId = typeof body.shippingOptionId === 'string' ? body.shippingOptionId : ''
  const coupon = await readCoupon(env, body)
  const priced = await priceCart(env, parseLines(body), address.address, coupon)
  const option = priced.shipping.find((item) => item.id === shippingOptionId)
  if (!option) throw new HttpError(400, 'Choose a shipping method again')
  const key = publishableKey(env)
  if (!env.STRIPE_SECRET_KEY || !key) throw new HttpError(503, 'Card payments are not available right now')
  const discountCents = priced.discountCents + option.discountCents
  const chargedSubtotal = priced.subtotalCents - priced.discountCents
  const chargedShipping = option.retailCents - option.discountCents

  let tax: { id: string; amountTotal: number; taxCents: number }
  try {
    tax = await createTaxCalculation(env.STRIPE_SECRET_KEY, {
      address: address.address,
      lines: priced.lines.map((line) => ({
        reference: line.itemReferenceId,
        amount: line.retailCents - line.discountCents,
      })),
      shippingCents: chargedShipping,
    })
  } catch (error) {
    throw new HttpError(400, stripeMessage(error))
  }
  if (tax.amountTotal < 50) throw new HttpError(400, 'This order is below the minimum card payment')
  const taxCents = Math.max(0, tax.amountTotal - chargedSubtotal - chargedShipping)

  const orderId = `ord_${crypto.randomUUID()}`
  let intent: { id: string; clientSecret: string }
  try {
    intent = await createPaymentIntent(env.STRIPE_SECRET_KEY, {
      amount: tax.amountTotal,
      orderId,
      email: address.address.email,
      idempotencyKey: orderId,
      address: address.address,
    })
  } catch (error) {
    throw new HttpError(400, stripeMessage(error))
  }

  const order: StoreOrder = {
    id: orderId,
    createdAt: new Date().toISOString(),
    status: 'pending',
    email: address.address.email,
    currency: 'usd',
    items: priced.lines.map((line) => ({
      productId: line.productId,
      variantId: line.variantId,
      itemReferenceId: line.itemReferenceId,
      productUid: line.productUid,
      title: line.title,
      variantTitle: line.variantTitle,
      quantity: line.quantity,
      wholesaleCents: line.wholesaleCents,
      retailCents: line.retailCents,
      files: line.files,
      pageCount: line.pageCount,
    })),
    legs: option.legs.map((leg, index) => ({
      referenceId: option.legs.length === 1 ? orderId : `${orderId}-${index + 1}`,
      itemReferenceIds: leg.itemReferenceIds,
      shipmentMethodUid: leg.shipmentMethodUid,
      name: leg.name,
      wholesaleCents: leg.wholesaleCents,
    })),
    shippingLabel: option.label,
    shippingRetailCents: option.retailCents,
    shippingWholesaleCents: option.wholesaleCents,
    discountCents,
    couponCode: coupon?.code,
    couponPercent: coupon?.percent,
    minDeliveryDays: option.minDeliveryDays,
    maxDeliveryDays: option.maxDeliveryDays,
    address: address.address,
    subtotalCents: priced.subtotalCents,
    taxCents,
    totalCents: tax.amountTotal,
    stripePaymentIntentId: intent.id,
    stripeTaxCalculationId: tax.id,
  }
  await saveOrder(env.PHOTOS_KV, order)
  return json({
    orderId,
    clientSecret: intent.clientSecret,
    publishableKey: key,
    subtotalCents: priced.subtotalCents,
    shippingCents: option.retailCents,
    shippingLabel: option.label,
    discountCents,
    coupon: couponPublic(coupon),
    taxCents,
    totalCents: tax.amountTotal,
    minDeliveryDays: option.minDeliveryDays,
    maxDeliveryDays: option.maxDeliveryDays,
    lines: priced.lines.map((line) => ({
      productId: line.productId,
      variantId: line.variantId,
      title: line.title,
      variantTitle: line.variantTitle,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      linePriceCents: line.retailCents,
    })),
  })
}

async function confirm(request: Request, env: Env, orderId: string) {
  const body = (await readJson(request)) as { paymentIntentId?: unknown }
  const paymentIntentId = typeof body.paymentIntentId === 'string' ? body.paymentIntentId : ''
  if (!/^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) throw new HttpError(400, 'Missing payment')
  const order = await getOrder(env.PHOTOS_KV, orderId)
  if (!order) return json({ error: 'Order not found' }, 404)
  const synced = await syncFromStripe(env, order, paymentIntentId)
  return json({ order: publicOrder(synced) })
}

async function webhook(request: Request, env: Env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!env.STRIPE_WEBHOOK_SECRET) return json({ error: 'Webhook secret is not set' }, 503)
  const payload = await request.text()
  const signature = request.headers.get('stripe-signature') ?? ''
  const valid = await verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET)
  if (!valid) return json({ error: 'Invalid signature' }, 400)
  let event: { type?: string; data?: { object?: { id?: string; metadata?: { orderId?: string } } } }
  try {
    event = JSON.parse(payload) as typeof event
  } catch {
    return json({ error: 'Invalid payload' }, 400)
  }
  const intent = event.data?.object
  const orderId = intent?.metadata?.orderId ?? ''
  const order = orderId ? await getOrder(env.PHOTOS_KV, orderId) : null
  if (!order || !intent?.id) return json({ received: true })
  if (order.stripePaymentIntentId && order.stripePaymentIntentId !== intent.id) return json({ received: true })
  if (event.type === 'payment_intent.succeeded') {
    await syncFromStripe(env, order, intent.id)
  } else if (event.type === 'payment_intent.payment_failed' && order.status === 'pending') {
    order.status = 'payment_failed'
    await saveOrder(env.PHOTOS_KV, order)
  }
  return json({ received: true })
}

async function adminTest(request: Request, env: Env) {
  await requireAdmin(request, env)
  const settings = await getSettings(env.PHOTOS_KV)
  const checks = await testConnections(env, settings, configuredStoreIds(env, settings))
  const openai = env.OPENAI_API_KEY?.trim() || settings.openaiKey
  if (!openai) {
    checks.push({
      id: 'openai',
      name: 'OpenAI',
      status: 'warn',
      detail: 'No OpenAI API key yet. Add one in store settings to write product descriptions.',
    })
  } else {
    const result = await testOpenAiKey(openai)
    checks.push({ id: 'openai', name: 'OpenAI', status: result.ok ? 'ok' : 'fail', detail: result.detail })
  }
  return json({ checks })
}

async function adminGet(request: Request, env: Env, refresh: boolean) {
  await requireAdmin(request, env)
  return json(await adminPayload(env, refresh))
}

async function adminSettings(request: Request, env: Env) {
  await requireAdmin(request, env)
  const body = (await readJson(request)) as Record<string, unknown>
  const settings = await getSettings(env.PHOTOS_KV)
  if ('markupPercent' in body) {
    const next = clampPercent(body.markupPercent, 400)
    if (next == null) throw new HttpError(400, 'Markup must be between 0 and 400')
    settings.markupPercent = next
  }
  if ('shippingMarkupPercent' in body) {
    const next = clampPercent(body.shippingMarkupPercent, 200)
    if (next == null) throw new HttpError(400, 'Shipping markup must be between 0 and 200')
    settings.shippingMarkupPercent = next
  }
  if ('storeId' in body) {
    const storeId = typeof body.storeId === 'string' ? body.storeId.trim() : ''
    if (storeId && !/^[A-Za-z0-9_-]{8,80}$/.test(storeId)) {
      throw new HttpError(400, 'Store id should be the id from the Gelato store URL')
    }
    settings.storeId = storeId
  }
  if ('templateIds' in body) {
    const raw = Array.isArray(body.templateIds)
      ? body.templateIds.map(String).join('\n')
      : typeof body.templateIds === 'string'
        ? body.templateIds
        : ''
    const templateIds = [
      ...new Set(raw.split(/[\s,]+/).map((id) => id.trim()).filter(Boolean)),
    ]
    if (templateIds.some((id) => !/^[A-Za-z0-9_-]{8,80}$/.test(id))) {
      throw new HttpError(400, 'Each template id should be the id Gelato shows on the template')
    }
    if (templateIds.length > 50) throw new HttpError(400, 'Paste up to 50 template ids')
    settings.templateIds = templateIds
  }
  if (body.clearOpenaiKey === true) settings.openaiKey = ''
  else if (typeof body.openaiKey === 'string' && body.openaiKey.trim()) {
    const key = body.openaiKey.trim()
    if (!key.startsWith('sk-') || key.length < 20 || key.length > 200) {
      throw new HttpError(400, 'The OpenAI key should start with sk-')
    }
    settings.openaiKey = key
  }
  await saveSettings(env.PHOTOS_KV, settings)
  return json(await adminPayload(env, false))
}

async function adminCreateCoupon(request: Request, env: Env) {
  await requireAdmin(request, env)
  const body = (await readJson(request)) as { code?: unknown; percent?: unknown }
  const code = normalizeCouponCode(typeof body.code === 'string' ? body.code : '')
  if (!isCouponCode(code)) throw new HttpError(400, 'Use 3–24 letters, numbers, or hyphens')
  const percent = couponPercent(body.percent)
  if (percent == null) throw new HttpError(400, 'Discount must be a whole number from 1 to 100')
  const coupons = await getCoupons(env.PHOTOS_KV)
  if (coupons.some((coupon) => coupon.code === code)) throw new HttpError(400, 'That coupon code already exists')
  if (coupons.length >= 40) throw new HttpError(400, 'Remove a coupon before adding another')
  const next = await saveCoupons(env.PHOTOS_KV, [...coupons, { code, percent, active: true }])
  return json({ coupons: next })
}

async function adminUpdateCoupon(request: Request, env: Env, rawCode: string) {
  await requireAdmin(request, env)
  const code = normalizeCouponCode(decodeURIComponent(rawCode))
  const body = (await readJson(request)) as { active?: unknown }
  const coupons = await getCoupons(env.PHOTOS_KV)
  const coupon = coupons.find((item) => item.code === code)
  if (!coupon) return json({ error: 'Coupon not found' }, 404)
  coupon.active = Boolean(body.active)
  return json({ coupons: await saveCoupons(env.PHOTOS_KV, coupons) })
}

async function adminDeleteCoupon(request: Request, env: Env, rawCode: string) {
  await requireAdmin(request, env)
  const code = normalizeCouponCode(decodeURIComponent(rawCode))
  const coupons = await getCoupons(env.PHOTOS_KV)
  if (!coupons.some((coupon) => coupon.code === code)) return json({ error: 'Coupon not found' }, 404)
  return json({ coupons: await saveCoupons(env.PHOTOS_KV, coupons.filter((coupon) => coupon.code !== code)) })
}

function groupText(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

async function adminCreateGroup(request: Request, env: Env, kind: 'categories' | 'collections') {
  await requireAdmin(request, env)
  const body = (await readJson(request)) as { name?: unknown; description?: unknown }
  const name = groupText(body.name, 60)
  if (name.length < 2) throw new HttpError(400, 'Use a name of at least 2 characters')
  const groups = await getGroups(env.PHOTOS_KV)
  const list = groups[kind]
  if (list.length >= 30) throw new HttpError(400, 'You can keep up to 30 of these')
  const next: StoreGroup = {
    id: groupSlug(name, list.map((group) => group.id)),
    name,
    description: groupText(body.description, 240),
    productIds: [],
  }
  const saved = await saveGroups(env.PHOTOS_KV, { ...groups, [kind]: [...list, next] })
  return json({ groups: saved })
}

async function adminUpdateGroup(request: Request, env: Env, kind: 'categories' | 'collections', id: string) {
  await requireAdmin(request, env)
  const body = (await readJson(request)) as { name?: unknown; description?: unknown }
  const groups = await getGroups(env.PHOTOS_KV)
  const list = groups[kind]
  const group = list.find((item) => item.id === id)
  if (!group) return json({ error: 'Not found' }, 404)
  if ('name' in body) {
    const name = groupText(body.name, 60)
    if (name.length < 2) throw new HttpError(400, 'Use a name of at least 2 characters')
    group.name = name
  }
  if ('description' in body) group.description = groupText(body.description, 240)
  const saved = await saveGroups(env.PHOTOS_KV, groups)
  return json({ groups: saved })
}

async function adminDeleteGroup(request: Request, env: Env, kind: 'categories' | 'collections', id: string) {
  await requireAdmin(request, env)
  const groups = await getGroups(env.PHOTOS_KV)
  if (!groups[kind].some((group) => group.id === id)) return json({ error: 'Not found' }, 404)
  const saved = await saveGroups(env.PHOTOS_KV, {
    ...groups,
    [kind]: groups[kind].filter((group) => group.id !== id),
  })
  return json({ groups: saved })
}

async function adminToggle(request: Request, env: Env, id: string) {
  await requireAdmin(request, env)
  const body = (await readJson(request)) as {
    enabled?: unknown
    categoryIds?: unknown
    collectionIds?: unknown
    description?: unknown
  }
  const settings = await getSettings(env.PHOTOS_KV)
  if ('enabled' in body) {
    settings.enabled[id] = Boolean(body.enabled)
    await saveSettings(env.PHOTOS_KV, settings)
  }
  let groups = await getGroups(env.PHOTOS_KV)
  if (Array.isArray(body.categoryIds) || Array.isArray(body.collectionIds)) {
    if (Array.isArray(body.categoryIds)) {
      groups.categories = assignProduct(groups.categories, id, body.categoryIds.map(String))
    }
    if (Array.isArray(body.collectionIds)) {
      groups.collections = assignProduct(groups.collections, id, body.collectionIds.map(String))
    }
    groups = await saveGroups(env.PHOTOS_KV, groups)
  }
  if ('description' in body) {
    const copy = await getCopy(env.PHOTOS_KV)
    const text = typeof body.description === 'string' ? sanitizeHtml(body.description).trim().slice(0, 4000) : ''
    if (!text) delete copy[id]
    else copy[id] = { description: text, source: 'edited', updatedAt: new Date().toISOString() }
    await saveCopy(env.PHOTOS_KV, copy)
  }
  return json({ ok: true, enabled: settings.enabled[id] === true, groups })
}

function resolvedOpenAiKey(env: Env, settings: StoreSettings) {
  return env.OPENAI_API_KEY?.trim() || settings.openaiKey
}

async function adminDescriptions(request: Request, env: Env) {
  await requireAdmin(request, env)
  const body = (await readJson(request)) as { productId?: unknown }
  const settings = await getSettings(env.PHOTOS_KV)
  const key = resolvedOpenAiKey(env, settings)
  if (!key) throw new HttpError(400, 'Add an OpenAI API key in store settings first')
  const catalog = await loadCatalog(env, false)
  const copy = await getCopy(env.PHOTOS_KV)
  const requested = typeof body.productId === 'string' ? body.productId : ''
  const targets = requested
    ? catalog.products.filter((product) => product.id === requested).slice(0, 1)
    : catalog.products.filter((product) => !copy[product.id]).slice(0, 4)
  if (requested && !targets.length) return json({ error: 'That product is not in the Gelato catalog' }, 404)
  const updated: { id: string; title: string; description: string }[] = []
  for (const product of targets) {
    const description = await writeProductDescription(key, product)
    copy[product.id] = { description, source: 'openai', updatedAt: new Date().toISOString() }
    updated.push({ id: product.id, title: product.title, description })
  }
  if (updated.length) await saveCopy(env.PHOTOS_KV, copy)
  const remaining = catalog.products.filter((product) => !copy[product.id]).length
  return json({ updated, remaining })
}

async function adminSync(request: Request, env: Env, orderId: string) {
  await requireAdmin(request, env)
  const order = await getOrder(env.PHOTOS_KV, orderId)
  if (!order) return json({ error: 'Order not found' }, 404)
  if (!order.stripePaymentIntentId) throw new HttpError(400, 'This order has no Stripe payment yet')
  const synced = await syncFromStripe(env, order, order.stripePaymentIntentId)
  return json({ order: adminOrder(synced) })
}
