'use strict';
/**
 * lib/pricing.js — the only place cart maths happens.
 *
 * The browser never decides a price: /api/cart/price and POST /api/orders both
 * run through priceCart(), which re-reads every price and the stock level from
 * the database. Anything the client sends other than productId / variant / qty
 * is ignored on purpose.
 */
const config = require('./config');
const db = require('./db');

const { freeShippingThreshold, shippingFee, codFee, maxQtyPerLine, currency } = config.pricing;

/** Whole-rupee maths — Indian retail prices carry no paise on this store. */
function round(n) {
  return Math.round(Number(n) || 0);
}

/**
 * Evaluate a coupon against a subtotal.
 * @returns {{discount:number, freeShipping:boolean, message:string, coupon:object|null}}
 */
function evaluateCoupon(code, subtotal) {
  const wanted = String(code || '').trim().toUpperCase();
  if (!wanted) return { discount: 0, freeShipping: false, message: '', coupon: null, valid: false, skipped: true };

  const coupon = db.findCoupon(wanted);
  const invalid = (message) => ({ discount: 0, freeShipping: false, message, coupon: null, valid: false });
  if (!coupon) return invalid(`“${wanted}” is not a coupon we recognise.`);
  if (coupon.active === false) return invalid(`“${wanted}” is no longer active.`);
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) return invalid(`“${wanted}” expired.`);
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > Date.now()) return invalid(`“${wanted}” starts later.`);
  if (coupon.maxUses && (Number(coupon.uses) || 0) >= coupon.maxUses) return invalid(`“${wanted}” has run out.`);
  if (subtotal < (Number(coupon.minOrder) || 0)) {
    return invalid(
      `Add ${money(Math.round(coupon.minOrder - subtotal))} more to use ${wanted} (minimum ${money(coupon.minOrder)}).`
    );
  }

  let discount = 0;
  if (coupon.type === 'percent') {
    discount = round((subtotal * (Number(coupon.value) || 0)) / 100);
    if (coupon.maxCap) discount = Math.min(discount, Number(coupon.maxCap));
  } else if (coupon.type === 'flat') {
    discount = round(Number(coupon.value) || 0);
  }

  discount = Math.min(Math.max(0, discount), subtotal); // never let a coupon go negative
  const freeShipping = coupon.type === 'freeshipping' || coupon.freeShipping === true;
  return {
    discount,
    freeShipping,
    coupon,
    valid: true,
    message: freeShipping
      ? `${wanted} applied — delivery is on us.`
      : `${wanted} applied — you saved ${money(discount)}.`,
  };
}

function money(n) {
  return `${currency}${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n || 0))}`;
}

/**
 * @param {Array} items     [{productId, variant, qty}] — nothing else is trusted.
 * @param {string} couponCode
 * @param {string} payment  'cod' | 'razorpay' | 'online'
 */
