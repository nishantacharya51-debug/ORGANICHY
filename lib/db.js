'use strict';
/**
 * lib/db.js — the whole database: one JSON file per collection in ./data.
 *
 * Deliberately boring. Atomic writes (tmp + rename), a per-process cache keyed
 * on file size/mtime, and auto-seeding on first boot. For a store doing a few
 * hundred orders a day this is faster than a managed Postgres round-trip and it
 * costs ₹0. When the business outgrows it, replace the read/write pair below
 * with SQL — no view or route needs to change.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const config = require('./config');
const { buildSeed } = require('./seed');

const COLLECTIONS = ['products', 'orders', 'reviews', 'coupons', 'messages', 'subscribers', 'notifications'];
const MEM = new Map();
let seeded = false;

function fileFor(name) {
  return path.join(config.dataDir, `${name}.json`);
}

function writeRaw(name, value) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const file = fileFor(name);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
  MEM.delete(name);
}

function seedIfEmpty() {
  if (seeded) return;
  fs.mkdirSync(config.dataDir, { recursive: true });
  let meta = null;
  try {
    meta = JSON.parse(fs.readFileSync(fileFor('meta'), 'utf8'));
  } catch {
    meta = null;
  }
  if (!meta || meta.seedVersion !== config.seedVersion) {
    const seed = buildSeed();
    for (const name of COLLECTIONS) writeRaw(name, seed[name] || []);
    writeRaw('meta', {
      seedVersion: config.seedVersion,
      seededAt: new Date().toISOString(),
      note: 'Auto-created on first boot. Delete the data/ folder to reset the store to seed data.',
    });
    // eslint-disable-next-line no-console
    console.log(`[db] seeded ${COLLECTIONS.length} collections into ${path.relative(config.ROOT, config.dataDir)}/`);
  }
  seeded = true;
}

function read(name) {
  seedIfEmpty();
  const file = fileFor(name);
  let st = null;
  try {
    st = fs.statSync(file);
  } catch {
    return [];
  }
  const hit = MEM.get(name);
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit.value;
  let value;
  try {
    value = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    value = [];
  }
  MEM.set(name, { mtimeMs: st.mtimeMs, size: st.size, value });
  return value;
}

function write(name, value) {
  seedIfEmpty();
  writeRaw(name, value);
  return value;
}

/** Read → mutate → write, in one call. */
function update(name, mutator) {
  const list = read(name).slice();
  const next = mutator(list);
  return write(name, Array.isArray(next) ? next : list);
}

function newId(prefix) {
  return `${prefix}-${crypto.randomBytes(5).toString('hex')}`;
}

/** OH-2451-7K3M style ids: readable, unambiguous, hard to guess. */
function newOrderId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const day = String(Math.floor(Date.now() / 86400000) % 10000).padStart(4, '0');
  let tail = '';
  for (let i = 0; i < 4; i += 1) tail += alphabet[crypto.randomInt(alphabet.length)];
  return `OH-${day}-${tail}`;
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

function listProducts({ activeOnly = false, category = 'all' } = {}) {
  let list = read('products');
  if (activeOnly) list = list.filter((p) => p.active !== false);
  if (category && category !== 'all') list = list.filter((p) => p.category === category);
  return list.map(withComputed);
}

function withComputed(p) {
  const reviews = read('reviews').filter((r) => r.productId === p.id && r.approved !== false);
  const count = reviews.length;
  const avg = count ? reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / count : 0;
  const variants = p.variants || [];
  const cheapest = variants.length
    ? variants.reduce((a, b) => (Number(b.price) < Number(a.price) ? b : a))
    : null;
  const dearest = variants.length
    ? variants.reduce((a, b) => (Number(b.price) > Number(a.price) ? b : a))
    : null;
  const stocks = variants.map((v) => Number(v.stock) || 0);
  const price = cheapest ? Number(cheapest.price) : 0;
  const mrp = cheapest ? Number(cheapest.mrp || cheapest.price) : 0;
  return {
    ...p,
    ratingValue: count ? Number(avg.toFixed(1)) : Number(p.ratingBase || 5),
    reviewCount: count,
    price,
    mrp,
    maxPrice: dearest ? Number(dearest.price) : price,
    fromVariant: cheapest ? cheapest.label : '',
    toVariant: dearest ? dearest.label : '',
    priceRange: variants.length > 1,
    stock: stocks.reduce((a, b) => a + b, 0),
    lowStock: stocks.some((s) => s <= config.pricing.lowStockAt),
    soldOut: stocks.length > 0 && stocks.every((s) => s <= 0),
    savings: Math.max(0, mrp - price),
  };
}

