'use strict';
/**
 * ORGANICHY — single source of truth for brand, pricing and deployment config.
 *
 * Every value below can be overridden with an environment variable. A `.env`
 * file in the project root is read automatically by the tiny loader in this
 * file — deliberately no `dotenv` dependency (see the "why zero dependencies"
 * note in README.md).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/* ------------------------------------------------------------------ */
/* Zero-dependency .env loader                                         */
/* ------------------------------------------------------------------ */
function loadDotEnv() {
  const file = path.join(ROOT, '.env');
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return; // no .env — fine, use process.env / defaults
  }
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key && !(key in process.env)) process.env[key] = val;
  }
}
loadDotEnv();

/* ------------------------------------------------------------------ */
/* Coercion helpers                                                    */
/* ------------------------------------------------------------------ */
const int = (v, d) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
};
const money0 = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : d;
};
const bool = (v, d) =>
  v === undefined || v === '' ? d : /^(1|true|yes|on)$/i.test(String(v));
const cleanUrl = (u, d) => {
  const s = String(u || '').trim().replace(/\/+$/, '');
  return s || d;
};

const port = int(process.env.PORT, 3000);
const freeShipThreshold = money0(process.env.FREE_SHIPPING_THRESHOLD, 899);
const shipFee = money0(process.env.SHIPPING_FEE, 49);
const siteUrl = cleanUrl(process.env.SITE_URL, `http://localhost:${port}`);
const razorpayKeyId = String(process.env.RAZORPAY_KEY_ID || '').trim();
const razorpayKeySecret = String(process.env.RAZORPAY_KEY_SECRET || '').trim();

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */
const config = {
  /* Where the JSON "database" lives. Point this at a mounted volume in
     production (Render disk, VPS folder) so orders survive a redeploy. */
  dataDir: cleanUrl(process.env.DATA_DIR, '')
    ? path.resolve(ROOT, process.env.DATA_DIR.trim())
    : path.join(ROOT, 'data'),

  /* Bump to force a re-seed of an empty/fresh datastore. */
  seedVersion: 1,

  site: {
    url: siteUrl,
    port,
    host: process.env.HOST || '0.0.0.0',
    name: 'ORGANICHY',
  },

  brand: {
    legalName: 'ORGANICHY Food & Nutrition',
    name: 'ORGANICHY',
    tagline: 'Food & Nutrition',
    slogan: 'One jar. Two ingredients. Zero excuses.',
    founder: 'Sourav',
    city: 'Moradabad',
    state: 'Uttar Pradesh',
    country: 'India',
    address: 'Plot 14, Industrial Area Nadon, Moradabad, Uttar Pradesh 244001, India',
    email: 'care@organichy.in',
    phoneDisplay: '+91 98765 43210',
    whatsapp: String(process.env.WHATSAPP_NUMBER || '919876543210').replace(/\D/g, ''),
    instagram: 'https://instagram.com/organichy',
    /* Replace with the real licence numbers before launch — they are printed in
       the footer and in the JSON-LD Organization schema. */
    fssai: process.env.FSSAI_LICENCE || '10021045000456',
    gstin: process.env.GSTIN || '09AAEPB1234F1Z5',
    established: '2024',
  },

  pricing: {
    currency: '₹',
    currencyCode: 'INR',
    freeShippingThreshold: freeShipThreshold,
    shippingFee: shipFee,
    codFee: money0(process.env.COD_FEE, 29),
    codEnabled: bool(process.env.ENABLE_COD, true),
    maxQtyPerLine: 10,
    lowStockAt: 20,
  },

  payments: {
    /* Empty keys = demo mode: orders are recorded with a pay_DEMO… reference
       and nothing is ever charged. See POST /api/payment/create in server.js. */
    razorpayKeyId,
    razorpayKeySecret,
    mode: razorpayKeyId && razorpayKeySecret ? 'live' : 'demo',
  },

  admin: {
    password: process.env.ADMIN_PASSWORD || 'organichy@2026',
    sessionHours: 8,
    path: '/admin',
  },

  shipping: {
    freeShipCopy: `Free delivery on prepaid orders above ₹${freeShipThreshold}`,
    etaMinDays: 2,
    etaMaxDays: 6,
    dispatchDays: 'Mon–Sat',
    cashOnDeliveryNote: 'COD available across 19,000+ pincodes',
  },

  categories: [
    { id: 'all', label: 'All' },
    { id: 'peanut-butter', label: 'Peanut Butter', live: true },
    { id: 'protein-bars', label: 'Protein Bars', live: false, soon: 'Feb 2026' },
    { id: 'oats', label: 'Rolled Oats', live: false, soon: 'Mar 2026' },
    { id: 'whey', label: 'Whey Protein', live: false, soon: 'Apr 2026' },
    { id: 'gainers', label: 'Mass Gainers', live: false, soon: 'Jun 2026' },
  ],

  faqs: [
    {
      group: 'Ordering & payment',
      items: [
        {
          q: 'How do I pay? Do you accept UPI?',
          a: 'At checkout you can pay online (UPI, cards, netbanking and wallets go through Razorpay) or choose Cash on Delivery. COD carries a small ₹29 handling fee because the courier charges us for handling notes.',
        },
        {
          q: 'Is it safe to pay on the website?',
          a: 'Yes. Card and UPI payments never touch our servers — they run on Razorpay\'s PCI-DSS compliant checkout over HTTPS. We store only your order, not your payment instrument.',
        },
        {
          q: 'Do I need to create an account?',
          a: 'No. Checkout is deliberately guest-only. You get an order ID (for example OH-2451-7K3M) which, together with your phone number, tracks your parcel under My Account.',
        },
        {
          q: 'Can I change my address after ordering?',
          a: 'Yes, until the order is packed. WhatsApp us the order ID and the new address on +91 98765 43210 and we will update it — usually within a couple of hours.',
        },
        {
          q: 'Do you invoice with GST?',
          a: 'Every order ships with a GST tax invoice. Add your GSTIN in the order notes and it will appear on the invoice for input credit.',
        },
      ],
    },
    {
      group: 'Shipping & delivery',
      items: [
        {
          q: 'How long does delivery take?',
          a: 'Metro pincodes are usually 2–3 days, rest of India 3–6 days from dispatch. We pack within 24 hours on business days (Mon–Sat). Enter your pincode on any product page for a live estimate.',
        },
        {
          q: 'Is shipping really free?',
          a: 'Yes — free on every prepaid order above ₹899. Below that we charge a flat ₹49 which goes straight to the courier. COD orders pay the ₹49 shipping plus ₹29 handling.',
        },
        {
          q: 'Do you deliver across all of India?',
          a: 'We ship to 19,000+ pincodes. A handful of remote pincodes in the north-east and j&k are serviced weekly rather than daily; the pincode checker tells you if that applies to you.',
        },
        {
          q: 'How do I track my parcel?',
          a: 'As soon as the courier picks up your box we add the AWB to your order. Track it at /account with your order ID and phone number, or use the link in your dispatch message.',
        },
        {
          q: 'What if nobody is home for a COD delivery?',
          a: 'The courier attempts twice. After that the parcel returns to us and we re-dispatch once you pay the shipping for the retry — no penalty, no restocking fee.',
        },
      ],
    },
    {
      group: 'The product',
      items: [
        {
          q: 'What exactly is in the jar?',
          a: 'Classic Creamy and Crunchy are dry roasted peanuts and sea salt — that is the entire ingredient list. Chocolate adds alkalised cocoa and a touch of coconut sugar. High Protein adds a whey and pea protein blend.',
        },
        {
          q: 'Is there added sugar, palm oil or hydrogenated fat?',
          a: 'No. No refined sugar, no palm oil, no hydrogenated vegetable oil, no emulsifiers, no preservatives. Natural oil separation on top is proof of that — stir it back in.',
        },
        {
          q: 'How should I store it? Does it need a fridge?',
          a: 'No fridge needed. Keep the jar in a cool, dry cupboard away from sunlight, use a dry spoon, and stir once after opening. Shelf life is 9 months from manufacture.',
        },
        {
          q: 'Is it safe for kids, pregnant women, diabetics?',
          a: 'It is a whole-food spread with no added sugar in the Classic range, so it fits most diets. It is not a medical product — if you have a peanut allergy, kidney restriction or are on a prescribed diet, check with your doctor first.',
        },
        {
          q: 'Are the jars recyclable?',
          a: 'Yes — food-grade PET with an aluminium induction seal. Rinse the jar and drop it in dry waste; the seals go in mixed waste. We are testing refill pouches for 2026.',
        },
      ],
    },
    {
      group: 'Returns, wholesale & more',
      items: [
        {
          q: 'Can I return an opened jar?',
          a: 'For food-safety reasons we cannot accept opened jars back. What we do instead: if anything is wrong — damaged seal, off smell, transit damage — send a photo on WhatsApp and we replace or refund in full, no questions.',
        },
        {
          q: 'What if my jar arrives damaged?',
          a: 'Refuse the parcel if the seal is broken, or photograph it within 48 hours of delivery. We re-dispatch immediately and file the claim with the courier ourselves.',
        },
        {
          q: 'Do you do bulk or gym orders?',
          a: 'Yes. From 24 jars you get wholesale pricing, and we supply gyms, cafés and hotel breakfast counters across Uttar Pradesh. Email care@organichy.in with the quantity and your GSTIN.',
        },
        {
          q: 'Do you sell on Amazon or Flipkart?',
          a: 'Not right now — and that is on purpose. Selling direct keeps the margin in the kitchen instead of the marketplace, which is how we can use single-origin Gujarati peanuts at this price.',
        },
        {
          q: 'Where are the peanuts from?',
          a: 'Sourced through a farmer collective in Saurashtra, Gujarat, roasted and ground in our own unit in Moradabad. Batch date and lot number are printed on the base of every jar.',
        },
        {
          q: 'Can I visit the facility or get a sample?',
          a: 'Sampling drives for gyms in Moradabad and Bareilly run every month, and Sourav will show you the unit if you message ahead. Write to us from the Contact page and say when you are free.',
        },
      ],
    },
  ],
};

module.exports = config;
module.exports.ROOT = ROOT;
