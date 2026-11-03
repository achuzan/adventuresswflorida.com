import { Link } from 'react-router-dom'
import { useCart } from '../data/CartProvider'
import { SeoHead } from '../seo'
import { site } from '../site'
import { formatUsd } from '../shared/store'

export function StoreCartPage() {
  const { items, setQuantity, removeItem } = useCart()
  const subtotal = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0)

  return (
    <div className="page page--store page--cart">
      <SeoHead
        title={`Cart · ${site.shortBrand}`}
        description="Your Adventures in Southwest Florida print cart."
        path="/store/cart"
        noindex
      />
      <header className="page-hero">
        <p className="eyebrow">Store</p>
        <h1>Cart</h1>
        {items.length > 0 && (
          <p>
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </p>
        )}
      </header>
      {items.length === 0 ? (
        <div className="store-cart__empty">
          <p>Your cart is empty.</p>
          <Link className="btn btn--accent" to="/store">
            Browse the store
          </Link>
        </div>
      ) : (
        <div className="store-cart">
          <ul className="store-cart__items">
            {items.map((item) => (
              <li key={`${item.productId}:${item.variantId}`}>
                {item.previewUrl ? <img src={item.previewUrl} alt="" /> : <span className="store-card__fallback" />}
                <div className="store-cart__body">
                  <div className="store-cart__top">
                    <div>
                      <strong>
                        <Link to={`/store/${item.productId}`}>{item.title}</Link>
                      </strong>
                      {item.variantTitle ? <p>{item.variantTitle}</p> : null}
                      <p>{formatUsd(item.unitPriceCents)} each</p>
                    </div>
                    <strong className="store-cart__line">{formatUsd(item.unitPriceCents * item.quantity)}</strong>
                  </div>
                  <div className="store-cart__qty">
                    <label>
                      Qty
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={item.quantity}
                        onChange={(event) =>
                          setQuantity(item.productId, item.variantId, Number(event.target.value) || 1)
                        }
                      />
                    </label>
                    <button type="button" onClick={() => removeItem(item.productId, item.variantId)}>
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <aside className="store-cart__summary">
            <h2>Summary</h2>
            <p className="store-cart__row">
              <span>Subtotal</span>
              <strong>{formatUsd(subtotal)}</strong>
            </p>
            <p className="store-note">Shipping and tax are calculated at checkout.</p>
            <Link className="btn btn--accent" to="/store/checkout">
              Checkout
            </Link>
            <Link className="text-link" to="/store">
              Continue shopping
            </Link>
          </aside>
        </div>
      )}
    </div>
  )
}
