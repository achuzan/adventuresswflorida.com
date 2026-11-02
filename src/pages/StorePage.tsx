import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCart } from '../data/CartProvider'
import { storeJson } from '../data/store-client'
import { SeoHead } from '../seo'
import { site } from '../site'
import {
  formatUsd,
  fromPriceCents,
  type StoreGroupPublic,
  type StoreProductPublic,
} from '../shared/store'

type Catalog = {
  products: StoreProductPublic[]
  categories: StoreGroupPublic[]
  collections: StoreGroupPublic[]
  pricesPending?: boolean
}

const TILE_WASH = ['#e4f0ea', '#f8e7d6', '#f3ecd4', '#e4eef0', '#f6e4dc', '#e7eee8']
const TILE_PHOTO = [
  '/photos/alligator.jpg',
  '/photos/florida-scrub-jay.jpg',
  '/photos/greategret.jpg',
  '/photos/flamingo.jpg',
  '/photos/malewoodduck.jpg',
  '/photos/snailkite.jpg',
]

function priceLabel(product: StoreProductPublic) {
  const price = fromPriceCents(product.variants)
  const pending = product.variants.some((variant) => variant.pricePending) && price == null
  const varied =
    new Set(product.variants.flatMap((variant) => (variant.priceCents == null ? [] : [variant.priceCents]))).size > 1
  if (pending) return 'Pricing…'
  if (price == null) return 'Price unavailable'
  return varied ? `From ${formatUsd(price)}` : formatUsd(price)
}

function countIn(group: StoreGroupPublic, products: StoreProductPublic[]) {
  return products.filter((product) => group.productIds.includes(product.id)).length
}

function groupImage(group: StoreGroupPublic, products: StoreProductPublic[], index: number) {
  const match = products.find((product) => group.productIds.includes(product.id) && product.previewUrl)
  return match?.previewUrl || TILE_PHOTO[index % TILE_PHOTO.length]!
}

