import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCart } from '../data/CartProvider'
import { storeJson } from '../data/store-client'
import { SeoHead } from '../seo'
import { site } from '../site'
import { formatUsd, variantForSelection, type StoreProductPublic } from '../shared/store'

export function StoreProductPage() {
  const { productId = '' } = useParams()
  const { addItem } = useCart()
  const [product, setProduct] = useState<StoreProductPublic | null>(null)
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [variantId, setVariantId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const prepared = useRef('')

  useEffect(() => {
    let cancelled = false
    let timer = 0
    let attempts = 0
    setLoading(true)
    setProduct(null)
    setCategories([])
    setError(null)

    async function load() {
      try {
        const data = await storeJson<{
          product: StoreProductPublic
          categories?: { id: string; name: string }[]
          pricesPending?: boolean
        }>(`/api/store/products/${encodeURIComponent(productId)}`)
        if (cancelled) return
        setProduct(data.product)
        setCategories(data.categories ?? [])
        setError(null)
        if (data.pricesPending && attempts < 6) {
          attempts += 1
          timer = window.setTimeout(() => void load(), 800)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load that product')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [productId])

  const variant = product
    ? product.options.length > 0
      ? variantForSelection(product.variants, selected) ??
        product.variants.find((item) => item.id === variantId)
      : product.variants.find((item) => item.id === variantId) ?? product.variants[0]
    : undefined

  useEffect(() => {
    if (!product || prepared.current === product.id) return
    prepared.current = product.id
    const first = product.variants[0]
    if (!first) return
    const init: Record<string, string> = {}
    for (const option of first.options) init[option.name] = option.value
    setSelected(init)
    setVariantId(first.id)
    setQuantity(1)
    setAdded(false)
  }, [product])

  function chooseOption(name: string, value: string) {
    if (!product) return
    const next = { ...selected, [name]: value }
    if (variantForSelection(product.variants, next)) {
      setSelected(next)
      setAdded(false)
      return
    }
    const fallback = product.variants.find((item) =>
      item.options.some((option) => option.name === name && option.value === value),
    )
    if (!fallback) {
      setSelected(next)
      return
    }
    const snapped: Record<string, string> = {}
    for (const option of fallback.options) snapped[option.name] = option.value
    setSelected(snapped)
    setVariantId(fallback.id)
    setAdded(false)
  }

  function addToCart() {
    if (!product || !variant || variant.priceCents == null) return
    addItem({
      productId: product.id,
      variantId: variant.id,
      quantity,
      title: product.title,
      variantTitle: variant.title,
      previewUrl: variant.previewUrl || product.previewUrl,
      unitPriceCents: variant.priceCents,
    })
    setAdded(true)
  }

  const image = variant?.previewUrl || product?.previewUrl
  const category = categories[0]

  return (
    <div className="page page--store">
      <SeoHead
        title={product ? `${product.title} Â· Store Â· ${site.shortBrand}` : `Store Â· ${site.shortBrand}`}
        description={product?.title ? `${product.title} from Adventures in Southwest Florida, printed to order.` : 'Store product'}
        path={`/store/${productId}`}
        image={image || undefined}
      />
      <p className="store-crumb">
        <Link to="/store">Store</Link>
        {category && (
          <>
            {' / '}
            <Link to={`/store/category/${category.id}`}>{category.name}</Link>
          </>
        )}
        {product && <span> / {product.title}</span>}
      </p>
      {loading && !product && <p className="store-status">Loading productâ€¦</p>}
      {error && (
        <p className="store-error">
          {error} <Link to="/store">Back to the store</Link>
        </p>
      )}
      {product && (
        <article className="store-product">
          <div className="store-product__stage">
            {image ? (
              <img className="store-product__photo" src={image} alt={product.title} />
            ) : (
              <div className="store-card__fallback store-product__photo">{product.title}</div>
            )}
          </div>
          <div className="store-buy">
            {category && <p className="eyebrow">{category.name}</p>}
            <h1>{product.title}</h1>
            <p className="store-product__price">
              {variant?.pricePending && variant.priceCents == null
                ? 'Pricingâ€¦'
                : variant?.priceCents == null
                  ? 'Price unavailable'
                  : formatUsd(variant.priceCents)}
            </p>
            <p className="store-note">Print price before shipping and tax. Checkout confirms the price for your address.</p>
            <div className="store-options">
              {product.options.length > 0
                ? product.options.map((group) => (
                    <fieldset key={group.name}>
                      <legend>{group.name}</legend>
                      {group.values.length > 8 ? (
                        <select
                          value={selected[group.name] ?? ''}
                          onChange={(event) => chooseOption(group.name, event.target.value)}
                        >
                          {group.values.map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="store-pills">
                          {group.values.map((value) => (
                            <button
                              key={value}
                              type="button"
                              className={selected[group.name] === value ? 'is-selected' : ''}
                              onClick={() => chooseOption(group.name, value)}
                            >
                              {value}
                            </button>
                          ))}
                        </div>
                      )}
                    </fieldset>
                  ))
                : product.variants.length > 1 && (
                    <fieldset>
                      <legend>Option</legend>
                      <select value={variantId} onChange={(event) => setVariantId(event.target.value)}>
                        {product.variants.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.title}
                          </option>
                        ))}
                      </select>
                    </fieldset>
                  )}
            </div>
            {!variant && <p className="store-error">That combination is not available.</p>}
            <div className="store-buy__row">
              <label>
                Qty
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={quantity}
                  onChange={(event) => setQuantity(Math.min(20, Math.max(1, Number(event.target.value) || 1)))}
                />
              </label>
              <button
                type="button"
                className="btn btn--accent"
                disabled={!variant || variant.priceCents == null}
                onClick={addToCart}
              >
                Add to cart
              </button>
            </div>
            {added && (
              <p className="store-note">
                Added to cart. <Link to="/store/cart">View cart</Link>
              </p>
            )}
            <ul className="store-facts">
              <li>Printed to order</li>
              <li>Shipping quoted at checkout</li>
              <li>Tax calculated for your address</li>
            </ul>
          </div>
          {product.description && (
            <div className="store-copy store-product__copy" dangerouslySetInnerHTML={{ __html: product.description }} />
          )}
        </article>
      )}
    </div>
  )
}
