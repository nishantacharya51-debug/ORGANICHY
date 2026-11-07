# ORGANICHY — Handoff Pack 00 · Context & Instructions

**Read this file first.** It explains what the project is, what was decided during the build, and how to
turn the accompanying code packs into a live website. Packs 01–06 contain the complete source code as text.

---

## 0. Instruction to the receiving agent

You are receiving a finished, working e-commerce codebase for **ORGANICHY**, a peanut-butter brand in
Moradabad, India. Your job:

1. Recreate the repository from code packs 01–06 (every file path is given as a heading above its code block).
2. Copy in the binary assets listed in §6 (product photos + screenshots) — they cannot be represented as text.
3. Run it locally (`node server.js`) and confirm the smoke tests in §8 pass.
4. Create a GitHub repository and push it.
5. Deploy to Render using the included `render.yaml`, set the environment variables in §4, and verify.

Do **not** rewrite the application. It is complete: 14 storefront pages, cart, coupons, COD, checkout,
order tracking, reviews, and an admin console with analytics and inventory. Everything runs with **zero
npm dependencies** on Node 18+.

---

## 1. Project at a glance

| Item | Value |
|---|---|
| Brand | ORGANICHY — Food & Nutrition |
| Founder | Sourav |
| Location | Moradabad, Uttar Pradesh, India |
| Category | D2C food & nutrition (peanut butter now; protein bars, oats, whey, gainers planned) |
| Audience | Gym-goers, fitness enthusiasts, health-conscious Indian buyers |
| Site language / market | English UI, INR pricing, all-India shipping |
| Stack | Node.js 18+ / plain `http` server, server-rendered HTML strings, vanilla JS, CSS. **No frameworks, no build step, no dependencies.** |
| Storage | JSON files in `/data` (auto-created and seeded on first boot) |
| Pages | 14 + order confirmation + admin + 404 |
| Admin | `/admin`, password protected (default `organichy@2026`) |

### Why zero dependencies
The client budget is ₹7,000–10,000. A framework would add build tooling, bundler config and a permanent
npm security-patch maintenance bill. Plain Node keeps hosting cheap and the code readable for any future
developer. Swapping `lib/db.js` for Postgres later does not require touching any view.

---

## 2. What was built — feature inventory

**Storefront**
- Home (hero, proof counters, certifications band, featured products, benefits bento, process steps, reviews rail, CTA, newsletter)
- Shop / all products — category filter chips (future categories shown as "coming soon"), sort, search query support
- Product detail — image gallery, 2 size variants per product with per-size price/stock, quantity stepper, add to cart, buy now, pincode delivery estimate, ingredient/nutrition/shipping accordions, reviews with star input, related products
- About Us, Our Story (timeline), FAQs (18 Q&A in 4 groups, FAQPage schema), Contact (form → admin inbox)
- Cart — persistent, free-shipping progress bar, coupon field, quantity stepper, live totals
- Checkout — contact + address + payment, COD toggle, coupon, server-recalculated totals
- Order confirmation — order ID, items, totals, delivery timeline, ETA
- My Account — order tracking by order ID + phone, order history by email
- Privacy Policy, Shipping Policy, Return & Refund Policy, Terms & Conditions, 404
- WhatsApp floating support button, mobile sticky buy bar, nav dropdown with product thumbnails

**Commerce logic**
- Prices are **never** trusted from the browser: `/api/cart/price` and `/api/orders` re-price every line from the database
- Coupons: percent (with max cap), flat amount, free shipping, minimum order — seeded: `ORGANICHY10` (10%, min ₹499, cap ₹200), `FIRSTBIT` (15%, min ₹699, cap ₹250), `FREESHIP` (min ₹499), `GYM50` (₹50 off, min ₹999)
- Free shipping above ₹899, else ₹49 flat; COD adds ₹29 handling
- Stock decrements on order; low-stock alert on the dashboard
- Orders carry a status timeline: placed → packed → shipped → delivered (or cancelled) plus a courier AWB

**Admin console** (`/admin`)
- Login (token, 8-hour session), Overview (revenue, orders to fulfil, AOV, customers, 14-day revenue chart, top products, low-stock alerts, recent orders), Orders (status, tracking ID, CSV export), Products & stock (create/edit price/MRP/stock per variant, hide from store), Coupons (create), Inbox (contact messages, newsletter subscribers, notification queue)

