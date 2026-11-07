'use strict';
/**
 * lib/views/product.js — product detail page.
 * Gallery, size variants with per-variant price/stock, quantity stepper,
 * add-to-cart / buy-now, pincode ETA checker, label accordions, reviews with a
 * star picker, related jars, JSON-LD Product schema.
 */
const config = require('../config');
const db = require('../db');
const { esc, money, dateFmt, estimatePincode } = require('../util');
const { page, productCard, stars, qtyStepper, icon, sectionHead, baseSchema, breadcrumb, discountPct, field } = require('./layout');

/** "1 kg" / "500 g" → grams, so we can print a per-100 g price for comparison. */
function grams(label) {
  const m = String(label).match(/([\d.]+)\s*(kg|g)/i);
  if (!m) return 100;
  return Math.round(Number(m[1]) * (m[2].toLowerCase() === 'kg' ? 1000 : 1));
}

/** Scale a per-serve value to 100 g for the label footnote. */
function per100(p, label) {
  const row = (p.nutrition || []).find((n) => n.label === label);
  if (!row) return '';
  const n = parseFloat(String(row.value).replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n)) return row.value;
  return `${(n * (100 / 32)).toFixed(1)} g`.replace('.0 g', ' g');
}

function gallery(p) {
  const imgs = p.images && p.images.length ? p.images : ['/images/product-creamy.png'];
  return `<div class="gal" data-gallery data-accent="${esc(p.accent || '#0f7a4d')}">
  <div class="gal__main">
    ${imgs.length > 1 ? `<span class="gal__badge">${esc(p.badge || '')}</span>` : ''}
    <img class="gal__img" src="${esc(imgs[0])}" alt="${esc(p.name)} jar, ORGANICHY peanut butter" width="760" height="760" fetchpriority="high" data-gallery-main>
    <span class="gal__tint" style="--tint:${esc(p.tint || '#eef6f0')}" aria-hidden="true"></span>
  </div>
  ${imgs.length > 1
    ? `<div class="gal__thumbs">
      ${imgs
        .map(
          (src, i) =>
            `<button class="gal__thumb ${i === 0 ? 'is-active' : ''}" type="button" data-gallery-thumb="${esc(src)}" aria-label="View image ${i + 1}">
        <img src="${esc(src)}" alt="" width="96" height="96" loading="lazy">
      </button>`
        )
        .join('')}
    </div>`
    : ''}
  <ul class="gal__facts">
    ${p.highlights.map((h) => `<li>${icon('check', 'ic--sm')} ${esc(h)}</li>`).join('')}
  </ul>
</div>`;
}

function variants(p) {
  return `<div class="variants" data-variants>
  <div class="variants__head">
    <span class="label">Choose your size</span>
    <span class="variants__hint">${icon('refresh', 'ic--sm')} ${esc(p.variants.length)} options · price and stock update per size</span>
  </div>
  <div class="variants__list">
    ${p.variants
      .map(
        (v, i) => {
          const stock = Number(v.stock) || 0;
          const off = discountPct(v.price, v.mrp);
          return `<button class="variant ${i === 0 ? 'is-active' : ''} ${stock <= 0 ? 'is-out' : ''}" type="button"
        data-variant-btn="${esc(v.label)}" data-price="${v.price}" data-stock="${stock}" data-sku="${esc(v.sku || '')}"
        aria-pressed="${i === 0}">
      <span class="variant__tick" aria-hidden="true">${icon('check', 'ic--sm')}</span>
      <span class="variant__main">
        <span class="variant__label">${esc(v.label)}</span>
        <span class="variant__sub">${money(Math.round((v.price / grams(v.label)) * 100))} per 100 g · ${esc(v.sku || '')}</span>
      </span>
      <span class="variant__right">
        <span class="variant__price">${money(v.price)}</span>
        ${off > 0 ? `<span class="variant__mrp">${money(v.mrp)}</span>` : ''}
        <span class="variant__stock ${stock <= 0 ? 'is-out' : stock <= config.pricing.lowStockAt ? 'is-low' : ''}">${
            stock <= 0 ? 'Sold out' : stock <= config.pricing.lowStockAt ? `Only ${stock} left` : 'In stock'
          }</span>
      </span>
    </button>`;
        }
      )
      .join('')}
  </div>
</div>`;
}

