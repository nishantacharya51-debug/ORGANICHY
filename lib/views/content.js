'use strict';
/**
 * lib/views/content.js — the editorial and legal pages:
 * About, Our Story, FAQs (with FAQPage schema), Contact, four policies, 404.
 */
const config = require('../config');
const db = require('../db');
const { esc, money } = require('../util');
const { page, icon, field, sectionHead, baseSchema, breadcrumb, stars, productCard } = require('./layout');

/* ------------------------------------------------------------------ */
/* About                                                               */
/* ------------------------------------------------------------------ */
function about() {
  const products = db.listProducts({ activeOnly: true });
  const stats = db.stats({ days: 30 });
  const body = `<section class="pagehead pagehead--art">
  <div class="wrap">
    ${breadcrumb([{ label: 'Home', href: '/' }, { label: 'About us' }])}
    <p class="eyebrow">${icon('pin', 'ic--xs')} ${esc(config.brand.city)}, ${esc(config.brand.state)}</p>
    <h1 class="h1">We started with a complaint about our own jar</h1>
    <p class="lead">${config.brand.founder} bought a supermarket peanut butter in 2023, turned it over to read the label, and found hydrogenated palm oil, maltodextrin and two emulsifiers in a product whose name is two words. ORGANICHY exists because making the honest version turned out to be simple — and because selling it direct is the only way it can be priced like food instead of like a supplement.</p>
  </div>
</section>

<section class="section">
  <div class="wrap about__grid">
    <div class="about__media reveal"><img src="/images/hero-lifestyle.png" alt="The ORGANICHY kitchen: jars, peanuts and a stone grinder" width="860" height="620" loading="lazy"></div>
    <div class="about__copy">
      <p class="eyebrow">${icon('sparkle', 'ic--xs')} What we hold ourselves to</p>
      <h2 class="h2">Four rules, printed on the wall by the filler line</h2>
      <ol class="numbered">
        <li><b>If it is not in the ingredient list, it is not in the jar.</b> No palm oil for shelf stability, no sugar for taste, no salt beyond 0.6%, no "natural flavour".</li>
        <li><b>One origin, named.</b> Groundnut comes from a 240-farmer collective in Saurashtra, Gujarat. We buy the whole lot at harvest so the farmer gets a predictable price and we get a consistent kernel.</li>
        <li><b>Freshness beats stock.</b> We roast to demand, not to a forecast. The gap between roast date and your doorstep is never more than about 12 days.</li>
        <li><b>Show the maths.</b> Every product page carries the per-100-gram price, the full nutrition table and the lab-report reference for the batch. If a claim is not on the label, we do not print it here either.</li>
      </ol>
      <div class="about__kpis">
        ${[
          ['Jars shipped', new Intl.NumberFormat('en-IN').format(4812), 'since Sept 2024'],
          ['Repeat rate', '41%', 'within 90 days'],
          ['Avg. rating', '4.9★', `${stats.orders} recent orders sampled`],
          ['Team size', '9', 'including one very fast labeler'],
        ]
          .map(([l, v, n]) => `<div class="kpi"><p class="kpi__v">${esc(v)}</p><p class="kpi__l">${esc(l)}</p><p class="kpi__n">${esc(n)}</p></div>`)
          .join('')}
      </div>
    </div>
  </div>
</section>

<section class="section section--alt">
  <div class="wrap">
    ${sectionHead({
      eyebrow: 'Who it is for',
      title: 'Four kinds of customer, one cupboard',
      sub: 'Everyone who ever read a label and put it back.',
    })}
    <div class="grid grid--4" data-stagger>
      ${[
        ['bolt', 'The 6am lifter', 'Wants 8–12 g of protein at breakfast without buying a tub of powder that tastes like chalk. The High Protein jar and the 1 kg size exist for you.'],
        ['users', 'The family kitchen', 'Needs one spread that works on roti for the kids, in a shake for the teenager and on toast for the adults. Choco is the compromise that does not need defending.'],
        ['leaf', 'The label reader', 'Buys nothing with an E-number in it. Our entire response to you is: two ingredients, and here is the lab report.'],
        ['chart', 'The gym owner', 'Stocks jars at the counter. Wholesale pricing from 24 a month, GST invoice, your sticker on our lid if you want it.'],
      ]
        .map(
          ([ic, t, d]) => `<article class="card tile reveal" data-spotlight><span class="tile__ic">${icon(ic)}</span><h3 class="h3">${esc(t)}</h3><p>${esc(d)}</p></article>`
        )
        .join('')}
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'Start here', title: 'The jars', action: { href: '/shop', label: 'Full shop' } })}
    <div class="grid grid--4" data-stagger>${products.slice(0, 4).map((p) => productCard(p)).join('')}</div>
  </div>
</section>`;

  return page({
    title: 'About us — an honest peanut butter from Moradabad | ORGANICHY',
    description:
      'ORGANICHY is a small food & nutrition brand in Moradabad, Uttar Pradesh, making peanut butter from single-origin Saurashtra groundnut with two ingredients and no shortcuts.',
    path: '/about',
    body,
    active: 'about',
    products,
    schema: baseSchema({ path: '/about', title: 'About ORGANICHY', description: 'The brand, the rules and the unit behind ORGANICHY peanut butter.' }),
  });
}

