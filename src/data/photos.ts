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
    id: 'pileated',
    file: 'pileated-woodpecker.jpg',
    title: 'Pileated Woodpecker',
    location: 'Six Mile Cypress Slough Preserve',
    alt: 'Pileated woodpecker in the cypress slough',
    wash: 'linear-gradient(160deg, #2a1f18 0%, #4a3428 45%, #c45c20 100%)',
  },
  {
    id: 'spoonbill',
    file: 'roseate-spoonbill.jpg',
    title: 'Roseate Spoonbill at Sunrise',
    location: 'Bowditch Beach',
    alt: 'Roseate spoonbill in golden sunrise light',
    wash: 'linear-gradient(135deg, #5c2a3a 0%, #e07020 50%, #e8b84a 100%)',
  },
  {
    id: 'raccoon',
    file: 'curious-raccoon.jpg',
    title: 'Curious Raccoon',
    location: 'Six Mile Cypress Slough Preserve',
    alt: 'Raccoon peering through cypress habitat',
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
    id: 'slough-light',
    file: 'cypress-light.jpg',
    title: 'Light Through the Slough',
    location: 'Six Mile Cypress Slough Preserve',
    alt: 'Morning light filtering through cypress canopy',
    wash: 'linear-gradient(145deg, #163a36 0%, #2a6b6e 40%, #a8c4b8 100%)',
  },
  {
    id: 'lizard',
    file: 'anole.jpg',
    title: 'Green Anole',
    location: 'Lakes Park',
    alt: 'Green anole on a sunlit branch',
    wash: 'linear-gradient(140deg, #1a4a2e 0%, #3d7a4a 50%, #c4d46a 100%)',
  },
  {
    id: 'wetland-dusk',
    file: 'wetland-dusk.jpg',
    title: 'Wetland Dusk',
    location: 'Southwest Florida',
    alt: 'Soft dusk light over a Southwest Florida wetland',
    wash: 'linear-gradient(155deg, #1a2430 0%, #3d4a5c 40%, #e07020 95%)',
  },
]

export const featuredPhotoIds = ['spoonbill', 'scrub-jay', 'pileated'] as const