function accordions(p) {
  const blocks = [
    {
      id: 'ing',
      t: 'Ingredient list & allergen advice',
      open: true,
      body: `<p>${esc(p.ingredients)}</p>
      <p class="muted">Shelf life 9 months from the roast date printed on the base of the jar. Store in a cool dry cupboard, no refrigeration needed, use a dry spoon. Natural oil settling on top is what a jar without stabilisers looks like — stir for ten seconds.</p>`,
    },
    {
      id: 'nut',
      t: 'Nutrition information',
      body: `<table class="nute">
      <caption class="nute__cap">${esc(p.nutritionNote)} · values are typical per batch</caption>
      <tbody>
        ${p.nutrition.map((n) => `<tr><td>${esc(n.label)}</td><td>${esc(n.value)}</td></tr>`).join('')}
      </tbody>
    </table>
    <p class="muted">Per 100 g: energy 588 kcal, protein ${esc(per100(p, 'Protein'))}, fat ${esc(per100(p, 'Total fat'))}, carbohydrate ${esc(per100(p, 'Carbohydrate'))}, sugars ${esc(per100(p, '— Sugars (natural)') || per100(p, '— Added sugars'))}. Percentage RDA is computed against an 8,400 kJ adult diet (ICMR 2020).</p>`,
    },
    {
      id: 'ship',
      t: 'Shipping, COD & returns',
      body: `<ul class="ticks">
        <li>${icon('truck', 'ic--sm')} Free delivery on prepaid orders above ${money(config.pricing.freeShippingThreshold)}; otherwise a flat ${money(config.pricing.shippingFee)}.</li>
        <li>${icon('clock', 'ic--sm')} Packed within 24 hours on business days (${esc(config.shipping.dispatchDays)}); 2–3 days to metros, 3–6 days elsewhere.</li>
        <li>${icon('shield', 'ic--sm')} Cash on Delivery available on 19,000+ pincodes for a ${money(config.pricing.codFee)} handling fee.</li>
        <li>${icon('refresh', 'ic--sm')} Sealed-jar damage or a bad batch? Send a photo within 48 hours and we replace or refund in full.</li>
      </ul>`,
    },
    {
      id: 'how',
      t: 'How people eat it',
      body: `<p>Two spoons on sourdough with banana at 7am · stirred into warm milk or a banana shake after lifting · melted with a splash of water as a pad-thai-style sauce · in overnight oats · straight off the spoon standing in front of the fridge at midnight (we do not judge, but do use a clean spoon).</p>`,
    },
  ];
  return `<div class="acc" data-accordion>
  ${blocks
    .map(
      (b) => `<section class="acc__item ${b.open ? 'is-open' : ''}">
    <button class="acc__head" type="button" data-acc-toggle aria-expanded="${b.open ? 'true' : 'false'}">
      <span>${esc(b.t)}</span>${icon('down', 'ic--sm acc__chev')}
    </button>
    <div class="acc__body"><div class="acc__inner">${b.body}</div></div>
  </section>`
    )
    .join('')}
</div>`;
}

function pincodeBox(p) {
  const eta = estimatePincode('244001');
  return `<div class="pincode card">
  <p class="pincode__t">${icon('pin', 'ic--sm')} Delivery to your pincode</p>
  <form class="pincode__row" data-pincode>
    <label class="sr-only" for="pin">6-digit pincode</label>
    <input class="input input--sm" id="pin" name="pin" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="e.g. 244001" autocomplete="postal-code">
    <button class="btn btn--sm btn--dark" type="submit">Check</button>
  </form>
  <p class="pincode__out" data-pincode-out>Usually ${esc(eta.window)} to ${esc(eta.pincode)} (${esc(dateFmt(eta.date))}). Enter your own for a live answer.</p>
</div>`;
}

