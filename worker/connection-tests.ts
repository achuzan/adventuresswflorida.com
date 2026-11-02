import { asArray, GelatoError, gelatoRequest } from './gelato'
import type { StoreSettings } from './store-data'

export type ConnectionCheck = {
  id: 'gelato' | 'gelato-store' | 'stripe' | 'stripe-publishable' | 'stripe-webhook'
  name: string
  status: 'ok' | 'warn' | 'fail'
  detail: string
}

type StripeCall = {
  status: number
  message: string
  data: Record<string, unknown> | null
}

function keyMode(key: string) {
  if (key.startsWith('sk_live_') || key.startsWith('rk_live_') || key.startsWith('pk_live_')) return 'live'
  if (key.startsWith('sk_test_') || key.startsWith('rk_test_') || key.startsWith('pk_test_')) return 'test'
  return ''
}

function scrub(message: string) {
  return message.replace(/\b(?:sk|pk|rk|whsec)_[A-Za-z0-9]+\b/g, '[key]').slice(0, 280)
}

function check(id: ConnectionCheck['id'], name: string, status: ConnectionCheck['status'], detail: string): ConnectionCheck {
  return { id, name, status, detail: scrub(detail) }
}

async function stripeCall(key: string, path: string): Promise<StripeCall> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  })
  const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
  const record = data && typeof data === 'object' ? (data as Record<string, unknown>) : null
  return {
    status: res.status,
    message: data?.error?.message || `Stripe request failed (${res.status})`,
    data: record,
  }
}

async function testGelatoKey(apiKey: string | undefined): Promise<ConnectionCheck> {
  if (!apiKey) return check('gelato', 'Gelato', 'fail', 'Missing GELATO_API_KEY.')
  try {
    await gelatoRequest(apiKey, 'https://order.gelatoapis.com/v4/orders:search', {
      method: 'POST',
      body: JSON.stringify({ orderReferenceIds: ['connection-test-none'], limit: 1 }),
    })
    return check('gelato', 'Gelato', 'ok', 'Gelato accepted the API key.')
  } catch (error) {
    if (error instanceof GelatoError && (error.status === 401 || error.status === 403)) {
      return check('gelato', 'Gelato', 'fail', 'Gelato rejected the API key.')
    }
    const message = error instanceof Error ? error.message : 'Gelato did not respond.'
    return check('gelato', 'Gelato', 'fail', message)
  }
}

async function testGelatoStore(apiKey: string | undefined, storeIds: string[], templateIds: string[]): Promise<ConnectionCheck> {
  if (!apiKey) return check('gelato-store', 'Gelato store', 'fail', 'Gelato cannot be checked until GELATO_API_KEY is set.')
  if (!storeIds.length && !templateIds.length) {
    return check(
      'gelato-store',
      'Gelato store',
      'fail',
      'No store id is saved. Open the Manual store in Gelato and paste the id from the address bar.',
    )
  }
  const notes: string[] = []
  let failed = false
  for (const storeId of storeIds) {
    const label = `${storeId.slice(0, 8)}…`
    try {
      const data = await gelatoRequest<unknown>(
        apiKey,
        `https://ecommerce.gelatoapis.com/v1/stores/${encodeURIComponent(storeId)}/products?order=desc&orderBy=createdAt&offset=0&limit=1`,
      )
      const count = asArray(data, ['products', 'data']).length
      notes.push(
        count
          ? `Store ${label} responded and has products.`
          : `Store ${label} responded, and it has no products yet.`,
      )
    } catch (error) {
      failed = true
      if (error instanceof GelatoError && error.status === 404) {
        notes.push(`Gelato has no store ${label}. Copy the id from the Manual store address bar.`)
      } else if (error instanceof GelatoError && (error.status === 401 || error.status === 403)) {
        notes.push(`Gelato refused access to store ${label}.`)
      } else {
        notes.push(error instanceof Error ? error.message : `Store ${label} could not be checked.`)
      }
    }
  }
  let templatesOk = 0
  for (const templateId of templateIds.slice(0, 5)) {
    try {
      await gelatoRequest(apiKey, `https://ecommerce.gelatoapis.com/v1/templates/${encodeURIComponent(templateId)}`)
      templatesOk += 1
    } catch {
      failed = true
    }
  }
  if (templateIds.length) {
    const shown = Math.min(templateIds.length, 5)
    notes.push(`${templatesOk} of ${shown} template id${shown === 1 ? '' : 's'} loaded.`)
  }
  return check('gelato-store', 'Gelato store', failed ? 'fail' : 'ok', notes.join(' '))
}

