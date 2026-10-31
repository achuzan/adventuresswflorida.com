import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { storeJson } from '../data/store-client'
import { SeoHead } from '../seo'
import { site } from '../site'
import { formatUsd, fromPriceCents, type StoreProductPublic } from '../shared/store'

export function StorePage() {
  const [products, setProducts] = useState<StoreProductPublic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer = 0
    let attempts = 0

    async function load() {
      try {
        const data = await storeJson<{ products: StoreProductPublic[]; pricesPending?: boolean }>(
          '/api/store/products',
        )
        if (cancelled) return
        setProducts(data.products)
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

  return (
    <div className="page page--store">
      <SeoHead
        title={`Store · Prints, Calendars & Mugs · ${site.shortBrand}`}
        description="Order wildlife photography prints, calendars, and mugs from Adventures in Southwest Florida. Printed to order and shipped by Gelato."
        path="/store"
      />
      <header className="page-hero">
        <p className="eyebrow">Printed to order</p>
        <h1>Store</h1>
        <p>
          Prints, calendars, and mugs from the photographs. Shipping is quoted to your address
          before you pay. The calendar pages on this site stay up as the stories behind the printed
          calendars.
        </p>
      </header>

      {loading && <p className="store-status">Loading products…</p>}
      {error && <p className="store-error">{error}</p>}
      {!loading && !error && products.length === 0 && (
        <p className="store-status">The store is getting ready. Check back soon.</p>
      )}

      <div className="store-grid">
        {products.map((product) => {
          const price = fromPriceCents(product.variants)
          const pending = product.variants.some((variant) => variant.pricePending) && price == null
          const varied =
            new Set(product.variants.flatMap((variant) => (variant.priceCents == null ? [] : [variant.priceCents])))
              .size > 1
          return (
            <Link key={product.id} to={`/store/${product.id}`} className="store-card">
              {product.previewUrl ? (
                <img src={product.previewUrl} alt="" />
              ) : (
                <span className="store-card__fallback">{product.title}</span>
              )}
              <span className="store-card__body">
                <strong>{product.title}</strong>
                {product.productType && <span className="store-card__type">{product.productType}</span>}
                <span className="store-card__price">
                  {pending ? 'Pricing…' : price == null ? 'Price unavailable' : varied ? `From ${formatUsd(price)}` : formatUsd(price)}
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
