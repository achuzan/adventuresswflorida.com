/** Shared store types and price helpers used by the Worker and the React app. */

export type StoreOption = {
  name: string
  value: string
}

export type StoreOptionGroup = {
  name: string
  values: string[]
}

export type StoreVariantPublic = {
  id: string
  title: string
  options: StoreOption[]
  previewUrl: string
  priceCents: number | null
  pricePending: boolean
}

export type StoreProductPublic = {
  id: string
  title: string
  description: string
  previewUrl: string
  productType: string
  options: StoreOptionGroup[]
  images: string[]
  variants: StoreVariantPublic[]
  categoryIds: string[]
}

export type StoreGroupPublic = {
  id: string
  name: string
  description: string
  productIds: string[]
  image: string
  imageProductId: string
}

export type ShippingOptionPublic = {
  id: string
  label: string
  priceCents: number
  discountCents: number
  minDeliveryDays: number
  maxDeliveryDays: number
}

export type QuoteLinePublic = {
  productId: string
  variantId: string
  title: string
  variantTitle: string
  quantity: number
  unitPriceCents: number
  linePriceCents: number
}

export type QuoteResponse = {
  lines: QuoteLinePublic[]
  subtotalCents: number
  discountCents: number
  coupon: { code: string; percent: number } | null
  shipping: ShippingOptionPublic[]
}

export type PaymentPreview = {
  publishableKey: string
  subtotalCents: number
  shippingCents: number
  shippingLabel: string
  discountCents: number
  coupon: { code: string; percent: number } | null
  taxCents: number
  totalCents: number
  lines: QuoteLinePublic[]
  minDeliveryDays: number
  maxDeliveryDays: number
}

export type CheckoutResponse = PaymentPreview & {
  orderId: string
  paymentIntentId: string
  clientSecret: string
  requiresAction: boolean
  status: string
  detail?: string
}

export type PublicOrder = {
  id: string
  status: string
  printStatus: 'pending' | 'sending' | 'sent' | 'needs_attention' | 'payment_failed'
  email: string
  items: { title: string; variantTitle: string; quantity: number; linePriceCents: number }[]
  shippingLabel: string
  subtotalCents: number
  shippingCents: number
  discountCents: number
  couponCode: string
  taxCents: number
  totalCents: number
  minDeliveryDays: number
  maxDeliveryDays: number
  city: string
  country: string
  notice: '' | 'charged_not_placed' | 'refunded_unfinalized'
}

export type ShippingAddress = {
  firstName: string
  lastName: string
  line1: string
  line2: string
  city: string
  state: string
  postalCode: string
  country: string
  email: string
  phone: string
}

export const countries = [
  ['US', 'United States'],
  ['CA', 'Canada'],
  ['MX', 'Mexico'],
  ['GB', 'United Kingdom'],
  ['IE', 'Ireland'],
  ['FR', 'France'],
  ['DE', 'Germany'],
  ['ES', 'Spain'],
  ['IT', 'Italy'],
  ['PT', 'Portugal'],
  ['NL', 'Netherlands'],
  ['BE', 'Belgium'],
  ['LU', 'Luxembourg'],
  ['AT', 'Austria'],
  ['CH', 'Switzerland'],
  ['SE', 'Sweden'],
  ['NO', 'Norway'],
  ['DK', 'Denmark'],
  ['FI', 'Finland'],
  ['PL', 'Poland'],
  ['CZ', 'Czechia'],
  ['AU', 'Australia'],
  ['NZ', 'New Zealand'],
  ['JP', 'Japan'],
  ['SG', 'Singapore'],
  ['HK', 'Hong Kong'],
  ['KR', 'South Korea'],
] as const

export const usStates = [
  ['AL', 'Alabama'],
  ['AK', 'Alaska'],
  ['AZ', 'Arizona'],
  ['AR', 'Arkansas'],
  ['CA', 'California'],
  ['CO', 'Colorado'],
  ['CT', 'Connecticut'],
  ['DE', 'Delaware'],
  ['DC', 'District of Columbia'],
  ['FL', 'Florida'],
  ['GA', 'Georgia'],
  ['HI', 'Hawaii'],
  ['ID', 'Idaho'],
  ['IL', 'Illinois'],
  ['IN', 'Indiana'],
  ['IA', 'Iowa'],
  ['KS', 'Kansas'],
  ['KY', 'Kentucky'],
  ['LA', 'Louisiana'],
  ['ME', 'Maine'],
  ['MD', 'Maryland'],
  ['MA', 'Massachusetts'],
  ['MI', 'Michigan'],
  ['MN', 'Minnesota'],
  ['MS', 'Mississippi'],
  ['MO', 'Missouri'],
  ['MT', 'Montana'],
  ['NE', 'Nebraska'],
  ['NV', 'Nevada'],
  ['NH', 'New Hampshire'],
  ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'],
  ['NY', 'New York'],
  ['NC', 'North Carolina'],
  ['ND', 'North Dakota'],
  ['OH', 'Ohio'],
  ['OK', 'Oklahoma'],
  ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'],
  ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'],
  ['SD', 'South Dakota'],
  ['TN', 'Tennessee'],
  ['TX', 'Texas'],
  ['UT', 'Utah'],
  ['VT', 'Vermont'],
  ['VA', 'Virginia'],
  ['WA', 'Washington'],
  ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'],
  ['WY', 'Wyoming'],
] as const

