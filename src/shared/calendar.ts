/** Calendar QR pages shared by the Worker API and the React app. */

export const CALENDARS_KEY = 'calendars:catalog'
export const CALENDAR_SUBJECT_MAX = 120

export const calendarSlots = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
  'front',
  'back',
  'logo',
] as const

export type CalendarSlot = (typeof calendarSlots)[number]

export type CalendarEntry = {
  year: number
  slot: CalendarSlot
  label: string
  subject: string
  photoSrc: string
  audioSrc: string
  alt: string
}

export type SlotContent = {
  subject: string
  photoSrc: string
  audioSrc: string
}

export type CalendarOverrides = Record<string, Partial<Record<CalendarSlot, SlotContent>>>

const slotLabels: Record<CalendarSlot, string> = {
  january: 'January',
  february: 'February',
  march: 'March',
  april: 'April',
  may: 'May',
  june: 'June',
  july: 'July',
  august: 'August',
  september: 'September',
  october: 'October',
  november: 'November',
  december: 'December',
  front: 'Front Cover',
  back: 'Back Cover',
  logo: 'Logo',
}

const monthByNumber: Record<string, CalendarSlot> = {
  '1': 'january',
  '01': 'january',
  '2': 'february',
  '02': 'february',
  '3': 'march',
  '03': 'march',
  '4': 'april',
  '04': 'april',
  '5': 'may',
  '05': 'may',
  '6': 'june',
  '06': 'june',
  '7': 'july',
  '07': 'july',
  '8': 'august',
  '08': 'august',
  '9': 'september',
  '09': 'september',
  '10': 'october',
  '11': 'november',
  '12': 'december',
}

const slotSet = new Set<string>(calendarSlots)

type CalendarFields = Omit<CalendarEntry, 'year' | 'slot' | 'alt'>
type CalendarYear = Record<CalendarSlot, CalendarFields>

function photoSrc(year: number, file: string) {
  return encodeURI(`/calendars/${year}/photos/${file}`)
}

function audioSrc(year: number, file: string) {
  return encodeURI(`/calendars/${year}/${file}`)
}

function monthEntry(
  year: number,
  slot: Exclude<CalendarSlot, 'front' | 'back' | 'logo'>,
  subject: string,
  audioFile: string,
): CalendarFields {
  return {
    label: slotLabels[slot],
    subject,
    photoSrc: photoSrc(year, `${slot}.jpg`),
    audioSrc: audioSrc(year, audioFile),
  }
}

const year2027: CalendarYear = {
  january: monthEntry(2027, 'january', 'Eastern Cottontail', '2027 January Eastern Cottontail.mp3'),
  february: monthEntry(2027, 'february', 'Tricolored Heron', '2027 February Tricolored Heron.mp3'),
  march: monthEntry(2027, 'march', 'Great Egret', '2027 March Great Egret.mp3'),
  april: monthEntry(2027, 'april', 'Snail Kite', '2027 April Snail Kite.mp3'),
  may: monthEntry(2027, 'may', 'Burrowing Owl', '2027 May Burrowing Owl.mp3'),
  june: monthEntry(2027, 'june', 'Mangrove Cuckoo', '2027 June Mangrove Cuckoo.mp3'),
  july: monthEntry(2027, 'july', 'American Alligator', '2027 July American Alligator.mp3'),
  august: monthEntry(2027, 'august', 'Roseate Spoonbill', '2027 August Roseate spoonbill.mp3'),
  september: monthEntry(2027, 'september', 'Osprey', '2027 September Osprey.mp3'),
  october: monthEntry(2027, 'october', 'Egyptian Goose', '2027 October Egyptian Goose.mp3'),
  november: monthEntry(2027, 'november', 'Mottled Duck', '2027 November Mottled Duck.mp3'),
  december: monthEntry(2027, 'december', 'Monk Parakeet', '2027 December Monk Parakeet.mp3'),
  front: {
    label: 'Front Cover',
    subject: 'White-tailed Deer',
    photoSrc: photoSrc(2027, 'front.jpg'),
    audioSrc: audioSrc(2027, '2027 Front Cover White-tailed Deer.mp3'),
  },
  back: {
    label: 'Back Cover',
    subject: 'Jaguar',
    photoSrc: photoSrc(2027, 'back.jpg'),
    audioSrc: audioSrc(2027, '2027 Back Cover Jaguar.mp3'),
  },
  logo: {
    label: 'Logo',
    subject: 'Adventures in Southwest Florida',
    photoSrc: photoSrc(2027, 'logo.png'),
    audioSrc: audioSrc(2027, 'logo.mp3'),
  },
}

const seedCalendars: Record<number, CalendarYear> = {
  2027: year2027,
}

export function parseCalendarSlot(value: string | null): CalendarSlot | null {
  if (!value) return null
  const key = value.trim().toLowerCase()
  if (slotSet.has(key)) return key as CalendarSlot
  return monthByNumber[key] ?? null
}

