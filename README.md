# ORGANICHY — D2C storefront + admin console

**Peanut butter from Moradabad, sold direct.** A complete e-commerce site for
ORGANICHY Food & Nutrition: 14 storefront pages, working cart, coupons, COD,
checkout, order tracking, reviews, and an admin console with analytics and
inventory — in plain Node.js with **zero npm dependencies, no framework and no
build step.**

```bash
node server.js            # → http://localhost:3000   (admin at /admin, password organichy@2026)
```

That is the whole setup. Node 18 or newer and nothing else: no `npm install`,
no bundler, no database server. The first boot creates `data/` and seeds it with
4 products, 8 reviews, 4 coupons, 4 demo orders and a few inbox messages.

---

## Table of contents

| | |
|---|---|
| [What is here](#what-is-here) | [Storefront, commerce logic, admin](#what-is-here) |
| [Running it](#running-it) | [Local, tests, reset](#running-it) |
| [Configuration](#configuration) | [env vars and lib/config.js](#configuration) |
| [Layout](#layout) | [file-by-file map](#layout) |
| [How the pieces work](#how-the-pieces-work) | [cart, pricing, auth, motion, SEO](#how-the-pieces-work) |
| [Deploy](#deploy) | [pointer to DEPLOY.md](#deploy) |
| [Why zero dependencies](#why-zero-dependencies) | [the trade-off, stated](#why-zero-dependencies) |
| [Before going live](#before-going-live) | [the client's to-do list](#before-going-live) |

---

## What is here

**Storefront**
- **Home** — hero with entrance choreography, animated proof counters, certification
  band, featured jars, benefits bento, farm-to-jar process, review rail, wholesale CTA, newsletter.
- **Shop** — category chips (future categories render as "coming soon"), search,
  four sort orders, stock and discount badges on every card.
- **Product** — image gallery, two size variants with per-variant price/MRP/stock,
  quantity stepper, add-to-cart, buy-now, pincode delivery checker,
  ingredient / nutrition / shipping accordions, reviews with a star picker,
  related jars, sticky mobile buy bar.
- **Cart** — persisted in `localStorage`, free-shipping progress bar, coupon field,
  live server-priced totals, cross-sell row.
- **Checkout** — guest checkout: contact, address, payment (Razorpay or COD),
  coupon, agreement. Totals are recomputed on the server; the browser's numbers
  are never trusted.
- **Order confirmation** — order ID, copy button, delivery timeline with AWB,
  full receipt, print stylesheet.
- **My Account** — track by order ID + mobile, or list every order on an email.
  No passwords, no accounts to forget (deliberate — see [design notes](#design-notes)).
- **About, Our Story** (7-step timeline), **FAQs** (18 Q&A in 4 groups), **Contact**
  (messages land in the admin inbox), four policy pages, 404.
- WhatsApp floating support button, mobile drawer, nav mega-menu with product
  thumbnails, scroll progress bar — all CSS/JS-driven, all `prefers-reduced-motion`-aware.

**Commerce logic**
- Prices are re-read from the datastore on every quote and every order — see
  [`lib/pricing.js`](lib/pricing.js).
- Coupons: percent (with cap), flat, free-shipping, minimum-order, expiry,
  max-uses. Seeded: `ORGANICHY10` (10%, min ₹499, cap ₹200), `FIRSTBIT`
  (15%, min ₹699, cap ₹250), `FREESHIP` (min ₹499), `GYM50` (₹50 off, min ₹999).
- Free delivery above ₹899, else ₹49; COD adds ₹29 courier handling.
- Stock decrements on order, returns on cancellation, low-stock alerts on the dashboard.
- Orders carry a status timeline (`placed → packed → shipped → delivered`, or
  `cancelled`) plus a courier AWB that feeds the customer's tracking page.

**Admin console** (`/admin`, password protected)
- **Overview** — revenue, orders to fulfil, AOV, customers, 14-day revenue chart,
  top products, low-stock alerts, recent orders.
- **Orders** — search, status filter, status + AWB + note per row (customer is
  notified on every change), CSV export for the accountant.
- **Products & stock** — price / MRP / stock per variant, hide from store,
  toggle featured, create a new product.
- **Coupons** — create with type, cap, minimum, expiry and use limits.
- **Inbox** — contact messages and newsletter subscribers, with CSV export.
- **Notifications** — every email/WhatsApp the store would have sent, with the
  exact body text. Nothing is silently dropped in demo mode.

---

## Running it

```bash
git clone <this repo> && cd organichy
node server.js                       # or ./start-mac-linux.sh, or double-click start-windows.bat
open http://localhost:3000/admin     # password: organichy@2026  ← change before launch
```

```bash
npm test                 # 60 smoke checks: every route, the cart maths, order round-trip, admin API
PORT=3001 node server.js # if 3000 is taken
node -e "require('./lib/db').reseed()"   # back to seed data
rm -rf data              # same thing, more bluntly
```

The smoke test boots its own server on `:3127` against a throwaway datastore
(`test/.data`), so it never touches your dev data.

---

## Configuration

Everything lives in [`lib/config.js`](lib/config.js), and every value can be
overridden by an environment variable. A `.env` file in the project root is read
by a 15-line loader inside `lib/config.js` — no dotenv dependency.

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | HTTP port (Render injects its own) | `3000` |
| `SITE_URL` | canonical URL for meta tags, sitemap, emails | `http://localhost:3000` |
| `ADMIN_PASSWORD` | `/admin` password | `organichy@2026` — **change this** |
| `ADMIN_SESSION_HOURS` | how long an admin login stays valid | `8` |
| `ADMIN_LOGIN_ATTEMPTS` | wrong passwords allowed per 5 min per IP | `10` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | live payments | empty ⇒ **demo mode**, nothing is charged |
| `DATA_DIR` | where the JSON datastore lives | `./data` |
| `FREE_SHIPPING_THRESHOLD` / `SHIPPING_FEE` / `COD_FEE` | money | `899` / `49` / `29` |
| `ENABLE_COD` | turn cash-on-delivery off | `true` |
| `WHATSAPP_NUMBER`, `FSSAI_LICENCE`, `GSTIN` | shown in footer, meta and emails | placeholders |

Copy `.env.example` to `.env` to start. Business copy (brand, address, FAQ set,
category roadmap) is edited directly in `lib/config.js` — it is content, not
infrastructure.

---

## Layout

```
organichy/
├── server.js              # http server: page routes, storefront API, admin API, static
├── lib/
│   ├── config.js          # brand, pricing, shipping, FAQ set, .env loader
│   ├── db.js              # JSON datastore: atomic writes, mtime cache, seed, stats
│   ├── seed.js            # 4 products × 2 variants, 8 reviews, 4 coupons, 4 demo orders
│   ├── pricing.js         # THE cart maths + coupon rules + checkout validation
│   ├── notify.js          # notification queue, with real SMTP/WhatsApp calls commented
│   ├── util.js            # esc, ₹ formatting with lakh grouping, pincodes, CSV
│   └── views/
│       ├── layout.js      # page shell, header, footer, icons, product card, form fields
│       ├── home.js        ├── shop.js      ├── product.js
│       ├── cart.js        # cart + checkout       ├── content.js   # about/story/faqs/contact/policies/404
│       ├── account.js     # confirmation + My Account
│       └── admin.js       # login + the whole console
├── public/
│   ├── css/main.css       # design system + motion layer (one file)
│   ├── js/boot.js         # sets the .js flag before paint
│   ├── js/main.js         # cart engine, PDP, checkout, forms, motion
│   ├── js/admin.js        # console behaviours (tabs, filters, inline saves)
│   └── images/            # product + lifestyle photography, favicon.svg
├── data/                  # JSON database — created on first boot, git-ignored
├── docs/                  # requirements checklist, quotation, original handoff pack
├── test/smoke.js          # the acceptance tests, run by `npm test` and CI
├── render.yaml, Dockerfile, Procfile, .github/workflows/ci.yml
└── start-windows.bat, start-mac-linux.sh, README.md, DEPLOY.md
```

---

## How the pieces work

**Views are template strings.** `lib/views/*.js` export functions that return a
full HTML document built from string concatenation — the same thing JSX does, without
the compiler. Escaping is one function (`esc()`), so reading a diff tells you
whether a value is safe. To change the home page you edit `lib/views/home.js`.

**One pricing path.** `pricing.priceCart(items, coupon, payment)` is called by
`POST /api/cart/price` (to paint the cart) and by `POST /api/orders` (to charge it).
It takes only `productId`, `variant` and `qty` from the client, re-reads every
price and stock level from the datastore, clamps quantities, applies the coupon
rules and rounds to whole rupees. There is no second implementation to drift out of sync.

**Cart persistence is client-side.** `localStorage` holds `[{productId, variant, qty}]`.
Nothing about an anonymous cart hits the database, and the site is cache-friendly
because of it. If you swap in Postgres, the cart needs no migration.

**Admin auth.** `POST /api/admin/login` issues a random 48-hex token held in
memory for `ADMIN_SESSION_HOURS` (8) and mirrored into an `HttpOnly; SameSite=Lax`
cookie so `/admin` can render server-side. The same token is also accepted as
`Authorization: Bearer` **and** as `?token=` — because iframes, previews and
hardened browsers drop cookies, and "the password is right but it keeps showing
the login page" is what that looks like from the inside. Login returns
`redirect: "/admin?token=…"`; the client adopts it into `sessionStorage`, cleans the
URL, re-plants the cookie through `POST /api/admin/session`, and re-attaches the
token to CSV links. `bearer()` deliberately does not read `req.body`, so
`/api/admin/login` can never authenticate itself. The limiter counts *wrong*
passwords only (`ADMIN_LOGIN_ATTEMPTS`, 10 per 5 min) and says how many are left,
so refreshing the login page never burns your own budget.
SameSite=Lax is what stops a cross-site `<form>` from riding the cookie, and
`/api/admin/orders.csv?token=…` exists so a cron job can pull a nightly export.

**Motion lives in CSS.** `.reveal` + `IntersectionObserver`, counters, hero
stagger, parallax, card spotlight, header compression, nav loader, sticky buy bar —
each guard-checked against `prefers-reduced-motion` and each inert if JS is off.
No animation library.

**SEO.** Per-page title/description/canonical/OG, JSON-LD for
`Organization`, `WebSite`, `Product` (with `AggregateOffer`, `AggregateRating`,
`Review`), `FAQPage`, `BreadcrumbList`, plus `/sitemap.xml` (with image entries)
and `/robots.txt`. `/admin`, cart, checkout and order pages are `noindex`.

**Design notes.** Guest checkout instead of accounts: a peanut-butter brand does
not need a credential store, and order-ID + mobile tracking is what customers
actually use. Real review gating: reviews are only attached to a delivered order
before being marked "verified", and criticism is never moderated — only abuse.

---

## Deploy

Full instructions for Render, Railway, Fly.io and a ₹500/month VPS with nginx +
Certbot are in **[DEPLOY.md](DEPLOY.md)**. Shortest path:

1. Push this repo to GitHub.
2. Render → New → **Blueprint** → pick the repo. `render.yaml` creates the web
   service, sets Node 20, wires `/api/health` as the health check and mounts a
   1 GB disk at `DATA_DIR`.
3. Enter `ADMIN_PASSWORD` when prompted (plus Razorpay keys when you have them).
4. Point your domain at the service, set `SITE_URL`, redeploy.

> **Persistence warning.** On Render's **free** tier the filesystem is ephemeral —
> every deploy or sleep wipes `data/*.json`, i.e. your orders. Use the Starter plan
> with the disk from `render.yaml`, or move `lib/db.js` to Postgres first.

---

## Why zero dependencies

The project was quoted at ₹7,000–10,000 with maintenance billed separately. A
framework would have added a bundler, a build cache, a lockfile and a permanent
stream of `npm audit` findings that someone has to be paid to read. Plain Node
means:

- **hosting is trivial** — one process, one port, works on a 512 MB VPS or a free
  PaaS tier, and `Dockerfile` is 20 lines;
- **the next developer can read all of it** — no conventions to learn, no
  codegen, one CSS file, one JS file;
- **the supply-chain surface is the Node runtime only** — there is nothing here to
  left-pad, orphan or compromise.

The datastore is a JSON file per collection in `data/`. At a few hundred orders a
day that is faster than a managed database round-trip and costs ₹0. When it stops
being true, replace `read`/`write` in `lib/db.js` with SQL and touch no view.

---

## Before going live

Client-side checklist (not code):

- [ ] `ADMIN_PASSWORD` changed, Razorpay **live** keys + merchant KYC (`POST /api/payment/create`
      and `/api/payment/verify` already contain the real call, guarded by key presence)
- [ ] Real product photography replacing `public/images/*` (these were generated for the demo)
- [ ] Actual `FSSAI_LICENCE`, `GSTIN`, registered address, and the WhatsApp Business number
      (currently the placeholder `919876543210`)
- [ ] Legal review of the four policy pages by their CA/lawyer
- [ ] SMTP or Resend key + WhatsApp Cloud API token, then uncomment the two functions
      in `lib/notify.js` (5-line change, already drafted)
- [ ] Courier: manual AWB entry in admin works today; Delhivery/Shiprocket automation is
      marked in `server.js` where `POST /api/admin/orders/:id/status` saves the AWB
- [ ] Persistence plan (see the warning above)

## Licence

Private — © ORGANICHY Food & Nutrition, Moradabad. Built for the brand; do not
redistribute.