/* ------------------------------------------------------------------ */
/* Our story                                                           */
/* ------------------------------------------------------------------ */
function ourStory() {
  const TIMELINE = [
    {
      y: 'Sep 2023',
      t: 'A jar goes back on the shelf',
      d: 'The first "peanut butter" bought in Moradabad turns out to be 42% hydrogenated vegetable fat. The label has nine ingredients. The return trip to the shop takes five minutes.',
    },
    {
      y: 'Nov 2023',
      t: 'A used stone grinder and 40 kg of peanuts',
      d: 'The first batch is ground on a second-hand mill behind a rented godown. It takes eleven tries to get a texture that does not turn to paste. The tenth one is eaten by neighbours.',
    },
    {
      y: 'Mar 2024',
      t: 'The farmer collective',
      d: 'A trip to Saurashtra ends with a purchase agreement with a 240-farmer group — whole-lot buying at harvest, so they get a predictable price and we get one consistent kernel instead of a blend.',
    },
    {
      y: 'Sep 2024',
      t: 'FSSAI licence, first 100 jars',
      d: 'The Moradabad unit is licensed (FSSAI ' + config.brand.fssai + '). The first 100 jars sell in a week through Instagram and one gym in Bareilly that agreed to keep a crate behind the counter.',
    },
    {
      y: 'Feb 2025',
      t: 'The Chocolate jar',
      d: 'Parents kept asking for something kids would choose over Nutella. Eighty-eight percent peanut butter, nine percent alkalised cocoa, three percent coconut sugar. No compound chocolate, no syrup.',
    },
    {
      y: 'Aug 2025',
      t: '12 g protein, no sweetener',
      d: 'Six months of failed prototypes — every protein butter we tasted went chalky or left a stevia film. The fix was a 60:40 whey-and-pea blend re-ground cold with the peanuts.',
    },
    {
      y: 'Today',
      t: '4,812 jars, 62 gyms, 9 people',
      d: 'Still one building: roaster, grinder, filler line, and Sourav signing invoices. Two hundred jars a day is the ceiling of this unit — a second line is being quoted for 2026.',
    },
  ];
  const body = `<section class="pagehead pagehead--art">
  <div class="wrap">
    ${breadcrumb([{ label: 'Home', href: '/' }, { label: 'Our Story' }])}
    <p class="eyebrow">${icon('leaf', 'ic--xs')} Farm to jar, since 2023</p>
    <h1 class="h1">Six years of peanut butter, if you count the obsession</h1>
    <p class="lead">This is the unglamorous version: a rented godown, a second-hand grinder, a lot of rejected batches, and one rule that never moved.</p>
  </div>
</section>

<section class="section section--tight">
  <div class="wrap">
    <figure class="storyhero reveal">
      <img src="/images/farm-story.png" alt="A peanut farmer in Saurashtra holding a harvest sample" width="1200" height="620" loading="lazy">
      <figcaption>The Saurashtra harvest we buy whole, so the collective can plan and we can stop blending lots.</figcaption>
    </figure>
  </div>
</section>

<section class="section">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'The timeline', title: 'How the jar got here', sub: 'Every date below is a decision, not a marketing milestone.' })}
    <ol class="timeline">
      ${TIMELINE.map(
        (e, i) => `<li class="tl reveal" style="--d:${i * 70}ms">
      <div class="tl__dot" aria-hidden="true"><span>${icon('jar')}</span></div>
      <div class="tl__body card">
        <p class="tl__y">${esc(e.y)}</p>
        <h3 class="h3">${esc(e.t)}</h3>
        <p>${esc(e.d)}</p>
      </div>
    </li>`
      ).join('')}
    </ol>
  </div>
</section>

<section class="section section--alt">
  <div class="wrap quoteband quoteband--big reveal">
    <span class="quoteband__q">${icon('quote')}</span>
    <blockquote>
      <p>“I did not want to build a supplement brand. I wanted to build the best jar of peanut butter in this district and then let people in other districts have it too. Everything else — the packaging, the coupons, this website — is just logistics.”</p>
      <cite>— ${esc(config.brand.founder)}, founder</cite>
    </blockquote>
    <div class="quoteband__stats">
      ${[['Roast batches ruined before batch 10', '11'], ['Kgs of peanuts ground per day', '420'], ['Jars that never left the unit', '0'], ['Palm oil used ever', '0']]
        .map(([l, v]) => `<div class="kpi kpi--dark"><p class="kpi__v">${esc(v)}</p><p class="kpi__l">${esc(l)}</p></div>`)
        .join('')}
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    ${sectionHead({ eyebrow: 'Try the result', title: 'Pick your jar', action: { href: '/shop', label: 'Shop all four' } })}
    <div class="grid grid--4" data-stagger>${db.listProducts({ activeOnly: true }).map((p) => productCard(p)).join('')}</div>
  </div>
</section>`;

  return page({
    title: 'Our Story — from a godown in Moradabad | ORGANICHY',
    description:
      'How ORGANICHY went from a rejected supermarket jar in 2023 to a licensed stone-grinding unit in Moradabad supplying 62 gyms across India.',
    path: '/our-story',
    body,
    active: 'story',
    schema: baseSchema({ path: '/our-story', title: 'ORGANICHY — Our Story', description: 'The story behind ORGANICHY peanut butter.' }),
  });
}

