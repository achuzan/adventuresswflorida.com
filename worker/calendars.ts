import {
  CALENDARS_KEY,
  calendarSlots,
  cleanCalendarAssetPath,
  cleanCalendarSubject,
  mergeCalendarEntry,
  parseCalendarOverrides,
  seedCalendarYears,
  type CalendarEntry,
  type CalendarSlot,
  type SlotContent,
} from '../src/shared/calendar'

async function readOverrides(kv: KVNamespace) {
  const raw = await kv.get(CALENDARS_KEY)
  if (!raw) return {}
  try {
    return parseCalendarOverrides(JSON.parse(raw))
  } catch {
    return {}
  }
}

export async function listCalendars(kv: KVNamespace) {
  const overrides = await readOverrides(kv)
  return seedCalendarYears().map((year) => ({
    year,
    entries: calendarSlots.flatMap((slot) => {
      const entry = mergeCalendarEntry(year, slot, overrides[String(year)]?.[slot])
      return entry ? [entry] : []
    }),
  }))
}

export async function getCalendarSlot(
  kv: KVNamespace,
  year: number,
  slot: CalendarSlot,
): Promise<CalendarEntry | null> {
  const overrides = await readOverrides(kv)
  return mergeCalendarEntry(year, slot, overrides[String(year)]?.[slot])
}

export async function saveCalendarSlot(
  kv: KVNamespace,
  year: number,
  slot: CalendarSlot,
  content: SlotContent,
): Promise<CalendarEntry | null> {
  if (!mergeCalendarEntry(year, slot, null)) return null
  const subject = cleanCalendarSubject(content.subject)
  const photoSrc = cleanCalendarAssetPath(content.photoSrc)
  const audioSrc = cleanCalendarAssetPath(content.audioSrc)
  if (!subject || !photoSrc || !audioSrc) return null

  const saved = { subject, photoSrc, audioSrc }
  const overrides = await readOverrides(kv)
  const yearKey = String(year)
  overrides[yearKey] = {
    ...(overrides[yearKey] ?? {}),
    [slot]: saved,
  }
  await kv.put(CALENDARS_KEY, JSON.stringify(overrides))
  return mergeCalendarEntry(year, slot, saved)
}
