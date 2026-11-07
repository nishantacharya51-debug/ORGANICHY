'use strict';
/**
 * lib/views/layout.js — the shell every page is wrapped in, plus the shared
 * components (product card, stars, steppers, section heads). Everything here is
 * a server-rendered HTML string: no templating engine, no build step.
 */
const config = require('../config');
const { esc, money, jsonForScript, dateFmt, cls } = require('../util');

/* ------------------------------------------------------------------ */
/* Icons (inline sprite — one file, no icon font, no network)          */
/* ------------------------------------------------------------------ */
const ICONS = {
  cart: '<path d="M3 4h2.2l2.3 10.1a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L21.2 8H6.1"/><circle cx="10.2" cy="19.6" r="1.5"/><circle cx="17.6" cy="19.6" r="1.5"/>',
  check: '<path d="M4.5 12.6l4.6 4.5L19.6 6.6"/>',
  'check-circle': '<circle cx="12" cy="12" r="8.6"/><path d="M8.2 12.3l2.6 2.6 5-5.2"/>',
  truck: '<path d="M2.6 6.6h9.6v9.2H2.6z"/><path d="M12.2 9.6h3.9l3.3 3.2v3h-7.2z"/><circle cx="6.6" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
  leaf: '<path d="M20.4 3.6c0 9.4-5.6 13.6-11.4 13.6-2.5 0-4.4-.9-5-2 1-7.3 6.3-11.6 12.6-11.6z"/><path d="M4.6 18.4c2.2-5.3 6.2-9.3 11.4-11.6"/>',
  star: '<path d="M12 3.4l2.7 5.5 6 .9-4.3 4.3 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.8l6-.9z"/>',
  search: '<circle cx="11" cy="11" r="6.6"/><path d="M15.9 15.9L20.6 20.6"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.6 20.2c1.3-3.7 4.1-5.5 7.4-5.5s6.1 1.8 7.4 5.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  right: '<path d="M4.5 12h15M13 6l6.4 6L13 18"/>',
  down: '<path d="M6 9.4l6 6 6-6"/>',
  up: '<path d="M6 14.6l6-6 6 6"/>',
  whatsapp: '<path d="M3.8 20.2l1.4-4.2A8.2 8.2 0 1 1 8.4 19.2z"/><path d="M8.8 9.1c.4 3 2.9 5.4 5.9 5.8l1.1-1.6-2-1-1 .8a5.4 5.4 0 0 1-2.4-2.4l.8-1-1-2z"/>',
  mail: '<rect x="3" y="5.6" width="18" height="12.8" rx="2"/><path d="M3.8 7l8.2 5.6L20.2 7"/>',
  phone: '<path d="M6 3.4h3l2 4.8-2.4 1.6a12.4 12.4 0 0 0 6 6L16.2 14l4.4 2v3.4a2 2 0 0 1-2.2 2A17.2 17.2 0 0 1 4 5.6a2 2 0 0 1 2-2.2z"/>',
  pin: '<path d="M12 21.2s7-6.5 7-11.4a7 7 0 1 0-14 0c0 4.9 7 11.4 7 11.4z"/><circle cx="12" cy="9.6" r="2.6"/>',
  shield: '<path d="M12 3.2l7.2 3v5.9c0 4.5-3.1 7.8-7.2 9-4.1-1.2-7.2-4.5-7.2-9V6.2z"/><path d="M8.8 12l2.3 2.3 4.1-4.4"/>',
  sparkle: '<path d="M12 3.2l1.9 4.9 4.9 1.9-4.9 1.9L12 16.8l-1.9-4.9-4.9-1.9 4.9-1.9z"/><path d="M18.6 15.4l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  box: '<path d="M12 3.2l8.2 4.4v8.8L12 20.8l-8.2-4.4V7.6z"/><path d="M3.8 7.6l8.2 4.4 8.2-4.4M12 12v8.8"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.6 2.1"/>',
  plus: '<path d="M12 5.4v13.2M5.4 12h13.2"/>',
  minus: '<path d="M5.4 12h13.2"/>',
  trash: '<path d="M4.8 7h14.4M9.4 7V4.6h5.2V7M6.8 7l1 12.6h8.4L17.2 7"/>',
  chart: '<path d="M4 19.6V10.4M10 19.6V4.4M16 19.6v-6.2M22 19.6H2"/>',
  jar: '<path d="M8.4 3.4h7.2v2.4H8.4z"/><path d="M7.2 6.6h9.6l1 3.2v8.2a2.4 2.4 0 0 1-2.4 2.4H8.6a2.4 2.4 0 0 1-2.4-2.4V9.8z"/><path d="M6.4 12.4h11.2"/>',
  quote: '<path d="M9.4 6.4c-2.8 0-4.9 2.1-4.9 4.9 0 2.6 1.6 4.2 3.8 4.2.4 0 .8 0 1.1-.1-.5 2-2.1 3.3-3.8 4 4.3-.5 7.4-4 7.4-8.6V6.4z"/><path d="M20 6.4c-2.8 0-4.9 2.1-4.9 4.9 0 2.6 1.6 4.2 3.8 4.2"/>',
  alert: '<path d="M12 4.2l8.6 15.4H3.4z"/><path d="M12 10v4M12 16.6h.01"/>',
  copy: '<rect x="8.8" y="8.8" width="11.4" height="11.4" rx="2.2"/><path d="M15.2 5.4H6.6a2.2 2.2 0 0 0-2.2 2.2v8.6"/>',
  bolt: '<path d="M13.4 2.6L5.8 13.4h4.6l-1 8 7.8-11.2h-4.8z"/>',
  instagram: '<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="5"/><circle cx="12" cy="12" r="3.9"/><circle cx="17.1" cy="6.9" r="1.1"/>',
  tag: '<path d="M4.2 4.2h7.2l8.4 8.4-7.2 7.2L4.2 11.4z"/><circle cx="8.4" cy="8.4" r="1.4"/>',
  refresh: '<path d="M20 12a8 8 0 0 1-13.7 5.6M4 12a8 8 0 0 1 13.7-5.6"/><path d="M17.4 3v4.2h-4.2M6.6 21v-4.2h4.2"/>',
  filter: '<path d="M4 6.4h16M7 12h10M10 17.6h4"/>',
  lock: '<rect x="4.6" y="10.4" width="14.8" height="9.6" rx="2.2"/><path d="M8.2 10.4V7.8a3.8 3.8 0 0 1 7.6 0v2.6"/>',
  img: '<rect x="3.4" y="5" width="17.2" height="14" rx="2.4"/><circle cx="9" cy="10.4" r="1.8"/><path d="M4.6 17.6l4.6-4 3.2 2.8 3-2.6 4.2 3.8"/>',
  logout: '<path d="M15.4 8.6V5.8a2 2 0 0 0-2-2H5.6a2 2 0 0 0-2 2v12.4a2 2 0 0 0 2 2h7.8a2 2 0 0 0 2-2v-2.8"/><path d="M9.6 12h10.8M17.4 8.6l3 3.4-3 3.4"/>',
  download: '<path d="M12 3.6v10.8M8 11l4 3.6 4-3.6"/><path d="M4.4 18.4v1.2a1.6 1.6 0 0 0 1.6 1.6h12a1.6 1.6 0 0 0 1.6-1.6v-1.2"/>',
  users: '<circle cx="9" cy="8.4" r="3.2"/><path d="M2.8 19.6c1-3.2 3.4-4.8 6.2-4.8s5.2 1.6 6.2 4.8"/><path d="M16 5.6a3.2 3.2 0 0 1 0 5.6M17.4 14.8c2.2.4 3.6 1.9 4.4 4.2"/>',
  edit: '<path d="M4.6 19.4h3.2L19 8.2l-3.2-3.2L4.6 16.2z"/><path d="M14.6 6.2l3.2 3.2"/>',
  eye: '<path d="M2.6 12S6 6.4 12 6.4 21.4 12 21.4 12 18 17.6 12 17.6 2.6 12 2.6 12z"/><circle cx="12" cy="12" r="3"/>',
};

