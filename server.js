'use strict';
/**
 * ORGANICHY — server.js
 * Plain Node http server: every page route, the storefront REST API and the
 * admin API. No framework, no build step, no dependencies (see README).
 *
 * Layout of this file:
 *   1. helpers (headers, bodies, rate limiting, auth)
 *   2. storefront page routes
 *   3. storefront JSON API (cart pricing, orders, reviews, contact)
 *   4. admin API (login, state, orders, products, coupons, inbox, CSV)
 *   5. robots.txt / sitemap.xml / health
 *   6. the request handler + listen
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const config = require('./lib/config');
const db = require('./lib/db');
const pricing = require('./lib/pricing');
const notify = require('./lib/notify');
const { toCsv, esc } = require('./lib/util');

const viewsHome = require('./lib/views/home');
const viewsShop = require('./lib/views/shop');
const viewsProduct = require('./lib/views/product');
const viewsCart = require('./lib/views/cart');
const viewsContent = require('./lib/views/content');
const viewsAccount = require('./lib/views/account');
const viewsAdmin = require('./lib/views/admin');

const VERSION = require('./package.json').version;
const PUBLIC_DIR = path.join(__dirname, 'public');
const startedAt = Date.now();

const ROUTES = {
  home: '/',
  shop: '/shop',
  product: '/product/',
  cart: '/cart',
  checkout: '/checkout',
  account: '/account',
  faqs: '/faqs',
  about: '/about',
  story: '/our-story',
  contact: '/contact',
  policies: ['/privacy-policy', '/shipping-policy', '/return-refund-policy', '/terms'],
};

/* ================================================================== */
/* 1. Helpers                                                        */
/* ================================================================== */

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

const SECURITY = {
  // Scripts are same-origin only (no inline handlers); styles carry inline
  // attributes for a few computed widths, so style-src allows 'unsafe-inline'.
  'Content-Security-Policy': [
    "default-src 'self'",
    "img-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "connect-src 'self'",
    "font-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-XSS-Protection': '0',
};

function setSecurityHeaders(res) {
  for (const [k, v] of Object.entries(SECURITY)) res.setHeader(k, v);
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendHtml(res, html, status = 200, extra = {}) {
  setSecurityHeaders(res);
  send(
    res,
    status,
    html,
    Object.assign(
      {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
        Vary: 'Accept-Encoding',
      },
      extra
    )
  );
}

function sendJson(res, payload, status = 200, extra = {}) {
  setSecurityHeaders(res);
  send(res, status, JSON.stringify(payload), Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, extra));
}

function sendText(res, text, status = 200, type = 'text/plain; charset=utf-8', extra = {}) {
  send(res, status, text, Object.assign({ 'Content-Type': type, 'Cache-Control': 'no-cache' }, extra));
}

function redirect(res, location, status = 302, extra = {}) {
  setSecurityHeaders(res);
  res.writeHead(status, Object.assign({ Location: location }, extra));
  res.end();
}

function readBody(req, limit = 512 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error('payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function parseJson(req) {
  const raw = await readBody(req);
  if (!raw) return {};
  const type = String(req.headers['content-type'] || '');
  if (type.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(raw).entries());
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error('invalid JSON body'), { status: 400 });
  }
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

/* Naive fixed-window limiter — no Redis needed at this traffic level. */
const buckets = new Map();
function limited(key, max, windowMs = 60000) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return false;
  }
  b.n += 1;
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
  }
  return b.n > max;
}

/* ---------------------------- admin auth ---------------------------- */
// Tokens live in memory: an app restart signs everyone out, which is the right
// default for a single-tenant shop console. The same value is also issued as an
// HttpOnly, SameSite=Lax cookie so /admin can render server-side; SameSite=Lax
// means a cross-site <form> never carries it, which is our CSRF defence.
const adminTokens = new Map(); // token -> expiry epoch ms

function issueToken() {
  const token = crypto.randomBytes(24).toString('hex');
  adminTokens.set(token, Date.now() + config.admin.sessionHours * 3600 * 1000);
  for (const [t, exp] of adminTokens) if (exp < Date.now()) adminTokens.delete(t);
  return token;
}

function bearer(req) {
  const h = String(req.headers.authorization || '');
  if (h.toLowerCase().startsWith('bearer ')) return h.slice(7).trim();
  const cookie = String(req.headers.cookie || '');
  const m = cookie.match(/(?:^|;\s*)oh_admin=([a-f0-9]{16,})/);
  return m ? m[1] : '';
}

function isAuthed(req) {
  const token = bearer(req);
  if (!token) return false;
  const exp = adminTokens.get(token);
  if (!exp) return false;
  if (exp < Date.now()) {
    adminTokens.delete(token);
    return false;
  }
  return true;
}

function authCookie(token) {
  return `oh_admin=${token}; Max-Age=${config.admin.sessionHours * 3600}; Path=/; HttpOnly; SameSite=Lax`;
}

function safeCompare(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/* ----------------------------- validation ---------------------------- */
function cleanStr(v, max = 200) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}
function looksLikeHoneypot(body) {
  return Boolean(cleanStr(body.website, 1) || cleanStr(body.company_website, 1));
}

/* ================================================================== */
/* 2. Page routes                                                    */
/* ================================================================== */

