import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { storeJson } from '../data/store-client'
import { formatUsd } from '../shared/store'

const CATEGORY_PHOTOS = [
  '/photos/alligator.jpg',
  '/photos/alligator2.jpg',
  '/photos/claw.jpg',
  '/photos/destinbeachsunset.jpg',
  '/photos/flamingo.jpg',
  '/photos/flamingo2.jpg',
  '/photos/florida-scrub-jay.jpg',
  '/photos/greategret.jpg',
  '/photos/malewoodduck.jpg',
  '/photos/parrot.jpg',
  '/photos/pigfrog.jpg',
  '/photos/snailkite.jpg',
  '/calendars/2027/photos/front.jpg',
]

type AdminVariant = {
  id: string
  title: string
  printFile: { name: string; source: 'upload' | 'link'; href: string } | null
}

type AdminProduct = {
  id: string
  title: string
  previewUrl: string
  productType: string
  status: string
  source: 'store' | 'template'
  enabled: boolean
  sellable: boolean
  variantCount: number
  variants: AdminVariant[]
  hasPrintFile: boolean
  imageCount: number
  description: string
  descriptionSource: 'openai' | 'edited' | 'printful'
  pricePending: boolean
  wholesaleCents: number | null
  retailCents: number | null
  markupPercent: number | null
}

type AdminOrder = {
  id: string
  createdAt: string
  status: string
  email: string
  phone: string
  shipTo: {
    name: string
    line1: string
    line2: string
    city: string
    state: string
    postalCode: string
    country: string
  }
  items: { title: string; variantTitle: string; quantity: number; linePriceCents: number }[]
  shippingLabel: string
  shippingCents: number
  subtotalCents: number
  discountCents: number
  couponCode: string
  taxCents: number
  totalCents: number
  itemSummary: string
  gelatoOrderIds: string[]
  gelatoError: string
  stripePaymentIntentId: string
}

type ConnectionCheck = {
  id: string
  name: string
  status: 'ok' | 'warn' | 'fail'
  detail: string
}

function orderIsOpen(status: string) {
  return status === 'pending' || status === 'paid' || status === 'fulfillment_failed'
}

function orderLabel(status: string) {
  if (status === 'pending') return 'Awaiting payment'
  if (status === 'paid') return 'Processing'
  if (status === 'fulfillment_failed') return 'Needs attention'
  if (status === 'fulfilled') return 'Fulfilled'
  if (status === 'canceled') return 'Canceled'
  if (status === 'payment_failed') return 'Payment failed'
  return status.replaceAll('_', ' ')
}

function productBadge(product: AdminProduct) {
  if (product.status === 'unsynced') return { label: 'Needs design', tone: 'warn' }
  if (product.enabled && product.sellable) return { label: 'Active', tone: 'live' }
  if (product.enabled) return { label: 'Not for sale', tone: 'warn' }
  return { label: 'Draft', tone: 'draft' }
}

type StoreCoupon = {
  code: string
  percent: number
  active: boolean
}

type StoreGroup = {
  id: string
  name: string
  description: string
  productIds: string[]
  image: string
  imageProductId: string
}

type AdminStore = {
  settings: {
    markupPercent: number
    shippingMarkupPercent: number
    storeId: string
    templateIds: string[]
    aiBaseUrl: string
    aiModel: string
  }
  notes: string[]
  fetchedAt: string
  coupons: StoreCoupon[]
  groups: { categories: StoreGroup[]; collections: StoreGroup[] }
  secrets: {
    printful: boolean
    stripeSecret: boolean
    stripePublishable: boolean
    stripeWebhook: boolean
    openai: boolean
    openaiSource: 'cloudflare' | 'admin' | 'none'
    aiBaseUrl: string
    aiModel: string
  }
  products: AdminProduct[]
  orders: AdminOrder[]
}

