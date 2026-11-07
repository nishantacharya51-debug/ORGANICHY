# ORGANICHY — requirements vs implementation

The client brief arrived as 9 sections. Every line below is either **built** (with the
file to look at) or **explicitly deferred** with the reason and the price hook. Nothing
is quietly missing.

## 1. Pages

| # | Brief | Status | Where |
|---|---|---|---|
| 1 | Home with hero, USPs, certifications | built | `lib/views/home.js` |
| 2 | Shop / all products with category filter | built | `lib/views/shop.js` (chips, search, 4 sorts) |
| 3 | Product page: gallery, variants, add-to-cart, buy-now | built | `lib/views/product.js` |
| 4 | About Us | built | `lib/views/content.js` → `about()` |
| 5 | Our Story with timeline | built | `content.js` → `ourStory()` (7 entries) |
| 6 | FAQs (min. 15 Q&A) | built — 18 | `content.js` → `faqs()`, data in `lib/config.js` |
| 7 | Contact form → admin inbox | built | `content.js` → `contact()`, `POST /api/contact` |
| 8 | Cart with coupon + free-shipping bar | built | `cart.js` view + `public/js/main.js` |
| 9 | Checkout: address, payment, coupon | built | `cart.js` → `checkoutPage()`, `POST /api/orders` |
| 10 | Order confirmation | built | `account.js` → `orderConfirmation()` |
| 11 | Order tracking / My Account | built | `account.js` → `accountPage()`, `GET /api/order` |
| 12 | Privacy, Shipping, Return/Refund, Terms | built | `content.js` → `policyPage()` (real clauses, not lorem) |
| 13 | 404 | built | `content.js` → `notFound()` |
| 14 | Admin console | built | `lib/views/admin.js` + `public/js/admin.js` |

## 2. Catalogue & inventory

| Requirement | Status | Notes |
|---|---|---|
| 4 products, 2 size variants each | built | `lib/seed.js` — 500 g / 1 kg with independent price, MRP and stock |
| Per-variant stock, decrement on order | built | `db.decrementStock()` in `POST /api/orders`; restored on cancel |
| Low-stock alert | built | `pricing.lowStockAt = 20`, panel on Overview + badge on PDP |
| Hide product from storefront | built | `active` flag in Admin → Products |
| Create a new product | built | Admin → Products → "Add a product" (auto slug, 2 variants) |
| Out-of-stock UX | built | variant shows "Sold out", add-to-cart disables, qty clamps to stock |

## 3. Cart, coupons, pricing

| Requirement | Status | Notes |
|---|---|---|
| Persistent cart | built | `localStorage`, key `organichy.cart.v1`, syncs across tabs on focus |
| Coupon types: percent / flat / free ship / min order | built | `lib/pricing.js` → `evaluateCoupon()`; adds expiry + max-uses |
| 4 seeded coupons | built | `ORGANICHY10`, `FIRSTBIT`, `FREESHIP`, `GYM50` (exact terms in Pack 00 §2) |
| Free shipping ≥ ₹899, else ₹49 | built | `config.pricing`, editable per deploy via env |
| COD handling ₹29 | built | applied only when `payment === 'cod'` |
| Server re-prices at checkout | built | `/api/cart/price` and `/api/orders` both go through `priceCart()`; a client-sent `price` is ignored — asserted in `test/smoke.js` |

## 4. Payments

| Requirement | Status | Notes |
|---|---|---|
| Razorpay integration | **built, demo mode** | Orders are created with a `pay_DEMO…` reference, nothing is charged. Live keys flip `config.payments.mode`. |
| Real order creation + signature verify | drafted in code | `POST /api/payment/create` (calls `api.razorpay.com/v1/orders` when live) and `/api/payment/verify` (HMAC `orderId|paymentId`) |
| UPI / cards / netbanking / wallets | delegated to Razorpay | no card data touches this server, so no PCI scope |
| COD | built | toggle with `ENABLE_COD` |

