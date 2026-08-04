/// <reference types="@cloudflare/workers-types" />

interface Env {
  ASSETS: Fetcher
  PHOTOS_KV: KVNamespace
  ADMIN_PASSWORD: string
  SESSION_SECRET: string
}
