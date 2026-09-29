import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { defaultSiteSettings, parseSiteSettings, type SiteSettings } from '../shared/site-settings'

type SiteSettingsContextValue = {
  settings: SiteSettings
  loading: boolean
  refresh: () => Promise<void>
}

const SiteSettingsContext = createContext<SiteSettingsContextValue | null>(null)

async function fetchSettings(): Promise<SiteSettings> {
  const res = await fetch('/api/settings', { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`Could not load settings (${res.status})`)
  const data = (await res.json()) as { settings?: unknown }
  return parseSiteSettings(data.settings)
}

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(defaultSiteSettings())
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      setSettings(await fetchSettings())
    } catch {
      // Keep the built-in calendar link when the Worker API is offline.
      setSettings(defaultSiteSettings())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  return (
    <SiteSettingsContext.Provider value={{ settings, loading, refresh }}>
      {children}
    </SiteSettingsContext.Provider>
  )
}

export function useSiteSettings() {
  const ctx = useContext(SiteSettingsContext)
  if (!ctx) throw new Error('useSiteSettings must be used within SiteSettingsProvider')
  return ctx
}
