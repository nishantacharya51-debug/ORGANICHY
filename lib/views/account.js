'use strict';
/**
 * lib/views/account.js — order confirmation and My Account
 * (track by order ID + phone, history by email). Deliberately guest-only: no
 * passwords to forget, nothing to breach. Email-OTP accounts are a paid add-on.
 */
const config = require('../config');
const db = require('../db');
const { esc, money, dateFmt, weekdayDate, addDays, dateTimeFmt } = require('../util');
const { page, icon, field, baseSchema, breadcrumb } = require('./layout');

const FLOW = [
  { id: 'placed', label: 'Order placed', note: 'We have your order and the money (or the COD promise).' },
  { id: 'packed', label: 'Packed', note: 'Jar, seal, lot number, void fill, box.' },
  { id: 'shipped', label: 'Shipped', note: 'Scanned by the courier; AWB live.' },
  { id: 'delivered', label: 'Delivered', note: 'Signed for at your door.' },
];

function timeline(order) {
  const done = FLOW.map((f) => f.id);
  const currentIdx = order.status === 'cancelled' ? -1 : done.indexOf(order.status);
  return `<ol class="orderflow">
  ${FLOW.map((f, i) => {
    const step = (order.timeline || []).find((s) => s.status === f.id);
    const state = order.status === 'cancelled' ? 'pending' : i < currentIdx ? 'done' : i === currentIdx ? 'now' : 'pending';
    return `<li class="of__item is-${state}">
      <span class="of__dot">${state === 'done' ? icon('check', 'ic--sm') : state === 'now' ? icon('bolt', 'ic--sm') : ''}</span>
      <div class="of__body">
        <p class="of__label">${esc(f.label)}</p>
        <p class="of__when">${step ? esc(dateTimeFmt(step.at)) : '—'}</p>
        <p class="of__note">${esc(step ? step.note || f.note : f.note)}</p>
      </div>
    </li>`;
  }).join('')}
  ${
    order.status === 'cancelled'
      ? `<li class="of__item is-cancel"><span class="of__dot">${icon('close', 'ic--sm')}</span><div class="of__body"><p class="of__label">Cancelled</p><p class="of__note">${esc((order.timeline || []).filter((s) => s.status === 'cancelled').map((s) => s.note).join(' ') || 'This order was cancelled. Anything prepaid is refunded to source in 3–5 working days.')}</p></div></li>`
      : ''
  }
</ol>`;
}

function statusPill(status) {
  return `<span class="pill pill--${esc(status)}">${esc(status)}</span>`;
}

function linesTable(order) {
  return `<table class="lines">
  <thead><tr><th scope="col">Jar</th><th scope="col">Size</th><th scope="col" class="num">Qty</th><th scope="col" class="num">Price</th><th scope="col" class="num">Line total</th></tr></thead>
  <tbody>
    ${(order.items || [])
      .map(
        (l) => `<tr>
      <td scope="row" data-label="Jar"><span class="lines__pic"><img src="${esc(l.image)}" alt="" width="48" height="48"></span><span><a href="/product/${esc(l.slug || '')}">${esc(l.name)}</a><br><span class="muted">${esc(l.sku || '')}</span></span></td>
      <td data-label="Size">${esc(l.variant)}</td>
      <td class="num" data-label="Qty">${Number(l.qty) || 1}</td>
      <td class="num" data-label="Price">${money(l.price)}</td>
      <td class="num" data-label="Line total">${money((Number(l.price) || 0) * (Number(l.qty) || 1))}</td>
    </tr>`
      )
      .join('')}
  </tbody>
</table>
<dl class="totals">
  <div><dt>Item total</dt><dd>${money(order.subtotal)}</dd></div>
  ${order.discount ? `<div class="is-discount"><dt>Coupon ${esc(order.coupon || '')}</dt><dd>−${money(order.discount)}</dd></div>` : ''}
  <div><dt>Delivery</dt><dd>${order.shippingFee ? money(order.shippingFee) : 'FREE'}</dd></div>
  ${order.codFee ? `<div><dt>COD handling</dt><dd>${money(order.codFee)}</dd></div>` : ''}
  <div class="totals__grand"><dt>Total paid</dt><dd>${money(order.total)}</dd></div>
</dl>
<p class="payline">${order.payment === 'cod' ? `${icon('truck', 'ic--sm')} Cash on delivery — ${money(order.total)} payable to the courier${order.paymentStatus === 'paid' ? ' (collected)' : ''}` : `${icon('bolt', 'ic--sm')} Paid online via Razorpay · reference <code>${esc(order.paymentRef || '')}</code>`}</p>`;
}

