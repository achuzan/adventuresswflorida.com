# Adventures in Southwest Florida — Portfolio

Wildlife photography portfolio for **Brad Kemp**. Prints are still sold at [shop.adventuresswflorida.com](https://shop.adventuresswflorida.com) until the Printful store at `/store` is turned on.

## Stack

- Vite + React + TypeScript
- React Router
- Cloudflare Worker (static assets + `/api` + KV-backed media uploads)

## Develop

```bash
npm install
cp .dev.vars.example .dev.vars   # set ADMIN_PASSWORD
npm run dev                      # site UI (Vite)
```

In a second terminal (needed for admin uploads / API):

```bash
npm run build
npm run dev:worker
```

Or serve the built site + Worker together:

```bash
npm run dev:full
```

Open `/admin` and sign in with `ADMIN_PASSWORD` from `.dev.vars`.

## Admin gallery

Password-protected page at `/admin` (not linked in the public nav):

- Upload a new photo (JPG / PNG / WebP, up to 12 MB)
- Attach a shop / collection URL for that image
- Edit shop links on existing gallery photos

Uploads and the gallery catalog are stored in Workers KV. Each photo page’s **Shop Collection** button uses that photo’s link when set, otherwise the main shop URL.

### Production secrets

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
npx wrangler secret put PRINTFUL_API_TOKEN
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_PUBLISHABLE_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

`PRINTFUL_STORE_ID` is optional. Paste the Printful store number in admin when the account has more than one store.

## Store

`/store` sells Printful products (prints, calendars, and mugs) without replacing the on-site calendar pages. Design each product in a Printful store set to Manual order / API. Products stay hidden until they are switched on at `/admin`.

Customers pay the retail price set in Printful. The site does not add a markup. Checkout quotes live Printful shipping, adds Stripe Tax, and takes the card in a Stripe Payment Element. Card numbers are not stored on this site. After the card is authorized, the Worker creates the Printful order for the saved design, then captures the card. Printful bills the card saved on the Printful account when that order is confirmed.

Stripe webhook endpoint: `https://adventuresswflorida.com/api/stripe/webhook`

Events: `payment_intent.succeeded`, `payment_intent.payment_failed`.

Until `STRIPE_WEBHOOK_SECRET` is set, a completed checkout still sends the Printful order when the customer reaches the confirmation page. The webhook covers a closed tab. Admin can also sync an order.

## Seed photos (shipped with the build)

Existing frames still live in `public/photos/` with metadata in `src/shared/seed-photos.ts`. Site copy and social links live in `src/site.ts`.

## Build & deploy

```bash
npm run build
npm run deploy
```

Attach `adventuresswflorida.com` as a custom domain in Workers & Pages. Keep `shop.` on Printify.

SPA routing uses `assets.not_found_handling = "single-page-application"` (do not use a `/* /index.html 200` `_redirects` rule — Workers rejects it).

## Brand assets

- `public/brand/logo.png` — circular logo with transparent background (used on site)
- `public/brand/logo-white-bg.png` / `logo-clear-bg.png` — original exports (kept for reference)