function icon(name, cls = '') {
  const fill = name === 'star' || name === 'jar' || name === 'bolt' ? 'currentColor' : 'none';
  return `<svg class="${cls ? 'ic ' + cls : 'ic'}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

/* ------------------------------------------------------------------ */
/* Small components                                                    */
/* ------------------------------------------------------------------ */
function stars(rating, count, opts = {}) {
  const r = Number(rating) || 0;
  const full = Math.floor(r);
  const half = r - full >= 0.25 && r - full < 0.85;
  let out = '<span class="stars" role="img" aria-label="' + esc(`${r.toFixed(1)} out of 5 stars`) + '">';
  out += '<span class="stars__bg">';
  for (let i = 0; i < 5; i += 1) out += icon('star', 'ic--star');
  out += '</span><span class="stars__fill" style="--pct:' + Math.round(((full + (half ? 0.5 : 0)) / 5) * 100) + '%">';
  for (let i = 0; i < 5; i += 1) out += icon('star', 'ic--star');
  out += '</span></span>';
  if (opts.hideCount !== true) {
    out += `<span class="stars__num">${r.toFixed(1)}</span>`;
    out += `<span class="stars__count">(${count || 0})</span>`;
  }
  return out;
}

function discountPct(price, mrp) {
  if (!mrp || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

function priceBlock(p, extra = '') {
  const off = discountPct(p.price, p.mrp);
  return `<div class="${cls('price', extra)}">
    <span class="price__now">${money(p.price)}</span>
    ${off > 0 ? `<span class="price__mrp">${money(p.mrp)}</span><span class="price__off">${off}% off</span>` : ''}
    ${p.priceRange ? `<span class="price__from">upto ${money(p.maxPrice)}</span>` : ''}
  </div>`;
}

function badge(p) {
  if (p.soldOut) return '<span class="tag tag--out">Sold out</span>';
  if (p.badge) return `<span class="tag tag--brand">${esc(p.badge)}</span>`;
  const off = discountPct(p.price, p.mrp);
  return off >= 12 ? `<span class="tag tag--sale">${off}% off</span>` : '';
}

function productCard(p, opts = {}) {
  const stockLine = p.soldOut
    ? '<span class="pcard__stock pcard__stock--out">Back on 24 Nov</span>'
    : p.lowStock
      ? `<span class="pcard__stock pcard__stock--low">${icon('alert', 'ic--xs')} Only ${p.stock} left</span>`
      : `<span class="pcard__stock">${icon('check', 'ic--xs')} In stock · ${p.fromVariant}–${p.toVariant}</span>`;
  return `<article class="pcard card reveal" data-spotlight data-product="${esc(p.id)}">
  <a class="pcard__media" href="/product/${esc(p.slug)}" aria-label="${esc(p.name)}">
    <img class="pcard__img" src="${esc(p.images[0])}" alt="${esc(p.name)} — ORGANICHY peanut butter jar" loading="lazy" width="600" height="600">
    <span class="pcard__badges">${badge(p)}</span>
    <span class="pcard__tint" style="--tint:${esc(p.tint || '#eef6f0')}"></span>
  </a>
  <div class="pcard__body">
    <p class="pcard__cat">${esc((config.categories.find((c) => c.id === p.category) || {}).label || 'Store')}</p>
    <h3 class="pcard__title"><a href="/product/${esc(p.slug)}">${esc(p.name)}</a></h3>
    <p class="pcard__tag">${esc(p.tagline || p.blurb)}</p>
    ${stars(p.ratingValue, p.reviewCount)}
    <div class="pcard__foot">
      ${priceBlock(p)}
      ${stockLine}
    </div>
    <div class="pcard__cta">
      <button class="btn btn--primary btn--sm" data-add-cart data-product="${esc(p.id)}" data-variant="${esc(p.variants[0].label)}" ${p.soldOut ? 'disabled' : ''}>
        ${icon('cart')} Add ${p.variants.length > 1 ? `· from ${money(p.price)}` : 'to cart'}
      </button>
      <a class="btn btn--ghost btn--sm" href="/product/${esc(p.slug)}">Options</a>
    </div>
  </div>
</article>`;
}

function qtyStepper(qty = 1, opts = {}) {
  return `<div class="stepper" data-stepper>
  <button type="button" class="stepper__btn" data-step="-1" aria-label="Decrease quantity">${icon('minus')}</button>
  <input class="stepper__val" type="text" inputmode="numeric" pattern="[0-9]*" value="${Number(qty) || 1}" ${opts.name ? `name="${esc(opts.name)}"` : ''} data-qty-input aria-label="Quantity" ${opts.readonly ? 'readonly' : ''}>
  <button type="button" class="stepper__btn" data-step="1" aria-label="Increase quantity">${icon('plus')}</button>
</div>`;
}

function sectionHead(o) {
  return `<div class="section__head ${o.center ? 'is-center' : ''}">
  ${o.eyebrow ? `<p class="eyebrow">${icon(o.eyebrowIcon || 'sparkle', 'ic--xs')} ${esc(o.eyebrow)}</p>` : ''}
  <h2 class="h2">${esc(o.title)}</h2>
  ${o.sub ? `<p class="lead">${o.sub}</p>` : ''}
  ${o.action ? `<a class="link" href="${esc(o.action.href)}">${esc(o.action.label)} ${icon('right', 'ic--sm')}</a>` : ''}
</div>`;
}

function field(o) {
  const type = o.type || 'text';
  const common = `id="${esc(o.id)}" name="${esc(o.name || o.id)}" ${o.required ? 'required' : ''} ${o.autocomplete ? `autocomplete="${esc(o.autocomplete)}"` : ''} ${o.inputmode ? `inputmode="${esc(o.inputmode)}"` : ''} ${o.pattern ? `pattern="${esc(o.pattern)}"` : ''} ${o.minlength ? `minlength="${o.minlength}"` : ''} ${o.maxlength ? `maxlength="${o.maxlength}"` : ''} ${o.placeholder ? `placeholder="${esc(o.placeholder)}"` : ''} ${o.value ? `value="${esc(o.value)}"` : ''}`;
  let control;
  if (type === 'textarea') {
    control = `<textarea class="textarea" ${common} rows="${o.rows || 4}">${esc(o.value || '')}</textarea>`;
  } else if (type === 'select') {
    control = `<select class="select" ${common}>${(o.options || []).map((op) => `<option value="${esc(op)}" ${String(op) === String(o.value || '') ? 'selected' : ''}>${esc(op)}</option>`).join('')}</select>`;
  } else {
    control = `<input class="input" type="${esc(type)}" ${common}>`;
  }
  return `<div class="${cls('field', o.span && `field--${o.span}`, o.className)}">
  <label class="label" for="${esc(o.id)}">${esc(o.label)}${o.required ? '<span class="req" aria-hidden="true"> *</span>' : ''}${o.optional ? `<span class="opt">${esc(o.optional)}</span>` : ''}</label>
  ${control}
  ${o.hint ? `<p class="hint">${o.hint}</p>` : ''}
</div>`;
}

/* ------------------------------------------------------------------ */
/* Header / footer                                                     */
/* ------------------------------------------------------------------ */
function header(products, active) {
  const mega = products
    .slice(0, 4)
    .map(
      (p) => `<a class="mega__item" href="/product/${esc(p.slug)}">
      <span class="mega__media"><img src="${esc(p.images[0])}" alt="${esc(p.shortName)}" loading="lazy" width="80" height="80"></span>
      <span class="mega__text"><strong>${esc(p.shortName)}</strong><span>${money(p.price)} · ${esc(p.variants.map((v) => v.label).join(' / '))}</span></span>
    </a>`
    )
    .join('');

  const link = (href, label, key) =>
    `<a class="nav__link ${active === key ? 'is-active' : ''}" href="${href}" ${key === 'shop' ? 'data-mega-toggle' : ''}>${esc(label)}</a>`;

  return `<a class="skip-link" href="#main">Skip to content</a>
<div class="scrollbar" id="scrollbar" aria-hidden="true"></div>
<div class="navloader" id="navloader" aria-hidden="true"></div>
<header class="hdr" id="hdr">
  <div class="hdr__top">
    <div class="wrap hdr__top-in">
      <p class="hdr__ship">${icon('truck', 'ic--sm')} ${esc(config.shipping.freeShipCopy)} · ${esc(config.shipping.cashOnDeliveryNote)}</p>
      <div class="hdr__side">
        <a href="mailto:${esc(config.brand.email)}">${icon('mail', 'ic--sm')} ${esc(config.brand.email)}</a>
        <a href="https://wa.me/${esc(config.brand.whatsapp)}" target="_blank" rel="noopener">${icon('whatsapp', 'ic--sm')} ${esc(config.brand.phoneDisplay)}</a>
      </div>
    </div>
  </div>
  <div class="hdr__bar wrap">
    <a class="logo" href="/" aria-label="ORGANICHY home">
      <span class="logo__mark">${icon('jar')}</span>
      <span class="logo__text"><strong>ORGANICHY</strong><small>${esc(config.brand.tagline)}</small></span>
    </a>
    <nav class="nav" id="nav" aria-label="Main">
      ${link('/', 'Home', 'home')}
      <div class="nav__item nav__item--mega">${link('/shop', 'Shop', 'shop')}
        <div class="mega">
          <div class="mega__grid">${mega}</div>
          <div class="mega__foot">
            <p>Four jars, two sizes each. Every one of them ${config.pricing.currency}49 shipping or free above ${config.pricing.currency}${config.pricing.freeShippingThreshold}.</p>
            <a class="btn btn--dark btn--sm" href="/shop">Browse all ${icon('right', 'ic--sm')}</a>
          </div>
        </div>
      </div>
      ${link('/our-story', 'Our Story', 'story')}
      ${link('/faqs', 'FAQs', 'faqs')}
      ${link('/contact', 'Contact', 'contact')}
      ${link('/account', 'Track order', 'account')}
    </nav>
    <div class="hdr__actions">
      <a class="iconbtn" href="/account" aria-label="My account and order tracking">${icon('user')}</a>
      <a class="iconbtn iconbtn--cart" href="/cart" aria-label="Cart">${icon('cart')}<span class="badge" data-cart-badge hidden>0</span></a>
      <button class="burger" type="button" data-burger aria-expanded="false" aria-controls="drawer" aria-label="Open menu">${icon('menu')}</button>
    </div>
  </div>
</header>
<div class="drawer" id="drawer" aria-hidden="true">
  <div class="drawer__inner">
    <div class="drawer__head">
      <span class="logo__text"><strong>ORGANICHY</strong><small>${esc(config.brand.tagline)}</small></span>
      <button class="iconbtn" type="button" data-drawer-close aria-label="Close menu">${icon('close')}</button>
    </div>
    <nav class="drawer__nav" aria-label="Mobile">
      ${[['/', 'Home'], ['/shop', 'Shop all jars'], ['/cart', 'Cart'], ['/checkout', 'Checkout'], ['/account', 'Track an order'], ['/our-story', 'Our Story'], ['/about', 'About us'], ['/faqs', 'FAQs'], ['/contact', 'Contact']].map(([href, label]) => `<a class="drawer__link" href="${href}">${esc(label)} ${icon('right', 'ic--sm')}</a>`).join('')}
    </nav>
    <div class="drawer__cats">
      ${config.categories.filter((c) => !c.live).map((c) => `<span class="chip chip--soon">${esc(c.label)} · ${esc(c.soon || 'soon')}</span>`).join('')}
    </div>
    <a class="btn btn--primary btn--block" href="https://wa.me/${esc(config.brand.whatsapp)}?text=${encodeURIComponent('Hi ORGANICHY! I have a question about your peanut butter.')}" target="_blank" rel="noopener">${icon('whatsapp')} WhatsApp us</a>
  </div>
</div>
<div class="scrim" data-drawer-close></div>`;
}

function footer() {
  const col = (title, links) =>
    `<div class="ftr__col"><h4 class="ftr__title">${esc(title)}</h4><ul class="ftr__links">${links.map(([h, l]) => `<li><a href="${h}">${esc(l)}</a></li>`).join('')}</ul></div>`;
  return `<footer class="ftr">
  <div class="wrap ftr__grid">
    <div class="ftr__brand">
      <a class="logo" href="/"><span class="logo__mark">${icon('jar')}</span><span class="logo__text"><strong>ORGANICHY</strong><small>${esc(config.brand.tagline)}</small></span></a>
      <p class="ftr__slogan">${esc(config.brand.slogan)}</p>
      <p class="ftr__addr">${esc(config.brand.address)}<br>GSTIN ${esc(config.brand.gstin)} · FSSAI ${esc(config.brand.fssai)}</p>
      <div class="ftr__social">
        <a href="https://wa.me/${esc(config.brand.whatsapp)}" target="_blank" rel="noopener" aria-label="WhatsApp">${icon('whatsapp')}</a>
        <a href="${esc(config.brand.instagram)}" target="_blank" rel="noopener" aria-label="Instagram">${icon('instagram')}</a>
        <a href="mailto:${esc(config.brand.email)}" aria-label="Email">${icon('mail')}</a>
        <a href="tel:+${esc(config.brand.whatsapp)}" aria-label="Call">${icon('phone')}</a>
      </div>
    </div>
    ${col('Shop', [['/shop', 'All products'], ['/product/classic-creamy-peanut-butter', 'Classic Creamy'], ['/product/crunchy-peanut-butter', 'Crunchy'], ['/product/chocolate-peanut-butter', 'Chocolate'], ['/product/high-protein-peanut-butter', 'High Protein']])}
    ${col('Company', [['/about', 'About us'], ['/our-story', 'Our Story'], ['/contact', 'Contact'], ['/faqs', 'FAQs'], ['/cart', 'Cart']])}
    ${col('Help', [['/shipping-policy', 'Shipping policy'], ['/return-refund-policy', 'Returns & refunds'], ['/privacy-policy', 'Privacy policy'], ['/terms', 'Terms & conditions'], ['/account', 'Track an order']])}
    <div class="ftr__col ftr__col--nl">
      <h4 class="ftr__title">First dibs on new batches</h4>
      <p class="ftr__note">Roast dates, restock alerts and the occasional recipe. One mail a month, no reselling of your number.</p>
      <form class="nl" data-newsletter>
        <div class="nl__row">
          <label class="sr-only" for="ftr-email">Email address</label>
          <input class="input" id="ftr-email" type="email" name="email" placeholder="you@email.com" required autocomplete="email">
          <button class="btn btn--primary btn--sm" type="submit">Join</button>
        </div>
        <p class="form-msg" data-form-msg role="status"></p>
      </form>
    </div>
  </div>
  <div class="wrap ftr__bottom">
    <p>© ${new Date().getFullYear()} ${esc(config.brand.legalName)}. Built in ${esc(config.brand.city)}. Product photographs are for representation.</p>
    <p class="pay">${['UPI', 'Cards', 'Netbanking', 'COD', 'Razorpay'].map((m) => `<span>${esc(m)}</span>`).join('')}</p>
  </div>
</footer>
<a class="wafloat" href="https://wa.me/${esc(config.brand.whatsapp)}?text=${encodeURIComponent('Hi ORGANICHY! I want to ask about your peanut butter.')}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">
  ${icon('whatsapp')}<span class="wafloat__tip">Ask us anything</span>
</a>`;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
function page(opts) {
  const {
    title,
    description,
    path: route = '/',
    body = '',
    robots = 'index,follow',
    schema = [],
    bodyClass = '',
    products = [],
    ogImage = '/images/hero-lifestyle.png',
    type = 'website',
  } = opts;

  const url = `${config.site.url}${route === '/' ? '' : route}`;
  const ld = (Array.isArray(schema) ? schema : [schema]).filter(Boolean);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<meta name="robots" content="${esc(robots)}">
<meta name="theme-color" content="#0f7a4d">
<meta name="format-detection" content="telephone=no">
<meta property="og:type" content="${esc(type)}">
<meta property="og:site_name" content="ORGANICHY">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(config.site.url + ogImage)}">
<meta property="og:locale" content="en_IN">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(config.site.url + ogImage)}">
<link rel="icon" href="/images/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/images/product-creamy.png">
<link rel="preload" as="style" href="/css/main.css">
<link rel="stylesheet" href="/css/main.css">
<script src="/js/boot.js" defer></script>
<script src="/js/main.js" defer></script>
${ld.length ? `<script type="application/ld+json">${ld.length === 1 ? jsonForScript(ld[0]) : jsonForScript(ld)}</script>` : ''}
</head>
<body${bodyClass ? ` class="${esc(bodyClass)}"` : ''} data-route="${esc(route)}" data-currency="${esc(config.pricing.currency)}">
${header(products, opts.active)}
<main id="main" class="page">${body}</main>
${footer()}
</body>
</html>`;
}

