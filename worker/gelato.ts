import { sanitizeHtml, toCents, type ShippingAddress } from '../src/shared/store'

export class GelatoError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export type PrintFile = { type: string; url: string }

export type InternalVariant = {
  id: string
  title: string
  productUid: string
  options: { name: string; value: string }[]
  previewUrl: string
  images: string[]
  files: PrintFile[]
}

export type InternalProduct = {
  id: string
  source: 'store' | 'template'
  title: string
  description: string
  previewUrl: string
  productType: string
  status: string
  options: { name: string; values: string[] }[]
  images: string[]
  variants: InternalVariant[]
}

export type QuotedProduct = {
  itemReferenceId: string
  price: number
  currency: string
}

export type QuotedMethod = {
  name: string
  shipmentMethodUid: string
  price: number
  currency: string
  minDeliveryDays: number
  maxDeliveryDays: number
  type: string
  isPrivate?: boolean
}

export type GelatoQuoteGroup = {
  id: string
  itemReferenceIds: string[]
  shipmentMethods: QuotedMethod[]
  products: QuotedProduct[]
}

export type QuoteLineInput = {
  itemReferenceId: string
  productUid: string
  quantity: number
  files: PrintFile[]
  pageCount?: number
}

type Recipient = {
  firstName: string
  lastName: string
  addressLine1: string
  addressLine2?: string
  city: string
  state?: string
  postCode: string
  country: string
  email: string
  phone: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function str(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function num(value: unknown) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(parsed) ? parsed : null
}

function gelatoFieldErrors(data: unknown) {
  if (!isRecord(data)) return []
  const rows = Array.isArray(data.errors) ? data.errors : Array.isArray(data.details) ? data.details : []
  return rows.flatMap((row) => {
    if (typeof row === 'string' && row.trim()) return [row.trim()]
    if (!isRecord(row)) return []
    const message = str(row.message)
    const reference = str(row.reference) || str(row.path) || str(row.field)
    const text = [reference, message].filter(Boolean).join(': ')
    return text ? [text] : []
  })
}

function gelatoMessage(data: unknown) {
  if (!isRecord(data)) return ''
  const summary =
    (typeof data.message === 'string' && data.message.trim()) ||
    (typeof data.error === 'string' && data.error.trim()) ||
    (isRecord(data.error) && typeof data.error.message === 'string' && data.error.message.trim()) ||
    ''
  const fields = gelatoFieldErrors(data)
  if (fields.length && (!summary || /submitted data/i.test(summary))) return fields.join('; ')
  if (summary && fields.length && !fields.some((field) => summary.includes(field))) return `${summary} (${fields.join('; ')})`
  return summary
}

export function asArray(data: unknown, keys: string[]) {
  if (Array.isArray(data)) return data
  if (!isRecord(data)) return []
  for (const key of keys) {
    if (Array.isArray(data[key])) return data[key]
  }
  return []
}

async function gelato<T>(apiKey: string, url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('X-API-KEY', apiKey)
  if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const res = await fetch(url, { ...init, headers })
  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text) as unknown
    } catch {
      data = null
    }
  }
  if (!res.ok) {
    throw new GelatoError(res.status, gelatoMessage(data) || `Gelato request failed (${res.status})`)
  }
  if (text && data === null) {
    throw new GelatoError(res.status, 'Gelato returned a response that was not JSON')
  }
  return data as T
}

export { gelato as gelatoRequest }

function httpsUrl(value: unknown) {
  const url = str(value)
  return url.startsWith('https://') ? url : ''
}

function pushUrl(into: string[], value: unknown) {
  const url = httpsUrl(value)
  if (url && !into.includes(url)) into.push(url)
}

function collectImageUrls(record: Record<string, unknown>) {
  const images: string[] = []
  for (const key of ['previewUrl', 'externalPreviewUrl', 'externalThumbnailUrl', 'imageUrl', 'thumbnailUrl']) {
    pushUrl(images, record[key])
  }
  for (const key of ['images', 'previews', 'previewImages']) {
    const list = record[key]
    if (!Array.isArray(list)) continue
    for (const item of list) {
      if (typeof item === 'string') pushUrl(images, item)
      else if (isRecord(item)) {
        pushUrl(images, item.previewUrl)
        pushUrl(images, item.thumbnailUrl)
        pushUrl(images, item.imageUrl)
        pushUrl(images, item.url)
      }
    }
  }
  return images
}

