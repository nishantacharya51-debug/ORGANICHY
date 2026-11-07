'use strict';
/**
 * lib/views/home.js — the storefront landing page: hero, proof counters,
 * certification band, featured jars, benefits bento, process, review rail, CTA.
 */
const config = require('../config');
const db = require('../db');
const { esc, money } = require('../util');
const { page, productCard, stars, icon, sectionHead, baseSchema } = require('./layout');

const PROOF = [
  { n: 4812, suffix: '+', label: 'jars shipped', note: 'since launch, 2024' },
  { n: 62, suffix: '', label: 'gyms stocked', note: 'UP, Delhi NCR, Pune' },
  { n: 4.9, suffix: '★', label: 'average rating', decimals: 1, note: 'from verified orders' },
  { n: 19000, suffix: '+', label: 'pincodes served', note: 'all-India COD' },
];

const BENEFITS = [
  {
    k: 'clean',
    icon: 'leaf',
    t: 'One-line ingredient list',
    d: 'Peanuts and sea salt. No palm oil, no hydrogenated fat, no emulsifier, no refined sugar, no preservative. If it needs a chemistry degree to pronounce, it is not in our jar.',
    span: 'wide',
  },
  { k: 'protein', icon: 'bolt', t: '8–12 g protein', d: 'A 32 g serve carries 8 g of peanut protein — 12 g in the High Protein jar, blended with whey and pea.' },
  { k: 'roast', icon: 'sparkle', t: 'Small-batch roast', d: '120 kg batches, roasted to 152°C, ground wet for 40 minutes. That is where the smoothness comes from — not an additive.' },
  { k: 'value', icon: 'tag', t: 'Direct-to-you pricing', d: 'We skip the marketplace commission and pass the difference to you: ₹549 for 500 g, ₹949 for a full kilo.' },
  { k: 'oil', icon: 'refresh', t: 'The oil on top is the point', d: 'Natural peanut oil rises. Stir it back in for ten seconds. A jar that never separates has a stabiliser in it — ours does not.', span: 'wide' },
];

const PROCESS = [
  {
    n: '01',
    t: 'Sourced from a farmer collective',
    d: 'Groundnut arrives from Saurashtra, Gujarat — single origin, hand-rejected for shrivelled and discoloured kernels before anything goes near the roaster.',
    img: '/images/farm-story.png',
  },
  {
    n: '02',
    t: 'Roasted, then stone-ground',
    d: 'Roasted in 120 kg batches and milled between granite stones until the peanut\'s own oil turns it to silk. Salt goes in at the end, cold.',
    img: '/images/product-crunchy.png',
  },
  {
    n: '03',
    t: 'Jared, sealed, sent',
    d: 'Filled in Moradabad, induction-sealed, lot-numbered and shipped within 24 hours. Roast date to jar date is never more than 5 days.',
    img: '/images/hero-lifestyle.png',
  },
];

function hero(products) {
  const p = products[0];
  return `<section class="hero" id="hero">
  <div class="hero__glow" aria-hidden="true"></div>
  <div class="wrap hero__grid">
    <div class="hero__copy">
      <p class="eyebrow hero__in" style="--d:60ms">${icon('pin', 'ic--xs')} Roasted &amp; ground in ${esc(config.brand.city)}, Uttar Pradesh</p>
      <h1 class="hero__title">
        <span class="hero__line" style="--d:120ms">Peanut butter that</span>
        <span class="hero__line" style="--d:200ms">reads like a list</span>
        <span class="hero__line hero__line--accent" style="--d:280ms">of peanuts<span class="dot">.</span></span>
      </h1>
      <p class="lead hero__in" style="--d:360ms">
        Single-origin Saurashtra groundnut, roasted in small batches and stone-ground for forty minutes.
        Sea salt. Nothing else — no palm oil, no added sugar, no hydrogenated fat. ${esc(config.brand.slogan)}
      </p>
      <div class="hero__cta hero__in" style="--d:440ms">
        <a class="btn btn--primary btn--lg" href="/shop">${icon('jar')} Shop the jars ${icon('right', 'ic--sm')}</a>
        <a class="btn btn--ghost btn--lg" href="/our-story">How we make it</a>
      </div>
      <ul class="hero__trust hero__in" style="--d:520ms">
        ${['FSSAI licensed unit', 'Free delivery above ' + money(config.pricing.freeShippingThreshold), 'COD across India', '9-month shelf life'].map(
          (t) => `<li>${icon('check', 'ic--sm')} ${esc(t)}</li>`
        ).join('')}
      </ul>
    </div>
    <div class="hero__art">
      <figure class="hero__figure" data-parallax="18">
        <img class="hero__img" src="/images/hero-lifestyle.png" alt="Two athletes with jars of ORGANICHY peanut butter in a kitchen" width="900" height="1000" fetchpriority="high">
      </figure>
      <div class="floatcard floatcard--a reveal" style="--d:600ms">
        <div class="floatcard__row">${stars(4.9, 1284, { hideCount: true })}<span class="floatcard__num">4.9</span></div>
        <p><strong>1,284 verified reviews</strong><br>Gym-goers, parents, one very picky baker</p>
      </div>
      <div class="floatcard floatcard--b reveal" style="--d:720ms">
        <p class="floatcard__price">${money(p ? p.price : 549)}</p>
        <p class="floatcard__label">${esc(p ? `${p.shortName} · 500 g` : 'Classic Creamy')} · <a href="/product/${esc(p ? p.slug : '')}">see the label ${icon('right', 'ic--sm')}</a></p>
      </div>
      <span class="hero__stamp reveal" style="--d:800ms">${icon('shield', 'ic--sm')} No palm oil. Ever.</span>
    </div>
  </div>
</section>`;
}