## 5. Shipping / courier

| Requirement | Status | Notes |
|---|---|---|
| Delivery estimate by pincode | built | `GET /api/pincode` + checker on PDP and checkout (`lib/util.js` heuristic: metro / regular / remote) |
| Tracking timeline per order | built | `placed → packed → shipped → delivered / cancelled` with per-step notes |
| Courier integration (Delhivery/Shiprocket) | **deferred — priced** | needs a courier account. The AWB field in Admin → Orders is the seam: `POST /api/admin/orders/:id/status` saves `awb` + `courier` and notifies the customer. Automation = a fetch call at that one point. |

## 6. Reviews

| Requirement | Status | Notes |
|---|---|---|
| Star rating + text per product | built | `POST /api/reviews/:productId`, star picker on PDP |
| Aggregate rating on cards and schema | built | computed from rows in `db.withComputed()`, published as `aggregateRating` |
| Verified-purchase marking | built | matched against delivered orders in `POST /api/orders` history |
| Rate limiting | built | 4 reviews / 10 min / IP |

## 7. Analytics (admin)

Revenue lifetime + 30 days, orders, to-fulfil, AOV, customers, COD share, subscribers,
unread messages, 14-day revenue chart, top products by quantity and value, low-stock —
all in `db.stats()` and rendered in Overview. **Deferred:** cohort/UTM analysis and any
GA4 dashboard. The site deliberately ships **zero** tracking scripts; if the client wants
GA4 later it is a `<script>` in `layout.js` plus a CSP exception (and a privacy-policy line).

## 8. Support & notifications

| Requirement | Status | Notes |
|---|---|---|
| WhatsApp floating button + click-to-chat | built | `layout.js`, number in `config.brand.whatsapp` |
| Email confirmations | **queued, not sent** | full body text generated and listed in Admin → Notifications; two commented functions in `lib/notify.js` are the wiring |
| WhatsApp order updates | queued, same | per-status copy in `notify.js` |
| Contact messages to admin | built | inbox + notification entry |

## 9. Non-functional

| Requirement | Status |
|---|---|
| Mobile responsive (390 / 768 / 1440) | built, one breakpoint set in `main.css` §17 |
| SEO: meta, OG, canonical, JSON-LD, sitemap, robots | built (`baseSchema`, per-page `schema`, `/sitemap.xml`, `/robots.txt`) |
| Security headers, rate limiting, validation | built (CSP `script-src 'self'`, XFO DENY, per-IP limiter on login/orders/contact/reviews, server-side validation in `pricing.validateCustomer`) |
| Performance | one CSS file, three JS files, no fonts loaded over the network, images quantised to 320–760 KB, ~15 ms cold page render |
| `prefers-reduced-motion` | honoured — every animation is gated |
| Accessibility | skip link, labelled fields, `aria-expanded` on accordions/drawer, focus-visible rings, semantic landmarks, alt text on product imagery |
| Zero dependencies | 0 runtime, 0 dev — verified by `package.json` and CI |
| Tests | 60 checks in `test/smoke.js`, run by CI on every push/PR |
| Backups | nightly CSV endpoint documented in `DEPLOY.md` §1 |

## Not built, on purpose

1. **Customer accounts with passwords** — guest checkout + order-ID/mobile tracking covers
   it with zero breach surface and zero support load. Email-OTP accounts with saved
   addresses: add-on, 2–3 days.
2. **Real payment capture / live courier labels / live email** — all three need the
   client's own keys and KYC. The code paths exist and are marked; they cannot be
   finished without the accounts.
3. **Multi-language (Hindi)** — copy lives in view files, so it is a fork of `lib/views`
   with a locale prefix. Not started; quoted separately.
4. **Subscriptions / refill plans** — real revenue idea, needs Razorpay Subscriptions and
   a scheduler. Separate project.
5. **Product photography** — the images in `public/images/` were generated for this demo
   and must be replaced with the brand's own shots before launch.