function fileType(printArea: string, name: string) {
  const raw = (printArea || name || 'default').toLowerCase()
  const known = new Set([
    'default',
    'front',
    'back',
    'inside',
    'neck-inner',
    'neck-outer',
    'sleeve-left',
    'sleeve-right',
  ])
  if (known.has(raw)) return raw
  if (raw.includes('back')) return 'back'
  if (raw.includes('front')) return 'front'
  return 'default'
}

function collectFiles(record: Record<string, unknown>) {
  const files: PrintFile[] = []
  const push = (type: string, url: string) => {
    if (!url) return
    if (files.some((file) => file.type === type && file.url === url)) return
    files.push({ type, url })
  }
  for (const key of ['files', 'printFiles'] as const) {
    const list = record[key]
    if (!Array.isArray(list)) continue
    for (const item of list) {
      if (!isRecord(item)) continue
      push(fileType(str(item.type), str(item.type)), httpsUrl(item.url) || httpsUrl(item.fileUrl))
    }
  }
  for (const key of ['imagePlaceholders', 'placeholders'] as const) {
    const list = record[key]
    if (!Array.isArray(list)) continue
    for (const item of list) {
      if (!isRecord(item)) continue
      const url = httpsUrl(item.fileUrl) || httpsUrl(item.printFileUrl) || httpsUrl(item.url)
      push(fileType(str(item.printArea), str(item.name)), url)
    }
  }
  return files
}

function readGroups(record: Record<string, unknown>) {
  const raw = record.productVariantOptions ?? record.variantOptions ?? record.options ?? record.attributes
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (!isRecord(item)) return []
    const name = str(item.name)
    const values = Array.isArray(item.values) ? item.values.map(str).filter(Boolean) : []
    if (!name || !values.length) return []
    return [{ name, values }]
  })
}

function optionsFromTitle(title: string, groups: { name: string; values: string[] }[]) {
  if (!groups.length) return []
  const parts = title.split(/\s+[/|-]\s+/).map((part) => part.trim()).filter(Boolean)
  if (parts.length === groups.length) {
    return groups.map((group, index) => ({ name: group.name, value: parts[index]! }))
  }
  return groups.flatMap((group) => {
    const value = group.values.find((item) => title.toLowerCase().includes(item.toLowerCase()))
    return value ? [{ name: group.name, value }] : []
  })
}

function readVariantOptions(
  record: Record<string, unknown>,
  groups: { name: string; values: string[] }[],
  title: string,
) {
  if (Array.isArray(record.variantOptions)) {
    const options = record.variantOptions.flatMap((item) => {
      if (!isRecord(item)) return []
      const name = str(item.name)
      const value = str(item.value)
      if (!name || !value) return []
      return [{ name, value }]
    })
    if (options.length) return options
  }
  return optionsFromTitle(title, groups)
}

function uniqueImages(extra: string[], variants: InternalVariant[]) {
  const images: string[] = []
  for (const url of [...extra, ...variants.flatMap((variant) => [variant.previewUrl, ...variant.images])]) {
    if (url && !images.includes(url)) images.push(url)
  }
  return images.slice(0, 12)
}

function groupsFromVariants(variants: InternalVariant[]) {
  const map = new Map<string, string[]>()
  for (const variant of variants) {
    for (const option of variant.options) {
      const values = map.get(option.name) ?? []
      if (!values.includes(option.value)) values.push(option.value)
      map.set(option.name, values)
    }
  }
  return [...map.entries()].map(([name, values]) => ({ name, values }))
}

function normalizeVariants(
  rows: unknown,
  groups: { name: string; values: string[] }[],
  fallbackPreview: string,
) {
  if (!Array.isArray(rows)) return []
  const variants: InternalVariant[] = []
  for (const row of rows) {
    if (!isRecord(row)) continue
    if (str(row.connectionStatus) === 'ignored') continue
    const productUid = str(row.productUid)
    const id = str(row.id)
    if (!productUid || !id) continue
    const title = str(row.title) || productUid
    variants.push({
      id,
      title,
      productUid,
      options: readVariantOptions(row, groups, title),
      previewUrl:
        httpsUrl(row.previewUrl) ||
        httpsUrl(row.imageUrl) ||
        httpsUrl(row.externalPreviewUrl) ||
        fallbackPreview,
      images: collectImageUrls(row),
      files: collectFiles(row),
    })
  }
  return variants
}

export function normalizeStoreProduct(row: unknown): InternalProduct | null {
  if (!isRecord(row)) return null
  const id = str(row.id)
  const title = str(row.title) || 'Untitled product'
  if (!id) return null
  const previewUrl =
    httpsUrl(row.previewUrl) || httpsUrl(row.externalPreviewUrl) || httpsUrl(row.externalThumbnailUrl)
  const groups = readGroups(row)
  const variants = normalizeVariants(row.variants, groups, previewUrl)
  if (!variants.length) return null
  return {
    id,
    source: 'store',
    title,
    description: sanitizeHtml(str(row.description)),
    previewUrl,
    productType: str(row.productType),
    status: str(row.status) || 'active',
    options: groups.length ? groups : groupsFromVariants(variants),
    images: uniqueImages(collectImageUrls(row), variants),
    variants,
  }
}

