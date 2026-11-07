'use strict';
/**
 * lib/views/admin.js — the admin console at /admin.
 * Rendered server-side from the datastore (the login also sets an HttpOnly
 * cookie), then enhanced by public/js/admin.js for tab switching, inline stock
 * edits, status changes and coupon creation.
 */
const config = require('../config');
const db = require('../db');
const { esc, money, dateFmt, timeAgo, dateTimeFmt, toCsv } = require('../util');
const { icon, field, stars } = require('./layout');

const STATUSES = ['placed', 'packed', 'shipped', 'delivered', 'cancelled'];
const TABS = [
  ['overview', 'Overview', 'chart'],
  ['orders', 'Orders', 'box'],
  ['products', 'Products & stock', 'jar'],
  ['coupons', 'Coupons', 'tag'],
  ['inbox', 'Inbox', 'mail'],
  ['notify', 'Notifications', 'whatsapp'],
];

function shell(title, content, extra = '') {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="robots" content="noindex,nofollow,noarchive,noimageindex">
<meta name="theme-color" content="#0b1712">
<link rel="icon" href="/images/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/css/main.css">
<script src="/js/admin.js" defer></script>
${extra}
</head>
<body class="admin">
${content}
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/* Login                                                               */
/* ------------------------------------------------------------------ */
function loginPage({ error = '', busy = false, locked = false } = {}) {
  return shell(
    'Admin login — ORGANICHY',
    `<div class="login">
  <div class="login__bg" aria-hidden="true"></div>
  <form class="login__card card" method="post" action="/api/admin/login" data-admin-login>
    <span class="login__mark">${icon('jar')}</span>
    <h1 class="login__title">ORGANICHY admin</h1>
    <p class="login__sub">Orders, stock and the inbox. ${esc(config.brand.city)}.</p>
    <label class="sr-only" for="pw">Admin password</label>
    <input class="input login__input" id="pw" name="password" type="password" autocomplete="current-password" placeholder="password" required autofocus>
    <button class="btn btn--primary btn--block btn--lg" type="submit">${busy ? 'Checking…' : 'Open the console'} ${icon('right', 'ic--sm')}</button>
    ${error ? `<p class="login__err" role="alert">${icon('alert', 'ic--sm')} ${esc(error)}</p>` : ''}
    ${locked ? `<p class="login__note">${icon('clock', 'ic--sm')} The pause lifts by itself — typing faster does not.</p>` : ''}
    <div class="login__recover" data-admin-recover hidden></div>
    <p class="login__hint">Session lasts ${config.admin.sessionHours} hours. ${config.admin.loginAttempts} wrong passwords in 5 minutes locks the address, not the account.<br>
    Demo deployment password: <code>organichy@2026</code> — change <code>ADMIN_PASSWORD</code> before launch.</p>
    <a class="login__back" href="/">← back to the store</a>
  </form>
</div>`
  );
}

/* ------------------------------------------------------------------ */
/* Panels                                                              */
/* ------------------------------------------------------------------ */
function spark(series) {
  const max = Math.max(1, ...series.map((s) => s.revenue));
  return `<div class="spark" role="img" aria-label="Revenue by day for the last ${series.length} days">
  ${series
    .map(
      (s) => `<div class="spark__col" title="${esc(s.day)} · ${money(s.revenue)} · ${s.orders} order${s.orders === 1 ? '' : 's'}">
    <span class="spark__bar" style="--h:${Math.max(2, Math.round((s.revenue / max) * 100))}%"></span>
    <span class="spark__lbl">${esc(s.day.split(' ')[0])}</span>
  </div>`
    )
    .join('')}
</div>`;
}

function overview(s) {
  const kpi = (label, value, note, tone = '') =>
    `<div class="stat card"><p class="stat__label">${esc(label)}</p><p class="stat__val ${tone}">${esc(value)}</p><p class="stat__note">${note}</p></div>`;
  return `<div class="stats">
  ${kpi(
    'Lifetime revenue',
    money(s.revenue),
    `${s.orders} orders on the books · ${s.codShare}% of them COD`
  )}
  ${kpi('Last 30 days', money(s.revenue30), 'payable value, refunds excluded')}
  ${kpi(
    'To fulfil',
    String(s.open),
    s.open
      ? `<a href="#" data-goto-tab="orders">${icon('bolt', 'ic--xs')} open the order queue</a>`
      : `${icon('check-circle', 'ic--xs')} queue is clear`
  )}
  ${kpi('Average order value', money(s.aov), 'revenue ÷ delivered & in-flight orders')}
  ${kpi('Customers', String(s.customers), `${s.subscribers} newsletter · ${s.unreadMessages} unread messages`)}
  ${kpi('Live SKUs', String(s.products * 2), `${s.products} products · 2 sizes each`)}
</div>
<section class="card panel panel--chart">
  <h2 class="panel__head">Revenue, last 14 days</h2>
  <div class="panel__pad">${spark(s.series)}
    <p class="muted">Whole rupees, payable value including shipping and COD handling. Bars are calendar days, IST.</p>
  </div>
</section>
<div class="two">
  <section class="card panel">
    <h2 class="panel__head">Top products</h2>
    <div class="panel__pad">
      ${s.topProducts.length
        ? `<table class="table table--sm"><tbody>${s.topProducts
            .map(
              (t, i) => `<tr><td class="muted">${i + 1}</td><td>${esc(t.name)}</td><td class="num">${t.qty} jars</td><td class="num">${money(t.revenue)}</td></tr>`
            )
            .join('')}</tbody></table>`
        : '<p class="muted">No sales recorded yet.</p>'}
    </div>
  </section>
  <section class="card panel ${s.lowStock.length ? 'panel--warn' : ''}">
    <h2 class="panel__head">${icon('alert', 'ic--sm')} Low stock (${s.lowStock.length})</h2>
    <div class="panel__pad">
      ${s.lowStock.length
        ? `<ul class="alertlist">${s.lowStock
            .sort((a, b) => a.stock - b.stock)
            .map(
              (l) => `<li><span>${esc(l.name)} <b>${esc(l.variant)}</b></span><span class="alertlist__n ${l.stock === 0 ? 'is-out' : ''}">${l.stock === 0 ? 'out' : l.stock}</span></li>`
            )
            .join('')}</ul>
        <p class="muted">Every variant is above the ${config.pricing.lowStockAt}-jar line.</p>`
        : `<p class="muted">Every variant is above the ${config.pricing.lowStockAt}-jar line.</p>`}
    </div>
  </section>
</div>`;
}

function ordersPanel(orders) {
  return `<div class="adm__toolbar">
  <div class="filters" data-order-filters>
    ${['all', ...STATUSES].map((f) => `<button class="chip ${f === 'all' ? 'is-active' : ''}" type="button" data-filter-status="${f}">${esc(f)}${f === 'all' ? '' : ` <span class="chip__n">${orders.filter((o) => o.status === f).length}</span>`}</button>`).join('')}
  </div>
  <div class="adm__toolbar-right">
    <input class="input input--sm" type="search" placeholder="Search id, name, phone, pincode…" data-order-search>
    <a class="btn btn--sm btn--ghost" href="/api/admin/orders.csv">${icon('download', 'ic--sm')} CSV export</a>
  </div>
</div>
<div class="tablewrap card">
<table class="table" data-orders-table>
  <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th class="num">Total</th><th>Payment</th><th>Status</th><th>Tracking</th><th class="num">Update</th></tr></thead>
  <tbody>
    ${orders
      .map(
        (o) => `<tr data-status="${esc(o.status)}" data-search="${esc(`${o.id} ${o.customer.name} ${o.customer.phone} ${o.customer.email} ${o.customer.city} ${o.customer.pincode}`.toLowerCase())}">
      <td><b>${esc(o.id)}</b><br><span class="muted">${esc(dateFmt(o.createdAt))}</span></td>
      <td>${esc(o.customer.name)}<br><span class="muted">${esc(o.customer.phone)} · ${esc(o.customer.city)} ${esc(o.customer.pincode)}</span></td>
      <td class="cellitems">${(o.items || [])
        .map((l) => `<span>${l.qty} × ${esc(l.name.replace(' Peanut Butter', ''))} ${esc(l.variant)}</span>`)
        .join('')}</td>
      <td class="num"><b>${money(o.total)}</b><br><span class="muted">${o.discount ? `−${money(o.discount)} ${esc(o.coupon || '')}` : 'no coupon'}</span></td>
      <td><span class="pill pill--${esc(o.payment === 'cod' ? 'cod' : 'paid')}">${esc(o.payment === 'cod' ? 'COD' : 'prepaid')}</span><br><span class="muted">${esc(o.paymentRef || '')}</span></td>
      <td><span class="pill pill--${esc(o.status)}">${esc(o.status)}</span></td>
      <td>${o.awb ? `<code>${esc(o.awb)}</code><br><span class="muted">${esc(o.courier || 'Delhivery')}</span>` : '<span class="muted">—</span>'}</td>
      <td class="num">
        <form class="rowform" data-order-form="${esc(o.id)}">
          <select class="select select--xs" name="status" aria-label="Status for ${esc(o.id)}">${STATUSES.map((st) => `<option ${st === o.status ? 'selected' : ''}>${st}</option>`).join('')}</select>
          <input class="input input--xs" name="awb" placeholder="AWB" value="${esc(o.awb || '')}" aria-label="Courier AWB">
          <input class="input input--xs" name="note" placeholder="Note for the customer" aria-label="Note">
          <button class="btn btn--sm btn--dark" type="submit">Save</button>
        </form>
      </td>
    </tr>`
      )
      .join('') || '<tr><td colspan="8" class="muted">No orders yet. Place one from the storefront and it appears here instantly.</td></tr>'}
  </tbody>
</table>
</div>`;
}

function productsPanel(products) {
  return `<div class="tablewrap card">
<table class="table">
  <thead><tr><th>Product</th><th>Variant</th><th class="num">Price</th><th class="num">MRP</th><th class="num">Stock</th><th>Storefront</th><th class="num">Save</th></tr></thead>
  <tbody>
    ${products
      .flatMap((p) =>
        (p.variants || []).map(
          (v) => `<tr>
      <td><span class="cellprod"><img src="${esc((p.images || [])[0])}" alt="" width="36" height="36"><span><b>${esc(p.name)}</b><br><span class="muted">/${esc(p.slug)}${p.featured ? ' · featured' : ''}</span></span></span></td>
      <td>${esc(v.label)}<br><span class="muted">${esc(v.sku || '')}</span></td>
      <td class="num"><input class="input input--xs num" type="number" min="1" name="price" value="${v.price}" data-field="price" data-variant="${esc(v.id)}"></td>
      <td class="num"><input class="input input--xs num" type="number" min="1" name="mrp" value="${v.mrp || v.price}" data-field="mrp" data-variant="${esc(v.id)}"></td>
      <td class="num"><input class="input input--xs num" type="number" min="0" name="stock" value="${Number(v.stock) || 0}" data-field="stock" data-variant="${esc(v.id)}">${Number(v.stock) <= 0 ? '<span class="tag tag--out">out</span>' : Number(v.stock) <= config.pricing.lowStockAt ? '<span class="tag tag--low">low</span>' : ''}</td>
      <td><label class="check check--sm"><input type="checkbox" data-toggle-active data-product="${esc(p.id)}" ${p.active !== false ? 'checked' : ''}><span>visible</span></label><label class="check check--sm"><input type="checkbox" data-toggle-featured data-product="${esc(p.id)}" ${p.featured ? 'checked' : ''}><span>featured</span></label></td>
      <td class="num"><button class="btn btn--sm btn--dark" type="button" data-save-product="${esc(p.id)}">${icon('check', 'ic--sm')} Save</button></td>
    </tr>`
        )
      )
      .join('')}
  </tbody>
</table>
</div>
<details class="card panel details">
  <summary class="panel__head">${icon('plus', 'ic--sm')} Add a product</summary>
  <div class="panel__pad">
    <p class="muted">New jars land here as roasts come online (protein bars Feb 2026, oats Mar 2026). Two sizes get created by default; edit prices afterwards.</p>
    <form class="form-grid form-grid--5" data-new-product>
      ${field({ id: 'np-name', name: 'name', label: 'Name', required: true, placeholder: 'Dark Chocolate Peanut Butter', span: '6' })}
      ${field({ id: 'np-tag', name: 'tagline', label: 'Tagline', placeholder: 'One line under the name', span: '6' })}
      ${field({ id: 'np-500', name: 'price500', label: '500 g price', type: 'number', required: true, value: 599, span: '3' })}
      ${field({ id: 'np-500s', name: 'stock500', label: '500 g stock', type: 'number', required: true, value: 40, span: '3' })}
      ${field({ id: 'np-1k', name: 'price1kg', label: '1 kg price', type: 'number', required: true, value: 999, span: '3' })}
      ${field({ id: 'np-1ks', name: 'stock1kg', label: '1 kg stock', type: 'number', required: true, value: 20, span: '3' })}
      <div class="panel__foot panel__foot--span">${icon('img')} image path <input class="input input--sm" name="image" value="/images/product-creamy.png" placeholder="/images/…png"></div>
      <div class="panel__foot panel__foot--span"><button class="btn btn--primary" type="submit">Create product</button><p class="form-msg" data-form-msg></p></div>
    </form>
  </div>
</details>`;
}

function couponsPanel(coupons) {
  return `<div class="two">
  <section class="card tablewrap tablewrap--plain">
    <table class="table">
      <thead><tr><th>Code</th><th>Rule</th><th class="num">Min order</th><th class="num">Uses</th><th>Live</th></tr></thead>
      <tbody>
        ${coupons
          .map(
            (c) => `<tr>
        <td><b>${esc(c.code)}</b><br><span class="muted">${esc(c.label || '')}</span></td>
        <td>${c.type === 'percent' ? `${c.value}%${c.maxCap ? ` up to ${money(c.maxCap)}` : ''}` : c.type === 'flat' ? `${money(c.value)} off` : 'free delivery'}<br><span class="muted">${esc(c.description || '')}</span></td>
        <td class="num">${money(c.minOrder || 0)}</td>
        <td class="num">${Number(c.uses) || 0}${c.maxUses ? ` / ${c.maxUses}` : ''}</td>
        <td>${c.active === false ? '<span class="tag tag--out">off</span>' : '<span class="tag tag--v">on</span>'}${c.expiresAt ? `<br><span class="muted">ends ${esc(dateFmt(c.expiresAt))}</span>` : ''}</td>
      </tr>`
          )
          .join('')}
      </tbody>
    </table>
  </section>
  <section class="card panel">
    <h2 class="panel__head">${icon('plus', 'ic--sm')} Create a coupon</h2>
    <div class="panel__pad">
      <form class="form-grid form-grid--4" data-new-coupon>
        ${field({ id: 'nc-code', name: 'code', label: 'Code', required: true, placeholder: 'ROAST20', span: '4' })}
        ${field({ id: 'nc-label', name: 'label', label: 'Internal label', placeholder: 'Roast-week 20%', span: '4' })}
        ${field({ id: 'nc-type', name: 'type', label: 'Type', type: 'select', options: ['percent', 'flat', 'freeshipping'], span: '4' })}
        ${field({ id: 'nc-value', name: 'value', label: 'Percent or ₹ value', type: 'number', value: 10, span: '4' })}
        ${field({ id: 'nc-cap', name: 'maxCap', label: 'Max discount ₹', type: 'number', value: 200, span: '4' })}
        ${field({ id: 'nc-min', name: 'minOrder', label: 'Minimum order ₹', type: 'number', value: 499, span: '4' })}
        ${field({ id: 'nc-exp', name: 'expiresAt', label: 'Expires (YYYY-MM-DD)', placeholder: 'blank = never', span: '4' })}
        ${field({ id: 'nc-uses', name: 'maxUses', label: 'Max uses', type: 'number', value: 0, span: '4' })}
        ${field({ id: 'nc-desc', name: 'description', label: 'Customer-facing line', placeholder: '20% off during roast week, up to ₹200', span: '8' })}
        <div class="panel__foot panel__foot--span"><button class="btn btn--primary" type="submit">Create coupon</button><p class="form-msg" data-form-msg></p></div>
      </form>
      <p class="muted">Coupons are validated on the server at checkout: minimum order, expiry, use count and cap are all re-checked, and the discount is recomputed from database prices.</p>
    </div>
  </section>
</div>`;
}

function inboxPanel(messages, subscribers) {
  return `<div class="two">
  <section class="card panel">
    <h2 class="panel__head">Contact messages <span class="pill pill--count">${messages.filter((m) => !m.read).length} unread</span></h2>
    <div class="panel__pad">
      ${messages.length
        ? messages
            .map(
              (m) => `<article class="msg ${m.read ? '' : 'is-new'}">
          <header><b>${esc(m.name)}</b> <span class="muted">· ${esc(timeAgo(m.createdAt))}</span>${m.read ? '' : '<span class="tag tag--brand">new</span>'}</header>
          <p class="msg__subject">${esc(m.subject || '(no subject)')}</p>
          <p class="msg__body">${esc(m.body)}</p>
          <p class="muted">${icon('mail', 'ic--xs')} <a href="mailto:${esc(m.email)}">${esc(m.email)}</a>${m.phone ? ` · ${icon('phone', 'ic--xs')} <a href="tel:+91${esc(m.phone)}">${esc(m.phone)}</a>` : ''}</p>
          ${m.read ? '' : `<button class="btn btn--sm btn--ghost" type="button" data-read-message="${esc(m.id)}">Mark read</button>`}
        </article>`
            )
            .join('')
        : '<p class="muted">Nothing in the inbox.</p>'}
    </div>
  </section>
  <section class="card panel">
    <h2 class="panel__head">Newsletter subscribers <span class="pill pill--count">${subscribers.length}</span></h2>
    <div class="panel__pad">
      <p class="muted">Export this list whenever you like — it is a plain CSV, no lock-in.</p>
      <a class="btn btn--sm btn--ghost" href="/api/admin/subscribers.csv">${icon('download', 'ic--sm')} Download subscribers.csv</a>
      <ul class="simplelist">
        ${subscribers
          .slice(0, 40)
          .map((s) => `<li><span>${esc(s.email)}</span><span class="muted">${esc(s.source || 'site')} · ${esc(dateFmt(s.createdAt))}</span></li>`)
          .join('') || '<li class="muted">No signups yet.</li>'}
      </ul>
    </div>
  </section>
</div>`;
}

function notifyPanel(notifications) {
  return `<div class="card panel">
  <h2 class="panel__head">Notification queue <span class="pill pill--count">${notifications.length}</span></h2>
  <div class="panel__pad">
    <p class="notice notice--info">${icon('alert', 'ic--sm')} Nothing leaves the building in demo mode — every email and WhatsApp message is written to <code>data/notifications.json</code> and listed here. To send for real, uncomment <code>sendEmail</code> / <code>sendWhatsApp</code> in <code>lib/notify.js</code> and add the API keys.</p>
    <div class="tablewrap">
      <table class="table">
        <thead><tr><th>When</th><th>Channel</th><th>Event</th><th>To</th><th>Subject</th><th>Body</th></tr></thead>
        <tbody>
          ${notifications
            .slice(0, 60)
            .map(
              (n) => `<tr>
            <td class="muted">${esc(dateTimeFmt(n.createdAt))}</td>
            <td><span class="pill pill--${esc(n.channel)}">${esc(n.channel)}</span></td>
            <td>${esc(n.kind)}</td>
            <td><code>${esc(n.to || '')}</code></td>
            <td>${esc(n.subject || '')}</td>
            <td class="cellbody"><pre>${esc(n.body || '')}</pre></td>
          </tr>`
            )
            .join('') || '<tr><td colspan="6" class="muted">Queue is empty.</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>
</div>`;
}

function adminPage() {
  const products = db.listProducts();
  const orders = db.listOrders();
  const stats = db.stats({ days: 14 });
  const coupons = db.listCoupons();
  const messages = db.listMessages();
  const subscribers = db.listSubscribers();
  const notifications = db.listNotifications();

  const content = `<div class="adm" data-admin>
  <aside class="adm__side">
    <a class="adm__logo" href="/"><span class="logo__mark">${icon('jar')}</span><span class="logo__text"><strong>ORGANICHY</strong><small>console</small></span></a>
    <nav class="adm__nav" aria-label="Admin sections">
      ${TABS.map(([id, label, ic]) => `<button class="adm__tab" type="button" data-tab="${id}">${icon(ic, 'ic--sm')} <span>${esc(label)}</span>${id === 'orders' && stats.open ? `<b class="adm__n">${stats.open}</b>` : ''}${id === 'inbox' && stats.unreadMessages ? `<b class="adm__n">${stats.unreadMessages}</b>` : ''}</button>`).join('')}
    </nav>
    <div class="adm__sidefoot">
      <p class="muted">Signed in · session ${config.admin.sessionHours}h<br>${esc(config.brand.legalName)}</p>
      <a class="btn btn--sm btn--ghost" href="/" target="_blank" rel="noopener">${icon('eye', 'ic--sm')} View store</a>
      <button class="btn btn--sm btn--ghost" type="button" data-admin-logout>${icon('logout', 'ic--sm')} Sign out</button>
    </div>
  </aside>
  <main class="adm__main">
    <header class="adm__head">
      <div>
        <h1 class="adm__title" data-admin-title>Overview</h1>
        <p class="muted">Live from <code>data/</code> · ${esc(new Date().toLocaleString('en-IN'))}</p>
      </div>
      <div class="adm__head-actions">
        <button class="btn btn--sm btn--ghost" type="button" data-admin-refresh>${icon('refresh', 'ic--sm')} Refresh</button>
        <a class="btn btn--sm btn--ghost" href="/api/admin/orders.csv">${icon('download', 'ic--sm')} Orders CSV</a>
      </div>
    </header>
    <section class="adm__panel is-active" data-panel="overview">${overview(stats)}</section>
    <section class="adm__panel" data-panel="orders">${ordersPanel(orders)}</section>
    <section class="adm__panel" data-panel="products">${productsPanel(products)}</section>
    <section class="adm__panel" data-panel="coupons">${couponsPanel(coupons)}</section>
    <section class="adm__panel" data-panel="inbox">${inboxPanel(messages, subscribers)}</section>
    <section class="adm__panel" data-panel="notify">${notifyPanel(notifications)}</section>
  </main>
</div>`;

  return shell('ORGANICHY admin', content);
}

module.exports = { loginPage, adminPage, STATUSES, TABS };
