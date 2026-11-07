# ORGANICHY — quotation & scope note

Template for re-use on the next D2C food order. Numbers are what this project was
quoted at; keep the structure, change the digits.

---

## Scope: D2C storefront with admin (single brand, one product line)

| # | Deliverable | What the client actually gets | ₹ |
|---|---|---|---|
| 1 | Storefront — 14 pages | Home, Shop, Product, Cart, Checkout, Order confirmation, My Account/tracking, About, Our Story, FAQs, 4 policy pages, 404 | 26,000 |
| 2 | Commerce engine | Server-priced cart, 4 coupon types, free-shipping rules, COD handling, stock decrement, order status timeline | included |
| 3 | Payments | Razorpay checkout (UPI/cards/netbanking/wallets) wired end-to-end, demo mode until their KYC lands, signature verification drafted | included |
| 4 | Admin console | Overview + 14-day revenue chart, order queue with status/AWB updates + CSV, price/stock/visibility editor, coupon builder, contact inbox, subscriber list, notification log | 14,000 |
| 5 | Product content | Copy for every page, 18 FAQs, 4 product descriptions written from their label data, 4 SKU photos generated for the demo | 6,000 |
| 6 | SEO & performance | Per-page meta, OG, JSON-LD (Product/FAQ/Org/Breadcrumb), sitemap, robots, 200-size render, reduced-motion support | 4,000 |
| 7 | Hosting setup | GitHub repo, Render blueprint with persistent disk, custom domain + SSL, CI smoke tests, `DEPLOY.md` | 4,000 |
| | **Build total** | | **54,000** |
| | Negotiated to (single payment, no agency overhead, zero-dependency stack) | | **9,800** |

> **How the ₹9,800 number was reached, honestly:** the client's ceiling was ₹7,000–10,000.
> The scope above is what one weekend of agent-assisted building costs at that price — the
> quote was cut by removing everything that costs *them* money later: no framework, no
> licensed theme, no third-party app subscriptions, no page builder. The trade to state in
> writing: **no admin training videos, no design exploration beyond one pass, no content
> writing beyond the copy generated here.**

## Exclusions (say these out loud before signing)

- Domain, hosting, Razorpay and courier **account fees** — paid by the client, always.
- Product **photography** (real shots), FSSAI/GST legal text review, logo design.
- Live email/WhatsApp sending: needs *their* Resend/Twilio/WhatsApp Cloud account. The
  code is 5 lines from working; the keys are theirs.
- Anything marketplace (Amazon/Flipkart feed), mobile app, ERP/Tally sync, GST filing.

## Maintenance options

| Plan | Includes | ₹/month |
|---|---|---|
| **Quiet** | hosting + uptime watch, dependency-free stack so no patch cycle, 1 change request/mo (30 min), CSV backup check | 1,200 |
| **Standard** | Quiet + 3 change requests (2 h), seasonal banner/coupon setup, Razorpay reconciliation help, monthly 15-min call | 3,500 |
| **Growth** | Standard + new product lines, landing pages for ads, courier API integration, festival-campaign builds at a discount | 7,500 |

Recommended for this client: **Standard**. First three months quoted together at
₹9,000 (one 15% saving) because the launch period is when the questions come.

## Add-on price list (send when asked, don't wait)

| Add-on | ₹ | Days |
|---|---|---|
| Email-OTP customer accounts + saved addresses | 12,000 | 3 |
| Delhivery/Shiprocket label generation + auto-tracking | 15,000 | 3–4 |
| Live email + WhatsApp on every order event | 6,000 | 1 |
| Subscriptions / refill plans (Razorpay Subscriptions) | 18,000 | 4–5 |
| Hindi storefront (parallel locale) | 14,000 | 3 |
| Meta Pixel + GA4 + server-side conversion API | 8,000 | 1 |
| Festival landing page (single, with A/B hero) | 5,500 | 1 |
| Postgres migration for `lib/db.js` | 10,000 | 2 |

## Payment terms used

50% on signing, 40% on staging walkthrough, 10% after the domain goes live. Source
handed over on final payment — GitHub repo, env vars, `docs/`. Code is licensed to the
client for their own business; the stack stays dependency-free by agreement, which is
why their next developer can maintain it without me.
