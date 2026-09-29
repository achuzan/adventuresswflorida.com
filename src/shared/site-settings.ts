/** Navigation settings shared by the Worker API and the React app. */
export const SITE_SETTINGS_KEY = 'site:settings'

export type CalendarNav = {
  enabled: boolean
  label: string
  url: string
}

export type SiteSettings = {
  calendarNav: CalendarNav
}

export const defaultCalendarNav: CalendarNav = {
  enabled: true,
  label: '2027 Calendar',
  url: 'https://shop.adventuresswflorida.com/product/31276392',
}

export function defaultSiteSettings(): SiteSettings {
  return { calendarNav: { ...defaultCalendarNav } }
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** Accept stored JSON, falling back to defaults when a field is missing or invalid. */
export function parseSiteSettings(raw: unknown): SiteSettings {
  const fallback = defaultSiteSettings()
  if (!raw || typeof raw !== 'object') return fallback
  const calendar = (raw as { calendarNav?: unknown }).calendarNav
  if (!calendar || typeof calendar !== 'object') return fallback

  const record = calendar as Record<string, unknown>
  const label = typeof record.label === 'string' ? record.label.trim() : ''
  const url = typeof record.url === 'string' ? record.url.trim() : ''
  if (!label || label.length > 80 || !isHttpUrl(url)) return fallback

  return {
    calendarNav: {
      enabled: typeof record.enabled === 'boolean' ? record.enabled : fallback.calendarNav.enabled,
      label,
      url,
    },
  }
}

export function validateCalendarNav(
  input: unknown,
): { ok: true; value: CalendarNav } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Calendar link settings are required' }
  }
  const body = input as Record<string, unknown>
  if (typeof body.enabled !== 'boolean') {
    return { ok: false, error: 'Show in menu must be on or off' }
  }
  if (typeof body.label !== 'string' || !body.label.trim()) {
    return { ok: false, error: 'Link name is required' }
  }
  const label = body.label.trim()
  if (label.length > 80) {
    return { ok: false, error: 'Link name must be 80 characters or fewer' }
  }
  if (typeof body.url !== 'string' || !body.url.trim()) {
    return { ok: false, error: 'Link URL is required' }
  }
  const url = body.url.trim()
  if (!isHttpUrl(url)) {
    return { ok: false, error: 'Link URL must be a valid http or https address' }
  }
  return { ok: true, value: { enabled: body.enabled, label, url } }
}