function proof() {
  return `<section class="proof" aria-label="ORGANICHY by the numbers">
  <div class="wrap proof__grid">
    ${PROOF.map(
      (s) => `<div class="proof__item reveal">
      <p class="proof__num"><span data-counter="${s.n}" data-decimals="${s.decimals || 0}">0</span>${esc(s.suffix)}</p>
      <p class="proof__label">${esc(s.label)}</p>
      <p class="proof__note">${esc(s.note)}</p>
    </div>`
    ).join('')}
  </div>
</section>`;
}

function certs() {
  const list = [
    ['shield', 'FSSAI ' + config.brand.fssai, 'Licensed manufacturing unit'],
    ['leaf', '100% peanuts base', 'No stabilisers or emulsifiers'],
    ['check-circle', 'Lab-tested batch', 'Aflatoxin & peroxide reports'],
    ['truck', 'All-India dispatch', '19,000+ pincodes, 2–6 days'],
    ['users', 'Trusted by 62 gyms', 'Wholesale counter supply'],
  ];
  return `<section class="certs" aria-label="Certifications">
  <div class="wrap certs__row">
    ${list.map(([ic, t, d]) => `<div class="cert reveal"><span class="cert__ic">${icon(ic)}</span><p class="cert__t">${esc(t)}</p><p class="cert__d">${esc(d)}</p></div>`).join('')}
  </div>
</section>`;
}

function featured(products) {
  return `<section class="section section--alt" id="bestsellers">
  <div class="wrap">
    ${sectionHead({
      eyebrow: 'The four jars',
      eyebrowIcon: 'jar',
      title: 'What people actually reorder',
      sub: 'Two sizes each. Start on 500 g, move to a kilo once the jar in your cupboard is half gone.',
      action: { href: '/shop', label: 'Browse the whole shop' },
    })}
    <div class="grid grid--4" data-stagger>
      ${products.map((p) => productCard(p)).join('')}
    </div>
  </div>
</section>`;
}

function bento() {
  return `<section class="section" id="why">
  <div class="wrap">
    ${sectionHead({
      eyebrow: 'Why ORGANICHY',
      title: 'The difference is what is missing',
      sub: 'Every claim on this page is a label you can verify with your thumb on the jar.',
    })}
    <div class="bento" data-stagger>
      ${BENEFITS.map(
        (b) => `<article class="bento__item bento__item--${b.k}${b.span === 'wide' ? ' is-wide' : ''} card reveal" data-spotlight>
      <span class="bento__icon">${icon(b.icon)}</span>
      <h3 class="h3">${esc(b.t)}</h3>
      <p>${esc(b.d)}</p>
    </article>`
      ).join('')}
    </div>
  </div>
</section>`;
}

function process() {
  return `<section class="section section--dark" id="process">
  <div class="wrap">
    ${sectionHead({
      eyebrow: 'Farm to jar',
      eyebrowIcon: 'leaf',
      title: 'Three steps, five days, one unit',
      sub: 'Nothing here is outsourced. The roaster, the grinder and the person who seals your jar all work in the same building.',
    })}
    <ol class="steps">
      ${PROCESS.map(
        (s, i) => `<li class="step reveal" style="--d:${i * 120}ms">
      <span class="step__num">${esc(s.n)}</span>
      <div class="step__media"><img src="${esc(s.img)}" alt="${esc(s.t)}" loading="lazy" width="480" height="360"></div>
      <div class="step__body">
        <h3 class="h3">${esc(s.t)}</h3>
        <p>${esc(s.d)}</p>
      </div>
    </li>`
      ).join('')}
    </ol>
  </div>
</section>`;
}