function priceCart(items, couponCode, payment) {
  const raw = Array.isArray(items) ? items : [];
  const lines = [];
  const problems = [];
  let subtotal = 0;
  let mrpTotal = 0;
  let count = 0;

  for (const item of raw.slice(0, 40)) {
    const qtyRaw = Number.parseInt(item.qty, 10);
    const qty = Math.max(1, Math.min(maxQtyPerLine, Number.isFinite(qtyRaw) ? qtyRaw : 1));
    const found = db.findVariant(item.productId, item.variant);
    if (!found) {
      problems.push(`“${item.productId}” is no longer in the catalogue.`);
      continue;
    }
    const { product, variant } = found;
    if (product.active === false) {
      problems.push(`${product.name} has been removed from the store.`);
      continue;
    }
    const stock = Number(variant.stock) || 0;
    if (stock <= 0) {
      problems.push(`${product.name} — ${variant.label} is out of stock. We are roasting a new batch.`);
      continue;
    }
    const capped = qty > stock;
    const finalQty = capped ? stock : qty;
    if (capped) {
      problems.push(`Only ${stock} × ${variant.label} of ${product.name} left — quantity adjusted.`);
    }
    const lineTotal = round(variant.price * finalQty);
    subtotal = round(subtotal + lineTotal);
    mrpTotal = round(mrpTotal + (variant.mrp || variant.price) * finalQty);
    count += finalQty;
    lines.push({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      shortName: product.shortName || product.name,
      image: (product.images && product.images[0]) || '/images/product-creamy.png',
      variant: variant.label,
      variantId: variant.id,
      sku: variant.sku || '',
      price: variant.price,
      mrp: variant.mrp || variant.price,
      qty: finalQty,
      lineTotal,
      stock,
    });
  }

  const couponResult = evaluateCoupon(couponCode, subtotal);
  const discount = lines.length ? couponResult.discount : 0;
  const payable = round(subtotal - discount);

  let shipFee = payable >= freeShippingThreshold || payable <= 0 ? 0 : shippingFee;
  if (couponResult.freeShipping) shipFee = 0;

  const isCod = String(payment || '').toLowerCase() === 'cod';
  const cod = isCod && config.pricing.codEnabled ? codFee : 0;

  const total = round(payable + shipFee + cod);
  const toFreeShip = Math.max(0, round(freeShippingThreshold - payable));

  return {
    ok: true,
    lines,
    itemCount: count,
    subtotal,
    mrpTotal,
    productSavings: round(mrpTotal - subtotal),
    discount,
    coupon: couponResult.valid && couponResult.coupon ? couponResult.coupon.code : '',
    couponMessage: couponResult.message,
    couponValid: couponResult.valid,
    shippingFee: shipFee,
    freeShippingThreshold,
    freeShippingRemaining: toFreeShip,
    freeShippingProgress: Math.min(100, round((payable / freeShippingThreshold) * 100)),
    codFee: cod,
    total,
    savings: round(discount + (shippingFee - shipFee) + (mrpTotal - subtotal)),
    problems,
    note:
      toFreeShip > 0
        ? `Add ${money(toFreeShip)} more for free delivery on prepaid orders.`
        : 'Free delivery unlocked.',
  };
}

/** Server-side checkout validation. Returns { errors: [], order: {} }. */
function validateCustomer(c = {}) {
  const errors = [];
  const clean = {};
  const req = (key, label, value) => {
    if (!value || !String(value).trim()) errors.push(`${label} is required.`);
    return String(value || '').trim();
  };
  clean.name = req('name', 'Full name', c.name);
  clean.email = req('email', 'Email', c.email);
  clean.phone = req('phone', 'Phone number', c.phone);
  clean.address = req('address', 'Address', c.address);
  clean.city = req('city', 'City', c.city);
  clean.state = req('state', 'State', c.state);
  clean.pincode = req('pincode', 'Pincode', c.pincode);
  clean.notes = String(c.notes || '').trim().slice(0, 400);

  if (clean.name && clean.name.length < 3) errors.push('Please enter your full name.');
  if (clean.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean.email)) errors.push('That email address does not look right.');
  if (clean.phone && !/^[6-9]\d{9}$/.test(clean.phone.replace(/\D/g, '').slice(-10)))
    errors.push('Enter a 10-digit Indian mobile number starting 6–9.');
  if (clean.pincode && !/^\d{6}$/.test(clean.pincode.replace(/\D/g, ''))) errors.push('Pincode must be 6 digits.');
  if (clean.address && clean.address.length < 8) errors.push('Please give a fuller delivery address (house/flat + street).');
  if (clean.state && clean.state.length < 2) errors.push('Please give a state.');

  clean.phone = clean.phone.replace(/\D/g, '').slice(-10);
  clean.pincode = clean.pincode.replace(/\D/g, '').slice(0, 6);
  clean.email = clean.email.toLowerCase();

  return { errors, clean };
}

module.exports = { priceCart, evaluateCoupon, validateCustomer, money, round };