function orderConfirmation(order) {
  const eta = addDays(config.shipping.etaMinDays + 2);
  const body = `<section class="section section--tight done">
  <div class="wrap">
    <header class="done__head reveal is-in">
      <span class="done__tick" aria-hidden="true">${icon('check')}</span>
      <p class="eyebrow">${icon('check-circle', 'ic--xs')} ${order.payment === 'cod' ? 'Order received' : 'Payment captured'}</p>
      <h1 class="h1">Your jar is on the list, ${esc(String(order.customer.name || '').split(' ')[0] || 'friend')}.</h1>
      <p class="lead">Order <b class="oid" data-copy="${esc(order.id)}" data-copy-hint="Order ID copied">${esc(order.id)}</b> — keep this to track the parcel. A confirmation went to <a href="mailto:${esc(order.customer.email)}">${esc(order.customer.email)}</a>.</p>
      <div class="done__actions">
        <a class="btn btn--primary" href="/account?order=${esc(order.id)}&phone=${esc(order.customer.phone)}">Track this order ${icon('right', 'ic--sm')}</a>
        <button class="btn btn--ghost" type="button" data-copy-btn="${esc(order.id)}">${icon('copy', 'ic--sm')} Copy order ID</button>
        <a class="btn btn--ghost" href="https://wa.me/${esc(config.brand.whatsapp)}?text=${encodeURIComponent(`Hi! Just placed order ${order.id} — confirming the address is ${order.customer.address}, ${order.customer.city} ${order.customer.pincode}.`)}" target="_blank" rel="noopener">${icon('whatsapp')} Send us a note</a>
        <button class="btn btn--ghost" type="button" data-print>${icon('box', 'ic--sm')} Print / save PDF</button>
      </div>
    </header>

    <div class="done__grid">
      <div class="done__main">
        <section class="card panel">
          <h2 class="panel__head">Delivery progress</h2>
          <div class="panel__pad">${timeline(order)}
            <p class="panel__foot-note">${order.awb ? `${icon('truck', 'ic--sm')} Consignment <b>${esc(order.awb)}</b> via ${esc(order.courier || 'Delhivery')}.` : `${icon('clock', 'ic--sm')} Courier details appear here as soon as your box is scanned, usually tomorrow morning.`}</p>
          </div>
        </section>
        <section class="card panel">
          <h2 class="panel__head">What you ordered</h2>
          <div class="panel__pad">${linesTable(order)}</div>
        </section>
      </div>
      <aside class="done__side">
        <div class="card panel">
          <h2 class="panel__head">When it arrives</h2>
          <div class="panel__pad panel__pad--tight">
            <p class="eta"><b>${esc(weekdayDate(eta))}</b><br><span class="muted">or a day either side · ${config.shipping.etaMinDays}–${config.shipping.etaMaxDays} days from dispatch</span></p>
            <ul class="ticks">
              <li>${icon('pin', 'ic--sm')} ${esc(order.customer.address)}, ${esc(order.customer.city)}, ${esc(order.customer.state)} ${esc(order.customer.pincode)}</li>
              <li>${icon('phone', 'ic--sm')} Courier will call ${esc(order.customer.phone)}</li>
              ${order.customer.notes ? `<li>${icon('edit', 'ic--sm')} Your note: “${esc(order.customer.notes)}”</li>` : ''}
            </ul>
          </div>
        </div>
        <div class="card panel">
          <h2 class="panel__head">What happens next</h2>
          <ol class="numbered numbered--sm">
            <li>We pack it in Moradabad today or tomorrow (Mon–Sat).</li>
            <li>You get a message with the tracking number when the courier scans it.</li>
            <li>Check the seal before you accept a COD parcel — if it is broken, refuse it and tell us.</li>
            <li>First jar gone? Leave a review on the product page; it takes 20 seconds and it is how the next person finds us.</li>
          </ol>
        </div>
        <div class="card panel panel--wa">
          <h2 class="panel__head">Need to change something?</h2>
          <p class="muted">Address changes are free until the box is packed — usually a few hours. Message the order ID and what you want changed.</p>
          <a class="btn btn--primary btn--block" href="https://wa.me/${esc(config.brand.whatsapp)}" target="_blank" rel="noopener">${icon('whatsapp')} WhatsApp us</a>
        </div>
      </aside>
    </div>

    <div class="card helppanel helppanel--review">
      <div>
        <h3 class="h3">Once it lands, tell us how it went</h3>
        <p class="muted">Reviews come from delivered orders only. That is the entire reason the rating on this site means something.</p>
      </div>
      <div class="helppanel__cta">
        <a class="btn btn--ghost" href="/account?email=${esc(order.customer.email)}">See this order in My Account</a>
        <a class="btn btn--primary" href="/shop">Shop again</a>
      </div>
    </div>
  </div>
</section>`;

  return page({
    title: `Order ${order.id} confirmed — ORGANICHY`,
    description: 'Your ORGANICHY order is confirmed. Track delivery with your order ID and phone number.',
    path: `/order/${order.id}`,
    body,
    robots: 'noindex,nofollow',
    schema: [],
    products: db.listProducts({ activeOnly: true }),
  });
}