function baseSchema({ path: route = '/', title, description }) {
  const url = `${config.site.url}${route === '/' ? '' : route}`;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: config.brand.name,
      legalName: config.brand.legalName,
      url: config.site.url,
      logo: `${config.site.url}/images/favicon.svg`,
      description,
      foundingDate: config.brand.established,
      founder: { '@type': 'Person', name: config.brand.founder },
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Plot 14, Industrial Area Nadon',
        addressLocality: config.brand.city,
        addressRegion: config.brand.state,
        postalCode: '244001',
        addressCountry: 'IN',
      },
      email: config.brand.email,
      telephone: `+${config.brand.whatsapp}`,
      sameAs: [config.brand.instagram],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: config.brand.name,
      url: config.site.url,
      inLanguage: 'en-IN',
      potentialAction: {
        '@type': 'SearchAction',
        target: `${config.site.url}/shop?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: config.site.url }].concat(
        route === '/' ? [] : [{ '@type': 'ListItem', position: 2, name: title, item: url }]
      ),
    },
  ];
}

function breadcrumb(items) {
  return `<nav class="crumbs" aria-label="Breadcrumb">${items
    .map(
      (it, i) =>
        `<span>${i ? '<span class="crumbs__sep" aria-hidden="true">/</span>' : ''}${
          it.href && i < items.length - 1 ? `<a href="${esc(it.href)}">${esc(it.label)}</a>` : `<b>${esc(it.label)}</b>`
        }</span>`
    )
    .join('')}</nav>`;
}

module.exports = {
  page,
  baseSchema,
  productCard,
  priceBlock,
  discountPct,
  badge,
  stars,
  qtyStepper,
  sectionHead,
  field,
  icon,
  breadcrumb,
  header,
  footer,
};