export function normalizeTemplate(row: unknown): InternalProduct | null {
  if (!isRecord(row)) return null
  const id = str(row.id)
  const title = str(row.title) || str(row.templateName) || 'Untitled product'
  if (!id) return null
  const previewUrl = httpsUrl(row.previewUrl)
  const variants = normalizeVariants(row.variants, [], previewUrl)
  if (!variants.length) return null
  return {
    id,
    source: 'template',
    title,
    description: sanitizeHtml(str(row.description)),
    previewUrl,
    productType: str(row.productType),
    status: 'active',
    options: groupsFromVariants(variants),
    images: uniqueImages(collectImageUrls(row), variants),
    variants,
  }
}

async function listStoreProducts(apiKey: string, storeId: string) {
  const all: unknown[] = []
  for (let offset = 0; offset < 500; offset += 100) {
    const url =
      `https://ecommerce.gelatoapis.com/v1/stores/${encodeURIComponent(storeId)}/products` +
      `?order=desc&orderBy=createdAt&offset=${offset}&limit=100`
    let data: unknown
    try {
      data = await gelato<unknown>(apiKey, url)
    } catch (error) {
      if (error instanceof GelatoError && error.status === 405) {
        data = await gelato<unknown>(
          apiKey,
          `https://ecommerce.gelatoapis.com/v1/stores/${encodeURIComponent(storeId)}/products`,
          {
            method: 'POST',
            body: JSON.stringify({ order: 'desc', orderBy: 'createdAt', offset, limit: 100 }),
          },
        )
      } else {
        throw error
      }
    }
    const page = asArray(data, ['products', 'data'])
    all.push(...page)
    if (page.length < 100) break
  }
  return all
}

async function discoverStoreIds(apiKey: string, notes: string[]) {
  const urls = [
    'https://ecommerce.gelatoapis.com/v1/stores?limit=100&offset=0',
    'https://ecommerce.gelatoapis.com/v1/stores',
  ]
  for (const url of urls) {
    try {
      const data = await gelato<unknown>(apiKey, url)
      const ids = asArray(data, ['stores', 'data']).flatMap((row) => {
        if (!isRecord(row)) return []
        const id = str(row.id) || str(row.storeId)
        return id ? [id] : []
      })
      if (ids.length) {
        notes.push(`Found ${ids.length} Gelato store${ids.length === 1 ? '' : 's'}.`)
        return ids
      }
      notes.push('Gelato returned a store list, and it was empty.')
      return []
    } catch (error) {
      if (error instanceof GelatoError && error.status === 404) continue
      throw error
    }
  }
  return []
}

async function listTemplates(apiKey: string) {
  const templates: InternalProduct[] = []
  try {
    for (let offset = 0; offset < 500; offset += 100) {
      const data = await gelato<unknown>(
        apiKey,
        `https://ecommerce.gelatoapis.com/v1/templates?limit=100&offset=${offset}`,
      )
      const rows = asArray(data, ['templates', 'data', 'items'])
      for (const row of rows) {
        const product = normalizeTemplate(row)
        if (product) templates.push(product)
      }
      if (rows.length < 100) break
    }
    return { templates, missingEndpoint: false }
  } catch (error) {
    if (error instanceof GelatoError && (error.status === 404 || error.status === 405)) {
      return { templates, missingEndpoint: true }
    }
    throw error
  }
}

function dedupe(products: InternalProduct[]) {
  const seen = new Set<string>()
  return products.filter((product) => {
    if (seen.has(product.id)) return false
    seen.add(product.id)
    return true
  })
}

