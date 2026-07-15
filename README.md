# Adventures in Southwest Florida — Portfolio

Wildlife photography portfolio for **Brad Kemp**, with prints sold separately at [shop.adventuresswflorida.com](https://shop.adventuresswflorida.com).

## Stack

- Vite + React + TypeScript
- React Router
- Ready for Cloudflare Pages (includes `public/_redirects` for SPA routing)

## Develop

```bash
npm install
npm run dev
```

## Add your photos

1. Export web-optimized images (JPG/WebP, long edge ~1600–2400px)
2. Drop them into `public/photos/` using the filenames in `public/photos/README.md`
3. Placeholders clear themselves once files are found

Edit titles/locations in `src/data/photos.ts`. Site copy and links live in `src/site.ts`.

## Build

```bash
npm run build
npm run preview
```

## Deploy (Cloudflare Pages)

1. Push this repo to GitHub
2. In Cloudflare Pages: **Create project** → connect the repo
3. Build command: `npm run build`
4. Output directory: `dist`
5. Attach `adventuresswflorida.com` in Custom domains
6. Keep `shop.adventuresswflorida.com` pointed at Printify

## Brand assets

- `public/brand/logo.png` — circular logo with transparent background (used on site)
- `public/brand/logo-white-bg.png` / `logo-clear-bg.png` — original exports (kept for reference)