**Platform**
- SEO: per-page meta, canonical, Open Graph, JSON-LD (Organization, WebSite, Product with offers and aggregateRating, FAQPage), `sitemap.xml`, `robots.txt`
- Security: CSP and security headers, per-IP rate limiting on login/orders/contact, server-side validation, token admin auth, admin excluded from indexing, `noindex` on transactional pages
- Motion system: scroll reveals with stagger, animated counters, hero entrance choreography, parallax, card spotlight, scroll progress bar, header compression, nav loader, sticky mobile buy bar — all disabled under `prefers-reduced-motion`
- Notifications: every order event is queued in `data/notifications.json` and shown in the admin; real email/WhatsApp sending is a commented 5-line change in `lib/notify.js`

---

## 3. Conversation & decision log (context for whoever takes over)

1. **Brief** — client (Sourav, Moradabad) supplied a 9-section brief: 14 pages, Razorpay, COD, coupons, reviews, WhatsApp support, shipping integration, admin dashboard, inventory, analytics, SEO; budget ₹7–10k; maintenance quoted separately.
2. **Built the full store** rather than a mockup — working cart, checkout, orders, admin, reviews.
3. **Design** — mint/white/green brand palette with blue trust accents, premium/minimal, fully responsive (verified at 390px, 768px, 1440px). Product photography and lifestyle images were generated for the demo and must be replaced with the brand's real photos before launch.
4. **Payments** — Razorpay is wired end-to-end in **demo mode**: orders are created with a `pay_DEMO…` reference and nothing is charged. Going live needs `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` plus the merchant's KYC; `server.js` → `POST /api/payment/create` marks exactly where the real order call and signature verification go.
5. **Notifications** — queued, not sent. SMTP / WhatsApp Cloud API examples sit commented in `lib/notify.js`.
6. **Courier** — manual AWB entry in admin feeds the customer tracking timeline. Delhivery/Shiprocket automation is a marked integration point, not implemented.
7. **Customer accounts** — intentionally not built: guest checkout plus order-ID+phone tracking instead of forcing signup. Email-OTP accounts with saved addresses are a priced add-on.
8. **Motion & polish pass** — added the animation layer described above after first delivery; all motion is CSS-driven and respects reduced-motion.
9. **Local run fixes** — added a zero-dependency `.env` loader, a friendly `EADDRINUSE` message, and `start-windows.bat` / `start-mac-linux.sh` launchers.
10. **Deploy prep** — git repo initialised with one commit, `render.yaml`, `Dockerfile`, `Procfile`, GitHub Actions CI (boots the server and smoke-tests 19 URLs), `/api/health` endpoint, and `DEPLOY.md`.

**Open items that need the client (not code):**
- Razorpay live keys + KYC
- WhatsApp Business number (currently a placeholder `919876543210` in `lib/config.js`)
- Courier account for automated tracking
- SMTP/Resend key for confirmation emails
- Final product photos, prices, FSSAI licence number, GSTIN, registered address
- Legal review of the four policy pages
- Decision on Render plan: free tier has an **ephemeral** filesystem (orders reset on redeploy) — Starter plan + 1 GB disk is needed for real orders

---

## 4. Configuration & credentials

All in `lib/config.js`, overridable by environment variables (`.env` is read automatically, no dependency):

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | HTTP port | `3000` |
| `SITE_URL` | Canonical URL for SEO/emails | `http://localhost:3000` |
| `ADMIN_PASSWORD` | Admin console password | `organichy@2026` — **change before launch** |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Live payments | empty = demo mode |

Other business settings live in `lib/config.js`: free-shipping threshold ₹899, shipping ₹49, COD fee ₹29, COD on/off, WhatsApp number, brand email, GSTIN.

---

## 5. Repository layout

```
organichy/
├── server.js                 # HTTP server, all page routes, REST + admin API
├── lib/
│   ├── config.js             # brand, pricing, shipping, admin password
│   ├── db.js                 # JSON datastore (read/write/seed)
│   ├── seed.js               # 4 products, 8 reviews, 4 coupons, 4 demo orders
│   ├── pricing.js            # server-authoritative cart maths + coupons
│   ├── notify.js             # order notification queue + email/WhatsApp hooks
│   └── views/                # layout, home, shop, product, cart, content, account, admin
├── public/
│   ├── css/main.css          # full design system + motion layer
│   ├── js/main.js            # cart, checkout, PDP, forms, motion engine
│   ├── js/admin.js           # admin console
│   └── images/               # product + lifestyle photography (binary, see §6)
├── data/                     # JSON database — auto-created, git-ignored
├── docs/                     # requirements checklist, quotation template, screenshots
├── render.yaml               # Render blueprint
├── Dockerfile, Procfile
├── .github/workflows/ci.yml  # smoke-test CI
├── start-windows.bat, start-mac-linux.sh
├── README.md, DEPLOY.md
└── .env.example
```

