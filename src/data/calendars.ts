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

type CalendarYear = {
  [K in CalendarSlot]: Omit<CalendarEntry, 'year' | 'slot'>
}

const monthNames: Record<Exclude<CalendarSlot, 'front' | 'back' | 'logo'>, string> = {
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
}

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
): Omit<CalendarEntry, 'year' | 'slot'> {
  const label = monthNames[slot]
  return {
    label,
    subject,
    photoSrc: photoSrc(year, `${slot}.jpg`),
    audioSrc: audioSrc(year, audioFile),
    alt: `${subject}, ${label} ${year} calendar photograph`,
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
    alt: 'White-tailed deer, 2027 calendar front cover',
  },
  back: {
    label: 'Back Cover',
    subject: 'Jaguar',
    photoSrc: photoSrc(2027, 'back.jpg'),
    audioSrc: audioSrc(2027, '2027 Back Cover Jaguar.mp3'),
    alt: 'Jaguar, 2027 calendar back cover',
  },
  logo: {
    label: 'Logo',
    subject: 'Adventures in Southwest Florida',
    photoSrc: photoSrc(2027, 'logo.png'),
    audioSrc: audioSrc(2027, 'logo.mp3'),
    alt: 'Adventures in Southwest Florida logo',
  },
}

const calendars: Record<number, CalendarYear> = {
  2027: year2027,
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

function parseSlot(value: string | null): CalendarSlot | null {
  if (!value) return null
  const key = value.trim().toLowerCase()
  if (slotSet.has(key)) return key as CalendarSlot
  return monthByNumber[key] ?? null
}

export function getCalendarEntry(yearValue: string | null, monthValue: string | null): CalendarEntry | null {
  const year = Number(yearValue)
  const slot = parseSlot(monthValue)
  if (!Number.isInteger(year) || !slot) return null
  const catalog = calendars[year]
  if (!catalog) return null
  return { year, slot, ...catalog[slot] }
}

export function calendarPath(year: number, month: CalendarSlot) {
  return `/calendar?year=${year}&month=${month}`
}