async function testStripeSecret(secretKey: string | undefined): Promise<ConnectionCheck> {
  if (!secretKey) return check('stripe', 'Stripe', 'fail', 'Missing STRIPE_SECRET_KEY.')
  const mode = keyMode(secretKey)
  if (!mode) {
    return check('stripe', 'Stripe', 'fail', 'STRIPE_SECRET_KEY should start with rk_live_, rk_test_, sk_live_, or sk_test_.')
  }
  try {
    const payments = await stripeCall(secretKey, '/payment_intents?limit=1')
    if (payments.status === 401) return check('stripe', 'Stripe', 'fail', 'Stripe rejected the secret key.')
    if (payments.status === 403) {
      return check(
        'stripe',
        'Stripe',
        'fail',
        `Stripe recognized the ${mode} key, but it cannot read Payment Intents. Edit the restricted key and allow Payment Intents read and write.`,
      )
    }
    if (payments.status !== 200) return check('stripe', 'Stripe', 'fail', payments.message)
    const tax = await stripeCall(secretKey, '/tax/settings')
    const taxStatus = typeof tax.data?.status === 'string' ? tax.data.status : ''
    if (tax.status === 200 && taxStatus === 'active') {
      return check('stripe', 'Stripe', 'ok', `Stripe accepted the secret key (${mode} mode), and Stripe Tax is active.`)
    }
    if (tax.status === 403) {
      return check(
        'stripe',
        'Stripe',
        'warn',
        `Stripe accepted the secret key (${mode} mode). Allow Tax calculations and transactions write, and Tax settings read, on that restricted key.`,
      )
    }
    return check(
      'stripe',
      'Stripe',
      'warn',
      `Stripe accepted the secret key (${mode} mode). Stripe Tax is not active, so checkout cannot add tax until it is turned on in the Stripe Dashboard.`,
    )
  } catch (error) {
    return check('stripe', 'Stripe', 'fail', error instanceof Error ? error.message : 'Stripe did not respond.')
  }
}

async function testPublishable(secretKey: string | undefined, publishableKey: string | undefined): Promise<ConnectionCheck> {
  const key = publishableKey?.trim() ?? ''
  if (!key) return check('stripe-publishable', 'Stripe publishable key', 'fail', 'Missing STRIPE_PUBLISHABLE_KEY.')
  const mode = keyMode(key)
  if (!mode || !key.startsWith('pk_')) {
    return check('stripe-publishable', 'Stripe publishable key', 'fail', 'Use the publishable key that starts with pk_.')
  }
  const secretMode = secretKey ? keyMode(secretKey) : ''
  if (secretMode && secretMode !== mode) {
    return check(
      'stripe-publishable',
      'Stripe publishable key',
      'fail',
      `The publishable key is ${mode} mode and the secret key is ${secretMode} mode. They need to be the same mode.`,
    )
  }
  try {
    const probe = await stripeCall(key, '/account')
    if (probe.status === 200) {
      return check('stripe-publishable', 'Stripe publishable key', 'fail', 'That value is a secret key. Paste the key that starts with pk_.')
    }
    if (probe.status === 401) return check('stripe-publishable', 'Stripe publishable key', 'fail', 'Stripe rejected the publishable key.')
    if (probe.status === 403 || /publishable/i.test(probe.message)) {
      return check('stripe-publishable', 'Stripe publishable key', 'ok', `Stripe recognized the publishable key (${mode} mode).`)
    }
    return check('stripe-publishable', 'Stripe publishable key', 'fail', probe.message)
  } catch (error) {
    return check('stripe-publishable', 'Stripe publishable key', 'fail', error instanceof Error ? error.message : 'Stripe did not respond.')
  }
}