function orderRow(order) {
  const items = (order.items || [])
    .map((l) => `${l.qty} × ${l.name} (${l.variant})`)
    .join(' · ');
  return `<article class="ordercard card" data-order="${esc(order.id)}">
  <header class="ordercard__head">
    <div>
      <p class="ordercard__id">${esc(order.id)}</p>
      <p class="muted">Placed ${esc(dateFmt(order.createdAt))} · ${esc(order.payment === 'cod' ? 'Cash on delivery' : 'Prepaid')} ${statusPill(order.paymentStatus)}</p>
    </div>
    <p class="ordercard__total">${money(order.total)}</p>
  </header>
  <p class="ordercard__items">${esc(items)}</p>
  <div class="ordercard__foot">
    ${statusPill(order.status)}
    <p class="ordercard__eta">${
      order.status === 'delivered'
        ? `${icon('check-circle', 'ic--sm')} Delivered ${esc(dateFmt((order.timeline || []).filter((s) => s.status === 'delivered').slice(-1)[0]?.at || order.createdAt))}`
        : order.status === 'cancelled'
          ? 'Cancelled — refund to source if prepaid'
          : order.awb
            ? `${icon('truck', 'ic--sm')} AWB ${esc(order.awb)} · ${esc(order.courier || 'Delhivery')}`
            : `${icon('clock', 'ic--sm')} Packing in Moradabad — tracking appears here shortly`
    }</p>
    <div class="ordercard__cta">
      <a class="btn btn--sm btn--ghost" href="/order/${esc(order.id)}">Receipt</a>
      <a class="btn btn--sm btn--primary" href="/product/classic-creamy-peanut-butter">Reorder</a>
    </div>
  </div>
</article>`;
}

function trackResult(order, phone) {
  if (!order) {
    return `<div class="notice notice--err">${icon('alert', 'ic--sm')} We could not find that order with that phone number. Check the ID (looks like <code>OH-2451-7K3M</code>) and the 10-digit mobile you used.</div>`;
  }
  if (phone && String(order.customer.phone).slice(-10) !== String(phone).replace(/\D/g, '').slice(-10)) {
    return `<div class="notice notice--err">${icon('alert', 'ic--sm')} That order exists but the mobile number does not match. Reply to your confirmation email and we will fix it.</div>`;
  }
  return `<div class="track card">
  <header class="track__head">
    <div><p class="eyebrow">${icon('truck', 'ic--xs')} Order ${esc(order.id)}</p><h2 class="h3">Status: ${esc(order.status)}</h2>
      <p class="muted">${esc(order.customer.name)} · ${esc(order.customer.city)}, ${esc(order.customer.state)} ${esc(order.customer.pincode)} · ${money(order.total)}</p>
    </div>
    ${statusPill(order.status)}
  </header>
  ${timeline(order)}
  ${order.awb ? `<p class="track__awb">${icon('box', 'ic--sm')} Consignment <b>${esc(order.awb)}</b> · ${esc(order.courier || 'Delhivery Surface')}</p>` : ''}
  <div class="track__pad">${linesTable(order)}</div>
</div>`;
}

