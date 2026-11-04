/// <reference types="@cloudflare/workers-types" />

interface Env {
  ASSETS: Fetcher
  PHOTOS_KV: KVNamespace
  PRINT_FILES?: R2Bucket
  ADMIN_PASSWORD: string
  SESSION_SECRET: string
  GELATO_API_KEY?: string
  GELATO_STORE_ID?: string
  STRIPE_SECRET_KEY?: string
  STRIPE_PUBLISHABLE_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
  OPENAI_API_KEY?: string
  AI_BASE_URL?: string
  AI_MODEL?: string
}