---

## 6. Binary assets (cannot be included as text)

Copy these into the repo exactly at these paths. They are in the workspace zip (`organichy-source.zip`)
or must be supplied by the client. Until they exist, the site renders with broken images.

| Path | Notes |
|---|---|
| `public/images/product-creamy.png` | Classic Creamy jar, 1:1 studio shot |
| `public/images/product-crunchy.png` | Crunchy jar |
| `public/images/product-choco.png` | Chocolate jar |
| `public/images/product-protein.png` | High Protein jar |
| `public/images/hero-lifestyle.png` | Two athletes in a kitchen (home hero + About) |
| `public/images/farm-story.png` | Farmer with peanuts (Our Story) |
| `docs/screenshots/*.png` | Optional, for the client proposal |

`public/images/favicon.svg` **is** text and is included in pack 03.

---

## 7. Deploy: GitHub → Render

```bash
# 1. recreate + push
cd organichy
node server.js                       # optional local check, http://localhost:3000
git init -b main
git add -A && git commit -m "ORGANICHY initial commit"
git remote add origin https://github.com/<user>/organichy.git
git push -u origin main
```

```text
# 2. Render
New → Blueprint → select the repo (render.yaml is detected)
Set env: ADMIN_PASSWORD (required), SITE_URL, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
Deploy → health check hits /api/health
```

3. Custom domain: Render → Settings → Custom Domains → add domain, point DNS, wait for auto-SSL, then set
   `SITE_URL=https://<domain>` and redeploy.

**Persistence warning:** Render free tier uses an ephemeral filesystem — `data/*.json` resets on each
deploy/restart. Use the Starter plan with the 1 GB disk declared in `render.yaml`, or migrate `lib/db.js`
to Postgres, before taking real orders.

Full instructions including Railway, Fly.io and a VPS with nginx + Certbot are in the `DEPLOY.md`
included in pack 06.

---

## 8. Acceptance tests (run these after recreating the repo)

```bash
node server.js &                                    # start on :3000
for p in / /shop /product/classic-creamy-peanut-butter /about /our-story /faqs /contact \
         /cart /checkout /account /privacy-policy /shipping-policy /return-refund-policy \
         /terms /admin /sitemap.xml /robots.txt /api/health /api/products; do
  echo "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000$p)  $p"
done                                                # expect 200 everywhere

curl -s -X POST http://127.0.0.1:3000/api/cart/price -H 'Content-Type: application/json' \
  -d '{"items":[{"productId":"p-creamy","variant":"500 g","qty":2}],"coupon":"ORGANICHY10","payment":"cod"}'
# expect: subtotal 1098, discount 110, shippingFee 0, codFee 29, total 1017

curl -s -X POST http://127.0.0.1:3000/api/admin/login \
  -H 'Content-Type: application/json' -d '{"password":"organichy@2026"}'
# expect: {"ok":true,"token":"…"}
```

Manual checks: add to cart → cart badge updates → coupon `ORGANICHY10` applies → checkout with COD →
order confirmation shows the order ID → `/account` tracks it with that ID + phone → `/admin` shows the
order and can change its status.

---

## 9. Pack index

| Pack | Contents |
|---|---|
| 00 | This file — context, decisions, deploy instructions |
| 01 | `server.js` + `lib/config.js`, `db.js`, `pricing.js`, `seed.js`, `notify.js` |
| 02 | Views part 1 — `layout.js`, `home.js`, `shop.js`, `product.js` |
| 03 | Views part 2 — `cart.js`, `content.js`, `account.js`, `admin.js` |
| 04 | `public/css/main.css` (design system + motion) |
| 05 | `public/js/main.js`, `public/js/admin.js`, `public/images/favicon.svg` |
| 06 | Config & docs — `package.json`, `render.yaml`, `Dockerfile`, `Procfile`, `.env.example`, `.gitignore`, CI workflow, start scripts, `README.md`, `DEPLOY.md`, `docs/*` |
