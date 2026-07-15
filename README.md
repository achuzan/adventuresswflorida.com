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

## Deploy (Cloudflare)

This project deploys as a Worker with static assets (SPA mode in `wrangler.toml`).

1. Push to GitHub — Cloudflare rebuilds automatically
2. Or deploy manually:

```bash
npm run build
npx wrangler deploy
```

Attach `adventuresswflorida.com` as a custom domain in Workers & Pages. Keep `shop.` on Printify.

SPA routing uses `assets.not_found_handling = "single-page-application"` (do not use a `/* /index.html 200` `_redirects` rule — Workers rejects it).

## Brand assets

- `public/brand/logo.png` — circular logo with transparent background (used on site)
- `public/brand/logo-white-bg.png` / `logo-clear-bg.png` — original exports (kept for reference)