export function StorePage() {
  const { categoryId = '', collectionId = '' } = useParams()
  const { addItem } = useCart()
  const [catalog, setCatalog] = useState<Catalog>({ products: [], categories: [], collections: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('featured')
  const [addedId, setAddedId] = useState('')

  useEffect(() => {
    let cancelled = false
    let timer = 0
    let attempts = 0

    async function load() {
      try {
        const data = await storeJson<Catalog>('/api/store/products')
        if (cancelled) return
        setCatalog({
          products: data.products,
          categories: data.categories ?? [],
          collections: data.collections ?? [],
        })
        setError(null)
        const pending =
          data.pricesPending || data.products.some((product) => product.variants.some((variant) => variant.pricePending))
        if (pending && attempts < 6) {
          attempts += 1
          timer = window.setTimeout(() => void load(), 800)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the store')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  const category = catalog.categories.find((item) => item.id === categoryId)
  const collection = catalog.collections.find((item) => item.id === collectionId)
  const missingGroup = !loading && ((categoryId && !category) || (collectionId && !collection))
  const home = !categoryId && !collectionId

  const products = useMemo(() => {
    let list = catalog.products
    if (category) {
      const ids = new Set(category.productIds)
      list = list.filter((product) => ids.has(product.id))
    } else if (collection) {
      const order = new Map(collection.productIds.map((id, index) => [id, index]))
      list = list
        .filter((product) => order.has(product.id))
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    }
    const needle = query.trim().toLowerCase()
    if (needle) list = list.filter((product) => product.title.toLowerCase().includes(needle))
    if (sort === 'price') {
      list = [...list].sort((a, b) => (fromPriceCents(a.variants) ?? 0) - (fromPriceCents(b.variants) ?? 0))
    } else if (sort === 'name') {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title))
    }
    return list
  }, [catalog.products, category, collection, query, sort])

  const heading = category?.name || collection?.name || (home ? 'New arrivals' : 'Not in the shop')

  function quickAdd(product: StoreProductPublic) {
    const variant = product.variants.length === 1 ? product.variants[0] : undefined
    if (!variant || variant.priceCents == null) return
    addItem({
      productId: product.id,
      variantId: variant.id,
      quantity: 1,
      title: product.title,
      variantTitle: variant.title,
      previewUrl: variant.previewUrl || product.previewUrl,
      unitPriceCents: variant.priceCents,
    })
    setAddedId(product.id)
  }

  return (
    <div className="page page--store">
      <SeoHead
        title={`${home ? 'Store' : heading} · ${site.shortBrand}`}
        description="Order wildlife photography prints, calendars, and mugs from Adventures in Southwest Florida. Printed to order and shipped by Gelato."
        path={category ? `/store/category/${category.id}` : collection ? `/store/collection/${collection.id}` : '/store'}
      />

      {home && (
        <>
          <section className="store-hero">
            <img className="store-hero__photo" src="/photos/alligator.jpg" alt="" />
            <div className="store-hero__copy">
              <p className="store-kicker">Printed to order</p>
              <h1>
                The wild,
                <br />
                brought <em>home.</em>
              </h1>
              <p>
                Prints, calendars, and mugs from the photographs. Each one is made when you order,
                and shipping is quoted to your address before you pay.
              </p>
              <div className="store-hero__actions">
                <a className="btn btn--accent" href="#store-products">
                  Shop now
                </a>
                <a
                  className="btn btn--ghost"
                  href={catalog.categories.length ? '#store-categories' : catalog.collections.length ? '#store-collections' : '#store-products'}
                >
                  {catalog.categories.length ? 'Explore categories' : catalog.collections.length ? 'Explore collections' : 'Browse products'}
                </a>
              </div>
            </div>
          </section>

          <ul className="store-perks">
            <li>
              <PerkIcon name="print" />
              <span>
                <strong>Printed to order</strong>
                Made after you buy
              </span>
            </li>
            <li>
              <PerkIcon name="ship" />
              <span>
                <strong>Live shipping quote</strong>
                Confirmed at checkout
              </span>
            </li>
            <li>
              <PerkIcon name="field" />
              <span>
                <strong>From the field</strong>
                Photographs by Brad Kemp
              </span>
            </li>
            <li>
              <PerkIcon name="gift" />
              <span>
                <strong>Prints and gifts</strong>
                Calendars, prints, and mugs
              </span>
            </li>
          </ul>
        </>
      )}

      {!home && (
        <header className="store-top">
          <p className="store-crumb">
            <Link to="/store">Store</Link>
            {category && <span> / {category.name}</span>}
            {collection && <span> / {collection.name}</span>}
          </p>
          <h1>{heading}</h1>
          {(category?.description || collection?.description) && <p>{category?.description || collection?.description}</p>}
        </header>
      )}

      {catalog.categories.length > 0 && (
        <section className="store-section" id="store-categories">
          <div className="store-section__head">
            <h2>Shop by category</h2>
            {!home && (
              <Link to="/store" className="text-link">
                All products
              </Link>
            )}
          </div>
          <div className="store-tiles">
            {catalog.categories.map((item, index) => (
              <Link
                key={item.id}
                to={`/store/category/${item.id}`}
                className="store-tile"
                style={{ background: TILE_WASH[index % TILE_WASH.length] }}
                aria-current={item.id === categoryId ? 'page' : undefined}
              >
                <img src={groupImage(item, catalog.products, index)} alt="" />
                <strong>{item.name}</strong>
                <span>
                  {countIn(item, catalog.products)} product{countIn(item, catalog.products) === 1 ? '' : 's'}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {catalog.collections.length > 0 && (
        <section className="store-section" id="store-collections">
          <div className="store-section__head">
            <h2>Collections</h2>
          </div>
          <div className="store-tiles">
            {catalog.collections.map((item, index) => (
              <Link
                key={item.id}
                to={`/store/collection/${item.id}`}
                className="store-tile"
                style={{ background: TILE_WASH[(index + 2) % TILE_WASH.length] }}
                aria-current={item.id === collectionId ? 'page' : undefined}
              >
                <img src={groupImage(item, catalog.products, index + 1)} alt="" />
                <strong>{item.name}</strong>
                <span>
                  {countIn(item, catalog.products)} product{countIn(item, catalog.products) === 1 ? '' : 's'}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {home && (
        <section className="store-promo">
          <img src="/photos/florida-scrub-jay.jpg" alt="" />
          <div>
            <p className="store-kicker">From the photographs</p>
            <h2>Made when you order</h2>
            <p>Calendars, prints, and mugs, printed for you and shipped to your address.</p>
            <a className="btn btn--light" href="#store-products">
              Shop the store
            </a>
          </div>
        </section>
      )}

      <section className="store-section" id="store-products">
        <div className="store-section__head">
          <h2>{heading}</h2>
          <div className="store-toolbar">
            <label>
              <span className="sr-only">Search</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" />
            </label>
            <label>
              <span className="sr-only">Sort</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort">
                <option value="featured">Featured</option>
                <option value="name">Name</option>
                <option value="price">Price</option>
              </select>
            </label>
          </div>
        </div>

        {loading && <p className="store-status">Loading products…</p>}
        {error && <p className="store-error">{error}</p>}
        {missingGroup && <p className="store-status">That category or collection is not in the shop.</p>}
        {!loading && !error && !missingGroup && catalog.products.length === 0 && (
          <p className="store-status">The store is getting ready. Check back soon.</p>
        )}
        {!loading && !error && !missingGroup && catalog.products.length > 0 && products.length === 0 && (
          <p className="store-status">Nothing in this view yet.</p>
        )}

        <div className="store-grid">
          {products.map((product) => {
            const single = product.variants.length === 1 ? product.variants[0] : undefined
            const canAdd = Boolean(single && single.priceCents != null)
            return (
              <article key={product.id} className="store-card">
                <Link to={`/store/${product.id}`} className="store-card__media">
                  {product.previewUrl ? (
                    <img src={product.previewUrl} alt="" />
                  ) : (
                    <span className="store-card__fallback">{product.title}</span>
                  )}
                </Link>
                <div className="store-card__body">
                  <Link to={`/store/${product.id}`}>
                    <strong>{product.title}</strong>
                  </Link>
                  <span className="store-card__price">{priceLabel(product)}</span>
                  {canAdd ? (
                    <button type="button" className="store-card__add" onClick={() => quickAdd(product)}>
                      {addedId === product.id ? 'Added to cart' : 'Add to cart'}
                    </button>
                  ) : (
                    <Link className="store-card__add" to={`/store/${product.id}`}>
                      Choose options
                    </Link>
                  )}
                  {addedId === product.id && (
                    <Link className="store-card__added" to="/store/cart">
                      View cart
                    </Link>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function PerkIcon({ name }: { name: 'print' | 'ship' | 'field' | 'gift' }) {
  const common = {
    viewBox: '0 0 24 24',
    width: 22,
    height: 22,
    'aria-hidden': true as const,
  }
  return (
    <span className="store-perk__icon">
      {name === 'print' && (
        <svg {...common}>
          <path d="M7 8V4h10v4" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M6 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <rect x="7" y="13" width="10" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      )}
      {name === 'ship' && (
        <svg {...common}>
          <path d="M3 7h11v8H3z" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M14 10h4l3 3v2h-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <circle cx="7" cy="18" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="17" cy="18" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      )}
      {name === 'field' && (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      )}
      {name === 'gift' && (
        <svg {...common}>
          <rect x="4" y="10" width="16" height="10" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M4 14h16M12 10v10" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12 10c0-2.5-2.2-4-3.6-2.6S10 9 12 10s3.4-1.2 3.6-2.6S12 7.5 12 10z" fill="none" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      )}
    </span>
  )
}