export async function pullCatalog(apiKey: string, storeIds: string[], templateIds: string[]) {
  const notes: string[] = []
  const ids = storeIds.length ? storeIds : await discoverStoreIds(apiKey, notes)
  const products: InternalProduct[] = []

  for (const storeId of ids) {
    const rows = await listStoreProducts(apiKey, storeId)
    let count = 0
    for (const row of rows) {
      const product = normalizeStoreProduct(row)
      if (!product) continue
      products.push(product)
      count += 1
    }
    notes.push(`Store ${storeId.slice(0, 8)}… listed ${count} product${count === 1 ? '' : 's'}.`)
  }

  const listed = await listTemplates(apiKey)
  products.push(...listed.templates)
  if (listed.templates.length) {
    notes.push(`Gelato returned ${listed.templates.length} template${listed.templates.length === 1 ? '' : 's'}.`)
  }

  for (const templateId of templateIds) {
    if (products.some((product) => product.id === templateId)) continue
    try {
      const data = await gelato<unknown>(
        apiKey,
        `https://ecommerce.gelatoapis.com/v1/templates/${encodeURIComponent(templateId)}`,
      )
      const product = normalizeTemplate(data)
      if (product) products.push(product)
      else notes.push(`Template ${templateId} did not include any variants.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'request failed'
      notes.push(`Template ${templateId} could not be loaded. ${message}`)
    }
  }

  if (listed.missingEndpoint && (templateIds.length > 0 || products.length === 0)) {
    notes.push(
      'Gelato did not offer a template list. If you saved designs as templates, paste each template id below.',
    )
  }
  if (!ids.length && products.length === 0) {
    notes.push(
      'No store id was found. Create the products in Gelato, then paste the store id from the store page URL, or paste template ids.',
    )
  }

  return { products: dedupe(products), notes }
}

export async function fetchUnitWholesaleCents(apiKey: string, productUid: string) {
  const data = await gelato<unknown>(
    apiKey,
    `https://product.gelatoapis.com/v3/products/${encodeURIComponent(productUid)}/prices?country=US&currency=USD`,
  )
  const rows = (Array.isArray(data) ? data : asArray(data, ['prices', 'data'])).flatMap((row) => {
    if (!isRecord(row)) return []
    const quantity = num(row.quantity)
    const price = num(row.price)
    if (quantity == null || price == null || quantity < 1) return []
    return [{ quantity, price, currency: (str(row.currency) || 'USD').toUpperCase() }]
  })
  const usd = rows.filter((row) => row.currency === 'USD')
  const pool = usd.length ? usd : rows
  const one = pool.find((row) => row.quantity === 1)
  if (one) return toCents(one.price)
  const smallest = [...pool].sort((a, b) => a.quantity - b.quantity)[0]
  if (!smallest) return null
  return toCents(smallest.price / smallest.quantity)
}

function findPageCount(value: unknown, depth: number): number | undefined {
  if (depth > 6 || !value || typeof value !== 'object') return undefined
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findPageCount(item, depth + 1)
      if (found) return found
    }
    return undefined
  }
  const record = value as Record<string, unknown>
  for (const [key, child] of Object.entries(record)) {
    if (/pagecount/i.test(key.replace(/[\s_-]/g, ''))) {
      const parsed = num(child)
      if (parsed != null && Number.isInteger(parsed) && parsed > 0 && parsed < 500) return parsed
    }
  }
  for (const child of Object.values(record)) {
    const found = findPageCount(child, depth + 1)
    if (found) return found
  }
  return undefined
}

export async function lookupPageCount(apiKey: string, productUid: string) {
  try {
    const data = await gelato<unknown>(
      apiKey,
      `https://product.gelatoapis.com/v3/products/${encodeURIComponent(productUid)}`,
    )
    return findPageCount(data, 0)
  } catch {
    return undefined
  }
}

function parseQuote(data: unknown): GelatoQuoteGroup[] {
  if (!isRecord(data)) return []
  return asArray(data.quotes, []).flatMap((row) => {
    if (!isRecord(row)) return []
    const products = asArray(row.products, []).flatMap((item) => {
      if (!isRecord(item)) return []
      const price = num(item.price)
      const itemReferenceId = str(item.itemReferenceId)
      if (!itemReferenceId || price == null) return []
      return [{ itemReferenceId, price, currency: (str(item.currency) || 'USD').toUpperCase() }]
    })
    const shipmentMethods = asArray(row.shipmentMethods, []).flatMap((item) => {
      if (!isRecord(item)) return []
      const price = num(item.price)
      const shipmentMethodUid = str(item.shipmentMethodUid)
      if (!shipmentMethodUid || price == null) return []
      return [
        {
          name: str(item.name) || shipmentMethodUid,
          shipmentMethodUid,
          price,
          currency: (str(item.currency) || 'USD').toUpperCase(),
          minDeliveryDays: num(item.minDeliveryDays) ?? 0,
          maxDeliveryDays: num(item.maxDeliveryDays) ?? num(item.minDeliveryDays) ?? 0,
          type: str(item.type) || 'normal',
          isPrivate: typeof item.isPrivate === 'boolean' ? item.isPrivate : undefined,
        },
      ]
    })
    return [
      {
        id: str(row.id),
        itemReferenceIds: asArray(row.itemReferenceIds, []).map(str).filter(Boolean),
        shipmentMethods,
        products,
      },
    ]
  })
}