export function AdminStorePanel() {
  const [data, setData] = useState<AdminStore | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [shippingMarkup, setShippingMarkup] = useState('0')
  const [storeId, setStoreId] = useState('')
  const [checks, setChecks] = useState<ConnectionCheck[] | null>(null)
  const [testing, setTesting] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [couponPercent, setCouponPercent] = useState('10')
  const [categoryName, setCategoryName] = useState('')
  const [collectionName, setCollectionName] = useState('')
  const [section, setSection] = useState<'products' | 'catalog' | 'coupons' | 'orders' | 'settings'>('products')
  const [orderView, setOrderView] = useState<'open' | 'closed'>('open')
  const [aiBaseUrl, setAiBaseUrl] = useState('')
  const [aiModel, setAiModel] = useState('')
  const [aiApiKey, setAiApiKey] = useState('')
  const [clearOpenai, setClearOpenai] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  async function load(refresh = false, fillForm = false, mergePrices = false) {
    const payload = refresh
      ? await storeJson<AdminStore>('/api/admin/store/refresh', { method: 'POST', credentials: 'same-origin' })
      : await storeJson<AdminStore>('/api/admin/store', { credentials: 'same-origin' })
    setData((current) => {
      if (!mergePrices || !current) return payload
      const byId = new Map(payload.products.map((product) => [product.id, product]))
      return {
        ...current,
        notes: payload.notes,
        fetchedAt: payload.fetchedAt,
        secrets: payload.secrets,
        products: current.products.map((product) => {
          const next = byId.get(product.id)
          if (!next) return product
          return {
            ...product,
            wholesaleCents: next.wholesaleCents,
            retailCents: next.retailCents,
            pricePending: next.pricePending,
            hasPrintFile: next.hasPrintFile,
            variants: next.variants ?? product.variants,
            status: next.status,
            sellable: next.sellable,
          }
        }),
      }
    })
    if (fillForm) {
      setShippingMarkup(String(payload.settings.shippingMarkupPercent))
      setStoreId(payload.settings.storeId)
      setAiBaseUrl(payload.settings.aiBaseUrl)
      setAiModel(payload.settings.aiModel)
    }
    return payload
  }

  useEffect(() => {
    let cancelled = false
    let timer = 0
    let attempts = 0

    async function run() {
      try {
        const payload = await load(false, attempts === 0, attempts > 0)
        if (cancelled) return
        if (payload.products.some((product) => product.pricePending) && attempts < 5) {
          attempts += 1
          timer = window.setTimeout(() => void run(), 900)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the store')
      }
    }

    void run()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  async function saveSettings(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await loadSettings()
      setNotice('Saved store settings. Refresh products if you changed the store id.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settings')
    } finally {
      setBusy(false)
    }
  }

  async function loadSettings() {
    const payload = await storeJson<AdminStore>('/api/admin/store/settings', {
      method: 'PATCH',
      credentials: 'same-origin',
      body: JSON.stringify({
        shippingMarkupPercent: Number(shippingMarkup),
        storeId,
        aiBaseUrl,
        aiModel,
        ...(aiApiKey.trim() ? { aiApiKey } : {}),
        ...(clearOpenai ? { clearOpenaiKey: true } : {}),
      }),
    })
    setData(payload)
    setAiBaseUrl(payload.settings.aiBaseUrl)
    setAiModel(payload.settings.aiModel)
    setAiApiKey('')
    setClearOpenai(false)
  }

  function setCoupons(coupons: StoreCoupon[]) {
    setData((current) => (current ? { ...current, coupons } : current))
  }

  function setGroups(groups: AdminStore['groups']) {
    setData((current) => (current ? { ...current, groups } : current))
  }

  const groups = data?.groups ?? { categories: [], collections: [] }

  function memberIds(kind: 'categories' | 'collections', productId: string) {
    return groups[kind].filter((group) => group.productIds.includes(productId)).map((group) => group.id)
  }

  async function addGroup(event: FormEvent, kind: 'categories' | 'collections') {
    event.preventDefault()
    const name = (kind === 'categories' ? categoryName : collectionName).trim()
    if (name.length < 2) return
    setBusy(true)
    setError(null)
    try {
      const payload = await storeJson<{ groups: AdminStore['groups'] }>(`/api/admin/store/${kind}`, {
        method: 'POST',
        credentials: 'same-origin',
        body: JSON.stringify({ name }),
      })
      setGroups(payload.groups)
      if (kind === 'categories') setCategoryName('')
      else setCollectionName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that')
    } finally {
      setBusy(false)
    }
  }

  async function removeGroup(kind: 'categories' | 'collections', group: StoreGroup) {
    setBusy(true)
    setError(null)
    try {
      const payload = await storeJson<{ groups: AdminStore['groups'] }>(
        `/api/admin/store/${kind}/${encodeURIComponent(group.id)}`,
        { method: 'DELETE', credentials: 'same-origin' },
      )
      setGroups(payload.groups)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that')
    } finally {
      setBusy(false)
    }
  }

  async function setCategoryImage(group: StoreGroup, image: string, imageProductId = '') {
    setBusy(true)
    setError(null)
    try {
      const payload = await storeJson<{ groups: AdminStore['groups'] }>(
        `/api/admin/store/categories/${encodeURIComponent(group.id)}`,
        {
          method: 'PATCH',
          credentials: 'same-origin',
          body: JSON.stringify({ image, imageProductId }),
        },
      )
      setGroups(payload.groups)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the category image')
    } finally {
      setBusy(false)
    }
  }

  async function setMembership(product: AdminProduct, kind: 'categories' | 'collections', groupId: string, on: boolean) {
    const field = kind === 'categories' ? 'categoryIds' : 'collectionIds'
    const current = memberIds(kind, product.id)
    const next = on ? [...current, groupId] : current.filter((id) => id !== groupId)
    setError(null)
    setData((currentData) => {
      if (!currentData?.groups) return currentData
      return {
        ...currentData,
        groups: {
          ...currentData.groups,
          [kind]: currentData.groups[kind].map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  productIds: on
                    ? group.productIds.includes(product.id)
                      ? group.productIds
                      : [...group.productIds, product.id]
                    : group.productIds.filter((id) => id !== product.id),
                }
              : group,
          ),
        },
      }
    })
    try {
      const payload = await storeJson<{ groups: AdminStore['groups'] }>(
        `/api/admin/store/products/${encodeURIComponent(product.id)}`,
        {
          method: 'PATCH',
          credentials: 'same-origin',
          body: JSON.stringify({ [field]: next }),
        },
      )
      setGroups(payload.groups)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update that product')
      try {
        await load(false, false)
      } catch {
        /* keep the assignment error */
      }
    }
  }

  async function addCoupon(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const payload = await storeJson<{ coupons: StoreCoupon[] }>('/api/admin/store/coupons', {
        method: 'POST',
        credentials: 'same-origin',
        body: JSON.stringify({ code: couponCode, percent: Number(couponPercent) }),
      })
      setCoupons(payload.coupons)
      setCouponCode('')
      setNotice('Coupon added.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that coupon')
    } finally {
      setBusy(false)
    }
  }

  async function setCouponActive(coupon: StoreCoupon, active: boolean) {
    setError(null)
    setCoupons(
      (data?.coupons ?? []).map((item) => (item.code === coupon.code ? { ...item, active } : item)),
    )
    try {
      const payload = await storeJson<{ coupons: StoreCoupon[] }>(
        `/api/admin/store/coupons/${encodeURIComponent(coupon.code)}`,
        {
          method: 'PATCH',
          credentials: 'same-origin',
          body: JSON.stringify({ active }),
        },
      )
      setCoupons(payload.coupons)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update that coupon')
      try {
        await load(false, false)
      } catch {
        /* keep the coupon error */
      }
    }
  }

  async function removeCoupon(coupon: StoreCoupon) {
    setBusy(true)
    setError(null)
    try {
      const payload = await storeJson<{ coupons: StoreCoupon[] }>(
        `/api/admin/store/coupons/${encodeURIComponent(coupon.code)}`,
        { method: 'DELETE', credentials: 'same-origin' },
      )
      setCoupons(payload.coupons)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that coupon')
    } finally {
      setBusy(false)
    }
  }

  async function toggle(product: AdminProduct) {
    setError(null)
    const enabled = !product.enabled
    setData((current) =>
      current
        ? {
            ...current,
            products: current.products.map((item) => (item.id === product.id ? { ...item, enabled } : item)),
          }
        : current,
    )
    try {
      await storeJson(`/api/admin/store/products/${encodeURIComponent(product.id)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        body: JSON.stringify({ enabled }),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update that product')
      try {
        await load(false, false)
      } catch {
        /* keep the toggle error */
      }
    }
  }

  async function saveDescription(product: AdminProduct) {
    const description = drafts[product.id] ?? product.description
    setBusy(true)
    setError(null)
    try {
      await storeJson(`/api/admin/store/products/${encodeURIComponent(product.id)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        body: JSON.stringify({ description }),
      })
      setData((current) =>
        current
          ? {
              ...current,
              products: current.products.map((item) =>
                item.id === product.id
                  ? { ...item, description, descriptionSource: description.trim() ? 'edited' : 'printful' }
                  : item,
              ),
            }
          : current,
      )
      setNotice('Saved that description.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that description')
    } finally {
      setBusy(false)
    }
  }

  async function writeDescriptions(productId?: string) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const payload = await storeJson<{
        updated: { id: string; title: string; description: string }[]
        remaining: number
      }>('/api/admin/store/descriptions', {
        method: 'POST',
        credentials: 'same-origin',
        body: JSON.stringify(productId ? { productId } : {}),
      })
      setData((current) => {
        if (!current) return current
        const byId = new Map(payload.updated.map((item) => [item.id, item.description]))
        return {
          ...current,
          products: current.products.map((item) =>
            byId.has(item.id)
              ? { ...item, description: byId.get(item.id) || item.description, descriptionSource: 'openai' as const }
              : item,
          ),
        }
      })
      setDrafts((current) => {
        const next = { ...current }
        for (const item of payload.updated) delete next[item.id]
        return next
      })
      setNotice(
        payload.updated.length
          ? `Wrote ${payload.updated.length} description${payload.updated.length === 1 ? '' : 's'}.${payload.remaining ? ` ${payload.remaining} still need a description.` : ''}`
          : 'Every product already has a store description.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not write descriptions')
    } finally {
      setBusy(false)
    }
  }

  async function testConnections() {
    setTesting(true)
    setError(null)
    try {
      const payload = await storeJson<{ checks: ConnectionCheck[] }>('/api/admin/store/test', {
        method: 'POST',
        credentials: 'same-origin',
      })
      setChecks(payload.checks)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not test the connections')
    } finally {
      setTesting(false)
    }
  }

  async function refresh() {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await load(true)
      setNotice('Reloaded products from Printful.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh Printful')
    } finally {
      setBusy(false)
    }
  }

  async function sync(order: AdminOrder) {
    setBusy(true)
    setError(null)
    try {
      const payload = await storeJson<{ order: AdminOrder }>(
        `/api/admin/store/orders/${encodeURIComponent(order.id)}/sync`,
        { method: 'POST', credentials: 'same-origin' },
      )
      setData((current) =>
        current
          ? { ...current, orders: current.orders.map((item) => (item.id === payload.order.id ? payload.order : item)) }
          : current,
      )
      setNotice(`Updated order ${payload.order.id}: ${orderLabel(payload.order.status)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sync that order')
    } finally {
      setBusy(false)
    }
  }

  async function cancelOrder(order: AdminOrder) {
    const refund = order.status === 'paid' || order.status === 'fulfilled' || order.status === 'fulfillment_failed'
    const confirmed = window.confirm(
      refund
        ? 'Cancel this order? A completed card payment is refunded, and Printful is asked to stop the print.'
        : 'Cancel this order? The card payment will be stopped if it has not been completed.',
    )
    if (!confirmed) return
    setBusy(true)
    setError(null)
    try {
      const payload = await storeJson<{ order: AdminOrder }>(
        `/api/admin/store/orders/${encodeURIComponent(order.id)}/cancel`,
        { method: 'POST', credentials: 'same-origin' },
      )
      setData((current) =>
        current
          ? { ...current, orders: current.orders.map((item) => (item.id === payload.order.id ? payload.order : item)) }
          : current,
      )
      setNotice(`Canceled order ${payload.order.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel that order')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="admin-card store-admin">
      <div className="store-admin__head">
        <div>
          <h2>Store</h2>
          <p className="admin-hint">
            <Link to="/store">View the store</Link>
          </p>
        </div>
      </div>
      {!data && !error && <p className="admin-status">Loading store…</p>}
      {error && <p className="admin-error">{error}</p>}
      {notice && <p className="admin-notice">{notice}</p>}
      {data && (
        <>
          <div className="store-admin-nav" role="tablist" aria-label="Store sections">
            {(
              [
                ['products', `Products (${data.products.length})`],
                ['catalog', 'Categories'],
                ['coupons', `Coupons (${data.coupons?.length ?? 0})`],
                ['orders', `Orders (${data.orders.filter((order) => orderIsOpen(order.status)).length})`],
                ['settings', 'Settings'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={section === id} onClick={() => setSection(id)}>
                {label}
              </button>
            ))}
          </div>

          {section === 'products' && (
            <div>
              <div className="store-actions">
                <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void refresh()}>
                  Refresh from Printful
                </button>
                <button type="button" className="btn btn--accent" disabled={busy} onClick={() => void writeDescriptions()}>
                  Write missing descriptions
                </button>
              </div>
              {data.notes.length > 0 && (
                <ul className="admin-hint">
                  {data.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              )}
              {data.products.length === 0 ? (
                <p>No products yet. Create them in Printful, then refresh.</p>
              ) : (
                <ul className="store-admin-list">
                  {data.products.map((product) => {
                    const badge = productBadge(product)
                    const price =
                      product.pricePending && product.wholesaleCents == null
                        ? 'Loading price…'
                        : product.wholesaleCents == null
                          ? 'No price yet'
                          : `${formatUsd(product.wholesaleCents)} cost · ${formatUsd(product.retailCents ?? 0)} price`
                    return (
                      <li key={product.id} className="store-admin-product">
                        {product.previewUrl ? (
                          <img src={product.previewUrl} alt="" className="admin-photo-row__thumb" />
                        ) : (
                          <span className="admin-photo-row__thumb store-card__fallback" />
                        )}
                        <div>
                          <div className="store-product__row">
                            <div>
                              <strong>{product.title}</strong>
                              <p className="admin-hint">
                                {product.variantCount} size{product.variantCount === 1 ? '' : 's'}
                                {product.productType ? ` · ${product.productType}` : ''}
                              </p>
                            </div>
                            <span className={`store-badge store-badge--${badge.tone}`}>{badge.label}</span>
                            <p className="store-product__price">{price}</p>
                            <label className="admin-check">
                              <input type="checkbox" checked={product.enabled} onChange={() => void toggle(product)} />
                              On store
                            </label>
                          </div>
                          <details className="store-product__edit">
                            <summary>Edit</summary>
                            <label>
                              Description
                              <textarea
                                rows={4}
                                value={drafts[product.id] ?? product.description}
                                onChange={(event) =>
                                  setDrafts((current) => ({ ...current, [product.id]: event.target.value }))
                                }
                              />
                            </label>
                            <p className="admin-hint">
                              {product.descriptionSource === 'openai'
                                ? 'Written with the connected AI.'
                                : product.descriptionSource === 'edited'
                                  ? 'Edited here.'
                                  : 'Using the Printful description.'}
                            </p>
                            <div className="store-actions">
                              <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void saveDescription(product)}>
                                Save description
                              </button>
                              <button type="button" className="text-link" disabled={busy} onClick={() => void writeDescriptions(product.id)}>
                                Rewrite
                              </button>
                            </div>
                            {(groups.categories.length > 0 || groups.collections.length > 0) && (
                              <div className="store-assign">
                                {groups.categories.map((group) => (
                                  <label key={group.id} className="admin-check">
                                    <input
                                      type="checkbox"
                                      checked={group.productIds.includes(product.id)}
                                      onChange={(event) =>
                                        void setMembership(product, 'categories', group.id, event.target.checked)
                                      }
                                    />
                                    {group.name}
                                  </label>
                                ))}
                                {groups.collections.map((group) => (
                                  <label key={group.id} className="admin-check">
                                    <input
                                      type="checkbox"
                                      checked={group.productIds.includes(product.id)}
                                      onChange={(event) =>
                                        void setMembership(product, 'collections', group.id, event.target.checked)
                                      }
                                    />
                                    {group.name}
                                  </label>
                                ))}
                              </div>
                            )}
                          </details>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {section === 'catalog' && (
            <div className="store-admin-split">
              <div className="store-admin-pane">
                <h3>Categories</h3>
                <p className="admin-hint">Departments in the shop, such as Prints or Calendars. Choose the photo for each tile.</p>
                <form className="admin-form" onSubmit={(event) => void addGroup(event, 'categories')}>
                  <label>
                    New category
                    <input
                      value={categoryName}
                      onChange={(event) => setCategoryName(event.target.value)}
                      placeholder="Prints"
                      maxLength={60}
                      required
                    />
                  </label>
                  <button className="btn btn--accent" type="submit" disabled={busy}>
                    Add category
                  </button>
                </form>
                {groups.categories.length === 0 ? (
                  <p className="admin-hint">No categories yet.</p>
                ) : (
                  <ul className="store-orders">
                    {groups.categories.map((group) => (
                      <li key={group.id}>
                        <strong>{group.name}</strong>
                        <span>{group.productIds.length} products</span>
                        <div className="store-image-pick" role="listbox" aria-label={`Image for ${group.name}`}>
                          {CATEGORY_PHOTOS.map((src) => (
                            <button
                              key={src}
                              type="button"
                              className={group.image === src ? 'is-selected' : ''}
                              aria-label={src.split('/').pop()}
                              disabled={busy}
                              onClick={() => void setCategoryImage(group, src)}
                            >
                              <img src={src} alt="" />
                            </button>
                          ))}
                          {data.products
                            .filter((product) => product.previewUrl)
                            .map((product) => (
                              <button
                                key={product.id}
                                type="button"
                                className={!group.image && group.imageProductId === product.id ? 'is-selected' : ''}
                                aria-label={product.title}
                                title={product.title}
                                disabled={busy}
                                onClick={() => void setCategoryImage(group, '', product.id)}
                              >
                                <img src={product.previewUrl} alt="" />
                              </button>
                            ))}
                        </div>
                        {(group.image || group.imageProductId) && (
                          <button type="button" className="text-link" disabled={busy} onClick={() => void setCategoryImage(group, '')}>
                            Use an automatic photo
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-link"
                          disabled={busy}
                          onClick={() => void removeGroup('categories', group)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="store-admin-pane">
                <h3>Collections</h3>
                <p className="admin-hint">Curated groups, such as a season or a gift set.</p>
                <form className="admin-form" onSubmit={(event) => void addGroup(event, 'collections')}>
                  <label>
                    New collection
                    <input
                      value={collectionName}
                      onChange={(event) => setCollectionName(event.target.value)}
                      placeholder="Spring gifts"
                      maxLength={60}
                      required
                    />
                  </label>
                  <button className="btn btn--accent" type="submit" disabled={busy}>
                    Add collection
                  </button>
                </form>
                {groups.collections.length === 0 ? (
                  <p className="admin-hint">No collections yet.</p>
                ) : (
                  <ul className="store-orders">
                    {groups.collections.map((group) => (
                      <li key={group.id}>
                        <strong>{group.name}</strong>
                        <span>{group.productIds.length} products</span>
                        <button
                          type="button"
                          className="text-link"
                          disabled={busy}
                          onClick={() => void removeGroup('collections', group)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {section === 'coupons' && (
            <div>
              <p className="admin-hint">
                A code takes a percent off your markup. The print cost is never discounted.
              </p>
              <form className="admin-grid" onSubmit={(event) => void addCoupon(event)}>
                <label>
                  Code
                  <input
                    value={couponCode}
                    onChange={(event) => setCouponCode(event.target.value)}
                    placeholder="SPRING"
                    maxLength={24}
                    required
                  />
                </label>
                <label>
                  Percent of markup
                  <input
                    inputMode="numeric"
                    value={couponPercent}
                    onChange={(event) => setCouponPercent(event.target.value)}
                    min={1}
                    max={100}
                    required
                  />
                </label>
                <div className="admin-span-2">
                  <button className="btn btn--accent" type="submit" disabled={busy}>
                    Add coupon
                  </button>
                </div>
              </form>
              {(data.coupons ?? []).length === 0 ? (
                <p className="admin-hint">No coupon codes yet.</p>
              ) : (
                <ul className="store-orders">
                  {(data.coupons ?? []).map((coupon) => (
                    <li key={coupon.code}>
                      <strong>{coupon.code}</strong>
                      <span>{coupon.percent}% off markup</span>
                      <label className="admin-check">
                        <input
                          type="checkbox"
                          checked={coupon.active}
                          onChange={() => void setCouponActive(coupon, !coupon.active)}
                        />
                        Active
                      </label>
                      <button type="button" className="text-link" disabled={busy} onClick={() => void removeCoupon(coupon)}>
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {section === 'orders' && (
            <div>
              <div className="store-admin-nav store-admin-nav--sub" role="tablist" aria-label="Order status">
                <button type="button" role="tab" aria-selected={orderView === 'open'} onClick={() => setOrderView('open')}>
                  Open ({data.orders.filter((order) => orderIsOpen(order.status)).length})
                </button>
                <button type="button" role="tab" aria-selected={orderView === 'closed'} onClick={() => setOrderView('closed')}>
                  Closed ({data.orders.filter((order) => !orderIsOpen(order.status)).length})
                </button>
              </div>
              {data.orders.filter((order) => orderIsOpen(order.status) === (orderView === 'open')).length === 0 ? (
                <p className="admin-hint">{orderView === 'open' ? 'No open orders.' : 'No closed orders.'}</p>
              ) : (
                <ul className="store-orders">
                  {data.orders
                    .filter((order) => orderIsOpen(order.status) === (orderView === 'open'))
                    .map((order) => (
                    <li key={order.id}>
                      <div className="store-order__top">
                        <strong>#{order.id.slice(4, 12)}</strong>
                        <span className={`store-badge store-badge--${orderIsOpen(order.status) ? 'warn' : 'closed'}`}>
                          {orderLabel(order.status)}
                        </span>
                        <span>{new Date(order.createdAt).toLocaleString()}</span>
                        <strong>{formatUsd(order.totalCents)}</strong>
                      </div>
                      <span>{order.email}{order.phone ? ` · ${order.phone}` : ''}</span>
                      <span>
                        {order.shipTo.name}, {order.shipTo.line1}
                        {order.shipTo.line2 ? `, ${order.shipTo.line2}` : ''}, {order.shipTo.city}
                        {order.shipTo.state ? `, ${order.shipTo.state}` : ''} {order.shipTo.postalCode}, {order.shipTo.country}
                      </span>
                      <ul className="store-order__lines">
                        {order.items.map((item, index) => (
                          <li key={`${item.title}-${index}`}>
                            <span>
                              {item.quantity}× {item.title}
                              {item.variantTitle ? <small>{item.variantTitle}</small> : null}
                            </span>
                            <span>{formatUsd(item.linePriceCents)}</span>
                          </li>
                        ))}
                        <li>
                          <span>{order.shippingLabel || 'Shipping'}</span>
                          <span>{formatUsd(order.shippingCents)}</span>
                        </li>
                        {order.discountCents > 0 && (
                          <li>
                            <span>Coupon {order.couponCode}</span>
                            <span>{formatUsd(-order.discountCents)}</span>
                          </li>
                        )}
                        <li>
                          <span>Tax</span>
                          <span>{formatUsd(order.taxCents)}</span>
                        </li>
                        <li>
                          <span>Total</span>
                          <strong>{formatUsd(order.totalCents)}</strong>
                        </li>
                      </ul>
                      {order.stripePaymentIntentId && <span className="admin-hint">Payment {order.stripePaymentIntentId}</span>}
                      {order.gelatoOrderIds.length > 0 && <span className="admin-hint">Print {order.gelatoOrderIds.join(', ')}</span>}
                      {order.gelatoError && <span className="admin-error">{order.gelatoError}</span>}
                      <div className="store-order__actions">
                        {order.status !== 'canceled' && order.status !== 'fulfilled' && (
                          <button type="button" className="text-link" disabled={busy} onClick={() => void sync(order)}>
                            Settle payment
                          </button>
                        )}
                        {order.status !== 'canceled' && (
                          <button type="button" className="text-link" disabled={busy} onClick={() => void cancelOrder(order)}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {section === 'settings' && (
            <div>
              <ul className="store-secrets">
                <li>{data.secrets.printful ? 'Printful connected' : 'Printful token missing'}</li>
                <li>{data.secrets.stripeSecret && data.secrets.stripePublishable ? 'Card payments connected' : 'Card payments incomplete'}</li>
                <li>
                  {data.secrets.stripeWebhook
                    ? 'Payment webhook connected'
                    : 'Payment webhook not set. A finished checkout can still place the order.'}
                </li>
                <li>{data.secrets.openai ? 'Description writer connected' : 'Description writer not connected'}</li>
              </ul>
              <div className="store-actions">
                <button type="button" className="btn btn--ghost" disabled={testing} onClick={() => void testConnections()}>
                  {testing ? 'Testing connections…' : 'Test connections'}
                </button>
              </div>
              {checks && (
                <ul className="store-checks">
                  {checks.map((item) => (
                    <li key={item.id} className={`is-${item.status}`}>
                      <strong>{item.name}.</strong> {item.detail}
                    </li>
                  ))}
                </ul>
              )}
              <form className="admin-grid" onSubmit={(event) => void saveSettings(event)}>
                <h3 className="admin-span-2">Shipping</h3>
                <label>
                  Shipping markup %
                  <input
                    inputMode="decimal"
                    value={shippingMarkup}
                    onChange={(event) => setShippingMarkup(event.target.value)}
                  />
                </label>
                <p className="admin-hint admin-span-2">
                  Product prices come from Printful. This percent is added only to the shipping quote.
                </p>
                <h3 className="admin-span-2">Printful</h3>
                <label className="admin-span-2">
                  Store id
                  <input
                    value={storeId}
                    onChange={(event) => setStoreId(event.target.value)}
                    placeholder="Leave blank if the account has one store"
                  />
                </label>
                <p className="admin-hint admin-span-2">
                  Use the Manual / API store. Paste its number when the account has more than one store.
                </p>
                <h3 className="admin-span-2">Descriptions</h3>
                <label className="admin-span-2">
                  API address
                  <input
                    value={aiBaseUrl}
                    onChange={(event) => setAiBaseUrl(event.target.value)}
                    placeholder="https://your-open-webui-host/api"
                    autoComplete="off"
                  />
                </label>
                <label className="admin-span-2">
                  Model
                  <input
                    value={aiModel}
                    onChange={(event) => setAiModel(event.target.value)}
                    placeholder="gemini-2.5-flash"
                    autoComplete="off"
                  />
                </label>
                <label className="admin-span-2">
                  API key
                  <input
                    type="password"
                    value={aiApiKey}
                    onChange={(event) => setAiApiKey(event.target.value)}
                    placeholder={data.secrets.openai ? 'A key is already saved' : 'Paste the API key'}
                    autoComplete="off"
                  />
                </label>
                <label className="admin-check admin-span-2">
                  <input type="checkbox" checked={clearOpenai} onChange={(event) => setClearOpenai(event.target.checked)} />
                  Remove the saved API key
                </label>
                <div className="admin-span-2 store-actions">
                  <button className="btn btn--accent" type="submit" disabled={busy}>
                    Save settings
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}
    </section>
  )
}
