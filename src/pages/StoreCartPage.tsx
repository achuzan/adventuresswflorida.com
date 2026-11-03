import { Link } from 'react-router-dom'
import { useCart } from '../data/CartProvider'
import { SeoHead } from '../seo'
import { site } from '../site'
import { formatUsd } from '../shared/store'

export function StoreCartPage() {
  const { items, setQuantity, removeItem } = useCart()
  const subtotal = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0)

  return (
    <div className="page page--narrow">
      <SeoHead
        title={`Cart · ${site.shortBrand}`}
        description="Your Adventures in Southwest Florida print cart."
        path="/store/cart"
        noindex
      />
      <header className="page-hero">
        <p className="eyebrow">Store</p>
        <h1>Cart</h1>
      </header>
      {items.length === 0 ? (
        <p className="store-status">
          Your cart is empty. <Link to="/store">Browse the store</Link>
        </p>
      ) : (
        <>
          <ul className="store-lines">
            {items.map((item) => (
              <li key={`${item.productId}:${item.variantId}`} className="store-line">
                {item.previewUrl ? <img src={item.previewUrl} alt="" /> : <span className="store-card__fallback" />}
                <div>
                  <strong>
                    <Link to={`/store/${item.productId}`}>{item.title}</Link>
                  </strong>
                  <p>{item.variantTitle}</p>
                  <p>{formatUsd(item.unitPriceCents)}</p>
                  <label>
                    Quantity
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
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => removeItem(item.productId, item.variantId)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="store-total">
            Subtotal <strong>{formatUsd(subtotal)}</strong>
          </p>
          <p className="store-note">Shipping and tax are calculated at checkout from Gelato and Stripe.</p>
          <Link className="btn btn--accent" to="/store/checkout">
            Checkout
          </Link>
        </>
      )}
    </div>
  )
}
