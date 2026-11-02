import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
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

function priceLabel(product: StoreProductPublic) {
  const price = fromPriceCents(product.variants)
  const pending = product.variants.some((variant) => variant.pricePending) && price == null
  const varied =
    new Set(product.variants.flatMap((variant) => (variant.priceCents == null ? [] : [variant.priceCents]))).size > 1
  if (pending) return 'Pricing…'
  if (price == null) return 'Price unavailable'
  return varied ? `From ${formatUsd(price)}` : formatUsd(price)
}

export function StorePage() {
  const { categoryId = '', collectionId = '' } = useParams()
  const [catalog, setCatalog] = useState<Catalog>({ products: [], categories: [], collections: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('featured')

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
  const browsing = Boolean(category || collection)

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

  const heading = category?.name || collection?.name || (categoryId || collectionId ? 'Not in the shop' : 'All products')
  const description =
    category?.description ||
    collection?.description ||
    (categoryId || collectionId
      ? ''
      : 'Prints, calendars, and mugs from the photographs. Shipping is quoted to your address before you pay.')

  return (
    <div className="page page--store">
      <SeoHead
        title={`${heading} · Store · ${site.shortBrand}`}
        description="Order wildlife photography prints, calendars, and mugs from Adventures in Southwest Florida. Printed to order and shipped by Gelato."
        path={category ? `/store/category/${category.id}` : collection ? `/store/collection/${collection.id}` : '/store'}
      />
      <header className="store-top">
        <p className="store-crumb">
          <Link to="/store">Store</Link>
          {category && <span> / {category.name}</span>}
          {collection && <span> / {collection.name}</span>}
        </p>
        <h1>{heading}</h1>
        {description && <p>{description}</p>}
      </header>

      <div className="store-shop">
        <aside className="store-side">
          <p className="store-side__label">Shop by</p>
          <nav className="store-cats" aria-label="Categories">
            <Link to="/store" aria-current={!categoryId && !collectionId ? 'page' : undefined}>
              All products
              <span>{catalog.products.length}</span>
            </Link>
            {catalog.categories.map((item) => (
              <Link key={item.id} to={`/store/category/${item.id}`} aria-current={item.id === categoryId ? 'page' : undefined}>
                {item.name}
                <span>{catalog.products.filter((product) => item.productIds.includes(product.id)).length}</span>
              </Link>
            ))}
          </nav>
          {catalog.collections.length > 0 && (
            <>
              <p className="store-side__label">Collections</p>
              <nav className="store-cats" aria-label="Collections">
                {catalog.collections.map((item) => (
                  <Link
                    key={item.id}
                    to={`/store/collection/${item.id}`}
                    aria-current={item.id === collectionId ? 'page' : undefined}
                  >
                    {item.name}
                  </Link>
                ))}
              </nav>
            </>
          )}
        </aside>

        <div>
          {!browsing && catalog.collections.length > 0 && (
            <section className="store-featured">
              <h2>Collections</h2>
              <div className="store-collections">
                {catalog.collections.map((item) => (
                  <Link key={item.id} to={`/store/collection/${item.id}`} className="store-collection">
                    <strong>{item.name}</strong>
                    <span>{item.description || `${item.productIds.length} products`}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="store-toolbar">
            <label>
              Search
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" />
            </label>
            <label>
              Sort
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="featured">Featured</option>
                <option value="name">Name</option>
                <option value="price">Price</option>
              </select>
            </label>
            {!loading && catalog.products.length > 0 && (
              <p>
                {products.length} product{products.length === 1 ? '' : 's'}
              </p>
            )}
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
              const names = catalog.categories
                .filter((item) => (product.categoryIds ?? []).includes(item.id))
                .map((item) => item.name)
              return (
                <Link key={product.id} to={`/store/${product.id}`} className="store-card">
                  {product.previewUrl ? (
                    <img src={product.previewUrl} alt="" />
                  ) : (
                    <span className="store-card__fallback">{product.title}</span>
                  )}
                  <span className="store-card__body">
                    {names[0] && <span className="store-card__type">{names[0]}</span>}
                    <strong>{product.title}</strong>
                    <span className="store-card__price">{priceLabel(product)}</span>
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
