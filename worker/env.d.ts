/// <reference types="@cloudflare/workers-types" />

interface Env {
  ASSETS: Fetcher
  PHOTOS_KV: KVNamespace
  ADMIN_PASSWORD: string
  SESSION_SECRET: string
  GELATO_API_KEY?: string
  GELATO_STORE_ID?: string
  STRIPE_SECRET_KEY?: string
  STRIPE_PUBLISHABLE_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
}
