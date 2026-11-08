import { listPrintfulStores, PrintfulError, printfulId } from './printful'
import type { StoreSettings } from './store-data'

export type ConnectionCheck = {
  id: 'printful' | 'printful-store' | 'stripe' | 'stripe-publishable' | 'stripe-webhook' | 'openai'
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

async function testPrintful(token: string | undefined, storeId: string): Promise<ConnectionCheck[]> {
  if (!token) {
    return [
      check('printful', 'Printful', 'fail', 'Missing PRINTFUL_API_TOKEN.'),
      check('printful-store', 'Printful store', 'fail', 'Printful cannot be checked until PRINTFUL_API_TOKEN is set.'),
    ]
  }
  let stores: { id: string; name: string; type: string }[]
  try {
    stores = await listPrintfulStores(token)
  } catch (error) {
    const rejected = error instanceof PrintfulError && (error.status === 401 || error.status === 403)
    const message = rejected ? 'Printful rejected the API token.' : error instanceof Error ? error.message : 'Printful did not respond.'
    return [
      check('printful', 'Printful', 'fail', message),
      check('printful-store', 'Printful store', 'fail', 'Printful did not accept the token, so the store was not checked.'),
    ]
  }
  const account = check('printful', 'Printful', 'ok', 'Printful accepted the API token.')
  if (storeId && !printfulId.test(storeId)) {
    return [account, check('printful-store', 'Printful store', 'fail', 'The saved store id is not a Printful store number.')]
  }
  if (storeId && !stores.some((store) => store.id === storeId)) {
    return [account, check('printful-store', 'Printful store', 'fail', 'That store id is not on this Printful account.')]
  }
  if (!storeId && stores.length > 1) {
    return [
      account,
      check('printful-store', 'Printful store', 'warn', 'This account has more than one store. Paste the Manual / API store id in settings.'),
    ]
  }
  const chosen = stores.find((store) => store.id === storeId) ?? stores[0]
  if (!chosen) {
    return [account, check('printful-store', 'Printful store', 'fail', 'Create a Manual order / API store in Printful, then refresh.')]
  }
  const manual = /api|manual|native/i.test(chosen.type)
  return [
    account,
    check(
      'printful-store',
      'Printful store',
      manual ? 'ok' : 'warn',
      manual
        ? `Connected to ${chosen.name}.`
        : `Connected to ${chosen.name}. Use a Manual order / API store so this site can place the orders.`,
    ),
  ]
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

export async function testConnections(env: Env, settings: Pick<StoreSettings, 'storeId'>): Promise<ConnectionCheck[]> {
  const publishable = env.STRIPE_PUBLISHABLE_KEY
  const [printful, stripe, stripeKey, webhook] = await Promise.all([
    testPrintful(env.PRINTFUL_API_TOKEN, (settings.storeId || env.PRINTFUL_STORE_ID || '').trim()),
    testStripeSecret(env.STRIPE_SECRET_KEY),
    testPublishable(env.STRIPE_SECRET_KEY, publishable),
    testWebhook(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET),
  ])
  return [...printful, stripe, stripeKey, webhook]
}
