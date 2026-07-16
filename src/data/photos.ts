export type Photo = {
  id: string
  /** Filenames to drop into /public/photos/ — first match wins when present */
  file: string
  title: string
  location: string
  alt: string
  /** Short story for the dedicated photo page (SEO + context) */
  story: string
  /** Soft watercolor wash used until a real file is added */
  wash: string
}

/**
 * Drop web-optimized JPG/WebP files into public/photos/ using these filenames.
 * Until then, the site shows branded placeholders with the same titles.
 */
export const photos: Photo[] = [
  {
    id: 'scrub-jay',
    file: 'florida-scrub-jay.jpg',
    title: 'Florida Scrub Jay with Acorn',
    location: 'Southwest Florida',
    alt: 'Florida scrub jay holding an acorn',
    story:
      'Florida scrub jays are cooperative, curious birds found only in Florida’s scrub habitat. This frame catches one pausing mid-forage with an acorn — a small moment that speaks to the resilience of Southwest Florida’s upland ecosystems.',
    wash: 'linear-gradient(145deg, #1e4d45 0%, #3d6b5c 40%, #e07020 100%)',
  },
  {
    id: 'snailkite',
    file: 'snailkite.jpg',
    title: 'Snail Kite',
    location: 'Harns Marsh',
    alt: 'Snail kite at Harns Marsh',
    story:
      'Photographed at Harns Marsh in Lee County, this snail kite is a wetland specialist that thrives where apple snails are plentiful. Soft light and open marsh give the raptor room to dominate the frame.',
    wash: 'linear-gradient(160deg, #2a1f18 0%, #4a3428 45%, #c45c20 100%)',
  },
  {
    id: 'claw',
    file: 'claw.jpg',
    title: 'Iguana Claw',
    location: 'John Yarbrough Linear Park',
    alt: 'Iguana claw at John Yarbrough Linear Park',
    story:
      'A close study of an iguana’s claw along the John Yarbrough Linear Park trail. Texture, scale, and warm Florida light turn a detail most people walk past into fine-art wildlife photography.',
    wash: 'linear-gradient(135deg, #5c2a3a 0%, #e07020 50%, #e8b84a 100%)',
  },
  {
    id: 'greategret',
    file: 'greategret.jpg',
    title: 'Great Egret',
    location: 'Lakes Park',
    alt: 'Great egret at Lakes Park',
    story:
      'A great egret wades the shallows at Lakes Park in Fort Myers. Clean lines, pale plumage, and reflective water make this a classic Southwest Florida bird photograph for print collectors.',
    wash: 'linear-gradient(150deg, #243028 0%, #5c4033 55%, #8a6a4a 100%)',
  },
  {
    id: 'alligator',
    file: 'alligator.jpg',
    title: 'Alligator at Rest',
    location: 'Southwest Florida wetlands',
    alt: 'American alligator resting in wetland water',
    story:
      'An American alligator rests half-submerged in Southwest Florida wetland water — quiet, watchful, and perfectly at home. This is the atmosphere that defines Adventures in Southwest Florida wildlife photography.',
    wash: 'linear-gradient(160deg, #0f2a28 0%, #1e4d45 50%, #6b8f71 100%)',
  },
  {
    id: 'destinbeachsunset',
    file: 'destinbeachsunset.jpg',
    title: 'Sunset at Destin Beach Florida',
    location: 'Destin Beach',
    alt: 'Sunset at Destin Beach Florida',
    story:
      'Golden hour along Destin Beach, where Gulf color spills across the horizon. A landscape companion to the wildlife work — evenings on Florida’s coast that belong on a wall as much as in a field notebook.',
    wash: 'linear-gradient(145deg, #163a36 0%, #2a6b6e 40%, #a8c4b8 100%)',
  },
  {
    id: 'malewoodduck',
    file: 'malewoodduck.jpg',
    title: 'Male Wood Duck',
    location: 'Six Mile Cypress Slough Preserve',
    alt: 'Male wood duck at Six Mile Cypress Slough Preserve',
    story:
      'A male wood duck in breeding plumage at Six Mile Cypress Slough Preserve. Cypress, still water, and vivid color — one of the most rewarding subjects in Southwest Florida bird photography.',
    wash: 'linear-gradient(140deg, #1a4a2e 0%, #3d7a4a 50%, #c4d46a 100%)',
  },
  {
    id: 'flamingo',
    file: 'flamingo.jpg',
    title: 'Flamingo at Sarasota Jungle Gardens Florida',
    location: 'Sarasota Jungle Gardens',
    alt: 'Flamingo standing in front of a fountain at Sarasota Jungle Gardens Florida',
    story:
      'A flamingo stands near the fountain at Sarasota Jungle Gardens. Bold color and calm posture make this a favorite print for anyone who loves Florida’s tropical side.',
    wash: 'linear-gradient(155deg, #1a2430 0%, #3d4a5c 40%, #e07020 95%)',
  },
  {
    id: 'flamingo2',
    file: 'flamingo2.jpg',
    title: 'Flamingo Sleeping at Sarasota Jungle Gardens Florida',
    location: 'Sarasota Jungle Gardens',
    alt: 'Flamingo sleeping at Sarasota Jungle Gardens Florida',
    story:
      'A sleeping flamingo at Sarasota Jungle Gardens — soft curves, tucked beak, and quiet pink. A gentler companion piece to the standing flamingo frame.',
    wash: 'linear-gradient(155deg, #1a2430 0%, #3d4a5c 40%, #e07020 95%)',
  },
  {
    id: 'alligator2',
    file: 'alligator2.jpg',
    title: 'Alligator with Spider on Its Head at Lakes Park Florida',
    location: 'Lakes Park',
    alt: 'Alligator with a spider on its head at Lakes Park Florida',
    story:
      'At Lakes Park, an alligator surfaces with an unexpected hitchhiker — a spider resting on its head. A quirky Southwest Florida wildlife moment that rewards a second look.',
    wash: 'linear-gradient(155deg, #1a2430 0%, #3d4a5c 40%, #e07020 95%)',
  },
  {
    id: 'pigfrog',
    file: 'pigfrog.jpg',
    title: 'Pig Frog at Six Mile Cypress Slough Preserve Florida',
    location: 'Six Mile Cypress Slough Preserve',
    alt: 'Pig frog at Six Mile Cypress Slough Preserve Florida',
    story:
      'A pig frog at Six Mile Cypress Slough Preserve, half-hidden among wetland greens. Amphibians are easy to miss — and worth slowing down for in Southwest Florida.',
    wash: 'linear-gradient(155deg, #1a2430 0%, #3d4a5c 40%, #e07020 95%)',
  },
  {
    id: 'parrot',
    file: 'parrot.jpg',
    title: 'Parrot at Sarasota Jungle Gardens Florida',
    location: 'Sarasota Jungle Gardens',
    alt: 'Parrot at Sarasota Jungle Gardens Florida',
    story:
      'A vivid parrot photographed at Sarasota Jungle Gardens. Saturated plumage and eye contact turn a garden encounter into a bold wildlife print.',
    wash: 'linear-gradient(155deg, #1a2430 0%, #3d4a5c 40%, #e07020 95%)',
  },
]

export const featuredPhotoIds = ['alligator', 'scrub-jay', 'snailkite'] as const

export function getPhotoById(id: string) {
  return photos.find((p) => p.id === id)
}

export function photoPath(id: string) {
  return `/gallery/${id}`
}

export function photoImageUrl(photo: Photo, origin = '') {
  return `${origin}/photos/${photo.file}`
}