async function testWebhook(secretKey: string | undefined, webhookSecret: string | undefined): Promise<ConnectionCheck> {
  const saved = Boolean(webhookSecret?.trim())
  if (saved && !webhookSecret!.trim().startsWith('whsec_')) {
    return check('stripe-webhook', 'Stripe webhook', 'fail', 'STRIPE_WEBHOOK_SECRET should start with whsec_.')
  }
  if (!secretKey || !keyMode(secretKey)) {
    return check(
      'stripe-webhook',
      'Stripe webhook',
      'warn',
      saved
        ? 'The signing secret is saved. Stripe could not be asked about the endpoint because the secret key is missing.'
        : 'STRIPE_WEBHOOK_SECRET is not set. Checkout still finishes when the customer reaches the order page.',
    )
  }
  try {
    const listed = await stripeCall(secretKey, '/webhook_endpoints?limit=100')
    if (listed.status === 403) {
      return check(
        'stripe-webhook',
        'Stripe webhook',
        'warn',
        saved
          ? 'The signing secret is saved. Allow Webhook endpoints read on the restricted key to confirm the endpoint from here.'
          : 'STRIPE_WEBHOOK_SECRET is not set. Checkout still finishes from the order page.',
      )
    }
    if (listed.status !== 200) {
      return check('stripe-webhook', 'Stripe webhook', 'fail', listed.message)
    }
    const endpoints = Array.isArray(listed.data?.data) ? listed.data.data : []
    const matches = endpoints.flatMap((row) => {
      if (!row || typeof row !== 'object') return []
      const endpoint = row as { url?: unknown; status?: unknown; enabled_events?: unknown }
      const url = typeof endpoint.url === 'string' ? endpoint.url : ''
      if (!url.includes('/api/stripe/webhook')) return []
      const events = Array.isArray(endpoint.enabled_events) ? endpoint.enabled_events.map(String) : []
      const listens =
        events.includes('*') ||
        (events.includes('payment_intent.succeeded') && events.includes('payment_intent.payment_failed'))
      return [{ url, enabled: endpoint.status === 'enabled', listens }]
    })
    const ready = matches.find((endpoint) => endpoint.enabled && endpoint.listens)
    if (ready && saved) {
      return check(
        'stripe-webhook',
        'Stripe webhook',
        'ok',
        'Stripe has an enabled webhook for /api/stripe/webhook with the payment events, and the signing secret is saved.',
      )
    }
    if (ready && !saved) {
      return check(
        'stripe-webhook',
        'Stripe webhook',
        'warn',
        'Stripe has the webhook endpoint, but STRIPE_WEBHOOK_SECRET is not set, so this site will ask Stripe to retry.',
      )
    }
    if (matches.length && saved) {
      return check(
        'stripe-webhook',
        'Stripe webhook',
        'fail',
        'A webhook points at /api/stripe/webhook, but it is disabled or missing payment_intent.succeeded and payment_intent.payment_failed.',
      )
    }
    if (saved) {
      return check(
        'stripe-webhook',
        'Stripe webhook',
        'warn',
        'The signing secret is saved, but Stripe has no webhook pointing at /api/stripe/webhook.',
      )
    }
    return check(
      'stripe-webhook',
      'Stripe webhook',
      'warn',
      'STRIPE_WEBHOOK_SECRET is not set, and Stripe has no webhook for /api/stripe/webhook yet. Checkout still finishes from the order page.',
    )
  } catch (error) {
    return check('stripe-webhook', 'Stripe webhook', 'fail', error instanceof Error ? error.message : 'Stripe did not respond.')
  }
}

export async function testConnections(
  env: Env,
  settings: Pick<StoreSettings, 'storeId' | 'templateIds'>,
  storeIds: string[],
): Promise<ConnectionCheck[]> {
  const publishable = env.STRIPE_PUBLISHABLE_KEY
  return Promise.all([
    testGelatoKey(env.GELATO_API_KEY),
    testGelatoStore(env.GELATO_API_KEY, storeIds.length ? storeIds : settings.storeId ? [settings.storeId] : [], settings.templateIds),
    testStripeSecret(env.STRIPE_SECRET_KEY),
    testPublishable(env.STRIPE_SECRET_KEY, publishable),
    testWebhook(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET),
  ])
}