function recipientOf(address: ShippingAddress): Recipient {
  return {
    firstName: address.firstName,
    lastName: address.lastName,
    addressLine1: address.line1,
    ...(address.line2 ? { addressLine2: address.line2 } : {}),
    city: address.city,
    ...(address.state ? { state: address.state } : {}),
    postCode: address.postalCode,
    country: address.country,
    email: address.email,
    phone: address.phone,
  }
}

export async function quoteOrder(apiKey: string, lines: QuoteLineInput[], address: ShippingAddress) {
  const recipient = recipientOf(address)
  const data = await gelato<unknown>(apiKey, 'https://order.gelatoapis.com/v4/orders:quote', {
    method: 'POST',
    body: JSON.stringify({
      orderReferenceId: `quote-${crypto.randomUUID()}`,
      customerReferenceId: recipient.email.slice(0, 60),
      currency: 'USD',
      allowMultipleQuotes: false,
      recipient,
      products: lines.map((line) => ({
        itemReferenceId: line.itemReferenceId,
        productUid: line.productUid,
        quantity: line.quantity,
        ...(line.pageCount ? { pageCount: line.pageCount } : {}),
        ...(line.files.length ? { files: line.files } : {}),
      })),
    }),
  })
  const quotes = parseQuote(data)
  if (!quotes.length) throw new GelatoError(502, 'Gelato did not return a price for that order')
  return quotes
}

export async function quoteOrderResolvingPages(
  apiKey: string,
  lines: QuoteLineInput[],
  address: ShippingAddress,
) {
  try {
    return { quotes: await quoteOrder(apiKey, lines, address), lines }
  } catch (error) {
    if (!(error instanceof GelatoError) || !/page/i.test(error.message)) throw error
    const next: QuoteLineInput[] = []
    let changed = false
    for (const line of lines) {
      if (line.pageCount) {
        next.push(line)
        continue
      }
      const pageCount = await lookupPageCount(apiKey, line.productUid)
      if (pageCount) changed = true
      next.push({ ...line, pageCount })
    }
    if (!changed) throw error
    return { quotes: await quoteOrder(apiKey, next, address), lines: next }
  }
}

export async function findGelatoOrder(apiKey: string, referenceId: string) {
  const data = await gelato<unknown>(apiKey, 'https://order.gelatoapis.com/v4/orders:search', {
    method: 'POST',
    body: JSON.stringify({ orderReferenceIds: [referenceId], limit: 5 }),
  })
  const orders = asArray(data, ['orders'])
  for (const row of orders) {
    if (!isRecord(row)) continue
    const id = str(row.id)
    if (!id) continue
    if (!str(row.orderReferenceId) || str(row.orderReferenceId) === referenceId) return id
  }
  return null
}

export async function createGelatoOrder(
  apiKey: string,
  referenceId: string,
  email: string,
  shipmentMethodUid: string,
  address: ShippingAddress,
  items: {
    itemReferenceId: string
    productUid: string
    quantity: number
    files: PrintFile[]
    pageCount?: number
  }[],
) {
  for (const item of items) {
    if (!item.files.length || item.files.some((file) => !file.url.startsWith('https://'))) {
      throw new GelatoError(400, 'Each item needs a public print file before it can be ordered')
    }
  }
  const data = await gelato<unknown>(apiKey, 'https://order.gelatoapis.com/v4/orders', {
    method: 'POST',
    body: JSON.stringify({
      orderType: 'order',
      orderReferenceId: referenceId,
      customerReferenceId: email.slice(0, 60),
      currency: 'USD',
      shipmentMethodUid,
      items: items.map((item) => ({
        itemReferenceId: item.itemReferenceId,
        productUid: item.productUid,
        quantity: item.quantity,
        files: item.files,
        ...(item.pageCount ? { pageCount: item.pageCount } : {}),
      })),
      shippingAddress: recipientOf(address),
      metadata: [{ key: 'orderId', value: referenceId.slice(0, 100) }],
    }),
  })
  if (!isRecord(data) || !str(data.id)) {
    throw new GelatoError(502, 'Gelato accepted the order but did not return an id')
  }
  return str(data.id)
}

export async function cancelGelatoOrder(apiKey: string, orderId: string) {
  await gelato(apiKey, `https://order.gelatoapis.com/v4/orders/${encodeURIComponent(orderId)}:cancel`, {
    method: 'POST',
    body: '{}',
  })
}

export async function mapPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  if (!items.length) return
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next
      next += 1
      await fn(items[index]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
}
