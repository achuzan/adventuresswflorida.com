import { useRef, useState, type FormEvent } from 'react'
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
  type PaymentPreview,
  type PublicOrder,
  type QuoteLinePublic,
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
  const [preview, setPreview] = useState<PaymentPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function updateAddress(patch: Partial<ShippingAddress>) {
    setAddress((current) => ({ ...current, ...patch }))
    setQuote(null)
    setPreview(null)
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
      const data = await storeJson<PaymentPreview>('/api/store/review', {
        method: 'POST',
        body: JSON.stringify({
          lines: cartLines(items),
          address,
          shippingOptionId,
          coupon,
        }),
      })
      setPreview(data)
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
        <p>Review the total, then place the order. The card is charged only after the print order is accepted.</p>
      </header>

      {items.length === 0 && !preview ? (
        <p className="store-status">
          Your cart is empty. <Link to="/store">Browse the store</Link>
        </p>
      ) : preview ? (
        <Elements
          stripe={stripeFor(preview.publishableKey)}
          options={{
            mode: 'payment',
            amount: preview.totalCents,
            currency: 'usd',
            captureMethod: 'manual',
            appearance,
          }}
        >
          <PayStep
            preview={preview}
            lines={cartLines(items)}
            address={address}
            shippingOptionId={shippingOptionId}
            coupon={coupon}
            onEdit={() => {
              setPreview(null)
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
                setPreview(null)
                setShippingOptionId('')
              }}
            />
          </label>

          {quote && (
            <>
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
                    <span>{option.label}</span>
                    <strong>{formatUsd(option.priceCents)}</strong>
                  </label>
                ))}
              </fieldset>
              <ul className="store-summary">
                {quote.lines.map((line) => (
                  <SummaryLine key={`${line.productId}:${line.variantId}`} line={line} />
                ))}
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
            </>
          )}

          {error && <p className="store-error">{error}</p>}
          <button className="btn btn--accent" type="submit" disabled={busy || items.length === 0}>
            {busy ? 'Contacting Printful…' : quote ? 'Continue to payment' : 'Calculate shipping'}
          </button>
        </form>
      )}
    </div>
  )
}

function SummaryLine({ line }: { line: QuoteLinePublic }) {
  return (
    <li>
      <span>
        {line.quantity}× {line.title}
        {line.variantTitle ? <small>{line.variantTitle}</small> : null}
      </span>
      <span>{formatUsd(line.linePriceCents)}</span>
    </li>
  )
}

function PayStep({
  preview,
  lines,
  address,
  shippingOptionId,
  coupon,
  onEdit,
}: {
  preview: PaymentPreview
  lines: { productId: string; variantId: string; quantity: number }[]
  address: ShippingAddress
  shippingOptionId: string
  coupon: string
  onEdit: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const placing = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function placeOrder(event: FormEvent) {
    event.preventDefault()
    if (!stripe || !elements || placing.current) return
    placing.current = true
    setBusy(true)
    setError(null)
    const submitted = await elements.submit()
    if (submitted.error) {
      setError(submitted.error.message || 'Check the payment details')
      placing.current = false
      setBusy(false)
      return
    }

    const stripeActions = stripe as Stripe & {
      createConfirmationToken?: (options: { elements: NonNullable<typeof elements> }) => Promise<{
        error?: { message?: string }
        confirmationToken?: { id: string }
      }>
      handleNextAction?: (options: { clientSecret: string }) => Promise<{
        error?: { message?: string }
        paymentIntent?: { id: string; status: string }
      }>
    }
    let confirmationToken = ''
    let paymentMethodId = ''
    if (stripeActions.createConfirmationToken) {
      const created = await stripeActions.createConfirmationToken({ elements })
      if (created.error || !created.confirmationToken) {
        setError(created.error?.message || 'The card was not charged and the order was not placed.')
        placing.current = false
        setBusy(false)
        return
      }
      confirmationToken = created.confirmationToken.id
    } else {
      const created = await stripe.createPaymentMethod({ elements })
      if (created.error || !created.paymentMethod) {
        setError(created.error?.message || 'The card was not charged and the order was not placed.')
        placing.current = false
        setBusy(false)
        return
      }
      paymentMethodId = created.paymentMethod.id
    }

    try {
      const data = await storeJson<CheckoutResponse>('/api/store/checkout', {
        method: 'POST',
        body: JSON.stringify({
          lines,
          address,
          shippingOptionId,
          coupon,
          totalCents: preview.totalCents,
          confirmationToken,
          paymentMethodId,
        }),
      })
      let paymentIntentId = data.paymentIntentId
      let settled = data.status === 'fulfilled' || data.status === 'paid'
      if (data.requiresAction) {
        const next = stripeActions.handleNextAction
          ? await stripeActions.handleNextAction({ clientSecret: data.clientSecret })
          : await stripe.confirmCardPayment(data.clientSecret)
        if (next.error || next.paymentIntent?.status !== 'requires_capture' || !next.paymentIntent.id) {
          setError('The bank did not authorize the card. The order was not placed and the card was not charged.')
          placing.current = false
          setBusy(false)
          return
        }
        paymentIntentId = next.paymentIntent.id
        const finalized = await storeJson<{ order: PublicOrder }>(
          `/api/store/orders/${encodeURIComponent(data.orderId)}/finalize`,
          { method: 'POST', body: JSON.stringify({ paymentIntentId }) },
        )
        settled = finalized.order.printStatus === 'sent' || finalized.order.printStatus === 'sending'
        if (!settled) {
          setError(
            finalized.order.notice === 'refunded_unfinalized'
              ? 'The order was not placed. If a charge appeared, it has been refunded.'
              : 'The order was not placed and the card was not charged.',
          )
          placing.current = false
          setBusy(false)
          return
        }
      }
      if (!settled) {
        setError(
          data.detail ||
            (data.status === 'fulfillment_failed'
              ? 'The print order was accepted, but the card was not charged.'
              : 'The order was not placed and the card was not charged.'),
        )
        placing.current = false
        setBusy(false)
        return
      }
      window.location.assign(`/store/order/${data.orderId}?payment_intent=${paymentIntentId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The order was not placed and the card was not charged.')
      placing.current = false
      setBusy(false)
    }
  }

  return (
    <form className="store-form" onSubmit={(event) => void placeOrder(event)}>
      <ul className="store-summary">
        {preview.lines.map((line) => (
          <SummaryLine key={`${line.productId}:${line.variantId}`} line={line} />
        ))}
        <li>
          <span>{preview.shippingLabel}</span>
          <span>{formatUsd(preview.shippingCents)}</span>
        </li>
        {preview.coupon && (
          <li>
            <span>
              Coupon {preview.coupon.code} ({preview.coupon.percent}% of the markup)
            </span>
            <span>{formatUsd(-preview.discountCents)}</span>
          </li>
        )}
        <li>
          <span>Tax</span>
          <span>{formatUsd(preview.taxCents)}</span>
        </li>
        <li>
          <span>Total</span>
          <strong>{formatUsd(preview.totalCents)}</strong>
        </li>
      </ul>
      <PaymentElement />
      {error && <p className="store-error">{error}</p>}
      <div className="store-actions">
        <button className="btn btn--accent" type="submit" disabled={!stripe || !elements || busy}>
          {busy ? 'Placing order…' : `Place order · ${formatUsd(preview.totalCents)}`}
        </button>
        <button type="button" className="text-link" onClick={onEdit} disabled={busy}>
          Edit address
        </button>
      </div>
      <p className="store-note">Nothing is charged until you place the order. If the print order is not accepted, the card is not charged.</p>
    </form>
  )
}