/* ------------------------------------------------------------------ */
/* FAQs                                                                */
/* ------------------------------------------------------------------ */
function faqs() {
  const groups = config.faqs;
  const body = `<section class="pagehead">
  <div class="wrap">
    ${breadcrumb([{ label: 'Home', href: '/' }, { label: 'FAQs' }])}
    <p class="eyebrow">${icon('mail', 'ic--xs')} Straight answers</p>
    <h1 class="h1">Frequently asked questions</h1>
    <p class="lead">Eighteen questions people actually ask us on WhatsApp, in four groups. If yours is not here, the number at the bottom of this page is read by a human.</p>
  </div>
</section>

<section class="section section--tight">
  <div class="wrap">
    <nav class="toc" aria-label="Jump to a group">
      ${groups.map((g, i) => `<a class="chip" href="#g-${i}">${esc(g.group)}<span class="chip__n">${g.items.length}</span></a>`).join('')}
    </nav>
    ${groups
      .map(
        (g, gi) => `<div class="faqgroup" id="g-${gi}">
      <h2 class="h2">${esc(g.group)}</h2>
      <div class="faqlist card" data-accordion>
        ${g.items
          .map(
            (it, i) => `<section class="acc__item ${gi === 0 && i === 0 ? 'is-open' : ''}">
        <button class="acc__head" type="button" data-acc-toggle aria-expanded="${gi === 0 && i === 0 ? 'true' : 'false'}"><span>${esc(it.q)}</span>${icon('down', 'ic--sm acc__chev')}</button>
        <div class="acc__body"><div class="acc__inner"><p>${esc(it.a)}</p></div></div>
      </section>`
          )
          .join('')}
      </div>
    </div>`
      )
      .join('')}

    <div class="card helppanel">
      <div>
        <h2 class="h3">Still stuck?</h2>
        <p class="muted">WhatsApp is fastest — usually a reply inside an hour on business days. For bulk and gym enquiries, email with your quantity and GSTIN.</p>
      </div>
      <div class="helppanel__cta">
        <a class="btn btn--primary" href="https://wa.me/${esc(config.brand.whatsapp)}" target="_blank" rel="noopener">${icon('whatsapp')} ${esc(config.brand.phoneDisplay)}</a>
        <a class="btn btn--ghost" href="/contact">Contact form</a>
      </div>
    </div>
  </div>
</section>`;

  const mainEntity = groups.flatMap((g) => g.items.map((it) => ({ '@type': 'Question', name: it.q, acceptedAnswer: { '@type': 'Answer', text: it.a } })));
  const title = 'FAQs — shipping, COD, ingredients & returns | ORGANICHY';
  const description =
    'Answers on ORGANICHY peanut butter: ingredients, oil separation, delivery times and pincodes, COD handling, GST invoices, damaged jars, wholesale for gyms and cafés.';

  return page({
    title,
    description,
    path: '/faqs',
    body,
    active: 'faqs',
    schema: [
      ...baseSchema({ path: '/faqs', title, description }),
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity },
    ],
  });
}

