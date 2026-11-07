'use strict';
/**
 * lib/views/cart.js — cart page and checkout page.
 * The line items live in localStorage; every number you see on screen is
 * recomputed by the server through POST /api/cart/price so a tampered browser
 * can never invent a price.
 */
const config = require('../config');
const db = require('../db');
const { esc, money } = require('../util');
const { page, icon, field, baseSchema } = require('./layout');

const STATES = [
  'Andaman & Nicobar', 'Andhra Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh', 'Dadra & Nagar Haveli', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

function freeBar() {
  return `<div class="freebar" data-freebar>
  <div class="freebar__track"><span class="freebar__fill" data-freebar-fill style="--pct:0%"></span></div>
  <p class="freebar__text" data-freebar-text>Add ${money(config.pricing.freeShippingThreshold)} or more for free delivery.</p>
</div>`;
}

function couponBox() {
  // A <div>, not a <form>: on the checkout page this block sits *inside* the
  // checkout form, and nested forms are illegal HTML — the browser would close
  // the outer one and the Place-order button would silently stop working.
  return `<div class="coupon" data-coupon>
  <label class="label" for="coupon-code">${icon('tag', 'ic--sm')} Have a coupon?</label>
  <div class="coupon__row">
    <input class="input input--sm" id="coupon-code" name="coupon" type="text" placeholder="ORGANICHY10" autocapitalize="characters" autocomplete="off" spellcheck="false">
    <button class="btn btn--sm btn--dark" type="button" data-coupon-apply>Apply</button>
  </div>
  <p class="form-msg" data-coupon-msg role="status"></p>
  <p class="coupon__list">Live: ${db
    .listCoupons()
    .filter((c) => c.active !== false)
    .map((c) => `<button type="button" class="coupon__chip" data-coupon-pick="${esc(c.code)}" title="${esc(c.description)}">${esc(c.code)}</button>`)
    .join('')}</p>
</div>`;
}

function summaryRows(isCheckout) {
  return `<dl class="summary__rows">
  <div class="summary__row"><dt>Item total</dt><dd data-sum="subtotal">${money(0)}</dd></div>
  <div class="summary__row is-discount" data-sum-wrap="discount" hidden><dt>Coupon <span data-sum="coupon" class="summary__code"></span></dt><dd data-sum="discount">−${money(0)}</dd></div>
  <div class="summary__row"><dt>Delivery</dt><dd data-sum="shipping">${money(config.pricing.shippingFee)}</dd></div>
  <div class="summary__row" data-sum-wrap="cod" hidden><dt>COD handling</dt><dd data-sum="cod">${money(config.pricing.codFee)}</dd></div>
  <div class="summary__total"><dt>To pay</dt><dd data-sum="total">${money(0)}</dd></div>
</dl>
<p class="summary__save" data-sum-save>You are saving <b data-sum="savings">${money(0)}</b> against MRP.</p>
${isCheckout ? '' : `<p class="summary__note">${icon('shield', 'ic--sm')} Prices are recalculated on our server at checkout — coupons and stock are re-checked before payment.</p>`}`;
}

function cartPage() {
  const body = `<section class="section section--tight">
  <div class="wrap">
    <header class="pagehead pagehead--sm">
      <p class="eyebrow">${icon('cart', 'ic--xs')} Your box</p>
      <h1 class="h1">Cart</h1>
      <p class="lead">Free delivery above ${money(config.pricing.freeShippingThreshold)} on prepaid orders. COD adds ${money(config.pricing.codFee)} courier handling.</p>
    </header>

    <div class="cart" data-cart-root>
      <div class="cart__main card">
        <div class="cart__lines" data-cart-lines aria-live="polite">
          <p class="cart__loading">Loading your jar count…</p>
        </div>
        <div class="cart__suggest" data-cart-suggest hidden>
          <p class="cart__suggest-t">Add a 1 kg jar and the shipping is on us.</p>
          <div class="grid grid--3" data-suggest-grid></div>
        </div>
        <noscript><p class="notice notice--warn">Your cart is stored in this browser, so JavaScript needs to be enabled to list it. You can also order on WhatsApp at ${esc(config.brand.phoneDisplay)}.</p></noscript>
      </div>
      <aside class="cart__side">
        <div class="summary card">
          <h2 class="summary__title">Order summary</h2>
          ${freeBar()}
          ${summaryRows(false)}
          ${couponBox()}
          <a class="btn btn--primary btn--block btn--lg" href="/checkout" data-checkout-link>Checkout ${icon('right', 'ic--sm')}</a>
          <a class="btn btn--ghost btn--block" href="/shop">Keep browsing</a>
          <ul class="summary__trust">
            <li>${icon('lock', 'ic--sm')} HTTPS everywhere, no card data on our servers</li>
            <li>${icon('truck', 'ic--sm')} Packed in Moradabad within 24 hours (Mon–Sat)</li>
            <li>${icon('refresh', 'ic--sm')} Free re-dispatch if a jar arrives damaged</li>
          </ul>
        </div>
      </aside>
    </div>
  </div>
</section>`;
  return page({
    title: 'Your cart — ORGANICHY',
    description: 'Review your ORGANICHY jars, apply a coupon and see live totals. Free delivery above ₹899 on prepaid orders.',
    path: '/cart',
    body,
    robots: 'noindex,follow',
    active: 'cart',
    products: db.listProducts({ activeOnly: true }),
    schema: [],
  });
}

function checkoutPage(query = {}) {
  const body = `<section class="section section--tight">
  <div class="wrap">
    <header class="pagehead pagehead--sm">
      <p class="eyebrow">${icon('shield', 'ic--xs')} Secure checkout</p>
      <h1 class="h1">Checkout</h1>
      <p class="lead">Two minutes. No account needed — you get an order ID to track the parcel with.</p>
    </header>

    <form class="checkout" data-checkout novalidate>
      <div class="checkout__grid">
        <div class="checkout__form">
          <section class="panel card">
            <h2 class="panel__head"><span class="panel__n">1</span> Contact</h2>
            <div class="form-grid">
              ${field({ id: 'c-name', name: 'name', label: 'Full name', required: true, autocomplete: 'name', placeholder: 'Rahul Sharma' })}
              ${field({ id: 'c-phone', name: 'phone', label: 'Mobile number', required: true, type: 'tel', inputmode: 'numeric', autocomplete: 'tel', placeholder: '98765 43210', hint: 'Courier calls this number. We never message you marketing.' })}
              ${field({ id: 'c-email', name: 'email', label: 'Email', required: true, type: 'email', autocomplete: 'email', placeholder: 'you@email.com', hint: 'Order confirmation and the tracking link go here.' })}
            </div>
          </section>

          <section class="panel card">
            <h2 class="panel__head"><span class="panel__n">2</span> Delivery address</h2>
            <div class="form-grid">
              ${field({ id: 'c-address', name: 'address', type: 'textarea', rows: 2, label: 'Flat / house, street, landmark', required: true, autocomplete: 'street-address', placeholder: 'B-19 Moti Nagar, near Jama Masjid', span: '6' })}
              ${field({ id: 'c-city', name: 'city', label: 'City / town', required: true, autocomplete: 'address-level2', placeholder: 'Moradabad', span: '2' })}
              ${field({ id: 'c-pincode', name: 'pincode', label: 'Pincode', required: true, inputmode: 'numeric', pattern: '[0-9]{6}', maxlength: 6, autocomplete: 'postal-code', placeholder: '244001', span: '2' })}
              ${field({ id: 'c-state', name: 'state', label: 'State', type: 'select', required: true, options: STATES, value: 'Uttar Pradesh', autocomplete: 'address-level1', span: '2' })}
              ${field({ id: 'c-notes', name: 'notes', type: 'textarea', rows: 2, label: 'Delivery notes', optional: 'optional', placeholder: 'Gate code, preferred time, GSTIN for the invoice…', span: '6' })}
            </div>
            <div class="pincode pincode--inline" data-checkout-pincode>
              <p data-pincode-out>${icon('pin', 'ic--sm')} Enter a pincode to see the delivery estimate.</p>
            </div>
          </section>

          <section class="panel card">
            <h2 class="panel__head"><span class="panel__n">3</span> Payment</h2>
            <div class="paytabs" data-paytabs>
              <label class="paytab is-active">
                <input type="radio" name="payment" value="razorpay" checked>
                <span class="paytab__ic">${icon('bolt')}</span>
                <span class="paytab__t">Pay online</span>
                <span class="paytab__s">UPI, cards, netbanking, wallets via Razorpay</span>
                <span class="paytab__tag">Fastest dispatch</span>
              </label>
              ${config.pricing.codEnabled
                ? `<label class="paytab">
                <input type="radio" name="payment" value="cod">
                <span class="paytab__ic">${icon('truck')}</span>
                <span class="paytab__t">Cash on delivery</span>
                <span class="paytab__s">Pay the courier in cash or UPI on the doorstep</span>
                <span class="paytab__tag paytab__tag--warn">+${money(config.pricing.codFee)} handling</span>
              </label>`
                : ''}
            </div>
            <p class="panel__demo">${icon('alert', 'ic--sm')}
              ${config.payments.mode === 'live'
                ? 'You are being charged through Razorpay\'s secure checkout. Card and UPI details never touch our servers.'
                : `Razorpay is running in <b>demo mode</b> on this deployment — an order is created with a <code>pay_DEMO…</code> reference and <b>nothing is charged</b>. Add <code>RAZORPAY_KEY_ID</code> and <code>RAZORPAY_KEY_SECRET</code> to go live. COD works normally.`}
            </p>
          </section>

          <section class="panel card">
            <h2 class="panel__head"><span class="panel__n">4</span> Offer &amp; agreement</h2>
            <div class="panel__pad">
              ${couponBox()}
              <label class="check">
                <input type="checkbox" name="agree" required>
                <span>I have read the <a href="/terms" target="_blank" rel="noopener">terms</a> and the <a href="/return-refund-policy" target="_blank" rel="noopener">return policy</a>, and the address above is correct.</span>
              </label>
              <label class="check">
                <input type="checkbox" name="newsletter" value="yes">
                <span>Put me on the roast calendar (one email a month, no phone spam).</span>
              </label>
            </div>
          </section>
        </div>

        <aside class="checkout__side">
          <div class="summary card summary--sticky">
            <h2 class="summary__title">Your order <span class="summary__count" data-sum-count>0 items</span></h2>
            <ul class="minilines" data-minilines></ul>
            ${freeBar()}
            ${summaryRows(true)}
            <button class="btn btn--primary btn--block btn--lg" type="submit" data-place-order>Place order ${icon('right', 'ic--sm')}</button>
            <p class="form-msg" data-checkout-msg role="status"></p>
            <p class="summary__lock">${icon('lock', 'ic--sm')} Your data goes to our own server in India and nowhere else. No tracking pixels, no ad retargeting.</p>
          </div>
        </aside>
      </div>
    </form>

    <div class="checkout__help card">
      <div><h3 class="h3">Something wrong with the form?</h3><p class="muted">Order on WhatsApp instead — send your address and pincode to <a href="https://wa.me/${esc(config.brand.whatsapp)}" target="_blank" rel="noopener">${esc(config.brand.phoneDisplay)}</a> and we will create the order for you.</p></div>
      <div><h3 class="h3">Bulk or gift order?</h3><p class="muted">Tell us the quantity and we will quote a wholesale rate and ship from stock, usually same day. <a href="/contact?topic=wholesale">Contact form →</a></p></div>
    </div>
  </div>
</section>`;

  return page({
    title: 'Checkout — ORGANICHY',
    description: 'Guest checkout for ORGANICHY peanut butter. UPI, cards and netbanking via Razorpay, or Cash on Delivery across India.',
    path: '/checkout',
    body,
    robots: 'noindex,nofollow',
    active: 'cart',
    products: db.listProducts({ activeOnly: true }),
    schema: [],
  });
}

module.exports = { cartPage, checkoutPage, STATES, summaryRows, couponBox, freeBar };
