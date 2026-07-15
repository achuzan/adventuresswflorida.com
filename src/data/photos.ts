export type Photo = {
  id: string
  /** Filenames to drop into /public/photos/ — first match wins when present */
  file: string
  title: string
  location: string
  alt: string
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
    wash: 'linear-gradient(145deg, #1e4d45 0%, #3d6b5c 40%, #e07020 100%)',
  },
  {
    id: 'snailkite',
    file: 'snailkite.jpg',
    title: 'Snail Kite',
    location: 'Hanrs Marsh',
    alt: 'Snail Kite at Harmns Marsh',
    wash: 'linear-gradient(160deg, #2a1f18 0%, #4a3428 45%, #c45c20 100%)',
  },
  {
    id: 'claw',
    file: 'claw.jpg',
    title: 'Iguana Claw',
    location: 'John Yarbrough Linear Park',
    alt: 'Iguana Claw at John Yarbrough Linear Park',
    wash: 'linear-gradient(135deg, #5c2a3a 0%, #e07020 50%, #e8b84a 100%)',
  },
  {
    id: 'greategret',
    file: 'greategret.jpg',
    title: 'Great Egret',
    location: 'Lakes Park',
    alt: 'Great Egret at Lakes Park',
    wash: 'linear-gradient(150deg, #243028 0%, #5c4033 55%, #8a6a4a 100%)',
  },
  {
    id: 'alligator',
    file: 'alligator.jpg',
    title: 'Alligator at Rest',
    location: 'Southwest Florida wetlands',
    alt: 'American alligator resting in wetland water',
    wash: 'linear-gradient(160deg, #0f2a28 0%, #1e4d45 50%, #6b8f71 100%)',
  },
  {
    id: 'destinbeachsunset',
    file: 'destinbeachsunset.jpg',
    title: 'Sunset at Destin Beach Florida',
    location: 'Destin Beach',
    alt: 'Sunset at Destin Florida',
    wash: 'linear-gradient(145deg, #163a36 0%, #2a6b6e 40%, #a8c4b8 100%)',
  },
  {
    id: 'malewoodduck',
    file: 'malewoodduck.jpg',
    title: 'Male Wood Duck',
    location: 'Six Mile Cypress Slough Preserve',
    alt: 'Male Wood Duck at Six Mile Cypress Slough Preserve',
    wash: 'linear-gradient(140deg, #1a4a2e 0%, #3d7a4a 50%, #c4d46a 100%)',
  },
  {
    id: 'flamingo',
    file: 'flamingo.jpg',
    title: 'Flamingo at Sarasota Jungle Gardens Florida',
    location: 'Sarasota Jungle Gardens',
    alt: 'Flamingo standing in from of a fountain at Sarasota Jungle Gardens Florida',
    wash: 'linear-gradient(155deg, #1a2430 0%, #3d4a5c 40%, #e07020 95%)',
  },
  {
    id: 'flamingo2',
    file: 'flamingo2.jpg',
    title: 'Flamingo Sleeping at Sarasota Jungle Gardens Florida',
    location: 'Sarasota Jungle Gardens',
    alt: 'Flamingo sleeping at Sarasota Jungle Gardens Florida',
    wash: 'linear-gradient(155deg, #1a2430 0%, #3d4a5c 40%, #e07020 95%)',
  },
  {
    id: 'alligator2',
    file: 'alligator2.jpg',
    title: 'Alligator with spider on its head at Lakes Park Florida',
    location: 'Lakes Park',
    alt: 'Alligator with spider on its head at Lakes Park Florida',
    wash: 'linear-gradient(155deg, #1a2430 0%, #3d4a5c 40%, #e07020 95%)',
  },
  {
    id: 'pigfrog',
    file: 'pigfrog.jpg',
    title: 'Pig Frog at Six Mile Cypress Slough Preserve Florida',
    location: 'Six Mile Cypress Slough Preserve',
    alt: 'Pig Frog at Six Mile Cypress Slough Preserve Florida',
    wash: 'linear-gradient(155deg, #1a2430 0%, #3d4a5c 40%, #e07020 95%)',
  },
  {
    id: 'parrot',
    file: 'parrot.jpg',
    title: 'Parrot at Sarasota Jungle Gardens Florida',
    location: 'Sarasota Jungle Gardens',
    alt: 'Parrot at Sarasota Jungle Gardens Florida',
    wash: 'linear-gradient(155deg, #1a2430 0%, #3d4a5c 40%, #e07020 95%)',
  },
]

export const featuredPhotoIds = ['alligator', 'scrub-jay', 'snailkite'] as const
