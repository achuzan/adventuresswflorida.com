const COOKIE = 'aswf_admin'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

function timingSafeEqual(a: string, b: string) {
  const enc = new TextEncoder()
  const aBytes = enc.encode(a)
  const bBytes = enc.encode(b)
  const len = Math.max(aBytes.length, bBytes.length)
  let diff = aBytes.length ^ bBytes.length
  for (let i = 0; i < len; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0)
  }
  return diff === 0
}

async function hmacSign(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return bufferToBase64Url(sig)
}

function bufferToBase64Url(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function parseCookies(header: string | null) {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=')
    if (!rawKey) continue
    out[rawKey] = decodeURIComponent(rest.join('=') || '')
  }
  return out
}

export async function verifyPassword(password: string, expected: string) {
  if (!expected) return false
  return timingSafeEqual(password, expected)
}

export async function createSessionToken(secret: string) {
  const exp = Date.now() + SESSION_TTL_MS
  const payload = `v1.${exp}`
  const sig = await hmacSign(secret, payload)
  return `${payload}.${sig}`
}

export async function isAuthenticated(request: Request, secret: string) {
  if (!secret) return false
  const cookies = parseCookies(request.headers.get('Cookie'))
  const token = cookies[COOKIE]
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== 'v1') return false
  const exp = Number(parts[1])
  if (!Number.isFinite(exp) || exp < Date.now()) return false
  const payload = `${parts[0]}.${parts[1]}`
  const expected = await hmacSign(secret, payload)
  return timingSafeEqual(parts[2]!, expected)
}

export function sessionCookieHeader(token: string, secure: boolean) {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000)
  const parts = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function clearSessionCookieHeader(secure: boolean) {
  const parts = [`${COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
  if (secure) parts.push('Secure')
  return parts.join('; ')
}