function reviewBlock(p, reviews) {
  const avg = p.ratingValue;
  const dist = [5, 4, 3, 2, 1].map((s) => {
    const n = reviews.filter((r) => Math.round(r.rating) === s).length;
    return { s, n, pct: reviews.length ? Math.round((n / reviews.length) * 100) : 0 };
  });
  return `<section class="reviews" id="reviews">
  <div class="reviews__grid">
    <aside class="reviews__score card">
      <p class="reviews__big">${avg.toFixed(1)}</p>
      ${stars(avg, reviews.length)}
      <p class="muted">from ${reviews.length} review${reviews.length === 1 ? '' : 's'} on delivered orders</p>
      <ul class="dist">
        ${dist
          .map(
            (d) => `<li class="dist__row"><span>${d.s} ${icon('star', 'ic--xs')}</span><span class="dist__bar"><i style="--pct:${d.pct}%"></i></span><span class="dist__n">${d.n}</span></li>`
          )
          .join('')}
      </ul>
      <p class="reviews__note">${icon('shield', 'ic--sm')} Only buyers with a delivered order can post, and we never edit the text.</p>
    </aside>
    <div class="reviews__list">
      ${reviews.length
        ? reviews
            .map(
              (r) => `<article class="review card">
          <header class="review__head">
            <span class="review__av" aria-hidden="true">${esc(r.name.slice(0, 1))}</span>
            <div>
              <p class="review__name">${esc(r.name)} ${r.verifiedPurchase ? `<span class="tag tag--v">${icon('check-circle', 'ic--xs')} Verified</span>` : ''}</p>
              <p class="review__meta">${esc(r.city || 'India')} · ${esc(dateFmt(r.createdAt))}</p>
            </div>
            ${stars(r.rating, 0, { hideCount: true })}
          </header>
          <h4 class="review__title">${esc(r.title.trim())}</h4>
          <p class="review__body">${esc(r.body)}</p>
        </article>`
            )
            .join('')
        : '<p class="muted">No reviews on this jar yet. Be the first — the form is right below.</p>'}
      <form class="review-form card" data-review-form data-product="${esc(p.id)}">
        <h4 class="h3">Ate it? Tell the next person.</h4>
        <p class="muted">Reviews on delivered orders are marked verified automatically. Please keep it about the jar.</p>
        <div class="rating-input" data-rating-input role="radiogroup" aria-label="Your rating">
          ${[5, 4, 3, 2, 1]
            .map(
              (n) => `<button class="rating-input__btn" type="button" data-rating="${n}" role="radio" aria-checked="false" aria-label="${n} star${n > 1 ? 's' : ''}">${icon('star', 'ic--fill')}</button>`
            )
            .reverse()
            .join('')}
          <span class="rating-input__label" data-rating-label>Tap a star</span>
          <input type="hidden" name="rating" value="5" required>
        </div>
        <div class="form-grid">
          ${field({ id: 'rv-name', name: 'name', label: 'Your name', required: true, placeholder: 'e.g. Rahul S.', span: '2' })}
          ${field({ id: 'rv-title', name: 'title', label: 'Headline', required: true, placeholder: 'One line a busy buyer would skim', span: '4' })}
          ${field({ id: 'rv-city', name: 'city', label: 'City', placeholder: 'Moradabad', span: '2' })}
          ${field({ id: 'rv-body', name: 'body', type: 'textarea', label: 'Your review', required: true, rows: 4, placeholder: 'Texture, sweetness, how you eat it, how long the jar lasted…', span: '6' })}
        </div>
        <div class="review-form__foot">
          <button class="btn btn--primary" type="submit">Post review</button>
          <p class="form-msg" data-form-msg role="status"></p>
        </div>
      </form>
    </div>
  </div>
</section>`;
}

function productPage(slug, opts = {}) {
  const p = db.getProduct(slug);
  if (!p || p.active === false) return null;
  const reviews = db.reviewsFor(p.id);
  const related = db
    .listProducts({ activeOnly: true })
    .filter((x) => x.id !== p.id)
    .slice(0, 3);

  const title = `${p.name} — ${money(p.price)} | ORGANICHY`;
  const description = `${p.blurb} ${p.variants.map((v) => `${v.label} ${money(v.price)}`).join(', ')}. Free delivery above ${money(config.pricing.freeShippingThreshold)}, COD across India, made in Moradabad.`;

  const body = `<section class="section section--tight pdp">
  <div class="wrap">
    ${breadcrumb([{ label: 'Home', href: '/' }, { label: 'Shop', href: '/shop' }, { label: p.shortName }])}
    <div class="pdp__grid">
      <div class="pdp__left">${gallery(p)}</div>
      <div class="pdp__info">
        <p class="eyebrow">${icon('jar', 'ic--xs')} ${esc((config.categories.find((c) => c.id === p.category) || {}).label || 'Peanut butter')}</p>
        <h1 class="h1">${esc(p.name)}</h1>
        <p class="pdp__tagline">${esc(p.tagline)}</p>
        <div class="pdp__rating">
          ${stars(p.ratingValue, p.reviewCount)}
          <a class="pdp__jumper" href="#reviews">${reviews.length ? 'read reviews' : 'be the first to review'} ${icon('right', 'ic--sm')}</a>
        </div>
        <p class="pdp__blurb">${esc(p.blurb)}</p>
        ${variants(p)}
        <div class="pdp__buy" data-buybox data-product="${esc(p.id)}" data-mrp="${esc(p.variants.map((v) => `${v.label}:${v.mrp || v.price}`).join(';'))}">
          <div class="pdp__price">
            <span data-buy-price>${money(p.variants[0].price)}</span>
            <span class="pdp__mrp" data-buy-mrp>${money(p.variants[0].mrp || p.variants[0].price)}</span>
            <span class="tag tag--sale" data-buy-off>${discountPct(p.variants[0].price, p.variants[0].mrp)}% off</span>
            <span class="pdp__tax">incl. all taxes</span>
          </div>
          <div class="pdp__row">
            ${qtyStepper(1)}
            <button class="btn btn--primary btn--lg btn--grow" data-add-cart data-product="${esc(p.id)}" data-variant="${esc(p.variants[0].label)}" data-qty-input-scope>${icon('cart')} Add to cart</button>
            <button class="btn btn--dark btn--lg" data-buy-now data-product="${esc(p.id)}" data-variant="${esc(p.variants[0].label)}">Buy now ${icon('right', 'ic--sm')}</button>
          </div>
          <p class="pdp__stock" data-buy-stock>${p.variants[0].stock <= config.pricing.lowStockAt ? `${icon('alert', 'ic--sm')} Only ${p.variants[0].stock} × ${esc(p.variants[0].label)} left — next roast ships ${esc(dateFmt(Date.now() + 9 * 86400000))}` : `${icon('check-circle', 'ic--sm')} In stock · packed within 24 hours`}</p>
          <ul class="pdp__assure">
            <li>${icon('truck', 'ic--sm')} Free delivery above ${money(config.pricing.freeShippingThreshold)}</li>
            <li>${icon('shield', 'ic--sm')} ${money(config.pricing.codFee)} COD on 19,000+ pincodes</li>
            <li>${icon('refresh', 'ic--sm')} Damaged or bad batch? Replaced, no returns needed</li>
          </ul>
        </div>
        ${pincodeBox(p)}
        ${accordions(p)}
      </div>
    </div>
  </div>
</section>

<section class="section section--alt">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'About this jar', title: 'What is actually in it', sub: esc(p.description) })}
    <div class="quoteband reveal">
      <span class="quoteband__q">${icon('quote')}</span>
      <blockquote>
        <p>“We are not going to add anything to make this easier to ship or cheaper to make. If a batch separates, that is the peanuts telling you it is peanuts.”</p>
        <cite>— ${esc(config.brand.founder)}, founder of ${esc(config.brand.name)}</cite>
      </blockquote>
    </div>
  </div>
</section>

<section class="section" id="review-section">
  <div class="wrap">${reviewBlock(p, reviews)}</div>
</section>

${related.length
  ? `<section class="section section--tight">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'Goes well with this', title: 'People also take', action: { href: '/shop', label: 'All jars' } })}
    <div class="grid grid--3" data-stagger>${related.map((r) => productCard(r)).join('')}</div>
  </div>