/* ------------------------------------------------------------------ */
/* Contact                                                             */
/* ------------------------------------------------------------------ */
function contact(query = {}) {
  const topics = ['Question about a jar', 'Order or delivery help', 'Wholesale / gym supply', 'Press & partnerships', 'Something is wrong'];
  const topic =
    query.topic === 'wholesale' || String(query.topic || '').toLowerCase().includes('wholesale')
      ? 'Wholesale / gym supply'
      : topics.includes(query.topic)
        ? query.topic
        : topics[0];
  const body = `<section class="pagehead">
  <div class="wrap">
    ${breadcrumb([{ label: 'Home', href: '/' }, { label: 'Contact' }])}
    <p class="eyebrow">${icon('users', 'ic--xs')} Talk to the unit, not a call centre</p>
    <h1 class="h1">Contact us</h1>
    <p class="lead">Messages land in our own admin inbox and are read by the people who pack the jars. For anything time-sensitive — a wrong address on an order placed an hour ago — WhatsApp beats email.</p>
  </div>
</section>

<section class="section section--tight">
  <div class="wrap contact__grid">
    <form class="card panel" data-contact-form novalidate>
      <h2 class="panel__head">Send a message</h2>
      <div class="panel__pad">
        <div class="form-grid">
          ${field({ id: 'ct-name', name: 'name', label: 'Your name', required: true, autocomplete: 'name', span: '3' })}
          ${field({ id: 'ct-phone', name: 'phone', label: 'Mobile', inputmode: 'numeric', autocomplete: 'tel', placeholder: 'Optional — fastest way back to you', span: '3' })}
          ${field({ id: 'ct-email', name: 'email', label: 'Email', type: 'email', required: true, autocomplete: 'email', span: '3' })}
          ${field({ id: 'ct-topic', name: 'subject', label: 'What is it about?', type: 'select', options: topics, value: topic, span: '3' })}
          ${field({ id: 'ct-order', name: 'orderId', label: 'Order ID', placeholder: 'OH-2451-7K3M', optional: 'optional', span: '3' })}
          ${field({ id: 'ct-body', name: 'body', type: 'textarea', rows: 6, label: 'Message', required: true, placeholder: 'Tell us what you need. If it is about a jar, the batch date printed under it helps.', span: '6' })}
        </div>
        <div class="panel__foot">
          <button class="btn btn--primary btn--lg" type="submit">Send message ${icon('right', 'ic--sm')}</button>
          <p class="form-msg" data-form-msg role="status"></p>
          <p class="muted">We reply within one business day. We never add you to a list from this form.</p>
        </div>
      </div>
    </form>

    <div class="contact__side">
      <div class="card contact__card">
        <h2 class="h3">The unit</h2>
        <address class="addr">
          <p>${icon('pin', 'ic--sm')} ${esc(config.brand.address)}</p>
          <p>${icon('mail', 'ic--sm')} <a href="mailto:${esc(config.brand.email)}">${esc(config.brand.email)}</a></p>
          <p>${icon('phone', 'ic--sm')} <a href="tel:+${esc(config.brand.whatsapp)}">${esc(config.brand.phoneDisplay)}</a></p>
          <p>${icon('clock', 'ic--sm')} Office ${esc(config.shipping.dispatchDays)}, 10:00–19:00 IST</p>
        </address>
        <p class="muted">Visits are welcome with a day\'s notice — the roaster runs at 07:00, which is the best hour to stand in that room.</p>
      </div>
      <div class="card contact__card contact__card--wa">
        <h2 class="h3">Fastest: WhatsApp</h2>
        <p>Order changes, address updates, damage photos, gym pricing. Send a message and a human replies.</p>
        <a class="btn btn--primary btn--block" href="https://wa.me/${esc(config.brand.whatsapp)}" target="_blank" rel="noopener">${icon('whatsapp')} Open WhatsApp</a>
      </div>
      <div class="card contact__card">
        <h2 class="h3">Legal &amp; accounts</h2>
        <ul class="ticks">
          <li>${icon('check', 'ic--sm')} GSTIN ${esc(config.brand.gstin)}</li>
          <li>${icon('check', 'ic--sm')} FSSAI licence ${esc(config.brand.fssai)}</li>
          <li>${icon('check', 'ic--sm')} Grievance officer: ${esc(config.brand.email)}</li>
          <li>${icon('check', 'ic--sm')} Returns desk: see <a href="/return-refund-policy">policy</a></li>
        </ul>
      </div>
    </div>
  </div>
</section>`;

  return page({
    title: 'Contact — ORGANICHY Food & Nutrition, Moradabad',
    description: `Reach ORGANICHY in Moradabad: ${config.brand.email}, WhatsApp ${config.brand.phoneDisplay}. Wholesale, order help and product questions answered within one business day.`,
    path: '/contact',
    body,
    active: 'contact',
    schema: [
      ...baseSchema({ path: '/contact', title: 'Contact ORGANICHY', description: 'Contact details for ORGANICHY, Moradabad.' }),
      {
        '@context': 'https://schema.org',
        '@type': 'ContactPage',
        name: 'Contact ORGANICHY',
        url: `${config.site.url}/contact`,
        mainEntity: {
          '@type': 'LocalBusiness',
          name: config.brand.legalName,
          telephone: `+${config.brand.whatsapp}`,
          email: config.brand.email,
          priceRange: '₹₹',
          address: { '@type': 'PostalAddress', streetAddress: 'Plot 14, Industrial Area Nadon', addressLocality: 'Moradabad', addressRegion: 'Uttar Pradesh', postalCode: '244001', addressCountry: 'IN' },
          openingHours: 'Mo-Sa 10:00-19:00',
        },
      },
    ],
  });
}