function accountPage(query = {}) {
  const wantOrder = String(query.order || '').trim();
  const wantPhone = String(query.phone || '').trim();
  const wantEmail = String(query.email || '').trim();
  const tracked = wantOrder && wantPhone ? db.getOrder(wantOrder) : null;
  const history = wantEmail ? db.ordersByEmail(wantEmail) : [];
  const tab = wantOrder ? 'track' : wantEmail ? 'history' : 'track';

  const body = `<section class="section section--tight">
  <div class="wrap">
    ${breadcrumb([{ label: 'Home', href: '/' }, { label: 'My Account' }])}
    <header class="pagehead pagehead--sm">
      <p class="eyebrow">${icon('truck', 'ic--xs')} No login, no password</p>
      <h1 class="h1">Track an order</h1>
      <p class="lead">Your order ID and the mobile number on it are the key. We skip accounts on purpose — nothing to remember, nothing to leak. If you want saved addresses and one-tap reorder, that is a feature: ask us for it.</p>
    </header>

    <div class="tabs" data-tabs>
      <button class="tab ${tab === 'track' ? 'is-active' : ''}" type="button" data-tab="track" aria-selected="${tab === 'track'}">${icon('search', 'ic--sm')} Track by order ID</button>
      <button class="tab ${tab === 'history' ? 'is-active' : ''}" type="button" data-tab="history" aria-selected="${tab === 'history'}">${icon('mail', 'ic--sm')} All orders for my email</button>
    </div>

    <div class="tabpanels">
      <section class="tabpanel ${tab === 'track' ? 'is-active' : ''}" data-panel="track">
        <form class="card query" method="get" action="/account" data-track-form>
          <input type="hidden" name="tab" value="track">
          <div class="query__grid">
            ${field({ id: 't-order', name: 'order', label: 'Order ID', required: true, placeholder: 'OH-2451-7K3M', autocapitalize: 'characters', hint: 'In your confirmation email and at the top of this page if you just ordered.' })}
            ${field({ id: 't-phone', name: 'phone', label: 'Mobile on the order', required: true, type: 'tel', inputmode: 'numeric', placeholder: '98765 43210' })}
          </div>
          <div class="query__foot">
            <button class="btn btn--primary" type="submit">${icon('search', 'ic--sm')} Find my order</button>
            <a class="btn btn--ghost" href="https://wa.me/${esc(config.brand.whatsapp)}" target="_blank" rel="noopener">${icon('whatsapp')} Lost it? Ask on WhatsApp</a>
          </div>
        </form>
        <div data-track-result>${tracked ? trackResult(tracked, wantPhone) : wantOrder ? trackResult(null) : `<div class="card sample"><p class="muted">Try a demo order while the store is in its seeding state: order ID <code>OH-2445-XL9D</code>, mobile <code>9021044556</code>. It is mid-transit with a real AWB, so you can see a shipped timeline.</p></div>`}</div>
      </section>

      <section class="tabpanel ${tab === 'history' ? 'is-active' : ''}" data-panel="history">
        <form class="card query" method="get" action="/account" data-history-form>
          <div class="query__grid query__grid--wide">
            ${field({ id: 'h-email', name: 'email', label: 'Email used at checkout', required: true, type: 'email', autocomplete: 'email', placeholder: 'you@email.com' })}
          </div>
          <div class="query__foot">
            <button class="btn btn--primary" type="submit">${icon('chart', 'ic--sm')} Show my orders</button>
            <p class="muted">This lists every order on that email on this device\'s server — nothing is remembered after the page loads.</p>
          </div>
        </form>
        <div data-history-result>
          ${wantEmail
            ? history.length
              ? `<h2 class="h3">Your ORGANICHY orders (${history.length})</h2>${history.map((o) => orderRow(o)).join('')}`
              : `<div class="notice notice--warn">${icon('alert', 'ic--sm')} No orders on that email yet. Guest orders are linked to the email you typed at checkout — check for a typo.</div>`
            : ''}
        </div>
      </section>
    </div>

    <div class="grid grid--3 acctcards">
      ${[
        ['truck', 'Delivery windows', 'Metros 2–3 days from dispatch, the rest of India 3–6. Remote pincodes ride the courier\'s weekly sweep.'],
        ['refresh', 'Change an address', 'Free until the box is packed. WhatsApp the order ID and the new address; usually done within two hours on business days.'],
        ['shield', 'Damaged or wrong jar', 'A photo within 48 hours is the entire process. We replace or refund in full and never ask you to post a food item back.'],
      ]
        .map(([ic, t, d]) => `<article class="card tile reveal"><span class="tile__ic">${icon(ic)}</span><h3 class="h3">${esc(t)}</h3><p>${esc(d)}</p></article>`)
        .join('')}
    </div>
  </div>
</section>`;

  return page({
    title: 'Track your order — ORGANICHY',
    description: 'Track an ORGANICHY order with your order ID and mobile number, or list every order on your email. No account or password needed.',
    path: '/account',
    body,
    robots: 'noindex,follow',
    active: 'account',
    products: db.listProducts({ activeOnly: true }),
    schema: baseSchema({ path: '/account', title: 'ORGANICHY — My Account', description: 'Track your ORGANICHY order.' }),
  });
}

module.exports = { orderConfirmation, accountPage, timeline, statusPill, linesTable, orderRow };