function pageHealthcheck() {
  // ensure the datastore exists before the first view reads it
  db.init();
}

function handlePage(req, res, url) {
  const p = url.pathname;

  if (p === '/' || p === '/index.html') {
    return sendHtml(res, viewsHome.home());
  }
  if (p === '/shop') {
    return sendHtml(res, viewsShop.shop(Object.fromEntries(url.searchParams)));
  }
  if (p.startsWith('/product/')) {
    const slug = decodeURIComponent(p.slice('/product/'.length)).replace(/\/+$/, '');
    if (!/^[a-z0-9-]+$/i.test(slug)) {
      sendHtml(res, viewsContent.notFound(req), 404);
      return true;
    }
    const html = viewsProduct.productPage(slug);
    if (!html) {
      sendHtml(res, viewsContent.notFound(req), 404);
      return true;
    }
    return sendHtml(res, html);
  }
  if (p === '/cart') return sendHtml(res, viewsCart.cartPage());
  if (p === '/checkout') return sendHtml(res, viewsCart.checkoutPage(Object.fromEntries(url.searchParams)));
  if (p === '/account') return sendHtml(res, viewsAccount.accountPage(Object.fromEntries(url.searchParams)));
  if (p.startsWith('/order/')) {
    const id = decodeURIComponent(p.slice('/order/'.length));
    const order = db.getOrder(id);
    if (!order) {
      sendHtml(res, viewsContent.notFound(req), 404);
      return true;
    }
    return sendHtml(res, viewsAccount.orderConfirmation(order));
  }
  if (p === '/about') return sendHtml(res, viewsContent.about());
  if (p === '/our-story') return sendHtml(res, viewsContent.ourStory());
  if (p === '/faqs') return sendHtml(res, viewsContent.faqs());
  if (p === '/contact') return sendHtml(res, viewsContent.contact(Object.fromEntries(url.searchParams)));
  if (p.startsWith('/policy/')) {
    return redirect(res, `/${p.slice('/policy/'.length)}`, 301);
  }
  const key = p.replace(/^\//, '');
  if (ROUTES.policies.includes(p)) return sendHtml(res, viewsContent.policyPage(key));

  if (p === '/admin') {
    if (!isAuthed(req)) return sendHtml(res, viewsAdmin.loginPage());
    return sendHtml(res, viewsAdmin.adminPage());
  }
  if (p === '/admin/login') return redirect(res, '/admin', 302);

  if (p === '/robots.txt') return sendText(res, robotsTxt());
  if (p === '/sitemap.xml') return sendText(res, sitemapXml(), 200, 'application/xml; charset=utf-8');
  if (p === '/favicon.ico') return redirect(res, '/images/favicon.svg', 302);
  if (p === '/manifest.webmanifest') {
    return sendJson(res, {
      name: 'ORGANICHY — Food & Nutrition',
      short_name: 'ORGANICHY',
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#0f7a4d',
      icons: [{ src: '/images/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
    });
  }

  return false; // not handled here
}

function robotsTxt() {
  return `# ORGANICHY — ${config.site.url}
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /cart
Disallow: /checkout
Disallow: /order/
Disallow: /account

# AI crawlers: content may be read, do not use it to train storefront clones.
User-agent: GPTBot
Disallow: /api/

Sitemap: ${config.site.url}/sitemap.xml
`;
}

function sitemapXml() {
  const now = new Date().toISOString().slice(0, 10);
  const statics = [
    ['/', '1.0', 'daily'],
    ['/shop', '0.9', 'daily'],
    ['/our-story', '0.7', 'monthly'],
    ['/about', '0.6', 'monthly'],
    ['/faqs', '0.6', 'weekly'],
    ['/contact', '0.5', 'monthly'],
    ['/privacy-policy', '0.3', 'yearly'],
    ['/shipping-policy', '0.3', 'yearly'],
    ['/return-refund-policy', '0.3', 'yearly'],
    ['/terms', '0.3', 'yearly'],
  ];
  const urls = statics.map(
    ([loc, priority, changefreq]) =>
      `  <url>\n    <loc>${esc(config.site.url + loc)}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`
  );
  for (const p of db.listProducts({ activeOnly: true })) {
    urls.push(
      `  <url>\n    <loc>${esc(config.site.url + '/product/' + p.slug)}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n    <image:image><image:loc>${esc(config.site.url + (p.images[0] || ''))}</image:loc><image:title>${esc(p.name)}</image:title></image:image>\n  </url>`
    );
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>\n`;
}

/* ================================================================== */
/* 3. Storefront JSON API                                              */
/* ================================================================== */

const api = {};

api['GET /api/health'] = async (req, res) => {
  const products = db.listProducts();
  return sendJson(res, {
    ok: true,
    status: 'ok',
    service: 'organichy',
    version: VERSION,
    node: process.version,
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    time: new Date().toISOString(),
    db: { products: products.length, orders: db.listOrders().length, reviews: db.reviewsFor(products[0] ? products[0].id : '').length },
    payments: config.payments.mode,
    seed: config.seedVersion,
  });
};

api['GET /api/products'] = async (req, res) => {
  const products = db.listProducts({ activeOnly: true }).map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    shortName: p.shortName,
    category: p.category,
    badge: p.badge || '',
    tagline: p.tagline,
    blurb: p.blurb,
    image: (p.images || [])[0],
    rating: p.ratingValue,
    reviewCount: p.reviewCount,
    featured: !!p.featured,
    price: p.price,
    mrp: p.mrp,
    maxPrice: p.maxPrice,
    stock: p.stock,
    soldOut: p.soldOut,
    variants: (p.variants || []).map((v) => ({ id: v.id, label: v.label, price: v.price, mrp: v.mrp, stock: Number(v.stock) || 0, sku: v.sku })),
  }));
  return sendJson(res, { ok: true, count: products.length, currency: config.pricing.currency, products });
};

api['GET /api/product/:slug'] = async (req, res, url) => {
  const slug = decodeURIComponent(url.pathname.replace('/api/product/', ''));
  const p = db.getProduct(slug);
  if (!p || p.active === false) return sendJson(res, { ok: false, error: 'product not found' }, 404);
  return sendJson(res, {
    ok: true,
    product: { ...p, reviews: db.reviewsFor(p.id) },
    config: {
      freeShippingThreshold: config.pricing.freeShippingThreshold,
      shippingFee: config.pricing.shippingFee,
      codFee: config.pricing.codFee,
      maxQtyPerLine: config.pricing.maxQtyPerLine,
      lowStockAt: config.pricing.lowStockAt,
    },
  });
};

/** The single source of cart truth. Client sends ids/qty only. */
api['POST /api/cart/price'] = async (req, res) => {
  const body = await parseJson(req);
  const priced = pricing.priceCart(body.items, body.coupon, body.payment);
  return sendJson(res, priced);
};

api['GET /api/coupons'] = async (req, res) => {
  return sendJson(res, {
    ok: true,
    coupons: db
      .listCoupons()
      .filter((c) => c.active !== false)
      .map((c) => ({ code: c.code, description: c.description, minOrder: c.minOrder, type: c.type, value: c.value })),
  });
};

api['GET /api/pincode'] = async (req, res, url) => {
  const { estimatePincode } = require('./lib/util');
  const out = estimatePincode(url.searchParams.get('pin') || url.searchParams.get('q') || '');
  if (!out.ok) return sendJson(res, { ok: false, error: out.reason }, 422);
  return sendJson(res, {
    ok: true,
    pincode: out.pincode,
    window: out.window,
    days: out.days,
    date: out.date.toISOString().slice(0, 10),
    dateLabel: new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(out.date),
    metro: out.metro,
    note: out.note,
    codAvailable: config.pricing.codEnabled,
  });
};

api['POST /api/orders'] = async (req, res) => {
  if (limited(`order:${clientIp(req)}`, 12, 60000)) {
    return sendJson(res, { ok: false, error: 'Too many attempts — wait a minute and try again.' }, 429);
  }
  const body = await parseJson(req);
  if (looksLikeHoneypot(body)) return sendJson(res, { ok: true, orderId: 'OH-SPAM', quiet: true });

  const { errors, clean } = pricing.validateCustomer(body.customer || {});
  if (errors.length) return sendJson(res, { ok: false, error: errors[0], errors }, 422);

  const priced = pricing.priceCart(body.items, body.coupon, body.payment);
  if (!priced.lines.length) {
    return sendJson(res, { ok: false, error: 'Your cart is empty or every item is out of stock.', problems: priced.problems }, 422);
  }
  if (priced.total <= 0) return sendJson(res, { ok: false, error: 'Order total is invalid.' }, 422);

  const isCod = String(body.payment || '').toLowerCase() === 'cod';
  if (isCod && !config.pricing.codEnabled) return sendJson(res, { ok: false, error: 'Cash on delivery is currently unavailable.' }, 422);

  const id = db.newOrderId();
  const now = new Date().toISOString();
  const payment = isCod
    ? { mode: 'cod', status: 'pending', ref: 'cod_pending' }
    : config.payments.mode === 'live'
      ? { mode: 'razorpay', status: 'created', ref: `order_${crypto.randomBytes(7).toString('hex')}` }
      : { mode: 'demo', status: 'paid', ref: `pay_DEMO${crypto.randomBytes(6).toString('hex')}` };

  const order = {
    id,
    createdAt: now,
    status: 'placed',
    payment: isCod ? 'cod' : 'razorpay',
    paymentStatus: payment.status,
    paymentRef: payment.ref,
    paymentMode: payment.mode,
    customer: clean,
    items: priced.lines.map((l) => ({
      productId: l.productId,
      slug: l.slug,
      name: l.name,
      variant: l.variant,
      price: l.price,
      qty: l.qty,
      image: l.image,
      sku: l.sku,
    })),
    subtotal: priced.subtotal,
    coupon: priced.coupon || '',
    discount: priced.discount,
    shippingFee: priced.shippingFee,
    codFee: priced.codFee,
    total: priced.total,
    awb: '',
    courier: '',
    timeline: [{ status: 'placed', at: now, note: 'Order received on the website. Awaiting packing.' }],
    source: cleanStr(body.source, 20) || 'web',
    userAgent: cleanStr(req.headers['user-agent'], 160),
  };

  db.decrementStock(priced.lines);
  db.addOrder(order);
  if (priced.coupon) db.bumpCouponUsage(priced.coupon);
  if (body.newsletter === 'yes' || body.newsletter === true) db.addSubscriber(clean.email, 'checkout');
  notify.onOrderCreated(order);

  return sendJson(res, {
    ok: true,
    orderId: id,
    status: 'placed',
    total: priced.total,
    payment,
    razorpay: payment.mode === 'razorpay' ? { keyId: config.payments.razorpayKeyId, orderId: payment.ref } : null,
    redirect: `/order/${id}`,
    etaDays: [config.shipping.etaMinDays, config.shipping.etaMaxDays],
  }, 201);
};

/** Order status for the customer (needs the phone number on the order). */
api['GET /api/order'] = async (req, res, url) => {
  const id = cleanStr(url.searchParams.get('id'), 40);
  const phone = cleanStr(url.searchParams.get('phone'), 20).replace(/\D/g, '').slice(-10);
  const order = db.getOrder(id);
  if (!order || (phone && String(order.customer.phone).replace(/\D/g, '').slice(-10) !== phone)) {
    return sendJson(res, { ok: false, error: 'No order matches that ID and mobile number.' }, 404);
  }
  const publicView = {
    id: order.id,
    createdAt: order.createdAt,
    status: order.status,
    total: order.total,
    items: order.items,
    customer: { name: order.customer.name, city: order.customer.city, state: order.customer.state, pincode: order.customer.pincode, address: order.customer.address },
    timeline: order.timeline,
    awb: order.awb,
    courier: order.courier,
    payment: order.payment,
    paymentStatus: order.paymentStatus,
  };
  return sendJson(res, { ok: true, order: publicView });
};

api['POST /api/reviews/:productId'] = async (req, res, url) => {
  const productId = decodeURIComponent(url.pathname.replace('/api/reviews/', ''));
  if (limited(`review:${clientIp(req)}`, 4, 600000)) {
    return sendJson(res, { ok: false, error: 'You just posted a review — give it a few minutes.' }, 429);
  }
  const body = await parseJson(req);
  if (looksLikeHoneypot(body)) return sendJson(res, { ok: true });
  const product = db.getProduct(productId);
  if (!product) return sendJson(res, { ok: false, error: 'Unknown product.' }, 404);

  const name = cleanStr(body.name, 40);
  const title = cleanStr(body.title, 90);
  const text = cleanStr(body.body, 900);
  const rating = Math.min(5, Math.max(1, Number.parseInt(body.rating, 10) || 0));
  if (name.length < 2) return sendJson(res, { ok: false, error: 'Please give a name (first name is fine).' }, 422);
  if (!rating) return sendJson(res, { ok: false, error: 'Pick a star rating.' }, 422);
  if (title.length < 4) return sendJson(res, { ok: false, error: 'A short headline, please.' }, 422);
  if (text.length < 12) return sendJson(res, { ok: false, error: 'A little more detail helps the next buyer.' }, 422);

  const review = {
    id: db.newId('r'),
    productId: product.id,
    name: name.includes(' ') ? name.split(' ')[0][0] + '. ' + name.split(' ').slice(-1)[0] : name,
    city: cleanStr(body.city, 40) || 'India',
    rating,
    title,
    body: text,
    createdAt: new Date().toISOString(),
    approved: true,
    verifiedPurchase: db.listOrders().some((o) => (o.customer.email || '').toLowerCase().includes(name.split(' ')[0].toLowerCase()) && (o.items || []).some((l) => l.productId === product.id)),
  };
  db.addReview(review);
  return sendJson(res, { ok: true, review, rating: db.getProduct(product.id).ratingValue, reviewCount: db.getProduct(product.id).reviewCount }, 201);
};

api['POST /api/newsletter'] = async (req, res) => {
  const body = await parseJson(req);
  if (limited(`news:${clientIp(req)}`, 6, 600000)) return sendJson(res, { ok: false, error: 'Slow down a second.' }, 429);
  if (looksLikeHoneypot(body)) return sendJson(res, { ok: true });
  const email = cleanStr(body.email, 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return sendJson(res, { ok: false, error: 'That email address does not look right.' }, 422);
  db.addSubscriber(email, cleanStr(body.source, 20) || 'site');
  return sendJson(res, { ok: true, message: 'You are on the list — next roast note goes out first.' });
};

api['POST /api/contact'] = async (req, res) => {
  if (limited(`contact:${clientIp(req)}`, 5, 300000)) {
    return sendJson(res, { ok: false, error: 'Too many messages from this connection — try WhatsApp or email.' }, 429);
  }
  const body = await parseJson(req);
  if (looksLikeHoneypot(body)) return sendJson(res, { ok: true });
  const name = cleanStr(body.name, 60);
  const email = cleanStr(body.email, 120).toLowerCase();
  const message = cleanStr(body.body, 2000);
  if (name.length < 2) return sendJson(res, { ok: false, error: 'Please tell us your name.' }, 422);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return sendJson(res, { ok: false, error: 'A working email, please — that is how we reply.' }, 422);
  if (message.length < 10) return sendJson(res, { ok: false, error: 'A slightly longer message?' }, 422);

  db.addMessage({
    id: db.newId('m'),
    createdAt: new Date().toISOString(),
    name,
    email,
    phone: cleanStr(body.phone, 20),
    subject: cleanStr(body.subject, 120) || '(no subject)',
    orderId: cleanStr(body.orderId, 20),
    body: message,
    read: false,
  });
  notify.queue({
    channel: 'admin',
    kind: 'contact.message',
    to: config.brand.email,
    subject: `Website enquiry from ${name}`,
    body: `${message}\n\nReply to: ${email}${body.phone ? ` / ${cleanStr(body.phone, 20)}` : ''}`,
  });
  return sendJson(res, { ok: true, message: `Thanks ${name.split(' ')[0]} — message received. We reply within one business day.` });
};

/** Razorpay order creation. In demo mode nothing is charged. */
api['POST /api/payment/create'] = async (req, res) => {
  const body = await parseJson(req);
  const amount = Math.max(0, Math.round(Number(body.amount) || 0));
  if (!amount) return sendJson(res, { ok: false, error: 'Missing amount.' }, 422);

  if (config.payments.mode !== 'live') {
    return sendJson(res, {
      ok: true,
      mode: 'demo',
      amount,
      currency: config.pricing.currencyCode,
      reference: `pay_DEMO${crypto.randomBytes(6).toString('hex')}`,
      note: 'Razorpay keys are not configured, so this is a simulated payment: the order is saved and nothing is charged. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to go live.',
    });
  }

  /* ---------------------------------------------------------------
   * LIVE PATH — the 5 lines that talk to Razorpay, kept here so the
   * integration point is obvious:
   *   const creds = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
   *   const r = await fetch('https://api.raazorpay.com/v1/orders', ...)   // see below
   * --------------------------------------------------------------- */
  try {
    const creds = Buffer.from(`${config.payments.razorpayKeyId}:${config.payments.razorpayKeySecret}`).toString('base64');
    const rzp = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amount * 100, // paise
        currency: config.pricing.currencyCode,
        receipt: cleanStr(body.receipt, 40) || `oh_${Date.now()}`,
      }),
    });
    const json = await rzp.json();
    if (!rzp.ok) throw new Error(json?.error?.description || `razorpay ${rzp.status}`);
    return sendJson(res, { ok: true, mode: 'live', razorpayOrderId: json.id, amount, currency: json.currency, keyId: config.payments.razorpayKeyId });
  } catch (err) {
    return sendJson(res, { ok: false, error: `Could not create the payment order: ${err.message}` }, 502);
  }
};

/**
 * Razorpay webhook / signature check. With live keys, verify the HMAC of
 * `razorpay_order_id|razorpay_payment_id` against the key secret before you
 * flip an order to paid.
 */
api['POST /api/payment/verify'] = async (req, res) => {
  const body = await parseJson(req);
  const { orderId, paymentId, signature } = body;
  if (config.payments.mode !== 'live') {
    return sendJson(res, { ok: true, mode: 'demo', verified: true, note: 'demo mode — signature check skipped' });
  }
  const expected = crypto
    .createHmac('sha256', config.payments.razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  const ok = signature && safeCompare(expected, signature);
  return sendJson(res, { ok: Boolean(ok), verified: Boolean(ok) }, ok ? 200 : 400);
};

/* ================================================================== */
/* 4. Admin API                                                      */
/* ================================================================== */

api['POST /api/admin/login'] = async (req, res) => {
  const ip = clientIp(req);
  if (limited(`login:${ip}`, 10, 300000)) {
    const msg = 'Too many password attempts. Locked for 5 minutes.';
    if (wantsHtml(req)) return sendHtml(res, viewsAdmin.loginPage({ error: msg }), 429);
    return sendJson(res, { ok: false, error: msg }, 429);
  }
  const body = await parseJson(req);
  const password = String(body.password || '');
  if (!safeCompare(password, config.admin.password)) {
    // eslint-disable-next-line no-console
    console.warn(`[admin] failed login from ${ip}`);
    if (wantsHtml(req)) return sendHtml(res, viewsAdmin.loginPage({ error: 'Wrong password.' }), 401);
    return sendJson(res, { ok: false, error: 'Wrong password.' }, 401);
  }
  const token = issueToken();
  const headers = { 'Set-Cookie': authCookie(token) };
  if (wantsHtml(req)) return redirect(res, '/admin', 303, headers);
  return sendJson(res, { ok: true, token, expiresInSeconds: config.admin.sessionHours * 3600 }, 200, headers);
};

function wantsHtml(req) {
  const ct = String(req.headers['content-type'] || '');
  if (ct.includes('application/x-www-form-urlencoded') && !String(req.headers.accept || '').includes('application/json')) return true;
  return false;
}

api['POST /api/admin/logout'] = async (req, res) => {
  const token = bearer(req);
  if (token) adminTokens.delete(token);
  return sendJson(res, { ok: true }, 200, { 'Set-Cookie': 'oh_admin=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax' });
};

function requireAdmin(req, res) {
  if (isAuthed(req)) return true;
  sendJson(res, { ok: false, error: 'Admin session expired — sign in again at /admin.' }, 401);
  return false;
}

api['GET /api/admin/state'] = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const products = db.listProducts();
  return sendJson(res, {
    ok: true,
    stats: db.stats({ days: 14 }),
    products: products.map((p) => ({ ...p, reviews: db.reviewsFor(p.id).length })),
    orders: db.listOrders(),
    coupons: db.listCoupons(),
    messages: db.listMessages(),
    subscribers: db.listSubscribers(),
    notifications: db.listNotifications().slice(0, 100),
    config: {
      siteUrl: config.site.url,
      payments: config.payments.mode,
      freeShippingThreshold: config.pricing.freeShippingThreshold,
      shippingFee: config.pricing.shippingFee,
      codFee: config.pricing.codFee,
      codEnabled: config.pricing.codEnabled,
      lowStockAt: config.pricing.lowStockAt,
    },
  });
};

api['POST /api/admin/orders/:id/status'] = async (req, res, url) => {
  if (!requireAdmin(req, res)) return;
  const id = decodeURIComponent(url.pathname.split('/').slice(-2)[0]);
  const body = await parseJson(req);
  const order = db.getOrder(id);
  if (!order) return sendJson(res, { ok: false, error: 'no such order' }, 404);

  const status = cleanStr(body.status, 20).toLowerCase();
  if (!viewsAdmin.STATUSES.includes(status)) return sendJson(res, { ok: false, error: `status must be one of ${viewsAdmin.STATUSES.join(', ')}` }, 422);

  const now = new Date().toISOString();
  const note = cleanStr(body.note, 300);
  const patch = {
    status,
    timeline: (order.timeline || []).concat([{ status, at: now, note: note || defaultNote(status, order) }]),
  };
  if (body.awb !== undefined) {
    patch.awb = cleanStr(body.awb, 40);
    patch.courier = cleanStr(body.courier, 40) || order.courier || 'Delhivery Surface';
    if (patch.awb) patch.timeline[patch.timeline.length - 1].note = `AWB ${patch.awb} via ${patch.courier}.`;
  }
  if (status === 'delivered' && order.payment === 'cod') patch.paymentStatus = 'paid';
  if (status === 'cancelled') {
    // put the stock back — it never left the shelf
    db.decrementStock((order.items || []).map((l) => ({ ...l, qty: -(Number(l.qty) || 1) })));
    patch.paymentStatus = order.payment === 'cod' ? 'cancelled' : 'refund_due';
  }
  const updated = db.updateOrder(id, patch);
  notify.onOrderStatus(updated, status, note);
  return sendJson(res, { ok: true, order: updated });
};

function defaultNote(status, order) {
  if (status === 'packed') return `Packed in Moradabad (${(order.items || []).length} line${order.items.length === 1 ? '' : 's'}).`;
  if (status === 'shipped') return order.awb ? `Handed to ${order.courier || 'the courier'}, AWB ${order.awb}.` : 'Handed to the courier.';
  if (status === 'delivered') return 'Delivered and signed for.';
  if (status === 'cancelled') return 'Cancelled from the admin console.';
  return 'Updated by the admin console.';
}

api['POST /api/admin/products/:id'] = async (req, res, url) => {
  if (!requireAdmin(req, res)) return;
  const id = decodeURIComponent(url.pathname.split('/').slice(-1)[0]);
  const body = await parseJson(req);
  const product = db.getProduct(id);
  if (!product) return sendJson(res, { ok: false, error: 'no such product' }, 404);

  const raw = db.read('products').find((p) => p.id === product.id);
  const next = { ...raw };
  if (Array.isArray(body.variants)) {
    next.variants = raw.variants.map((v) => {
      const patch = body.variants.find((x) => String(x.id) === String(v.id)) || {};
      return {
        ...v,
        price: patch.price !== undefined ? Math.max(1, Math.round(Number(patch.price) || 0)) : v.price,
        mrp: patch.mrp !== undefined ? Math.max(1, Math.round(Number(patch.mrp) || 0)) : v.mrp,
        stock: patch.stock !== undefined ? Math.max(0, Math.round(Number(patch.stock) || 0)) : v.stock,
      };
    });
  }
  if (body.active !== undefined) next.active = Boolean(body.active);
  if (body.featured !== undefined) next.featured = Boolean(body.featured);
  if (body.badge !== undefined) next.badge = cleanStr(body.badge, 30);
  if (body.name) next.name = cleanStr(body.name, 90);
  db.saveProduct(next);
  return sendJson(res, { ok: true, product: db.getProduct(product.id) });
};

api['POST /api/admin/products'] = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const body = await parseJson(req);
  const name = cleanStr(body.name, 90);
  if (name.length < 4) return sendJson(res, { ok: false, error: 'Give the product a name.' }, 422);
  const { slugify } = require('./lib/util');
  const slug = cleanStr(body.slug, 70) || slugify(name);
  if (db.getProduct(slug)) return sendJson(res, { ok: false, error: 'A product with that slug already exists.' }, 409);
  const price500 = Math.max(1, Number(body.price500) || 599);
  const price1kg = Math.max(1, Number(body.price1kg) || 999);
  const product = {
    id: db.newId('p'),
    slug,
    name,
    shortName: name.split(' ').slice(-2).join(' '),
    category: cleanStr(body.category, 30) || 'peanut-butter',
    badge: cleanStr(body.badge, 30) || 'New',
    tagline: cleanStr(body.tagline, 90) || 'Freshly ground.',
    blurb: cleanStr(body.blurb, 240) || cleanStr(body.tagline, 90),
    description: cleanStr(body.description, 1200) || cleanStr(body.blurb, 240) || '',
    images: [cleanStr(body.image, 120) || '/images/product-creamy.png'],
    accent: cleanStr(body.accent, 9) || '#0f7a4d',
    tint: '#eef6f0',
    highlights: ['No palm oil', 'No added sugar', 'Small-batch roast'],
    ingredients: cleanStr(body.ingredients, 500) || 'Dry roasted peanuts, sea salt.',
    nutritionNote: 'Per serving — 32 g (2 tablespoons)',
    nutrition: [
      { label: 'Energy', value: '188 kcal' },
      { label: 'Protein', value: '8.0 g' },
      { label: 'Total fat', value: '16.0 g' },
      { label: 'Carbohydrate', value: '6.2 g' },
    ],
    variants: [
      { id: db.newId('v'), label: '500 g', price: price500, mrp: Math.round(price500 * 1.18), stock: Math.max(0, Number(body.stock500) || 40), sku: `ORG-${slug.slice(0, 6).toUpperCase()}-500` },
      { id: db.newId('v'), label: '1 kg', price: price1kg, mrp: Math.round(price1kg * 1.16), stock: Math.max(0, Number(body.stock1kg) || 20), sku: `ORG-${slug.slice(0, 6).toUpperCase()}-1KG` },
    ],
    createdAt: new Date().toISOString(),
    active: true,
    featured: false,
  };
  db.saveProduct(product);
  return sendJson(res, { ok: true, product: db.getProduct(slug) }, 201);
};

api['POST /api/admin/coupons'] = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const body = await parseJson(req);
  const code = cleanStr(body.code, 24).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (code.length < 3) return sendJson(res, { ok: false, error: 'Code needs at least 3 characters (A–Z, 0–9).' }, 422);
  if (db.findCoupon(code)) return sendJson(res, { ok: false, error: 'That code already exists.' }, 409);
  const type = ['percent', 'flat', 'freeshipping'].includes(body.type) ? body.type : 'percent';
  const coupon = {
    id: db.newId('c'),
    code,
    label: cleanStr(body.label, 40) || `${code}`,
    type,
    value: Math.max(0, Math.round(Number(body.value) || (type === 'percent' ? 10 : 50))),
    maxCap: Math.max(0, Math.round(Number(body.maxCap) || 0)),
    minOrder: Math.max(0, Math.round(Number(body.minOrder) || 0)),
    freeShipping: type === 'freeshipping',
    active: true,
    description: cleanStr(body.description, 160) || '',
    startsAt: null,
    expiresAt: body.expiresAt ? new Date(`${cleanStr(body.expiresAt, 12)}T23:59:59`).toISOString() : null,
    uses: 0,
    maxUses: Math.max(0, Math.round(Number(body.maxUses) || 0)),
  };
  db.addCoupon(coupon);
  return sendJson(res, { ok: true, coupon }, 201);
};

api['POST /api/admin/messages/:id/read'] = async (req, res, url) => {
  if (!requireAdmin(req, res)) return;
  const id = decodeURIComponent(url.pathname.split('/').slice(-2)[0]);
  db.markMessageRead(id);
  return sendJson(res, { ok: true });
};

api['GET /api/admin/orders.csv'] = async (req, res) => {
  if (!isAuthed(req)) {
    // Allow ?token= for curl/backup jobs where headers are awkward.
    const t = cleanStr(new URL(req.url, 'http://x').searchParams.get('token'), 80);
    if (!t || !adminTokens.get(t) || adminTokens.get(t) < Date.now()) return sendJson(res, { ok: false, error: 'admin session required' }, 401);
  }
  const rows = db.listOrders().map((o) => ({
    id: o.id,
    placed: String(o.createdAt).slice(0, 16).replace('T', ' '),
    status: o.status,
    payment: o.payment,
    payment_status: o.paymentStatus,
    payment_ref: o.paymentRef || '',
    customer: o.customer.name,
    email: o.customer.email,
    phone: o.customer.phone,
    address: o.customer.address,
    city: o.customer.city,
    state: o.customer.state,
    pincode: o.customer.pincode,
    items: (o.items || []).map((l) => `${l.qty}x ${l.name} ${l.variant}`),
    subtotal: o.subtotal,
    coupon: o.coupon || '',
    discount: o.discount,
    shipping: o.shippingFee,
    cod_fee: o.codFee,
    total: o.total,
    awb: o.awb || '',
    courier: o.courier || '',
  }));
  const csv = toCsv(rows);
  return send(res, 200, `\uFEFF${csv}`, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="organichy-orders-${new Date().toISOString().slice(0, 10)}.csv"`,
    'Cache-Control': 'no-store',
  });
};

api['GET /api/admin/subscribers.csv'] = async (req, res) => {
  if (!isAuthed(req)) return sendJson(res, { ok: false, error: 'admin session required' }, 401);
  const rows = db.listSubscribers().map((s) => ({ email: s.email, source: s.source || '', joined: String(s.createdAt).slice(0, 10) }));
  return send(res, 200, `\uFEFF${toCsv(rows)}`, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="organichy-subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
  });
};

/* ================================================================== */
/* 5. Static files                                                   */
/* ================================================================== */

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if (!rel || rel.includes('..') || rel.includes('\0')) return false;
  const abs = path.join(PUBLIC_DIR, rel);
  if (!abs.startsWith(PUBLIC_DIR)) return false;

  let stat;
  try {
    stat = fs.statSync(abs);
  } catch {
    return false;
  }
  if (stat.isDirectory()) return false;

  const ext = path.extname(abs).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const isImg = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico'].includes(ext);
  const etag = `W/"${stat.size.toString(16)}-${Math.round(stat.mtimeMs).toString(16)}"`;
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag });
    res.end();
    return true;
  }
  setSecurityHeaders(res);
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    ETag: etag,
    'Cache-Control': isImg ? 'public, max-age=604800' : 'public, max-age=0, must-revalidate',
    'Last-Modified': stat.mtime.toUTCString(),
  });
  fs.createReadStream(abs).pipe(res);
  return true;
}