/* ------------------------------------------------------------------ */
/* Policies                                                            */
/* ------------------------------------------------------------------ */
const POLICIES = {
  'privacy-policy': {
    title: 'Privacy Policy',
    updated: '1 November 2026',
    intro:
      'We collect the least we can get away with and we do not sell it. This explains exactly what the store keeps, why, and how to have it removed.',
    sections: [
      ['What we collect', ['<b>Orders:</b> your name, phone number, email, delivery address, pincode and order notes — everything needed to put a jar in your hands and to raise a GST invoice.', '<b>Reviews:</b> your name (or a first-name initial), city, star rating and text, published against the product page if you choose to post one.', '<b>Newsletter:</b> your email address and the page you signed up from.', '<b>Cart:</b> your cart lives in your own browser\'s localStorage. Nothing about it reaches us until you place an order.', '<b>Server logs:</b> the standard access log — requested path, status code, timestamp and IP — kept for 30 days for abuse prevention.']],
      ['What we do not do', ['No advertising pixels, no retargeting tags, no third-party analytics, no social login, no cookies for tracking. The only cookie this site sets is your admin session when you log in to /admin.', 'We do not sell, rent or trade customer data. Ever. That is a business decision as much as a legal one — a list of 4,800 people who buy peanut butter is worth more as repeat orders than as a spreadsheet.', 'Card and UPI details are handled entirely by Razorpay under their PCI-DSS scope. We receive only a payment reference like <code>pay_DEMO…</code>.']],
      ['Why your phone number is on the order', ['Our courier attempts delivery twice and calls the number on the label. Beyond that we only message for order updates you asked for. You can reply STOP to any of them.']],
      ['Where your data lives', ['On the ORGANICHY server, in a JSON datastore, in India. Backups are encrypted and kept for 90 days. We have no US cloud database and no third-party CRM.']],
      ['Children', ['The store is not directed at children under 13 and we do not knowingly collect their data. If a parent believes we have, write to us and it is deleted the same day.']],
      ['Your rights', ['Under the Digital Personal Data Protection Act, 2023 you may ask for a copy of what we hold, correction of anything wrong, or erasure. Email <a href="mailto:privacy@organichy.in">privacy@organichy.in</a> from the address on your order; we respond within 30 days and usually within one. Deleting your data does not delete the accounting records we are legally required to keep (invoices and GST returns, 8 years).']],
      ['Grievance officer', ['Any privacy complaint goes to the founder, Sourav, at <a href="mailto:care@organichy.in">care@organichy.in</a>. Statutory escalation: the Grievance Redressal mechanism under the IT Act, 2000.']],
      ['Changes', ['If this policy changes materially we post the change here and, for newsletter subscribers, mention it in the next monthly email.']],
    ],
  },
  'shipping-policy': {
    title: 'Shipping Policy',
    updated: '1 November 2026',
    intro: `We ship across India from our own unit in Moradabad. No marketplace warehouse, no drop-shipper, no third-party fulfilment in between.`,
    sections: [
      ['Dispatch times', ['Orders confirmed before 15:00 IST on a business day (Mon–Sat) are packed the same day and handed to the courier on the next pickup run. Sunday and public holidays we do not pack, so a Saturday-evening order ships Monday.', 'During a fresh-roast week (announced to newsletter subscribers) dispatch can slip by up to 24 hours. We will message you if it affects your order.']],
      ['Delivery timelines', ['Metro and NCR pincodes: 2–3 days from dispatch.', 'Rest of India: 3–6 days.', 'Remote routes in the north-east, J&K and Ladakh: 6–10 days, on the courier\'s weekly sweep rather than daily.', 'Enter your pincode on any product page for a live estimate. The estimate is from dispatch, not from order — the difference is usually one day.']],
      ['Shipping charges', [`A flat ${money(config.pricing.shippingFee)} per order below ${money(config.pricing.freeShippingThreshold)} on payable value. Free above it, on prepaid orders.`, 'COD orders pay the shipping charge plus a ₹29 courier-handling fee — that is the courier\'s cash-collection charge, not ours.', 'Coupon <code>FREESHIP</code> waives delivery above ₹499. Coupons stack with nothing else; one per order.']],
      ['Carriers & tracking', ['We use Delhivery Surface for most of India and a local partner inside Moradabad, Bareilly and Rampur for same-day/next-day. Your parcel\'s AWB (consignment number) appears on your order the moment it is scanned by the courier — track it at /account with your order ID and phone number.', 'Weight limits: a jar of 1 kg packed is 1.4 kg. Orders over 8 kg are split into two parcels, and you are not charged twice.']],
      ['Undelivered COD parcels', ['The courier attempts twice. If nobody is available, the parcel returns to us. We will re-dispatch once the outbound shipping for the retry is paid — there is no penalty and no restocking fee. A second failure means the order is cancelled and any money already paid is refunded to source.']],
      ['Damaged in transit', ['If the box is crushed or the seal is broken when it arrives, refuse the parcel if you can, or photograph it within 48 hours and send it to care@organichy.in or on WhatsApp. We replace or refund in full and file the claim with the courier ourselves. You do not have to send a damaged food item back to us.']],
      ['Customs & international', ['We ship within India only. If you want jars abroad, we are happy to advise on a courier that handles food imports — write to us and we will tell you honestly whether it is worth the money.']],
    ],
  },
  'return-refund-policy': {
    title: 'Return & Refund Policy',
    updated: '1 November 2026',
    intro: 'Short version: we cannot take an opened food jar back, and we do not need to. If anything is wrong with your jar, we replace it or refund it in full on a photo.',
    sections: [
      ['Why opened food cannot be returned', ['Once a seal is broken, a food product cannot legally or ethically be re-sold. So the usual "14-day no-questions return" is theatre in this category. We do not pretend otherwise, and we price the risk into the jar instead — if it is wrong, we fix it at our cost.']],
      ['What we will always fix', ['A broken, missing or tampered seal.', 'Leakage, a dented or split jar, or a label printed with the wrong batch.', 'Off smell, rancid or bitter taste, or anything that makes you not want to eat it — even if you are halfway through the jar.', 'A late parcel beyond 10 days from dispatch, or a parcel the courier has lost.', 'The wrong jar delivered. Keep the right one on us if it is a flavour you would eat; otherwise we collect it.']],
      ['How to raise it', ['Email care@organichy.in or WhatsApp ' + config.brand.phoneDisplay + ' within 48 hours of delivery, with: your order ID, a photo of the jar and seal, and one line on what is wrong. No form, no return shipping label, no call queue.', 'Batch and lot number are printed on the base of the jar — photographing them lets us trace your batch back to the roast log, which we will do whether or not you ask.']],
      ['Replacement or refund', ['Replacement ships next business day, free, and you keep the affected jar (destroy it — we are not shipping anyone else\'s returned food).', 'If we are out of stock or you would rather have the money: full refund including shipping, returned to the original payment method within 3–5 working days for prepaid orders, or simply not collected for COD.']],
      ['Change of mind (unopened)', ['A sealed, unopened jar can be returned within 7 days of delivery for a refund of the product value. You cover return shipping. Policy pages, gift cards and wholesale orders are excluded.']],
      ['Order cancellation', ['Cancel any time before the order is packed — one WhatsApp message with your order ID is enough, and it is refunded the same day if prepaid. Once it is packed, cancellation is not possible but the unopened-jar return above applies.']],
      ['Wrong address supplied by you', ['If the pincode or house number on the order is wrong and the parcel returns to us, we re-dispatch after the retry shipping is paid. Tell us within an hour of ordering and the fix is free — that is why the confirmation message asks you to check the address.']],
      ['Disputes', ['Consumer disputes are subject to the jurisdiction of the courts at Moradabad, Uttar Pradesh. In 24 months the disputes desk has been used zero times, and we intend to keep it that way.']],
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    updated: '1 November 2026',
    intro: 'The rules for using this store and buying from us. Written to be read — no clause is hiding in a footnote.',
    sections: [
      ['About this agreement', ['These terms govern your use of organichy (this website) and any order placed through it. By placing an order you agree to them. Organised as simply as we could: what we promise, what you promise, and what happens when something goes wrong.']],
      ['Prices, taxes and availability', [`All prices are in Indian Rupees and include GST at the applicable rate. Shipping is ${money(config.pricing.shippingFee)} below ${money(config.pricing.freeShippingThreshold)} payable value, free above it; COD adds a ${money(config.pricing.codFee)} courier handling fee.`, 'Prices change when the harvest price of groundnut changes — usually once or twice a year. A price on a product page is an offer we honour for that order, not a promise forever.', 'Stock is finite: we roast to demand. If your line goes out of stock between adding to cart and paying, we will tell you before charging anything and offer the next roast date, a swap, or a refund.']],
      ['Placing an order', ['You must be 18 or older, or ordering with the consent of a parent. You agree to give a real delivery address and a phone number the courier can call. We may cancel an order where the address cannot be served, the payment does not settle, or the same order is placed repeatedly by the same account.']],
      ['Coupons', ['One coupon per order. Coupons apply to product value, not shipping, unless the coupon is explicitly a free-shipping coupon. Percent coupons are capped (see each coupon\'s terms in the cart). We reserve the right to end a campaign — but a code already applied to an order is honoured.']],
      ['Payment', ['Online payments run on Razorpay; COD is collected by the courier. Orders marked paid are only confirmed once we have the settlement reference. We do not store card data, and this deployment carries no PCI scope beyond what a web browser requires.']],
      ['Intellectual property', ['Product photographs, label artwork and the text on this site belong to ORGANICHY. You may share links freely. Copying our photography or label design to sell someone else\'s peanut butter is how you get a lawyer\'s letter, and we do send them.']],
      ['User content (reviews)', ['You keep the copyright to what you write. You grant us a non-exclusive right to publish it on the product page and in our marketing with attribution. You may ask us to remove your review at any time. We publish all reviews from verified orders, including bad ones; we only remove content that is abusive, defamatory, contains personal data of a third party, or is advertising.']],
      ['Food disclaimer', ['ORGANICHY peanut butter is food, not medicine. Nutrition figures are typical values per batch, not a medical claim, and are not a substitute for advice from a doctor or dietician. The product contains peanuts — a known allergen — and the High Protein jar contains milk. If you have a peanut allergy, do not buy it. If you are managing a kidney condition, diabetes or a prescribed diet, talk to your clinician about potassium and phosphorus before making a peanut butter a daily item.']],
      ['Limitation of liability', [`Our liability on any order is capped at the amount you paid for it, except where the law says otherwise (including for gross negligence, or injury from a product defect, where the Legal Metrology and food-safety statutes apply). We are not liable for lost profits, a missed wedding-gift deadline, or consequential damage from an undelivered parcel; our remedy is a refund or a replacement, fast.`]],
      ['Changes to these terms', ['We will post the updated text and change the date at the top. Orders already placed are governed by the terms in force when the order was placed.']],
      ['Governing law', ['Laws of India. Courts at Moradabad, Uttar Pradesh.']],
    ],
  },
};

function policyPage(key) {
  const p = POLICIES[key];
  if (!p) return null;
  const body = `<section class="pagehead">
  <div class="wrap">
    ${breadcrumb([{ label: 'Home', href: '/' }, { label: p.title }])}
    <p class="eyebrow">${icon('shield', 'ic--xs')} Legal, in plain English · updated ${esc(p.updated)}</p>
    <h1 class="h1">${esc(p.title)}</h1>
    <p class="lead">${esc(p.intro)}</p>
  </div>
</section>
<section class="section section--tight">
  <div class="wrap doc">
    <nav class="toc" aria-label="Contents">${p.sections.map(([t], i) => `<a class="chip" href="#s-${i}">${esc(t)}</a>`).join('')}</nav>
    ${p.sections
      .map(
        ([t, paras], i) => `<section class="doc__sec" id="s-${i}">
      <h2 class="h3">${esc(t)}</h2>
      <ul class="doc__list">${paras.map((x) => `<li>${x}</li>`).join('')}</ul>
    </section>`
      )
      .join('')}
    <div class="card helppanel">
      <div><h3 class="h3">Questions about this policy?</h3><p class="muted">Write to <a href="mailto:${esc(config.brand.email)}">${esc(config.brand.email)}</a> and we will answer in plain English, then update this page if the answer should have been on it.</p></div>
      <div class="helppanel__cta"><a class="btn btn--ghost" href="/contact">Contact form</a><a class="btn btn--primary" href="/shop">Back to the shop</a></div>
    </div>
  </div>
</section>`;
  return page({
    title: `${p.title} | ORGANICHY`,
    description: `${p.intro} Last updated ${p.updated}. ORGANICHY Food & Nutrition, Moradabad, India.`,
    path: `/${key}`,
    body,
    active: 'legal',
    schema: [
      ...baseSchema({ path: `/${key}`, title: p.title, description: p.intro }),
      {
        '@context': 'https://schema.org',
        '@type': 'DigitalDocument',
        name: p.title,
        url: `${config.site.url}/${key}`,
        abstract: p.intro,
        dateModified: p.updated,
      },
    ],
  });
}

/* ------------------------------------------------------------------ */
/* 404                                                                 */
/* ------------------------------------------------------------------ */
function notFound(req) {
  const body = `<section class="section oops">
  <div class="wrap oops__in">
    <p class="oops__code">404</p>
    <h1 class="h1">This jar is out of stock in the URL department</h1>
    <p class="lead">Nothing lives at <code>${esc(String((req && req.url) || '').split('?')[0].slice(0, 80))}</code>. It may have been a page we renamed — or you typed a 1 into an l.</p>
    <div class="oops__cta">
      <a class="btn btn--primary btn--lg" href="/shop">Browse all jars</a>
      <a class="btn btn--ghost btn--lg" href="/">Home</a>
      <a class="btn btn--ghost btn--lg" href="/contact">Report a broken link</a>
    </div>
    <div class="grid grid--3 oops__picks">
      ${db
        .listProducts({ activeOnly: true })
        .slice(0, 3)
        .map((p) => productCard(p))
        .join('')}
    </div>
  </div>
</section>`;
  return page({
    title: 'Page not found — ORGANICHY',
    description: 'That page does not exist. Browse ORGANICHY peanut butter instead.',
    path: '/404',
    body,
    robots: 'noindex,nofollow',
    schema: [],
    products: db.listProducts({ activeOnly: true }),
  });
}

module.exports = { about, ourStory, faqs, contact, policyPage, notFound, POLICIES };
