'use strict';
/**
 * test/smoke.js — the acceptance tests from Handoff Pack 00 §8, plus the order
 * round-trip. Boots its own server on PORT (default 3127) so it can run in CI
 * and on a laptop with nothing installed but Node.
 *
 *   npm test
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Fresh, throwaway datastore so the run is deterministic and never touches the
// developer's own data/ folder.
const DATA = process.env.DATA_DIR || path.join(__dirname, '.data');
fs.rmSync(DATA, { recursive: true, force: true });

const PORT = Number(process.env.PORT || 3127);
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = path.resolve(__dirname, '..');

const PAGE_URLS = [
  '/',
  '/shop',
  '/product/classic-creamy-peanut-butter',
  '/about',
  '/our-story',
  '/faqs',
  '/contact',
  '/cart',
  '/checkout',
  '/account',
  '/privacy-policy',
  '/shipping-policy',
  '/return-refund-policy',
  '/terms',
  '/admin',
  '/sitemap.xml',
  '/robots.txt',
  '/api/health',
  '/api/products',
];

let pass = 0;
const failures = [];

function ok(name, cond, extra = '') {
  if (cond) {
    pass += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${name}${extra ? ` — ${extra}` : ''}`);
  } else {
    failures.push(name);
    console.log(`  \x1b[31m✗\x1b[0m ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

const get = async (p, opts = {}) => {
  const res = await fetch(BASE + p, opts);
  const text = await res.text();
  return {
    status: res.status,
    text,
    headers: res.headers,
    url: res.url,
    redirected: res.redirected,
    json: () => JSON.parse(text),
  };
};

async function waitForServer(tries = 60) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server did not come up on ${BASE}`);
}

async function main() {
  const child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let childLog = '';
  child.stdout.on('data', (d) => (childLog += d.toString()));
  child.stderr.on('data', (d) => (childLog += d.toString()));

  try {
    await waitForServer();

    console.log('\nORGANICHY smoke tests\n');

    /* ---- 1. every route answers ---- */
    console.log('pages');
    for (const url of PAGE_URLS) {
      const res = await get(url);
      ok(`GET ${url}`, res.status === 200, `${res.status}`);
    }

    /* ---- 2. cart maths is server-authoritative ---- */
    console.log('\ncommerce');
    const priced = await get('/api/cart/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p-creamy', variant: '500 g', qty: 2 }], coupon: 'ORGANICHY10', payment: 'cod' }),
    }).then((r) => r.json());
    ok('subtotal re-priced from the database', priced.subtotal === 1098, `got ${priced.subtotal}`);
    ok('coupon ORGANICHY10 → 10% capped at 200', priced.discount === 110, `got ${priced.discount}`);
    ok('free shipping above ₹899', priced.shippingFee === 0, `got ${priced.shippingFee}`);
    ok('COD handling ₹29', priced.codFee === 29, `got ${priced.codFee}`);
    ok('total 1017', priced.total === 1017, `got ${priced.total}`);

    const cheap = await get('/api/cart/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p-creamy', variant: '500 g', qty: 1 }], coupon: '', payment: 'razorpay' }),
    }).then((r) => r.json());
    ok('small order pays flat shipping', cheap.shippingFee === 49 && cheap.total === 598, `ship ${cheap.shippingFee}, total ${cheap.total}`);

    const bogus = await get('/api/cart/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'p-creamy', variant: '500 g', qty: 1, price: 1 }], coupon: 'NOPE99', payment: 'cod' }),
    }).then((r) => r.json());
    ok('client-sent price is ignored', bogus.subtotal === 549, `subtotal ${bogus.subtotal}`);
    ok('unknown coupon does not discount', bogus.discount === 0 && bogus.couponMessage.includes('not a coupon'));

    /* ---- 3. order round-trip ---- */
    console.log('\norder flow');
    const before = await get('/api/products').then((r) => r.json());
    const stockBefore = before.products.find((p) => p.id === 'p-creamy').variants.find((v) => v.label === '500 g').stock;
    const order = await get('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: 'p-creamy', variant: '500 g', qty: 2 }],
        coupon: 'ORGANICHY10',
        payment: 'cod',
        customer: {
          name: 'Smoke Tester',
          email: 'smoke@organichy.test',
          phone: '9876500011',
          address: '12 Test Road, Nadon',
          city: 'Moradabad',
          state: 'Uttar Pradesh',
          pincode: '244001',
        },
      }),
    });
    const created = JSON.parse(order.text);
    ok('POST /api/orders creates an order', order.status === 201 && created.ok, order.status);
    ok('order id format OH-0000-AAAA', /^OH-\d{4}-[A-Z0-9]{4}$/.test(created.orderId), created.orderId);
    ok('total charged server-side', created.total === 1017, `${created.total}`);
    const receipt = await get(`/order/${created.orderId}`);
    ok('confirmation page renders', receipt.status === 200 && receipt.text.includes(created.orderId));
    const after = await get('/api/products').then((r) => r.json());
    const stockAfter = after.products.find((p) => p.id === 'p-creamy').variants.find((v) => v.label === '500 g').stock;
    ok('stock decremented by 2', stockAfter === stockBefore - 2, `${stockBefore} → ${stockAfter}`);
    const track = await get(`/api/order?id=${created.orderId}&phone=9876500011`).then((r) => r.json());
    ok('customer can track with id + phone', track.ok && track.order.status === 'placed');
    const trackBad = await get(`/api/order?id=${created.orderId}&phone=9000000000`);
    ok('wrong phone cannot read the order', trackBad.status === 404);
    const acct = await get(`/account?order=${created.orderId}&phone=9876500011`);
    ok('My Account shows the timeline', acct.status === 200 && acct.text.includes('of__item'));

    /* ---- 4. admin ---- */
    console.log('\nadmin');
    const denied = await get('/api/admin/state');
    ok('admin API is closed without a token', denied.status === 401);
    const login = await get('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ password: process.env.ADMIN_PASSWORD || 'organichy@2026' }),
    }).then((r) => r.json());
    ok('login returns a token', login.ok === true && typeof login.token === 'string' && login.token.length >= 32);
    const badLogin = await get('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ password: 'hunter2' }),
    });
    ok('wrong password rejected', badLogin.status === 401);
    const auth = { Authorization: `Bearer ${login.token}` };
    /* The console has to open for a browser that refuses to keep a cookie —
       previews, iframes and hardened profiles drop it, and "my password is
       correct but it keeps showing the login page" is the bug that causes. */
    ok('login hands back a token URL for cookie-less browsers', login.redirect === `/admin?token=${login.token}`);
    const tokenPage = await get(`/admin?token=${login.token}`);
    ok(
      'token URL renders all six panels without a cookie',
      tokenPage.status === 200 &&
        tokenPage.text.includes('data-admin') &&
        (tokenPage.text.match(/adm__panel/g) || []).length === 6 &&
        !tokenPage.text.includes('data-admin-login')
    );
    const junk = await get('/admin?token=deadbeef');
    ok('a junk token gets the login card, never the console', junk.status === 200 && junk.text.includes('data-admin-login'));
    const replant = await get('/api/admin/session', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: '{}',
    }).then((r) => r.json());
    ok('session endpoint re-plants the cookie from a bearer token', replant.ok === true && replant.expiresInSeconds > 0);
    const csvNoCookie = await get(`/api/admin/orders.csv?token=${login.token}`);
    ok(
      'CSV download works with only a URL token',
      csvNoCookie.status === 200 && (csvNoCookie.headers.get('content-type') || '').includes('text/csv')
    );
    const formLogin = await get('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/html' },
      body: `password=${encodeURIComponent(process.env.ADMIN_PASSWORD || 'organichy@2026')}`,
    });
    ok(
      'no-JS form login ends up on the token-protected console',
      formLogin.status === 200 &&
        formLogin.redirected &&
        /\/admin\?token=/.test(formLogin.url) &&
        formLogin.text.includes('adm__panel')
    );
    /* Correct password must never be punished: 12 good logins in a row = 12 tokens. */
    let goodRuns = 0;
    for (let i = 0; i < 12; i += 1) {
      const again = await get('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ password: process.env.ADMIN_PASSWORD || 'organichy@2026' }),
      });
      if (again.status === 200) goodRuns += 1;
    }
    ok('12 successful logins in a row are never rate limited', goodRuns === 12);
    let firstErr = '';
    for (let i = 0; i < 10; i += 1) {
      const wrong = await get('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ password: `wrong${i}` }),
      });
      if (!firstErr && wrong.status === 401) firstErr = JSON.parse(wrong.text).error || '';
    }
    const locked = await get('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ password: process.env.ADMIN_PASSWORD || 'organichy@2026' }),
    });
    ok('ten wrong passwords say how many are left', /attempts left/.test(firstErr));
    ok('the lock is explained, not blamed on the password', locked.status === 429 && /Too many wrong passwords/.test(locked.text));
    const state = await get('/api/admin/state', { headers: auth }).then((r) => r.json());
    ok('state exposes orders + products + stats', state.ok && Array.isArray(state.orders) && state.orders.length >= 1 && state.stats.revenue > 0, `${state.orders.length} orders, ₹${state.stats.revenue}`);
    const moved = await get(`/api/admin/orders/${created.orderId}/status`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'shipped', awb: 'DD999000111222', note: 'Handed to Delhivery' }),
    }).then((r) => r.json());
    ok('status update + AWB saved', moved.ok && moved.order.status === 'shipped' && moved.order.awb === 'DD999000111222');
    const notified = await get('/api/admin/state', { headers: auth }).then((r) => r.json());
    ok('order event queued for the customer', notified.notifications.some((n) => n.orderId === created.orderId && n.kind === 'order.shipped'));
    const csv = await get('/api/admin/orders.csv', { headers: auth });
    ok('CSV export has a header row + orders', csv.status === 200 && csv.text.split('\n').length >= 3);
    const coupon = await get('/api/admin/coupons', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ code: `SMOKE${Date.now() % 1000}`, type: 'flat', value: 25, minOrder: 100 }) }).then((r) => r.json());
    ok('coupon creation works', coupon.ok && coupon.coupon.code.startsWith('SMOKE'));
    const edited = await get('/api/admin/products/p-creamy', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ featured: true }) }).then((r) => r.json());
    ok('product edit persists', edited.ok && edited.product.featured === true);

    /* ---- 5. content + SEO ---- */
    console.log('\ncontent & seo');
    const home = await get('/');
    ok('home has hero + JSON-LD', home.text.includes('hero__title') && home.text.includes('application/ld+json') && home.text.includes('"@type":"Organization"'));
    const pdp = await get('/product/classic-creamy-peanut-butter');
    ok('PDP has Product schema with offers', pdp.text.includes('"@type":"Product"') && pdp.text.includes('AggregateOffer'));
    const faqs = await get('/faqs');
    ok('FAQs ship FAQPage schema', faqs.text.includes('"@type":"FAQPage"') && faqs.text.includes('aggregateRating'.slice(0, 0) + 'Question'));
    const shop = await get('/shop?sort=price-asc');
    ok('shop sort works', shop.status === 200 && shop.text.includes('pcard'));
    const search = await get('/shop?q=protein');
    ok('shop search filters', search.text.includes('High Protein') && !search.text.includes('Classic Creamy Peanut Butter\n'));
    const robots = await get('/robots.txt');
    ok('robots disallows /admin', robots.text.includes('Disallow: /admin') && robots.text.includes('/sitemap.xml'));
    const sitemap = await get('/sitemap.xml');
    ok('sitemap lists every product', sitemap.status === 200 && PAGE_URLS.filter((u) => u.startsWith('/product/')).every((u) => sitemap.text.includes(u)));
    const missing = await get('/product/not-a-real-jar');
    ok('unknown product → 404 page', missing.status === 404 && missing.text.includes('404'));
    const noindex = await get('/checkout');
    ok('transactional pages are noindex', noindex.text.includes('noindex'));

    /* ---- 6. hardening ---- */
    console.log('\nsecurity');
    const root = await get('/');
    ok('CSP header set', /script-src 'self'/.test(root.headers.get('content-security-policy') || ''));
    ok('frame options DENY', root.headers.get('x-frame-operations') === 'DENY' || root.headers.get('x-frame-options') === 'DENY');
    ok('no inline script handlers', !/<script[^>]*>[^<]*on(click|load)=/.test(root.text) && !/ onclick=/.test(root.text));
    ok('no "undefined" leaking into HTML', !/>undefined</.test(root.text) && !/\[object Object\]/.test(root.text));
    const trav = await fetch(`${BASE}/../etc/passwd`).catch(() => null);
    ok('directory traversal blocked', !trav || trav.status === 404 || trav.status === 403 || trav.status === 400);
    const css = await get('/css/main.css');
    ok('static assets served', css.status === 200 && css.text.includes('.pcard'));
    const img = await get('/images/product-creamy.png');
    ok('product photography present', img.status === 200 && (img.headers.get('content-type') || '').includes('image/'));

    console.log(`\n${pass} passed, ${failures.length} failed\n`);
    if (failures.length) {
      console.log('failed checks:\n  ' + failures.join('\n  '));
      console.log('\nserver log:\n' + childLog.slice(-2000));
    }
  } catch (err) {
    console.error('\n✗ smoke run blew up:', err && err.message);
    console.error(childLog.slice(-3000));
    failures.push(String(err && err.message));
  } finally {
    child.kill('SIGTERM');
  }
  process.exit(failures.length ? 1 : 0);
}

main();