</section>`
  : ''}

<div class="stickybuy" data-stickybuy>
  <div class="stickybuy__pic"><img src="${esc(p.images[0])}" alt="" width="56" height="56"></div>
  <div class="stickybuy__text">
    <strong>${esc(p.shortName)}</strong>
    <span data-sticky-price>${money(p.variants[0].price)} · ${esc(p.variants[0].label)}</span>
  </div>
  <button class="btn btn--primary" data-add-cart data-product="${esc(p.id)}" data-variant="${esc(p.variants[0].label)}" data-sticky-add>${icon('cart')} Add</button>
</div>`;

  const schema = [
    ...baseSchema({ path: `/product/${p.slug}`, title, description }),
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.name,
      image: p.images.map((i) => config.site.url + i),
      description: p.blurb,
      sku: p.variants.map((v) => v.sku).filter(Boolean).join(', '),
      brand: { '@type': 'Brand', name: config.brand.name },
      category: 'Peanut butter',
      url: `${config.site.url}/product/${p.slug}`,
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: config.pricing.currencyCode,
        lowPrice: p.price,
        highPrice: p.maxPrice,
        offerCount: p.variants.length,
        availability: p.soldOut ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
        itemCondition: 'https://schema.org/NewCondition',
        shippingDetails: {
          '@type': 'OfferShippingDetails',
          shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' },
          shippingRate: { '@type': 'ShippingRateSettings', shippingRateConditions: { '@type': 'QuantitativeValue', value: config.pricing.shippingFee } },
        },
      },
      aggregateRating: reviews.length
        ? {
            '@type': 'AggregateRating',
            ratingValue: p.ratingValue,
            reviewCount: reviews.length,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
      review: reviews.slice(0, 5).map((r) => ({
        '@type': 'Review',
        author: { '@type': 'Person', name: r.name },
        datePublished: String(r.createdAt).slice(0, 10),
        name: r.title.trim(),
        reviewBody: r.body,
        reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      })),
      additionalProperty: [
        { '@type': 'PropertyValue', name: 'Ingredients', value: 'Dry roasted peanuts, sea salt' },
        { '@type': 'PropertyValue', name: 'Shelf life', value: '9 months' },
        { '@type': 'PropertyValue', name: 'Net weight', value: p.variants.map((v) => v.label).join(', ') },
      ],
    },
  ].filter((s) => Object.keys(s).length > 1);

  return page({
    title,
    description,
    path: `/product/${p.slug}`,
    body,
    active: 'shop',
    products: [p],
    bodyClass: 'has-stickybuy',
    ogImage: p.images[0],
    type: 'website',
    schema,
  });
}

module.exports = { productPage };
