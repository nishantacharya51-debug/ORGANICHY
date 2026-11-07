'use strict';
/** lib/views/shop.js — all products: category chips (incl. coming-soon), search, sort. */
const config = require('../config');
const db = require('../db');
const { esc } = require('../util');
const { page, productCard, icon, baseSchema, breadcrumb } = require('./layout');

const SORTS = [
  { id: 'featured', label: 'Featured first' },
  { id: 'price-asc', label: 'Price: low to high' },
  { id: 'price-desc', label: 'Price: high to low' },
  { id: 'rating', label: 'Best rated' },
  { id: 'name', label: 'Name A–Z' },
];

function sortProducts(list, sort) {
  const arr = list.slice();
  if (sort === 'price-asc') arr.sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc') arr.sort((a, b) => b.maxPrice - a.maxPrice);
  else if (sort === 'rating') arr.sort((a, b) => b.ratingValue - a.ratingValue || b.reviewCount - a.reviewCount);
  else if (sort === 'name') arr.sort((a, b) => a.name.localeCompare(b.name));
  else arr.sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || b.reviewCount - a.reviewCount);
  return arr;
}

function shop(query = {}) {
  const q = String(query.q || '').trim();
  const cat = String(query.cat || 'all').trim() || 'all';
  const sort = SORTS.some((s) => s.id === query.sort) ? query.sort : 'featured';

  const all = db.listProducts({ activeOnly: true });
  let list = all.filter((p) => (cat === 'all' ? true : p.category === cat));
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((p) =>
      [p.name, p.shortName, p.blurb, p.tagline, p.description, p.category, ...(p.highlights || [])]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }
  list = sortProducts(list, sort);

  const catMeta = config.categories.find((c) => c.id === cat) || null;
  const heading = q
    ? `Search results for “${q}”`
    : catMeta && cat !== 'all'
      ? `${catMeta.label}${catMeta.live ? '' : ' — coming soon'}`
      : 'Every jar we make';
  const sub = q
    ? list.length
      ? `${list.length} product${list.length === 1 ? '' : 's'} match your search. Prices include every tax; delivery is free above ₹${config.pricing.freeShippingThreshold} on prepaid orders.`
      : `Nothing matches “${q}” yet. Our protein bars, oats and whey land through 2026 — try “peanut”, “creamy” or “protein”.`
    : 'Four recipes, two sizes each, one rule: if it is not in the ingredient list, it is not in the jar. All prices are inclusive of GST.';

  const body = `<section class="pagehead">
  <div class="wrap">
    ${breadcrumb([{ label: 'Home', href: '/' }, { label: 'Shop' }])}
    <p class="eyebrow">${icon('jar', 'ic--xs')} The ORGANICHY line-up</p>
    <h1 class="h1">${esc(heading)}</h1>
    <p class="lead">${esc(sub)}</p>
  </div>
</section>
<section class="section section--tight">
  <div class="wrap">
    <div class="shopbar card">
      <form class="shopbar__search" method="get" action="/shop" role="search">
        <label class="sr-only" for="q">Search products</label>
        ${q ? `<input type="hidden" name="q" value="${esc(q)}">` : ''}
        <div class="searchbox">
          ${icon('search')}
          <input class="searchbox__input" id="q" name="q" type="search" placeholder="Search “creamy”, “protein”, “no sugar”…" value="${esc(q)}">
          <button class="btn btn--sm btn--dark" type="submit">Search</button>
        </div>
      </form>
      <div class="chips" role="group" aria-label="Filter by category">
        ${config.categories
          .map((c) => {
            const active = c.id === cat;
            if (!c.live) {
              return `<a class="chip chip--soon ${active ? 'is-active' : ''}" href="/shop?cat=${esc(c.id)}" title="Coming ${esc(c.soon || 'soon')}">${esc(c.label)}<span class="chip__soon">soon</span></a>`;
            }
            const count = c.id === 'all' ? all.length : all.filter((p) => p.category === c.id).length;
            return `<a class="chip ${active ? 'is-active' : ''}" href="/shop?cat=${esc(c.id)}">${esc(c.label)}<span class="chip__n">${count}</span></a>`;
          })
          .join('')}
      </div>
      <form class="shopbar__sort" method="get" action="/shop">
        ${cat !== 'all' ? `<input type="hidden" name="cat" value="${esc(cat)}">` : ''}
        ${q ? `<input type="hidden" name="q" value="${esc(q)}">` : ''}
        <label class="label label--inline" for="sort">${icon('filter', 'ic--sm')} Sort</label>
        <select class="select select--sm" id="sort" name="sort" data-autosubmit>
          ${SORTS.map((s) => `<option value="${s.id}" ${s.id === sort ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
        </select>
        <noscript><button class="btn btn--sm btn--ghost" type="submit">Apply</button></noscript>
      </form>
    </div>

    ${list.length
      ? `<div class="grid grid--4 pgrid" data-stagger>${list.map((p) => productCard(p)).join('')}</div>`
      : `<div class="empty card">
          <span class="empty__ic">${icon('search')}</span>
          <h2 class="h3">No jars match that yet</h2>
          <p>We are a four-product brand that is deliberately picky. Protein bars, rolled oats, whey and a mass gainer arrive through 2026 — the shop page will grow, the label rules will not.</p>
          <div class="empty__cta">
            <a class="btn btn--primary" href="/shop">Clear the filters</a>
            <a class="btn btn--ghost" href="/contact?topic=wholesale">Ask us to make something</a>
          </div>
        </div>`}

    <div class="shopfoot">
      <div class="shopfoot__col">
        <h3 class="h3">How to pick a size</h3>
        <p>500 g is roughly 15 servings and lasts one person about two weeks at breakfast. If you are spooning it after the gym or feeding a family of four, the 1 kg is ~₹400 cheaper per kilo and is the one most repeat customers settle on.</p>
      </div>
      <div class="shopfoot__col">
        <h3 class="h3">Prices, taxes and shipping</h3>
        <p>Every price includes GST. Delivery is a flat ₹${config.pricing.shippingFee} and free above ₹${config.pricing.freeShippingThreshold} on prepaid orders; Cash on Delivery adds a ₹${config.pricing.codFee} courier-handling fee. Coupons are applied at checkout and re-checked on our server, never in your browser.</p>
      </div>
      <div class="shopfoot__col">
        <h3 class="h3">Coming in 2026</h3>
        <div class="chips chips--static">
          ${config.categories.filter((c) => !c.live).map((c) => `<span class="chip chip--soon">${esc(c.label)} · ${esc(c.soon || 'soon')}</span>`).join('')}
        </div>
        <p>Join the roast calendar at the bottom of this page and we will tell you the week each one opens for pre-order.</p>
      </div>
    </div>
  </div>
</section>`;

  const title = q
    ? `Search: ${q} — ORGANICHY`
    : catMeta && catMeta.live && cat !== 'all'
      ? `${catMeta.label} — ORGANICHY`
      : 'Buy Peanut Butter Online in India — 4 Jars, 2 Sizes | ORGANICHY';
  const description =
    'Peanut butter with two ingredients: roasted Saurashtra peanuts and sea salt. Creamy, crunchy, chocolate and high-protein jars in 500 g and 1 kg. Free delivery above ₹' +
    config.pricing.freeShippingThreshold +
    ', COD across India.';

  return page({
    title,
    description,
    path: '/shop',
    body,
    active: 'shop',
    products: all,
    schema: [
      ...baseSchema({ path: '/shop', title, description }),
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: title,
        url: `${config.site.url}/shop`,
        description,
      },
    ],
  });
}

module.exports = { shop };
