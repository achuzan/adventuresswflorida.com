import {
  SITE_SETTINGS_KEY,
  defaultSiteSettings,
  parseSiteSettings,
  type SiteSettings,
} from '../src/shared/site-settings'

export async function getSiteSettings(kv: KVNamespace): Promise<SiteSettings> {
  const raw = await kv.get(SITE_SETTINGS_KEY)
  if (!raw) return defaultSiteSettings()
  try {
    return parseSiteSettings(JSON.parse(raw))
  } catch {
    return defaultSiteSettings()
  }
}

export async function saveSiteSettings(kv: KVNamespace, settings: SiteSettings) {
  await kv.put(SITE_SETTINGS_KEY, JSON.stringify(settings))
  return settings
}
