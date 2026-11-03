export type StripePaymentIntent = {
  id: string
  status: string
  amount: number
  currency: string
  metadata: Record<string, string>
}

function timingSafeEqual(a: string, b: string) {
  const enc = new TextEncoder()
  const aBytes = enc.encode(a)
  const bBytes = enc.encode(b)
  const len = Math.max(aBytes.length, bBytes.length)
  let diff = aBytes.length ^ bBytes.length
  for (let i = 0; i < len; i++) diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0)
  return diff === 0
}

async function stripeRequest(secretKey: string, path: string, params?: URLSearchParams, idempotencyKey?: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${secretKey}` }
  if (params) headers['Content-Type'] = 'application/x-www-form-urlencoded'
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: params ? 'POST' : 'GET',
    headers,
    body: params,
  })
  const data = (await res.json()) as {
    error?: { message?: string }
    [key: string]: unknown
  }
  if (!res.ok) {
    throw new Error(data.error?.message || `Stripe request failed (${res.status})`)
  }
  return data
}

export async function createTaxCalculation(
  secretKey: string,
  input: {
    address: {
      line1: string
      line2: string
      city: string
      state: string
      postalCode: string
      country: string
    }
    lines: { reference: string; amount: number }[]
    shippingCents: number
  },
) {
  const params = new URLSearchParams()
  params.set('currency', 'usd')
  params.set('customer_details[address][line1]', input.address.line1)
  if (input.address.line2) params.set('customer_details[address][line2]', input.address.line2)
  params.set('customer_details[address][city]', input.address.city)
  if (input.address.state) params.set('customer_details[address][state]', input.address.state)
  params.set('customer_details[address][postal_code]', input.address.postalCode)
  params.set('customer_details[address][country]', input.address.country)
  params.set('customer_details[address_source]', 'shipping')
  input.lines.forEach((line, index) => {
    params.set(`line_items[${index}][amount]`, String(line.amount))
    params.set(`line_items[${index}][quantity]`, '1')
    params.set(`line_items[${index}][reference]`, line.reference.slice(0, 100))
    params.set(`line_items[${index}][tax_code]`, 'txcd_99999999')
    params.set(`line_items[${index}][tax_behavior]`, 'exclusive')
  })
  params.set('shipping_cost[amount]', String(input.shippingCents))
  params.set('shipping_cost[tax_code]', 'txcd_92010001')
  params.set('shipping_cost[tax_behavior]', 'exclusive')
  const data = await stripeRequest(secretKey, '/tax/calculations', params)
  const amountTotal = data.amount_total
  const taxAmount = data.tax_amount_exclusive
  const id = data.id
  if (typeof amountTotal !== 'number' || typeof id !== 'string') {
    throw new Error('Stripe Tax did not return a calculation')
  }
  return {
    id,
    amountTotal,
    taxCents: typeof taxAmount === 'number' ? taxAmount : Math.max(0, amountTotal - input.lines.reduce((sum, line) => sum + line.amount, 0) - input.shippingCents),
  }
}

export async function createPaymentIntent(
  secretKey: string,
  input: {
    amount: number
    orderId: string
    email: string
    idempotencyKey: string
    address: {
      firstName: string
      lastName: string
      line1: string
      line2: string
      city: string
      state: string
      postalCode: string
      country: string
    }
  },
) {
  const params = new URLSearchParams()
  params.set('amount', String(input.amount))
  params.set('currency', 'usd')
  params.set('automatic_payment_methods[enabled]', 'true')
  params.set('receipt_email', input.email)
  params.set('description', `Adventures SW Florida ${input.orderId}`.slice(0, 200))
  params.set('metadata[orderId]', input.orderId)
  params.set('shipping[name]', `${input.address.firstName} ${input.address.lastName}`.slice(0, 200))
  params.set('shipping[address][line1]', input.address.line1)
  if (input.address.line2) params.set('shipping[address][line2]', input.address.line2)
  params.set('shipping[address][city]', input.address.city)
  if (input.address.state) params.set('shipping[address][state]', input.address.state)
  params.set('shipping[address][postal_code]', input.address.postalCode)
  params.set('shipping[address][country]', input.address.country)
  const data = await stripeRequest(secretKey, '/payment_intents', params, input.idempotencyKey)
  const id = data.id
  const clientSecret = data.client_secret
  if (typeof id !== 'string' || typeof clientSecret !== 'string') {
    throw new Error('Stripe did not return a payment')
  }
  return { id, clientSecret }
}

export async function cancelPaymentIntent(secretKey: string, id: string) {
  await stripeRequest(secretKey, `/payment_intents/${encodeURIComponent(id)}/cancel`, new URLSearchParams())
}

export async function refundPaymentIntent(secretKey: string, id: string) {
  const params = new URLSearchParams()
  params.set('payment_intent', id)
  await stripeRequest(secretKey, '/refunds', params, `refund-${id}`)
}

export async function getPaymentIntent(secretKey: string, id: string): Promise<StripePaymentIntent> {
  const data = await stripeRequest(secretKey, `/payment_intents/${encodeURIComponent(id)}`)
  const metadata = data.metadata
  return {
    id: String(data.id ?? id),
    status: String(data.status ?? ''),
    amount: typeof data.amount === 'number' ? data.amount : Number(data.amount),
    currency: String(data.currency ?? ''),
    metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? Object.fromEntries(Object.entries(metadata).map(([key, value]) => [key, String(value)]))
      : {},
  }
}

export async function createTaxTransaction(secretKey: string, calculationId: string, orderId: string) {
  const params = new URLSearchParams()
  params.set('calculation', calculationId)
  params.set('reference', orderId.slice(0, 100))
  await stripeRequest(secretKey, '/tax/transactions/create_from_calculation', params, `tax-${orderId}`)
}

export async function verifyStripeSignature(payload: string, header: string, secret: string) {
  const parts = header.split(',').map((part) => part.trim())
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2)
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3))
  if (!timestamp || !signatures.length) return false
  const age = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(age) || age > 300) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`))
  const expected = [...new Uint8Array(mac)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return signatures.some((signature) => signature.length === expected.length && timingSafeEqual(signature, expected))
}