export function calendarAlt(year: number, slot: CalendarSlot, subject: string, label: string) {
  if (slot === 'logo') return `${subject} logo`
  if (slot === 'front') return `${subject}, ${year} calendar front cover`
  if (slot === 'back') return `${subject}, ${year} calendar back cover`
  return `${subject}, ${label} ${year} calendar photograph`
}

export function cleanCalendarSubject(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const subject = value.trim()
  if (!subject || subject.length > CALENDAR_SUBJECT_MAX) return null
  return subject
}

export function cleanCalendarAssetPath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const path = value.trim()
  if (!path.startsWith('/calendars/') && !path.startsWith('/media/calendars/')) return null
  if (path.includes('..') || path.includes('\\') || path.includes('//')) return null
  for (let i = 0; i < path.length; i++) {
    const code = path.charCodeAt(i)
    if (code <= 31 || code === 127) return null
  }
  return path
}

export function seedCalendarYears() {
  return Object.keys(seedCalendars)
    .map((year) => Number(year))
    .filter((year) => Number.isInteger(year))
    .sort((a, b) => a - b)
}

export function mergeCalendarEntry(
  year: number,
  slot: CalendarSlot,
  override?: Partial<SlotContent> | null,
): CalendarEntry | null {
  const catalog = seedCalendars[year]
  if (!catalog) return null
  const base = catalog[slot]
  const subject = cleanCalendarSubject(override?.subject) ?? base.subject
  const photoSrc = cleanCalendarAssetPath(override?.photoSrc) ?? base.photoSrc
  const audioSrc = cleanCalendarAssetPath(override?.audioSrc) ?? base.audioSrc
  return {
    year,
    slot,
    label: slotLabels[slot],
    subject,
    photoSrc,
    audioSrc,
    alt: calendarAlt(year, slot, subject, slotLabels[slot]),
  }
}

export function getCalendarEntry(yearValue: string | null, monthValue: string | null): CalendarEntry | null {
  const year = Number(yearValue)
  const slot = parseCalendarSlot(monthValue)
  if (!Number.isInteger(year) || !slot) return null
  return mergeCalendarEntry(year, slot, null)
}

export function calendarPath(year: number, month: CalendarSlot) {
  return `/calendar?year=${year}&month=${month}`
}

export function parseCalendarEntry(raw: unknown): CalendarEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  if (typeof record.year !== 'number' || !Number.isInteger(record.year)) return null
  if (typeof record.slot !== 'string') return null
  const slot = parseCalendarSlot(record.slot)
  if (!slot) return null
  const subject = cleanCalendarSubject(record.subject)
  const photoSrc = cleanCalendarAssetPath(record.photoSrc)
  const audioSrc = cleanCalendarAssetPath(record.audioSrc)
  if (!subject || !photoSrc || !audioSrc) return null
  return mergeCalendarEntry(record.year, slot, { subject, photoSrc, audioSrc })
}

export function parseCalendarCatalog(raw: unknown): { year: number; entries: CalendarEntry[] }[] | null {
  if (!raw || typeof raw !== 'object') return null
  const calendars = (raw as { calendars?: unknown }).calendars
  if (!Array.isArray(calendars)) return null

  const parsed: { year: number; entries: CalendarEntry[] }[] = []
  for (const item of calendars) {
    if (!item || typeof item !== 'object') return null
    const year = (item as { year?: unknown }).year
    const entriesRaw = (item as { entries?: unknown }).entries
    if (typeof year !== 'number' || !Number.isInteger(year) || !Array.isArray(entriesRaw)) return null
    const entries: CalendarEntry[] = []
    for (const entryRaw of entriesRaw) {
      const entry = parseCalendarEntry(entryRaw)
      if (!entry || entry.year !== year) return null
      entries.push(entry)
    }
    parsed.push({ year, entries })
  }
  return parsed
}

export function parseCalendarOverrides(raw: unknown): CalendarOverrides {
  if (!raw || typeof raw !== 'object') return {}
  const overrides: CalendarOverrides = {}
  for (const [yearKey, yearValue] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}$/.test(yearKey) || !yearValue || typeof yearValue !== 'object') continue
    const yearOverrides: Partial<Record<CalendarSlot, SlotContent>> = {}
    for (const [slotKey, slotValue] of Object.entries(yearValue as Record<string, unknown>)) {
      const slot = parseCalendarSlot(slotKey)
      if (!slot || !slotValue || typeof slotValue !== 'object') continue
      const record = slotValue as Record<string, unknown>
      const subject = cleanCalendarSubject(record.subject)
      const photoSrc = cleanCalendarAssetPath(record.photoSrc)
      const audioSrc = cleanCalendarAssetPath(record.audioSrc)
      if (!subject || !photoSrc || !audioSrc) continue
      yearOverrides[slot] = { subject, photoSrc, audioSrc }
    }
    if (Object.keys(yearOverrides).length > 0) overrides[yearKey] = yearOverrides
  }
  return overrides
}