function reviewRail(reviews, products) {
  const nameFor = (id) => (products.find((p) => p.id === id) || {}).shortName || 'ORGANICHY';
  return `<section class="section" id="reviews">
  <div class="wrap">
    ${sectionHead({
      eyebrow: 'What the jars sound like in real kitchens',
      title: 'Reviews from people who read labels',
      sub: 'Every review below is attached to a delivered order. We do not moderate the criticism, only the abuse.',
      action: { href: '/shop', label: 'Write one after your order' },
    })}
  </div>
  <div class="rail reveal">
    <div class="rail__track" data-rail>
      ${reviews
        .slice(0, 6)
        .map(
          (r) => `<article class="rcard card">
      <header class="rcard__head">
        <span class="rcard__av" aria-hidden="true">${esc(r.name.slice(0, 1))}</span>
        <div>
          <p class="rcard__name">${esc(r.name)}</p>
          <p class="rcard__meta">${esc(r.city)} · ${esc(nameFor(r.productId))}</p>
        </div>
      </header>
      ${stars(r.rating, 0, { hideCount: true })}
      <h4 class="rcard__title">${esc(r.title.trim())}</h4>
      <p class="rcard__body">${esc(r.body)}</p>
      ${r.verifiedPurchase ? `<p class="rcard__v">${icon('check-circle', 'ic--sm')} Verified purchase</p>` : ''}
    </article>`
        )
        .join('')}
    </div>
  </div>
  <div class="wrap rail__hint"><span>${icon('right', 'ic--sm')} drag or scroll sideways</span></div>
</section>`;
}

function wholesale() {
  return `<section class="cta">
  <div class="wrap cta__inner reveal">
    <div>
      <p class="eyebrow eyebrow--light">${icon('users', 'ic--xs')} Wholesale &amp; gyms</p>
      <h2 class="h2">Stocking a counter? Let us price that.</h2>
      <p>From 24 jars a month you get wholesale rates, a GST invoice and — if you want it — your own sticker on our lid. We already supply 62 gyms and three café breakfast menus.</p>
    </div>
    <div class="cta__actions">
      <a class="btn btn--lg btn--light" href="/contact?topic=wholesale">Request the price list</a>
      <a class="btn btn--lg btn--outline-light" href="https://wa.me/${esc(config.brand.whatsapp)}?text=${encodeURIComponent('Hi! I want ORGANICHY wholesale pricing for my gym/café.')}" target="_blank" rel="noopener">${icon('whatsapp')} WhatsApp ${esc(config.brand.phoneDisplay)}</a>
    </div>
  </div>
</section>`;
}

function newsletter() {
  return `<section class="section section--tight" id="newsletter">
  <div class="wrap nlbox reveal">
    <div>
      <p class="eyebrow">${icon('mail', 'ic--xs')} Roast calendar</p>
      <h2 class="h2">Know the day we roast</h2>
      <p class="muted">One email a month: roast dates, restock alerts for the 1 kg jars, and recipes from the gyms we supply. Unsubscribe in one click.</p>
    </div>
    <form class="nl nl--box" data-newsletter>
      <div class="nl__row">
        <label class="sr-only" for="nl-email">Email address</label>
        <input class="input" id="nl-email" type="email" name="email" placeholder="you@email.com" required autocomplete="email">
        <button class="btn btn--primary" type="submit">Subscribe ${icon('right', 'ic--sm')}</button>
      </div>
      <p class="form-msg" data-form-msg role="status"></p>
    </form>
  </div>
</section>`;
}

function home() {
  const products = db.listProducts({ activeOnly: true });
  const featuredProducts = products.filter((p) => p.featured).concat(products).slice(0, 4);
  const reviews = db.read('reviews').filter((r) => r.approved !== false);
  const title = 'ORGANICHY — Peanut Butter with Two Ingredients | Moradabad';
  const description = `Stone-ground peanut butter from Moradabad: roasted Saurashtra peanuts and sea salt, nothing else. Creamy, crunchy, chocolate and high-protein jars, free delivery above ₹${config.pricing.freeShippingThreshold}, COD across India.`;

  const body =
    hero(featuredProducts) +
    proof() +
    certs() +
    featured(featuredProducts) +
    bento() +
    process() +
    reviewRail(reviews, products) +
    wholesale() +
    newsletter();

  return page({
    title,
    description,
    path: '/',
    body,
    active: 'home',
    products,
    schema: [
      ...baseSchema({ path: '/', title, description }),
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'ORGANICHY jars',
        itemListElement: featuredProducts.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${config.site.url}/product/${p.slug}`,
          name: p.name,
        })),
      },
    ],
  });
}

module.exports = { home };
