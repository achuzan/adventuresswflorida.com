import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { useCart } from '../data/CartProvider'
import { storeJson } from '../data/store-client'
import { SeoHead } from '../seo'
import { site } from '../site'
import {
  countries,
  formatUsd,
  usStates,
  validateAddress,
  type CheckoutResponse,
  type QuoteResponse,
  type ShippingAddress,
} from '../shared/store'

const stripeCache = new Map<string, Promise<Stripe | null>>()

function stripeFor(key: string) {
  let promise = stripeCache.get(key)
  if (!promise) {
    promise = loadStripe(key)
    stripeCache.set(key, promise)
  }
  return promise
}

const emptyAddress: ShippingAddress = {
  firstName: '',
  lastName: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'US',
  email: '',
  phone: '',
}

const appearance = {
  theme: 'stripe' as const,
  variables: {
    colorPrimary: '#1e4d45',
    colorText: '#221912',
    colorDanger: '#8a1f1f',
    fontFamily: 'Manrope, Segoe UI, sans-serif',
    borderRadius: '12px',
  },
}

function cartLines(items: { productId: string; variantId: string; quantity: number }[]) {
  return items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    quantity: item.quantity,
  }))
}

export function StoreCheckoutPage() {
  const { items } = useCart()
  const [address, setAddress] = useState<ShippingAddress>(emptyAddress)
  const [quote, setQuote] = useState<QuoteResponse | null>(null)
  const [shippingOptionId, setShippingOptionId] = useState('')
  const [coupon, setCoupon] = useState('')
  const [payment, setPayment] = useState<CheckoutResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function updateAddress(patch: Partial<ShippingAddress>) {
    setAddress((current) => ({ ...current, ...patch }))
    setQuote(null)
    setPayment(null)
    setShippingOptionId('')
  }

  async function calculateShipping(event: FormEvent) {
    event.preventDefault()
    const checked = validateAddress(address)
    if (!checked.ok) {
      setError(checked.error)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const data = await storeJson<QuoteResponse>('/api/store/quote', {
        method: 'POST',
        body: JSON.stringify({ lines: cartLines(items), address: checked.address, coupon }),
      })
      setAddress(checked.address)
      setQuote(data)
      setShippingOptionId(data.shipping[0]?.id ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not quote shipping')
    } finally {
      setBusy(false)
    }
  }

  async function continueToPayment(event: FormEvent) {
    event.preventDefault()
    if (!shippingOptionId) {
      setError('Choose a shipping method')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const data = await storeJson<CheckoutResponse>('/api/store/checkout', {
        method: 'POST',
        body: JSON.stringify({
          lines: cartLines(items),
          address,
          shippingOptionId,
          coupon,
        }),
      })
      setPayment(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start payment')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page page--narrow">
      <SeoHead
        title={`Checkout · ${site.shortBrand}`}
        description="Checkout for Adventures in Southwest Florida prints."
        path="/store/checkout"
        noindex
      />
      <header className="page-hero">
        <p className="eyebrow">Store</p>
        <h1>Checkout</h1>
        <p>Shipping comes from Gelato. Tax comes from Stripe. Card details stay with Stripe and are not stored here.</p>
      </header>

      {items.length === 0 && !payment ? (
        <p className="store-status">
          Your cart is empty. <Link to="/store">Browse the store</Link>
        </p>
      ) : payment ? (
        <Elements stripe={stripeFor(payment.publishableKey)} options={{ clientSecret: payment.clientSecret, appearance }}>
          <PayStep
            payment={payment}
            onEdit={() => {
              setPayment(null)
              setQuote(null)
            }}
          />
        </Elements>
      ) : (
        <form className="store-form" onSubmit={(event) => void (quote ? continueToPayment(event) : calculateShipping(event))}>
          <div className="store-form__grid">
            <label>
              First name
              <input maxLength={25} autoComplete="given-name" value={address.firstName} onChange={(event) => updateAddress({ firstName: event.target.value })} required />
            </label>
            <label>
              Last name
              <input maxLength={25} autoComplete="family-name" value={address.lastName} onChange={(event) => updateAddress({ lastName: event.target.value })} required />
            </label>
            <label className="store-span-2">
              Email
              <input type="email" autoComplete="email" maxLength={80} value={address.email} onChange={(event) => updateAddress({ email: event.target.value })} required />
            </label>
            <label className="store-span-2">
              Phone
              <input type="tel" autoComplete="tel" maxLength={25} value={address.phone} onChange={(event) => updateAddress({ phone: event.target.value })} required />
            </label>
            <label className="store-span-2">
              Address
              <input maxLength={35} autoComplete="address-line1" value={address.line1} onChange={(event) => updateAddress({ line1: event.target.value })} required />
            </label>
            <label className="store-span-2">
              Apartment, suite (optional)
              <input maxLength={35} autoComplete="address-line2" value={address.line2} onChange={(event) => updateAddress({ line2: event.target.value })} />
            </label>
            <label>
              City
              <input maxLength={30} autoComplete="address-level2" value={address.city} onChange={(event) => updateAddress({ city: event.target.value })} required />
            </label>
            <label>
              {address.country === 'US' ? 'State' : 'State / province'}
              {address.country === 'US' ? (
                <select autoComplete="address-level1" value={address.state} onChange={(event) => updateAddress({ state: event.target.value })} required>
                  <option value="">Choose</option>
                  {usStates.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              ) : (
                <input maxLength={35} autoComplete="address-level1" value={address.state} onChange={(event) => updateAddress({ state: event.target.value })} required={address.country === 'CA' || address.country === 'AU'} />
              )}
            </label>
            <label>
              Postal code
              <input maxLength={15} autoComplete="postal-code" value={address.postalCode} onChange={(event) => updateAddress({ postalCode: event.target.value })} required />
            </label>
            <label>
              Country
              <select autoComplete="country" value={address.country} onChange={(event) => updateAddress({ country: event.target.value, state: '' })}>
                {countries.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Coupon code (optional)
            <input
              value={coupon}
              autoComplete="off"
              maxLength={24}
              onChange={(event) => {
                setCoupon(event.target.value)
                setQuote(null)
                setPayment(null)
                setShippingOptionId('')
              }}
            />
          </label>

          {quote && (
            <fieldset className="store-shipping">
              <legend>Shipping</legend>
              {quote.shipping.length === 0 && <p>No shipping methods were returned for that address.</p>}
              {quote.shipping.map((option) => (
                <label key={option.id} className="store-ship">
                  <input
                    type="radio"
                    name="shipping"
                    value={option.id}
                    checked={shippingOptionId === option.id}
                    onChange={() => setShippingOptionId(option.id)}
                  />
                  <span>
                    {option.label}
                    <strong>{formatUsd(option.priceCents)}</strong>
                  </span>
                </label>
              ))}
              <ul className="store-summary">
                {quote.lines.map((line) => (
                  <li key={`${line.productId}:${line.variantId}`}>
                    <span>
                      {line.quantity}× {line.title}
                      {line.variantTitle ? ` (${line.variantTitle})` : ''}
                    </span>
                    <span>{formatUsd(line.linePriceCents)}</span>
                  </li>
                ))}
                <li>
                  <span>Prints</span>
                  <span>{formatUsd(quote.subtotalCents)}</span>
                </li>
                {quote.coupon && (
                  <li>
                    <span>
                      Coupon {quote.coupon.code} ({quote.coupon.percent}% of the markup)
                    </span>
                    <span>
                      {formatUsd(
                        -(quote.discountCents +
                          (quote.shipping.find((option) => option.id === shippingOptionId)?.discountCents ?? 0)),
                      )}
                    </span>
                  </li>
                )}
              </ul>
            </fieldset>
          )}

          {error && <p className="store-error">{error}</p>}
          <button className="btn btn--accent" type="submit" disabled={busy || items.length === 0}>
            {busy ? 'Contacting Gelato…' : quote ? 'Continue to payment' : 'Calculate shipping'}
          </button>
        </form>
      )}
    </div>
  )
}

function PayStep({ payment, onEdit }: { payment: CheckoutResponse; onEdit: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function pay(event: FormEvent) {
    event.preventDefault()
    if (!stripe || !elements) return
    setBusy(true)
    setError(null)
    const result = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: {
        return_url: `${window.location.origin}/store/order/${payment.orderId}`,
      },
    })
    if (result.error) {
      setError(result.error.message || 'Payment failed')
      setBusy(false)
      return
    }
    if (result.paymentIntent?.status === 'succeeded' || result.paymentIntent?.status === 'processing') {
      window.location.assign(
        `/store/order/${payment.orderId}?payment_intent=${result.paymentIntent.id}`,
      )
      return
    }
    setError('Payment was not completed')
    setBusy(false)
  }

  return (
    <form className="store-form" onSubmit={(event) => void pay(event)}>
      <ul className="store-summary">
        {payment.lines.map((line) => (
          <li key={`${line.productId}:${line.variantId}`}>
            <span>
              {line.quantity}× {line.title}
            </span>
            <span>{formatUsd(line.linePriceCents)}</span>
          </li>
        ))}
        <li>
          <span>Prints</span>
          <span>{formatUsd(payment.subtotalCents)}</span>
        </li>
        <li>
          <span>{payment.shippingLabel}</span>
          <span>{formatUsd(payment.shippingCents)}</span>
        </li>
        {payment.coupon && (
          <li>
            <span>
              Coupon {payment.coupon.code} ({payment.coupon.percent}% of the markup)
            </span>
            <span>{formatUsd(-payment.discountCents)}</span>
          </li>
        )}
        <li>
          <span>Tax</span>
          <span>{formatUsd(payment.taxCents)}</span>
        </li>
        <li>
          <span>Total</span>
          <strong>{formatUsd(payment.totalCents)}</strong>
        </li>
      </ul>
      <PaymentElement />
      {error && <p className="store-error">{error}</p>}
      <div className="store-actions">
        <button className="btn btn--accent" type="submit" disabled={!stripe || busy}>
          {busy ? 'Paying…' : `Pay ${formatUsd(payment.totalCents)}`}
        </button>
        <button type="button" className="text-link" onClick={onEdit}>
          Edit address
        </button>
      </div>
    </form>
  )
}