function getProduct(idOrSlug) {
  const key = String(idOrSlug || '').trim().toLowerCase();
  const raw = read('products').find(
    (p) => p.id.toLowerCase() === key || String(p.slug).toLowerCase() === key
  );
  return raw ? withComputed(raw) : null;
}

/** Accepts a product id or slug, and a variant label or id. */
function findVariant(idOrSlug, variantLabel) {
  const product = getProduct(idOrSlug);
  if (!product) return null;
  const variants = product.variants || [];
  const want = String(variantLabel || '').trim().toLowerCase();
  const variant =
    variants.find((v) => String(v.label).toLowerCase() === want) ||
    variants.find((v) => String(v.id).toLowerCase() === want) ||
    variants[0] ||
    null;
  if (!variant) return null;
  return { product, variant };
}

function saveProduct(patch) {
  return update('products', (list) => {
    const i = list.findIndex((p) => p.id === patch.id);
    if (i === -1) list.unshift(patch);
    else list[i] = { ...list[i], ...patch };
    return list;
  });
}

function setStock(variantId, stock) {
  return update('products', (list) => {
    for (const p of list) {
      for (const v of p.variants || []) {
        if (v.id === variantId) v.stock = Math.max(0, Number(stock) || 0);
      }
    }
    return list;
  });
}

function decrementStock(lines) {
  return update('products', (list) => {
    for (const line of lines) {
      const p = list.find((x) => x.id === line.productId || x.slug === line.slug);
      if (!p) continue;
      const v = (p.variants || []).find((x) => String(x.label).toLowerCase() === String(line.variant).toLowerCase());
      if (!v) continue;
      v.stock = Math.max(0, (Number(v.stock) || 0) - Number(line.qty || 1));
    }
    return list;
  });
}

/* ------------------------------------------------------------------ */
/* Coupons                                                             */
/* ------------------------------------------------------------------ */
function listCoupons() {
  return read('coupons');
}
function findCoupon(code) {
  const want = String(code || '').trim().toUpperCase();
  if (!want) return null;
  return read('coupons').find((c) => String(c.code).toUpperCase() === want) || null;
}
function addCoupon(coupon) {
  return update('coupons', (list) => {
    list.unshift(coupon);
    return list;
  });
}
function bumpCouponUsage(code) {
  const want = String(code || '').trim().toUpperCase();
  if (!want) return;
  update('coupons', (list) => {
    const c = list.find((x) => String(x.code).toUpperCase() === want);
    if (c) c.uses = (Number(c.uses) || 0) + 1;
    return list;
  });
}

