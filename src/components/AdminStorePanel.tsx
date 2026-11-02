import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { storeJson } from '../data/store-client'
import { formatUsd } from '../shared/store'

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
  hasPrintFile: boolean
  pricePending: boolean
  wholesaleCents: number | null
  retailCents: number | null
}

type AdminOrder = {
  id: string
  createdAt: string
  status: string
  email: string
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
}

type AdminStore = {
  settings: {
    markupPercent: number
    shippingMarkupPercent: number
    storeId: string
    templateIds: string[]
  }
  notes: string[]
  fetchedAt: string
  coupons: StoreCoupon[]
  groups: { categories: StoreGroup[]; collections: StoreGroup[] }
  secrets: {
    gelato: boolean
    stripeSecret: boolean
    stripePublishable: boolean
    stripeWebhook: boolean
  }
  products: AdminProduct[]
  orders: AdminOrder[]
}

export function AdminStorePanel() {
  const [data, setData] = useState<AdminStore | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [markup, setMarkup] = useState('0')
  const [shippingMarkup, setShippingMarkup] = useState('0')
  const [storeId, setStoreId] = useState('')
  const [templateIds, setTemplateIds] = useState('')
  const [checks, setChecks] = useState<ConnectionCheck[] | null>(null)
  const [testing, setTesting] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [couponPercent, setCouponPercent] = useState('10')
  const [categoryName, setCategoryName] = useState('')
  const [collectionName, setCollectionName] = useState('')

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
            status: next.status,
            sellable: next.sellable,
          }
        }),
      }
    })
    if (fillForm) {
      setMarkup(String(payload.settings.markupPercent))
      setShippingMarkup(String(payload.settings.shippingMarkupPercent))
      setStoreId(payload.settings.storeId)
      setTemplateIds(payload.settings.templateIds.join('\n'))
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
      setNotice('Saved store settings. Refresh products if you changed the store or template ids.')
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
        markupPercent: Number(markup),
        shippingMarkupPercent: Number(shippingMarkup),
        storeId,
        templateIds,
      }),
    })
    setData(payload)
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
      setNotice('Reloaded products from Gelato.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh Gelato')
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
      setNotice(`Updated order ${payload.order.id}: ${payload.order.status.replaceAll('_', ' ')}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sync that order')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="admin-card">
      <h2>Store</h2>
      <p className="admin-hint">
        Products come from Gelato and stay hidden until you turn them on. Gelato’s price is what Gelato
        charges this account. Markup is added for the customer. Stripe takes the card payment and emails
        a receipt. Gelato prints, ships, and emails tracking. This list is the place to see a payment
        that has not reached Gelato yet.
      </p>
      <p className="admin-hint">
        <Link to="/store">View the store</Link>
      </p>
      {!data && !error && <p className="admin-status">Loading store…</p>}
      {error && <p className="admin-error">{error}</p>}
      {notice && <p className="admin-notice">{notice}</p>}
      {data && (
        <>
          <ul className="store-secrets">
            <li>{data.secrets.gelato ? 'Gelato API key is set' : 'Missing GELATO_API_KEY'}</li>
            <li>{data.secrets.stripeSecret ? 'Stripe secret key is set' : 'Missing STRIPE_SECRET_KEY'}</li>
            <li>
              {data.secrets.stripePublishable
                ? 'Stripe publishable key is set'
                : 'Missing STRIPE_PUBLISHABLE_KEY'}
            </li>
            <li>
              {data.secrets.stripeWebhook
                ? 'Stripe webhook secret is set'
                : 'STRIPE_WEBHOOK_SECRET is not set yet. Payments can still complete from the order page. Add the webhook later at /api/stripe/webhook for payment_intent.succeeded and payment_intent.payment_failed.'}
            </li>
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
            <label>
              Print markup %
              <input inputMode="decimal" value={markup} onChange={(event) => setMarkup(event.target.value)} />
            </label>
            <label>
              Shipping markup %
              <input
                inputMode="decimal"
                value={shippingMarkup}
                onChange={(event) => setShippingMarkup(event.target.value)}
              />
            </label>
            <label className="admin-span-2">
              Gelato store id
              <input
                value={storeId}
                onChange={(event) => setStoreId(event.target.value)}
                placeholder="From the store URL in the Gelato dashboard"
              />
            </label>
            <label className="admin-span-2">
              Template ids
              <textarea
                rows={3}
                value={templateIds}
                onChange={(event) => setTemplateIds(event.target.value)}
                placeholder="One Gelato template id per line, if products were saved as templates"
              />
            </label>
            <div className="admin-span-2 store-actions">
              <button className="btn btn--accent" type="submit" disabled={busy}>
                Save settings
              </button>
              <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void refresh()}>
                Refresh from Gelato
              </button>
            </div>
          </form>
          <form className="admin-grid" onSubmit={(event) => void addCoupon(event)}>
            <h2 className="admin-span-2">Coupons</h2>
            <p className="admin-hint admin-span-2">
              A coupon removes a percent of the print and shipping markup. Gelato’s cost is never discounted.
              100% means the customer pays Gelato’s price.
            </p>
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
                  <span>{coupon.percent}% off the markup</span>
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
          <h2>Categories and collections</h2>
          <p className="admin-hint">
            Categories are the shop departments, such as Prints or Calendars. Collections are curated groups, such as
            a season or a gift set. Assign each product below. The store shows both.
          </p>
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
            <div>
              <button className="btn btn--accent" type="submit" disabled={busy}>
                Add category
              </button>
            </div>
          </form>
          {groups.categories.length === 0 ? (
            <p className="admin-hint">No categories yet.</p>
          ) : (
            <ul className="store-orders">
              {groups.categories.map((group) => (
                <li key={group.id}>
                  <strong>{group.name}</strong>
                  <span>{group.productIds.length} products</span>
                  <button type="button" className="text-link" disabled={busy} onClick={() => void removeGroup('categories', group)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
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
            <div>
              <button className="btn btn--accent" type="submit" disabled={busy}>
                Add collection
              </button>
            </div>
          </form>
          {groups.collections.length === 0 ? (
            <p className="admin-hint">No collections yet.</p>
          ) : (
            <ul className="store-orders">
              {groups.collections.map((group) => (
                <li key={group.id}>
                  <strong>{group.name}</strong>
                  <span>{group.productIds.length} products</span>
                  <button type="button" className="text-link" disabled={busy} onClick={() => void removeGroup('collections', group)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          {data.notes.length > 0 && (
            <ul className="admin-hint">
              {data.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
          <p className="admin-hint">Last product pull: {new Date(data.fetchedAt).toLocaleString()}</p>
          {data.products.length === 0 ? (
            <p>No Gelato products yet. Create them in Gelato, then refresh.</p>
          ) : (
            <ul className="admin-photo-list">
              {data.products.map((product) => (
                <li key={product.id} className="store-admin-product">
                  {product.previewUrl ? (
                    <img src={product.previewUrl} alt="" className="admin-photo-row__thumb" />
                  ) : (
                    <span className="admin-photo-row__thumb store-card__fallback" />
                  )}
                  <div>
                    <strong>{product.title}</strong>
                    <p className="admin-hint">
                      {product.source} · {product.status || 'active'} · {product.variantCount} variant
                      {product.variantCount === 1 ? '' : 's'}
                      {product.productType ? ` · ${product.productType}` : ''}
                      {product.status === 'publishing'
                        ? ' · Gelato is still publishing this product'
                        : product.status === 'publishing_error'
                          ? ' · Gelato could not publish this product'
                          : ''}
                    </p>
                    <p>
                      {product.pricePending && product.wholesaleCents == null
                        ? 'Loading Gelato cost…'
                        : product.wholesaleCents == null
                          ? 'Gelato did not return a US price'
                          : `Gelato cost ${formatUsd(product.wholesaleCents)} · customer ${formatUsd(product.retailCents ?? 0)}`}
                    </p>
                    {!product.hasPrintFile && (
                      <p className="admin-hint">
                        Gelato did not attach a print file. Orders are still sent, and Gelato rejects them if the
                        design is not already stored on the product.
                      </p>
                    )}
                    <label className="admin-check">
                      <input
                        type="checkbox"
                        checked={product.enabled}
                        onChange={() => void toggle(product)}
                      />
                      Show in the store
                    </label>
                    {(groups.categories.length > 0 || groups.collections.length > 0) && (
                      <div className="store-assign">
                        {groups.categories.map((group) => (
                          <label key={group.id} className="admin-check">
                            <input
                              type="checkbox"
                              checked={group.productIds.includes(product.id)}
                              onChange={(event) => void setMembership(product, 'categories', group.id, event.target.checked)}
                            />
                            {group.name}
                          </label>
                        ))}
                        {groups.collections.map((group) => (
                          <label key={group.id} className="admin-check">
                            <input
                              type="checkbox"
                              checked={group.productIds.includes(product.id)}
                              onChange={(event) => void setMembership(product, 'collections', group.id, event.target.checked)}
                            />
                            Collection: {group.name}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <h3>Recent orders</h3>
          {data.orders.length === 0 ? (
            <p className="admin-hint">No orders yet.</p>
          ) : (
            <ul className="store-orders">
              {data.orders.map((order) => (
                <li key={order.id}>
                  <strong>{order.status.replaceAll('_', ' ')}</strong>
                  <span>{new Date(order.createdAt).toLocaleString()}</span>
                  <span>{order.email}</span>
                  <span>{formatUsd(order.totalCents)}</span>
                  <span>{order.itemSummary}</span>
                  {order.gelatoOrderIds.length > 0 && <span>Gelato {order.gelatoOrderIds.join(', ')}</span>}
                  {order.gelatoError && <span className="admin-error">{order.gelatoError}</span>}
                  <button type="button" className="text-link" disabled={busy} onClick={() => void sync(order)}>
                    Sync payment and send to Gelato
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