/* ================================================================== */
/* 6. Request handler                                                  */
/* ================================================================== */

db.init();

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || `localhost:${config.site.port}`}`);
  } catch {
    return sendText(res, 'bad request', 400);
  }

  const key = `${req.method} ${url.pathname}`;
  const t0 = Date.now();
  res.on('finish', () => {
    // eslint-disable-next-line no-console
    console.log(`${req.method} ${url.pathname} → ${res.statusCode} ${Date.now() - t0}ms`);
  });

  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { Allow: 'GET,HEAD,POST,OPTIONS' });
      return res.end();
    }

    /* API first (exact, then :id patterns) */
    if (url.pathname.startsWith('/api/')) {
      if (api[key]) return await api[key](req, res, url);
      for (const [pattern, fn] of Object.entries(api)) {
        if (!pattern.includes(':')) continue;
        const [method, tmpl] = pattern.split(' ');
        if (method !== req.method) continue;
        const rx = new RegExp(`^${tmpl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:[A-Za-z]+/g, '([^/]+)')}$`);
        const m = url.pathname.match(rx);
        if (m) return await fn(req, res, url, m.slice(1));
      }
      return sendJson(res, { ok: false, error: 'unknown endpoint', path: url.pathname }, 404);
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      if (url.pathname.startsWith('/css/') || url.pathname.startsWith('/js/') || url.pathname.startsWith('/images/')) {
        if (serveStatic(req, res, url)) return undefined;
        if (url.pathname.endsWith('.css') || url.pathname.endsWith('.js')) {
          return sendText(res, url.pathname.endsWith('.css') ? '/* missing */' : '/* missing */', 404, 'text/plain; charset=utf-8');
        }
      }
      handlePage(req, res, url);
      if (res.headersSent) return undefined;
      setSecurityHeaders(res);
      return sendHtml(res, viewsContent.notFound(req), 404);
    }

    if (req.method === 'POST' && url.pathname === '/cart') return redirect(res, '/cart', 303);
    return sendText(res, 'method not allowed', 405, 'text/plain; charset=utf-8', { Allow: 'GET, POST' });
  } catch (err) {
    const status = Number(err && err.status) || 500;
    // eslint-disable-next-line no-console
    console.error(`[server] ${key} failed:`, err && err.message ? err.message : err);
    if (url.pathname.startsWith('/api/')) {
      return sendJson(res, { ok: false, error: status === 422 || status === 429 || status === 400 || status === 413 ? err.message : 'Something went wrong on our side. Try again in a moment.' }, status);
    }
    return sendHtml(res, `<section class="section"><div class="wrap"><h1 class="h1">Server error</h1><p class="lead">${esc(err.message || 'unknown error')}</p><a class="btn btn--primary" href="/">Back to the shop</a></div></section>`, 500);
  }
});

/* Keep the token map tidy; nothing else needs a timer. */
setInterval(() => {
  const now = Date.now();
  for (const [t, exp] of adminTokens) if (exp < now) adminTokens.delete(t);
  for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
}, 600000).unref();

function listen() {
  server.listen(config.site.port, config.site.host, () => {
    // eslint-disable-next-line no-console
    console.log(`
  ORGANICHY ${VERSION} — listening on http://localhost:${config.site.port}  (host ${config.site.host})
  ├─ store      http://localhost:${config.site.port}/
  ├─ admin      http://localhost:${config.site.port}/admin      password ${config.admin.password === 'organichy@2026' ? 'organichy@2026 (default — change it!)' : '(custom)'}
  ├─ health     http://localhost:${config.site.port}/api/health
  ├─ data        ${config.dataDir}
  └─ payments    ${config.payments.mode === 'live' ? 'Razorpay LIVE' : 'Razorpay demo (nothing is charged)'}
`);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    // eslint-disable-next-line no-console
    console.error(`
  Port ${config.site.port} is already in use.
  → another ORGANICHY may already be running: close that window, or
  → start this one elsewhere:  PORT=3001 node server.js
`);
    process.exit(1);
  }
  throw err;
});

if (require.main === module) listen();

module.exports = { server, config, db, pricing };
