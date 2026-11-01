import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useCart } from '../data/CartProvider'
import { storeJson } from '../data/store-client'
import { SeoHead } from '../seo'
import { site } from '../site'
import { deliveryLabel, formatUsd, type PublicOrder } from '../shared/store'

export function StoreOrderPage() {
  const { orderId = '' } = useParams()
  const [params] = useSearchParams()
  const paymentIntent = params.get('payment_intent') ?? ''
  const { clear } = useCart()
  const [order, setOrder] = useState<PublicOrder | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!paymentIntent) {
      setError('Open this page from checkout after payment.')
      return
    }
    let cancelled = false
    let timer = 0
    let attempts = 0

    async function tick() {
      try {
        const data = await storeJson<{ order: PublicOrder }>(
          `/api/store/orders/${encodeURIComponent(orderId)}/confirm`,
          {
            method: 'POST',
            body: JSON.stringify({ paymentIntentId: paymentIntent }),
          },
        )
        if (cancelled) return
        setOrder(data.order)
        if (data.order.printStatus !== 'payment_failed') clear()
        const done =
          data.order.printStatus === 'sent' ||
          data.order.printStatus === 'needs_attention' ||
          data.order.printStatus === 'payment_failed'
        if (!done && attempts < 8) {
          attempts += 1
          timer = window.setTimeout(() => void tick(), 2000)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not confirm the order')
      }
    }

    void tick()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [orderId, paymentIntent, clear])

  const headline =
    order?.printStatus === 'sent'
      ? 'Order sent to print'
      : order?.printStatus === 'needs_attention'
        ? 'Payment received'
        : order?.printStatus === 'payment_failed'
          ? 'Payment did not go through'
          : order
            ? 'Payment received'
            : 'Confirming payment'

  return (
    <div className="page page--narrow">
      <SeoHead
        title={`Order · ${site.shortBrand}`}
        description="Order confirmation for Adventures in Southwest Florida."
        path={`/store/order/${orderId}`}
        noindex
      />
      <header className="page-hero">
        <p className="eyebrow">Store</p>
        <h1>{headline}</h1>
      </header>
      {!order && !error && <p className="store-status">Confirming the payment and sending the order to Gelato…</p>}
      {error && <p className="store-error">{error}</p>}
      {order && (
        <>
          {order.printStatus === 'sending' && (
            <p>Your card payment succeeded. The print order is being sent to Gelato.</p>
          )}
          {order.printStatus === 'sent' && (
            <p>
              Gelato has the order and will email {order.email} when it ships
              {order.minDeliveryDays ? `, usually within ${deliveryLabel(order.minDeliveryDays, order.maxDeliveryDays)}` : ''}.
            </p>
          )}
          {order.printStatus === 'needs_attention' && (
            <p>
              Your payment succeeded. The print order still needs a moment on our side, and we’ll follow up at {order.email}.
            </p>
          )}
          {order.printStatus === 'payment_failed' && (
            <p>
              The payment was not completed. <Link to="/store/checkout">Return to checkout</Link>
            </p>
          )}
          <ul className="store-summary">
            {order.items.map((item, index) => (
              <li key={`${item.title}-${index}`}>
                <span>
                  {item.quantity}× {item.title}
                  {item.variantTitle ? ` (${item.variantTitle})` : ''}
                </span>
                <span>{formatUsd(item.linePriceCents)}</span>
              </li>
            ))}
            <li>
              <span>Prints</span>
              <span>{formatUsd(order.subtotalCents)}</span>
            </li>
            <li>
              <span>{order.shippingLabel}</span>
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
          <p className="store-note">
            Shipping to {order.city}, {order.country}. A Stripe receipt goes to {order.email}.
          </p>
        </>
      )}
      <p>
        <Link to="/store">Back to the store</Link>
      </p>
    </div>
  )
}