const STATE_REQUIRED = new Set(['US', 'CA', 'AU'])

export function formatUsd(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export function deliveryLabel(min: number, max: number) {
  const lo = Math.max(0, Math.round(min))
  const hi = Math.max(lo, Math.round(max))
  if (lo === hi) return lo === 1 ? '1 day' : `${lo} days`
  return `${lo}–${hi} days`
}

export function toCents(major: number) {
  return Math.round(major * 100)
}

export function withMarkup(wholesaleCents: number, percent: number) {
  return Math.max(0, Math.round(wholesaleCents * (1 + percent / 100)))
}

/** Customer price is the retail price set in Printful. The site does not add a markup. */
export function sellingUnitCents(
  wholesaleCents: number | null,
  printfulRetailCents: number | null | undefined,
) {
  if (printfulRetailCents != null && printfulRetailCents > 0) return printfulRetailCents
  return wholesaleCents
}

export function normalizeCouponCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

export function isCouponCode(code: string) {
  return /^[A-Z0-9][A-Z0-9-]{2,23}$/.test(code)
}

/** Amount of store markup removed. The result never exceeds the markup, so the price stays at or above the print cost. */
export function markupDiscountCents(wholesaleCents: number, retailCents: number, percent: number) {
  const markup = Math.max(0, retailCents - wholesaleCents)
  const portion = Math.min(100, Math.max(0, percent))
  return Math.min(markup, Math.round((markup * portion) / 100))
}

export function variantForSelection<T extends { options: StoreOption[] }>(
  variants: T[],
  selected: Record<string, string>,
) {
  return variants.find(
    (variant) =>
      variant.options.length > 0 &&
      variant.options.every((option) => selected[option.name] === option.value),
  )
}

export function fromPriceCents(variants: { priceCents: number | null }[]) {
  const prices = variants.flatMap((variant) =>
    variant.priceCents == null ? [] : [variant.priceCents],
  )
  if (!prices.length) return null
  return Math.min(...prices)
}

export function validateAddress(
  input: unknown,
): { ok: true; address: ShippingAddress } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Enter a shipping address' }
  const raw = input as Record<string, unknown>
  const text = (value: unknown) =>
    typeof value === 'string' ? value.replace(/[\r\n]+/g, ' ').trim() : ''

  const firstName = text(raw.firstName)
  const lastName = text(raw.lastName)
  const line1 = text(raw.line1)
  const line2 = text(raw.line2)
  const city = text(raw.city)
  const state = text(raw.state).toUpperCase()
  const postalCode = text(raw.postalCode)
  const country = text(raw.country).toUpperCase()
  const email = text(raw.email)
  const phone = text(raw.phone)

  if (!firstName || firstName.length > 25) {
    return { ok: false, error: 'First name is required and must be 25 characters or fewer' }
  }
  if (!lastName || lastName.length > 25) {
    return { ok: false, error: 'Last name is required and must be 25 characters or fewer' }
  }
  if (!line1 || line1.length > 35) {
    return { ok: false, error: 'Address line 1 is required and must be 35 characters or fewer' }
  }
  if (line2.length > 35) {
    return { ok: false, error: 'Address line 2 must be 35 characters or fewer' }
  }
  if (!city || city.length > 30) {
    return { ok: false, error: 'City is required and must be 30 characters or fewer' }
  }
  if (!countries.some(([code]) => code === country)) {
    return { ok: false, error: 'Choose a country this store ships to' }
  }
  if (STATE_REQUIRED.has(country) && !state) {
    return { ok: false, error: 'State or province is required for that country' }
  }
  if (country === 'US' && !usStates.some(([code]) => code === state)) {
    return { ok: false, error: 'Choose a US state' }
  }
  if (state.length > 35) return { ok: false, error: 'State must be 35 characters or fewer' }
  if (!postalCode || postalCode.length > 15) {
    return { ok: false, error: 'Postal code is required and must be 15 characters or fewer' }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 80) {
    return { ok: false, error: 'Enter a valid email address' }
  }
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7 || phone.length > 25) {
    return { ok: false, error: 'Enter a phone number the carrier can use (25 characters or fewer)' }
  }

  return {
    ok: true,
    address: { firstName, lastName, line1, line2, city, state, postalCode, country, email, phone },
  }
}

export function sanitizeHtml(input: string) {
  return input
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?\s*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const match = /\ssrc\s*=\s*("([^"]*)"|'([^']*)')/i.exec(tag)
      const url = match?.[2] || match?.[3] || ''
      if (!url.startsWith('https://')) return ''
      return `<img src="${url.replace(/"/g, '&quot;')}" alt="" />`
    })
}