/* ------------------------------------------------------------------ */
/* Reviews                                                             */
/* ------------------------------------------------------------------ */
function reviewsFor(productId) {
  return read('reviews')
    .filter((r) => r.productId === productId && r.approved !== false)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
function addReview(review) {
  return update('reviews', (list) => {
    list.unshift(review);
    return list;
  });
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */
function listOrders() {
  return read('orders').slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
function getOrder(id) {
  const want = String(id || '').trim().toUpperCase();
  return read('orders').find((o) => String(o.id).toUpperCase() === want) || null;
}
function addOrder(order) {
  return update('orders', (list) => {
    list.unshift(order);
    return list;
  });
}
function ordersByEmail(email) {
  const want = String(email || '').trim().toLowerCase();
  if (!want) return [];
  return listOrders().filter((o) => String(o.customer?.email || '').toLowerCase() === want);
}
function updateOrder(id, patch) {
  update('orders', (list) => {
    const i = list.findIndex((o) => String(o.id).toUpperCase() === String(id).toUpperCase());
    if (i !== -1) list[i] = { ...list[i], ...patch };
    return list;
  });
  return getOrder(id);
}

/* ------------------------------------------------------------------ */
/* Inbox: contact messages, subscribers, notification queue            */
/* ------------------------------------------------------------------ */
function listMessages() {
  return read('messages').slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
function addMessage(message) {
  return update('messages', (list) => {
    list.unshift(message);
    return list;
  });
}
function markMessageRead(id) {
  return update('messages', (list) => {
    const m = list.find((x) => x.id === id);
    if (m) m.read = true;
    return list;
  });
}
/** Reset every collection back to seed data (used by `npm run reset`). */
function reseed() {
  const seed = buildSeed();
  for (const name of COLLECTIONS) writeRaw(name, seed[name] || []);
  return true;
}
function listSubscribers() {
  return read('subscribers').slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
function addSubscriber(email, source) {
  const want = String(email || '').trim().toLowerCase();
  return update('subscribers', (list) => {
    if (!list.some((s) => String(s.email).toLowerCase() === want)) {
      list.unshift({ id: newId('s'), email: want, source: source || 'site', createdAt: new Date().toISOString() });
    }
    return list;
  });
}
function listNotifications() {
  return read('notifications').slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
function addNotification(n) {
  return update('notifications', (list) => {
    list.unshift(n);
    return list.slice(0, 400);
  });
}

/* ------------------------------------------------------------------ */
/* Admin analytics                                                     */
/* ------------------------------------------------------------------ */
function stats({ days = 14 } = {}) {
  const orders = listOrders();
  const paid = orders.filter((o) => o.status !== 'cancelled');
  const revenue = paid.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const cod = paid.filter((o) => o.payment === 'cod');
  const since = Date.now() - days * 86400000;
  const series = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const next = new Date(d.getTime() + 86400000);
    const inDay = paid.filter((o) => {
      const t = new Date(o.createdAt).getTime();
      return t >= d.getTime() && t < next.getTime();
    });
    series.push({
      day: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      date: d.toISOString().slice(0, 10),
      orders: inDay.length,
      revenue: inDay.reduce((s, o) => s + (Number(o.total) || 0), 0),
    });
  }
  const window30 = paid.filter((o) => new Date(o.createdAt).getTime() >= since);
  const revenue30 = window30.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const products = listProducts();
  const tally = new Map();
  for (const o of paid) {
    for (const line of o.items || []) {
      const cur = tally.get(line.productId) || { name: line.name, qty: 0, revenue: 0 };
      cur.qty += Number(line.qty) || 1;
      cur.revenue += (Number(line.price) || 0) * (Number(line.qty) || 1);
      tally.set(line.productId, cur);
    }
  }
  const lowStock = [];
  for (const p of products) {
    for (const v of p.variants || []) {
      if ((Number(v.stock) || 0) <= config.pricing.lowStockAt) {
        lowStock.push({ productId: p.id, name: p.name, variant: v.label, stock: Number(v.stock) || 0 });
      }
    }
  }
  return {
    revenue,
    revenue30,
    orders: orders.length,
    open: paid.filter((o) => o.status === 'placed' || o.status === 'packed').length,
    aov: paid.length ? Math.round(revenue / paid.length) : 0,
    customers: new Set(orders.map((o) => `${o.customer?.email || ''}|${o.customer?.phone || ''}`)).size,
    subscribers: listSubscribers().length,
    unreadMessages: listMessages().filter((m) => !m.read).length,
    codShare: paid.length ? Math.round((cod.length / paid.length) * 100) : 0,
    series,
    topProducts: [...tally.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    lowStock,
    recent: orders.slice(0, 8),
    products: products.length,
  };
}

module.exports = {
  init: seedIfEmpty,
  read,
  write,
  update,
  fileFor,
  newId,
  newOrderId,
  /* products */
  listProducts,
  getProduct,
  findVariant,
  saveProduct,
  setStock,
  decrementStock,
  /* coupons */
  listCoupons,
  findCoupon,
  addCoupon,
  bumpCouponUsage,
  /* reviews */
  reviewsFor,
  addReview,
  /* orders */
  listOrders,
  getOrder,
  addOrder,
  ordersByEmail,
  updateOrder,
  /* inbox */
  listMessages,
  addMessage,
  markMessageRead,
  listSubscribers,
  addSubscriber,
  listNotifications,
  addNotification,
  /* misc */
  reseed,
  stats,
};
