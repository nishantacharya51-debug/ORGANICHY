'use strict';
/* ==========================================================================
   ORGANICHY — public/js/main.js
   Cart store (localStorage) + server-authoritative pricing, product page,
   checkout, forms, and the motion layer. No dependencies, no build step.
   Everything is event-delegated from `document`, so server-rendered HTML and
   anything injected later (suggestions, review lists) behaves the same.
   ========================================================================== */
(function () {
  const KEY = 'organichy.cart.v1';
  const COUPON_KEY = 'organichy.coupon.v1';
  const MAX_LINES = 24;
  const money = (n) => '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = { ok: res.ok };
    }
    if (!res.ok && data.ok !== false) data.ok = false;
    if (!res.ok && !data.error) data.error = `Request failed (${res.status})`;
    return data;
  }

  /* ------------------------------------------------------------------ */
  /* Toast                                                              */
  /* ------------------------------------------------------------------ */
  let toastEl;
  let toastTimer;
  function toast(msg, kind = 'ok', action) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = `<svg class="ic ic--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="${
      kind === 'err' ? 'M12 4.2l8.6 15.4H3.4zM12 10v4M12 16.6h.01' : 'M4.5 12.6l4.6 4.5L19.6 6.6'
    }"/></svg><span>${esc(msg)}${action ? ` <a href="${esc(action.href)}">${esc(action.label)}</a>` : ''}</span>`;
    toastEl.classList.toggle('toast--err', kind === 'err');
    // reflow so the transition replays when toasts stack
    void toastEl.offsetWidth;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), kind === 'err' ? 5200 : 3200);
  }

  /* ------------------------------------------------------------------ */
  /* Cart model                                                          */
  /* ------------------------------------------------------------------ */
  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((l) => l && l.productId && l.variant)
        .map((l) => ({ productId: String(l.productId), variant: String(l.variant), qty: Math.max(1, Math.min(10, Number(l.qty) || 1)) }))
        .slice(0, MAX_LINES);
    } catch {
      return [];
    }
  }
  function write(lines) {
    const next = lines.filter((l) => l.qty > 0).slice(0, MAX_LINES);
    localStorage.setItem(KEY, JSON.stringify(next));
    try {
      sessionStorage.setItem('organichy.cart.sync', JSON.stringify(next));
    } catch {}
    badge();
    return next;
  }
  function add(line, opts = {}) {
    const lines = read();
    const i = lines.findIndex((l) => l.productId === line.productId && l.variant === line.variant);
    if (i > -1) lines[i].qty = Math.min(10, lines[i].qty + (Number(line.qty) || 1));
    else lines.push({ productId: line.productId, variant: line.variant, qty: Math.max(1, Number(line.qty) || 1) });
    write(lines);
    bumpBadge();
    if (!opts.silent) {
      toast(`${line.qty || 1} × ${line.variant} added to your cart`, 'ok', { href: '/cart', label: 'View cart' });
    }
    sync();
    return lines;
  }
  function badge() {
    const n = read().reduce((s, l) => s + l.qty, 0);
    $$('[data-cart-badge]').forEach((el) => {
      el.textContent = String(n);
      el.hidden = n === 0;
    });
    document.dispatchEvent(new CustomEvent('oh:cart', { detail: { count: n } }));
  }
  function bumpBadge() {
    $$('[data-cart-badge]').forEach((el) => {
      el.classList.remove('is-bump');
      void el.offsetWidth;
      el.classList.add('is-bump');
    });
  }

  /* Ask the server to price the cart, then let each page paint from it. */
  let lastQuote = null;
  async function quote() {
    const lines = read();
    if (!lines.length) {
      lastQuote = { lines: [], itemCount: 0, subtotal: 0, discount: 0, total: 0, shippingFee: 0, codFee: 0, coupon: '', problems: [] };
      document.dispatchEvent(new CustomEvent('oh:quote', { detail: lastQuote }));
      return lastQuote;
    }
    const payment = ($('input[name="payment"]:checked') || {}).value || localStorage.getItem('organichy.payment') || 'razorpay';
    const coupon = getCoupon();
    const data = await api('/api/cart/price', { method: 'POST', body: { items: lines, coupon, payment } });
    lastQuote = data && data.ok ? data : { lines: [], itemCount: 0, subtotal: 0, problems: [(data && data.error) || 'Could not price your cart.'] };
    // Drop lines the server rejected (out of stock / removed from catalogue).
    if (data.lines && data.lines.length !== lines.length) {
      write(data.lines.map((l) => ({ productId: l.productId, variant: l.variant, qty: l.qty })));
    }
    document.dispatchEvent(new CustomEvent('oh:quote', { detail: lastQuote }));
    return lastQuote;
  }
  function sync() {
    quote();
  }
  const getCoupon = () => localStorage.getItem(COUPON_KEY) || '';
  const setCoupon = (c) => (c ? localStorage.setItem(COUPON_KEY, String(c).toUpperCase()) : localStorage.removeItem(COUPON_KEY));

  window.OH = { add, read, write, quote, badge, toast, api, money, esc, getCoupon, setCoupon };

  /* ------------------------------------------------------------------ */
  /* Delegated controls                                                  */
  /* ------------------------------------------------------------------ */
  document.addEventListener('click', (ev) => {
    const addBtn = ev.target.closest('[data-add-cart]');
    if (addBtn) {
      ev.preventDefault();
      const box = addBtn.closest('[data-buybox]');
      const qty = box ? Math.max(1, Number(($('[data-qty-input]', box) || {}).value) || 1) : 1;
      add({ productId: addBtn.dataset.product, variant: addBtn.dataset.variant, qty });
      return;
    }
    const buy = ev.target.closest('[data-buy-now]');
    if (buy) {
      ev.preventDefault();
      const box = buy.closest('[data-buybox]');
      const qty = box ? Math.max(1, Number(($('[data-qty-input]', box) || {}).value) || 1) : 1;
      add({ productId: buy.dataset.product, variant: buy.dataset.variant, qty }, { silent: true });
      location.href = '/checkout';
      return;
    }
    const step = ev.target.closest('[data-step]');
    if (step) {
      ev.preventDefault();
      const wrap = step.closest('[data-stepper]');
      const input = $('[data-qty-input]', wrap);
      if (!input) return;
      const delta = Number(step.dataset.step) || 1;
      if (input.dataset.bound === '1') {
        // in a cart line: change the line, the server re-prices
        const line = input.closest('[data-line]');
        if (line) changeLine(line, (Number(input.value) || 1) + delta);
      } else {
        input.value = String(Math.max(1, Math.min(10, (Number(input.value) || 1) + delta)));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return;
    }
    const rm = ev.target.closest('[data-remove-line]');
    if (rm) {
      ev.preventDefault();
      changeLine(rm.closest('[data-line]'), 0);
      return;
    }
    const acc = ev.target.closest('[data-acc-toggle]');
    if (acc) {
      const item = acc.closest('.acc__item');
      const open = item.classList.toggle('is-open');
      acc.setAttribute('aria-expanded', open ? 'true' : 'false');
      return;
    }
    const burger = ev.target.closest('[data-burger]');
    if (burger) return toggleDrawer(true);
    if (ev.target.closest('[data-drawer-close]')) return toggleDrawer(false);

    const copy = ev.target.closest('[data-copy-btn]');
    if (copy) {
      const text = copy.dataset.copyBtn;
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast(`Copied: ${text}`), () => fallbackCopy(text));
      else fallbackCopy(text);
      return;
    }
    if (ev.target.closest('[data-print]')) return window.print();

    const tab = ev.target.closest('[data-tab]');
    if (tab && tab.closest('[data-tabs]')) {
      const group = tab.closest('[data-tabs]');
      $$('[data-tab]', group).forEach((t) => {
        const on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      const name = tab.dataset.tab;
      $$('[data-panel]', group.parentElement).forEach((p) => p.classList.toggle('is-active', p.dataset.panel === name));
      return;
    }
    const pick = ev.target.closest('[data-coupon-pick]');
    if (pick) {
      ev.preventDefault();
      const input = $('#coupon-code');
      if (input) {
        input.value = pick.dataset.couponPick;
        applyCoupon(pick.dataset.couponPick);
      }
      return;
    }
    const thumb = ev.target.closest('[data-gallery-thumb]');
    if (thumb) {
      const gal = thumb.closest('[data-gallery]');
      const img = $('[data-gallery-main]', gal);
      if (img) {
        img.style.opacity = '0';
        setTimeout(() => {
          img.src = thumb.dataset.galleryThumb;
          img.style.opacity = '1';
        }, 120);
      }
      $$('[data-gallery-thumb]', gal).forEach((t) => t.classList.toggle('is-active', t === thumb));
      return;
    }
    const vbtn = ev.target.closest('[data-variant-btn]');
    if (vbtn) return pickVariant(vbtn);
  });

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      toast(`Copied: ${text}`);
    } catch {
      toast('Copy failed — select the text manually', 'err');
    }
    ta.remove();
  }

  function toggleDrawer(open) {
    const drawer = $('#drawer');
    const scrim = $('.scrim');
    if (!drawer) return;
    drawer.classList.toggle('is-open', open);
    drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (scrim) scrim.classList.toggle('is-on', open);
    const btn = $('[data-burger]');
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.style.overflow = open ? 'hidden' : '';
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') toggleDrawer(false);
  });

  /* -------------------------------------------------------------- PDP ---- */
  function pickVariant(btn) {
    const wrap = btn.closest('[data-variants]') || document;
    const buybox = $('[data-buybox]');
    $$('[data-variant-btn]', wrap).forEach((b) => {
      const on = b === btn;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const label = btn.dataset.variantBtn;
    const price = Number(btn.dataset.price) || 0;
    const stock = Number(btn.dataset.stock) || 0;
    const mrpEl = $('[data-buy-mrp]', buybox || document);
    const priceEl = $('[data-buy-price]', buybox || document);
    if (priceEl) priceEl.textContent = money(price);
    if (mrpEl) {
      const mrp = Math.max(price, Number((mrpEl.textContent || '').replace(/[^\d]/g, '')) || price);
      // recompute MRP from the product data on the page (data-mrp-on)
      const map = (buybox && buybox.dataset.mrp) || '';
      const found = map.split(';').map((s) => s.split(':')).find((p) => p[0] === label);
      const realMrp = found ? Number(found[1]) : price;
      mrpEl.textContent = money(realMrp);
      const off = realMrp > price ? Math.round(((realMrp - price) / realMrp) * 100) : 0;
      const offEl = $('[data-buy-off]', buybox || document);
      if (offEl) {
        offEl.textContent = `${off}% off`;
        offEl.hidden = off <= 0;
      }
    }
    const stockEl = $('[data-buy-stock]', buybox || document);
    if (stockEl) {
      stockEl.dataset.low = stock <= 0 ? 'out' : stock <= 20 ? 'low' : '';
      stockEl.innerHTML =
        stock <= 0
          ? '<span class="ic">!</span> Sold out — next roast ships shortly'
          : stock <= 20
            ? `<svg class="ic ic--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 4.2l8.6 15.4H3.4zM12 10v4"/></svg> Only ${stock} × ${esc(label)} left`
            : `<svg class="ic ic--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.6"/><path d="M8.2 12.3l2.6 2.6 5-5.2"/></svg> In stock · packed within 24 hours`;
      stockEl.style.color = stock <= 0 ? 'var(--danger)' : stock <= 20 ? 'var(--amber)' : 'var(--brand-d)';
    }
    $$('[data-add-cart][data-product], [data-buy-now]', buybox || document).forEach((b) => {
      b.dataset.variant = label;
      b.disabled = stock <= 0;
    });
    const stickyPrice = $('[data-sticky-price]');
    if (stickyPrice) stickyPrice.textContent = `${money(price)} · ${label}`;
    const stickyAdd = $('[data-sticky-add]');
    if (stickyAdd) {
      stickyAdd.dataset.variant = label;
      stickyAdd.disabled = stock <= 0;
    }
    const stickyBtn = $('.stickybuy [data-add-cart]');
    if (stickyBtn) {
      stickyBtn.dataset.variant = label;
      stickyBtn.disabled = stock <= 0;
    }
  }

  /* ---------------------------------------------------------- pincode ---- */
  async function checkPincode(input, outEl) {
    if (!outEl) return;
    const pin = String(input.value || '').replace(/\D/g, '');
    if (pin.length !== 6) {
      outEl.textContent = 'Enter a valid 6-digit pincode.';
      outEl.className = 'pincode__out is-bad';
      return;
    }
    outEl.textContent = 'Checking the route…';
    const data = await api(`/api/pincode?pin=${pin}`);
    if (!data.ok) {
      outEl.textContent = data.error || 'That pincode is not serviceable yet — message us and we will find a way.';
      outEl.className = 'pincode__out is-bad';
      return;
    }
    outEl.innerHTML = `<svg class="ic ic--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4.5 12.6l4.6 4.5L19.6 6.6"/></svg> Delivery to <b>${esc(pin)}</b> in <b>${esc(data.window)}</b> — around <b>${esc(data.dateLabel)}</b>. ${esc(data.note)}${data.codAvailable ? ' COD available.' : ''}`;
    outEl.className = 'pincode__out is-ok';
  }
  document.addEventListener('submit', (ev) => {
    const pinForm = ev.target.closest('[data-pincode]');
    if (pinForm) {
      ev.preventDefault();
      const input = $('input[name="pin"]', pinForm);
      const box = pinForm.closest('.pincode') || pinForm.parentElement;
      checkPincode(input, $('[data-pincode-out]', box) || box.querySelector('[data-pincode-out]'));
      return;
    }
    if (ev.target.closest('[data-coupon-apply]')) {
      ev.preventDefault();
      applyCoupon(($('#coupon-code') || {}).value);
      return;
    }
    if (ev.target.closest('[data-newsletter]')) {
      ev.preventDefault();
      submitForm(ev.target, '/api/newsletter', { source: document.body.dataset.route || '/' });
      return;
    }
    if (ev.target.closest('[data-contact-form]')) {
      ev.preventDefault();
      submitForm(ev.target, '/api/contact');
      return;
    }
    if (ev.target.closest('[data-review-form]')) {
      ev.preventDefault();
      submitReview(ev.target);
      return;
    }
    if (ev.target.closest('[data-checkout]')) {
      ev.preventDefault();
      placeOrder(ev.target);
    }
  });

  /* checkout pincode: react to typing in the pincode field instead */
  document.addEventListener('input', (ev0) => {
    const el = ev0.target;
    if (el.name === 'pincode' && el.form && el.form.matches('[data-checkout]')) {
      const out = $('[data-pincode-out]', el.closest('.checkout__form'));
      if (String(el.value).replace(/\D/g, '').length === 6) checkPincode(el, out);
    }
    if (el.matches('[data-qty-input]') && el.dataset.bound === '1') {
      const line = el.closest('[data-line]');
      if (line) changeLine(line, Number(el.value) || 1);
    }
    if (el.id === 'coupon-code' && ev0.key === 'Enter') {
      ev0.preventDefault();
      applyCoupon(el.value);
    }
    if (el.id === 'coupon-code' && el.value.length >= 4) {
      // light touch: nothing to fetch, just normalise
      el.value = el.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    }
  });

  async function submitForm(form, endpoint, extra = {}) {
    const msg = $('[data-form-msg]', form);
    const btn = $('button[type="submit"]', form);
    const payload = Object.fromEntries(new FormData(form).entries());
    Object.assign(payload, extra);
    if (btn) btn.disabled = true;
    if (msg) {
      msg.textContent = 'Sending…';
      msg.className = 'form-msg';
    }
    const data = await api(endpoint, { method: 'POST', body: payload });
    if (btn) btn.disabled = false;
    if (msg) {
      msg.textContent = data.ok ? data.message || 'Done — thank you.' : data.error || 'Something went wrong.';
      msg.className = `form-msg ${data.ok ? 'is-ok' : 'is-err'}`;
    }
    if (data.ok) {
      form.reset();
      toast(data.message || 'Received.');
    }
    return data;
  }

  async function submitReview(form) {
    const productId = form.dataset.product;
    const rating = Number(($('input[name="rating"]', form) || {}).value || 0);
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.rating = rating;
    const data = await api(`/api/reviews/${encodeURIComponent(productId)}`, { method: 'POST', body: payload });
    const msg = $('[data-form-msg]', form);
    if (!data.ok) {
      if (msg) {
        msg.textContent = data.error;
        msg.className = 'form-msg is-err';
      }
      return;
    }
    if (msg) {
      msg.textContent = 'Posted — thank you, it is live on the page now.';
      msg.className = 'form-msg is-ok';
    }
    form.reset();
    $$('[data-rating]', form).forEach((b) => b.classList.remove('is-on'));
    const label = $('[data-rating-label]', form);
    if (label) label.textContent = 'Tap a star';
    toast('Review published. Much appreciated.');
    // inject the review so the page reflects it without a reload
    const list = $('.reviews__list');
    if (list && data.review) {
      const node = document.createElement('article');
      node.className = 'review card is-flash';
      node.innerHTML = `<header class="review__head"><span class="review__av">${esc(data.review.name.slice(0, 1))}</span><div><p class="review__name">${esc(data.review.name)}</p><p class="review__meta">${esc(data.review.city)} · just now</p></div></header>
      <h4 class="review__title">${esc(data.review.title)}</h4><p class="review__body">${esc(data.review.body)}</p>`;
      list.insertBefore(node, list.firstChild);
    }
    return data;
  }

  /* star picker */
  document.addEventListener('click', (ev) => {
    const star = ev.target.closest('[data-rating]');
    if (!star) return;
    const group = star.closest('[data-rating-input]');
    const n = Number(star.dataset.rating);
    $('input[name="rating"]', group).value = String(n);
    $$('[data-rating]', group).forEach((b) => b.classList.toggle('is-on', Number(b.dataset.rating) <= n));
    const label = $('[data-rating-label]', group);
    if (label) label.textContent = `${n} star${n === 1 ? '' : 's'}`;
  });

  /* ------------------------------------------------------------- coupon -- */
  async function applyCoupon(code) {
    const msg = $('[data-coupon-msg]');
    const want = String(code || '').trim().toUpperCase();
    if (msg) {
      msg.textContent = 'Checking…';
      msg.className = 'form-msg';
    }
    const quote0 = await quote();
    setCoupon(want);
    const data = await quote();
    const input = $('#coupon-code');
    const ok = Boolean(data.couponValid) && data.coupon === want;
    if (input) input.value = ok ? data.coupon : '';
    if (msg) {
      msg.textContent = want ? data.couponMessage || (ok ? 'Applied.' : 'That code did not apply.') : 'Coupon cleared.';
      msg.className = `form-msg ${ok ? 'is-ok' : want ? 'is-err' : ''}`;
    }
    if (!want) msg && (msg.textContent = 'Type a code, or tap one of the live coupons below.');
    void quote0;
    return data;
  }

  /* --------------------------------------------------------- cart page --- */
  function paintCart(q) {
    const root = $('[data-cart-root]');
    if (!root) return;
    const linesEl = $('[data-cart-lines]', root);
    if (!q.lines.length) {
      linesEl.innerHTML = `<div class="cart__empty">
        <span class="empty__ic"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8.4 3.4h7.2v2.4H8.4z"/><path d="M7.2 6.6h9.6l1 3.2v8.2a2.4 2.4 0 0 1-2.4 2.4H8.6a2.4 2.4 0 0 1-2.4-2.4V9.8z"/></svg></span>
        <h2 class="h3">Your cart is empty</h2>
        <p class="muted">Two spoons a day means a 500 g jar lasts about a fortnight. Start there — or take the kilo and skip the reorder.</p>
        <a class="btn btn--primary btn--lg" href="/shop">Browse the four jars</a>
      </div>`;
      const sug = $('[data-cart-suggest]', root);
      if (sug) {
        sug.hidden = false;
        const head = $('.cart__suggest-t', sug);
        if (head) head.textContent = 'Other people start with these:';
      }
      suggestions();
    } else {
      linesEl.innerHTML = q.lines
        .map(
          (l) => `<div class="line ${l.stock <= 0 ? 'is-out' : ''}" data-line data-id="${esc(l.productId)}" data-variant="${esc(l.variant)}">
      <span class="line__media"><img src="${esc(l.image)}" alt="" width="80" height="80" loading="lazy"></span>
      <div class="line__body">
        <p class="line__name"><a href="/product/${esc(l.slug)}">${esc(l.name)}</a></p>
        <p class="line__variant">${esc(l.variant)} · ${money(l.price)} each${l.stock > 0 ? ` · ${l.stock} in stock` : ' · out of stock'}</p>
        <div class="stepper stepper--sm" data-stepper>
          <button type="button" class="stepper__btn" data-step="-1" aria-label="Decrease"><svg class="ic ic--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5.4 12h13.2"/></svg></button>
          <input class="stepper__val" data-qty-input data-bound="1" inputmode="numeric" value="${l.qty}" aria-label="Quantity">
          <button type="button" class="stepper__btn" data-step="1" aria-label="Increase"><svg class="ic ic--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5.4v13.2M5.4 12h13.2"/></svg></button>
        </div>
      </div>
      <div class="line__right">
        <span class="line__total">${money(l.lineTotal)}</span>
        <button class="line__remove" type="button" data-remove-line>Remove<svg class="ic ic--xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4.8 7h14.4M9.4 7V4.6h5.2V7M6.8 7l1 12.6h8.4L17.2 7"/></svg></button>
      </div>
    </div>`
        )
        .join('') +
        (q.problems && q.problems.length ? `<p class="notice notice--warn">${esc(q.problems.join(' '))}</p>` : '');
      const sug = $('[data-cart-suggest]', root);
      if (sug) sug.hidden = q.lines.length >= 3;
      if (q.lines.length < 3) suggestions();
    }
    paintSummary(q);
  }

  async function changeLine(lineEl, qty) {
    const lines = read();
    const i = lines.findIndex((l) => l.productId === lineEl.dataset.id && l.variant === lineEl.dataset.variant);
    if (i === -1) return;
    lines[i].qty = Math.max(0, Math.min(10, Number(qty) || 1));
    if (lines[i].qty === 0) {
      lines.splice(i, 1);
      toast('Removed from cart.');
    }
    write(lines);
    await quote();
    if (!lines.length) toast('Your cart is now empty.', 'ok', { href: '/shop', label: 'Browse jars' });
  }

  let suggested = false;
  async function suggestions() {
    if (suggested) return;
    const grid = $('[data-suggest-grid]');
    if (!grid) return;
    suggested = true;
    const data = await api('/api/products');
    const mine = new Set(read().map((l) => l.productId));
    grid.innerHTML = (data.products || [])
      .filter((p) => !mine.has(p.id))
      .slice(0, 3)
      .map(
        (p) => `<article class="pcard card">
      <a class="pcard__media" href="/product/${esc(p.slug)}"><img class="pcard__img" src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy"><span class="pcard__badges">${p.badge ? `<span class="tag tag--brand">${esc(p.badge)}</span>` : ''}</span></a>
      <div class="pcard__body"><h3 class="pcard__title"><a href="/product/${esc(p.slug)}">${esc(p.name)}</a></h3>
      <div class="pcard__foot"><div class="price"><span class="price__now">${money(p.price)}</span></div></div>
      <div class="pcard__cta"><button class="btn btn--primary btn--sm" data-add-cart data-product="${esc(p.id)}" data-variant="${esc(p.variants[0].label)}">Add · ${esc(p.variants[0].label)}</button></div></div></article>`
      )
      .join('');
  }

  function paintSummary(q) {
    const set = (k, v) =>
      $$(`[data-sum="${k}"]`).forEach((el) => {
        el.textContent = v;
      });
    set('subtotal', money(q.subtotal || 0));
    set('discount', '−' + money(q.discount || 0));
    set('shipping', q.shippingFee ? money(q.shippingFee) : 'FREE');
    set('cod', money(q.codFee || 0));
    set('total', money(q.total || 0));
    set('savings', money(q.savings || 0));
    set('coupon', q.coupon || '');
    $$('[data-sum-wrap="discount"]').forEach((el) => (el.hidden = !q.discount));
    $$('[data-sum-wrap="cod"]').forEach((el) => (el.hidden = !q.codFee));
    $$('[data-sum-count]').forEach((el) => (el.textContent = `${q.itemCount || 0} item${q.itemCount === 1 ? '' : 's'}`));
    $$('[data-freebar]').forEach((bar) => {
      const pct = Math.max(0, Math.min(100, Number(q.freeShippingProgress) || 0));
      const fill = $('[data-freebar-fill]', bar);
      const text = $('[data-freebar-text]', bar);
      if (fill) fill.style.setProperty('--pct', pct + '%');
      if (text) text.textContent = q.freeShippingRemaining > 0 ? `Add ${money(q.freeShippingRemaining)} more for free delivery` : 'Free delivery unlocked 🎉';
      bar.classList.toggle('is-done', !(q.freeShippingRemaining > 0));
    });
    const link = $('[data-checkout-link]');
    if (link) link.classList.toggle('is-disabled', !(q.itemCount > 0));
    const place = $('[data-place-order]');
    if (place) place.disabled = !(q.itemCount > 0);
  }

  function paintMini(q) {
    const ul = $('[data-minilines]');
    if (!ul) return;
    if (!q.lines.length) {
      ul.innerHTML = '<li class="muted">Your cart is empty — add a jar on the shop page.</li>';
      return;
    }
    ul.innerHTML = q.lines
      .map(
        (l) => `<li><img src="${esc(l.image)}" alt="" loading="lazy"><span>${esc(l.name.replace(' Peanut Butter', ''))} <span class="muted">× ${l.qty} · ${esc(l.variant)}</span></span><b>${money(l.lineTotal)}</b></li>`
      )
      .join('');
  }

  /* ---------------------------------------------------------- checkout --- */
  async function placeOrder(form) {
    const msg = $('[data-checkout-msg]', form);
    const btn = $('[data-place-order]', form);
    const lines = read();
    if (!lines.length) {
      showMsg(msg, 'Your cart is empty. Add a jar first.', true);
      toast('Cart is empty', 'err', { href: '/shop', label: 'Go to shop' });
      return;
    }
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.agree) {
      showMsg(msg, 'Tick the box to accept the terms and confirm the address.', true);
      return;
    }
    const bad = [];
    ['name', 'phone', 'email', 'address', 'city', 'state', 'pincode'].forEach((k) => {
      const el = $(`[name="${k}"]`, form);
      const value = String(data[k] || '').trim();
      const ok = value.length >= (k === 'pincode' ? 6 : k === 'phone' ? 10 : 2) && (k !== 'email' || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value));
      if (el) el.classList.toggle('is-bad', !ok);
      if (!ok) bad.push(k);
    });
    if (bad.length) {
      showMsg(msg, `Please complete: ${bad.join(', ')}.`, true);
      const first = $(`[name="${bad[0]}"]`, form);
      if (first) first.focus();
      return;
    }
    if (btn) {
      btn.disabled = true;
      btn.classList.add('is-disabled');
      btn.dataset.label = btn.innerHTML;
      btn.innerHTML = 'Placing your order…';
    }
    showMsg(msg, 'Re-checking prices, stock and your coupon on the server…');

    const res = await api('/api/orders', {
      method: 'POST',
      body: { items: lines, coupon: getCoupon(), payment: data.payment, customer: data, newsletter: data.newsletter || '' },
    });
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('is-disabled');
      if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
    }
    if (!res.ok) {
      showMsg(msg, res.error || 'Could not place the order.', true);
      toast(res.error || 'Order failed', 'err');
      return;
    }
    /* Razorpay live path: open the checkout sheet, then verify the signature. */
    if (res.razorpay && window.Razorpay) {
      try {
        const rzp = new window.Razorpay({
          key: res.razorpay.keyId,
          amount: res.total * 100,
          currency: 'INR',
          name: 'ORGANICHY',
          description: `Order ${res.orderId}`,
          order_id: res.razorpay.orderId,
          prefill: { name: data.name, email: data.email, contact: data.phone },
          theme: { color: '#0f7a4d' },
          handler: () => location.href = res.redirect,
        });
        rzp.open();
      } catch (err) {
        showMsg(msg, `Payment window failed: ${err.message}`, true);
      }
      return;
    }
    write([]);
    setCoupon('');
    showMsg(msg, res.payment.mode === 'demo' ? 'Saved — demo payment, nothing charged. Taking you to your receipt…' : 'Order placed. Taking you to your receipt…');
    setTimeout(() => (location.href = res.redirect), res.payment.mode === 'demo' ? 500 : 200);
  }
  function showMsg(el, text, isErr) {
    if (!el) return;
    el.textContent = text;
    el.className = `form-msg ${isErr ? 'is-err' : ''}`;
  }

  document.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.matches('[data-autosubmit]')) t.form && t.form.submit();
    if (t.matches('input[name="payment"]')) {
      localStorage.setItem('organichy.payment', t.value);
      $$('.paytab').forEach((tab) => tab.classList.toggle('is-active', $('input', tab).checked));
      quote();
    }
    if (t.matches('[data-qty-input]') && t.dataset.bound === '1') {
      changeLine(t.closest('[data-line]'), t.value);
    }
  });

  /* ------------------------------------------------------------------ */
  /* Motion layer                                                        */
  /* ------------------------------------------------------------------ */
  function motion() {
    // reveal on scroll
    const revealables = $$('.reveal, [data-stagger]');
    if ('IntersectionObserver' in window && !reduce()) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('is-in');
              io.unobserve(e.target);
            }
          });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
      );
      revealables.forEach((el) => io.observe(el));
    } else {
      revealables.forEach((el) => el.classList.add('is-in'));
    }

    // animated counters
    $$('[data-counter]').forEach((el) => {
      const target = Number(el.dataset.counter) || 0;
      const dec = Number(el.dataset.decimals) || 0;
      const fmt = (n) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
      if (reduce()) {
        el.textContent = fmt(target);
        return;
      }
      const run = () => {
        const t0 = performance.now();
        const dur = 1400;
        const tick = (now) => {
          const p = Math.min(1, (now - t0) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = fmt(target * eased);
          if (p < 1) requestAnimationFrame(tick);
          else el.textContent = fmt(target);
        };
        requestAnimationFrame(tick);
      };
      if ('IntersectionObserver' in window) {
        const co = new IntersectionObserver(
          (ents) => {
            if (ents.some((e) => e.isIntersecting)) {
              run();
              co.disconnect();
            }
          },
          { threshold: 0.4 }
        );
        co.observe(el);
      } else run();
    });

    // card spotlight
    if (!reduce()) {
      document.addEventListener('pointermove', (e) => {
        const card = e.target.closest('[data-spotlight]');
        if (!card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    }

    // header compression + scroll progress + PDP sticky bar
    const hdr = $('#hdr');
    const bar = $('#scrollbar');
    const sticky = $('[data-stickybuy]');
    const buybox = $('[data-buybox]');
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        if (hdr) hdr.classList.toggle('is-stuck', y > 66);
        if (bar) {
          const max = document.documentElement.scrollHeight - window.innerHeight;
          bar.style.width = (max > 0 ? Math.min(100, (y / max) * 100) : 0) + '%';
        }
        if (sticky && buybox) {
          const r = buybox.getBoundingClientRect();
          sticky.classList.toggle('is-on', r.bottom < 40 && y > 240);
        }
        if (!reduce()) {
          $$('[data-parallax]').forEach((el) => {
            const speed = Number(el.dataset.parallax) || 12;
            const r = el.getBoundingClientRect();
            const mid = r.top + r.height / 2 - window.innerHeight / 2;
            el.style.transform = `translate3d(0,${(-mid / window.innerHeight) * speed}px,0)`;
          });
        }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // nav loader for full-page navigations
    const loader = $('#navloader');
    if (loader) {
      document.addEventListener('click', (e) => {
        const a = e.target.closest('a[href]');
        if (!a || a.target === '_blank' || a.dataset.addCart || a.hasAttribute('download') || a.href.startsWith('mailto') || a.href.startsWith('tel') || a.hashOnly) return;
        if (a.origin !== location.origin || a.pathname === location.pathname && a.search === location.search) return;
        loader.classList.add('is-on');
        setTimeout(() => loader.classList.remove('is-on'), 1100);
      });
      window.addEventListener('pageshow', () => loader.classList.remove('is-on'));
    }

    // drag-scrollable review rail
    const rail = $('[data-rail]');
    if (rail) {
      let down = false;
      let startX = 0;
      let startLeft = 0;
      rail.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') return;
        down = true;
        startX = e.clientX;
        startLeft = rail.parentElement.scrollLeft;
        rail.parentElement.classList.add('is-drag');
      });
      window.addEventListener('pointermove', (e) => {
        if (!down) return;
        rail.parentElement.scrollLeft = startLeft - (e.clientX - startX);
      });
      window.addEventListener('pointerup', () => {
        down = false;
        rail.parentElement.classList.remove('is-drag');
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                               */
  /* ------------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', () => {
    badge();
    // restore the coupon chip
    const stored = getCoupon();
    if (stored) {
      const input = $('#coupon-code');
      if (input) input.value = stored;
    }
    document.addEventListener('oh:quote', (e) => {
      if ($('[data-cart-root]')) paintCart(e.detail);
      else { paintSummary(e.detail); paintMini(e.detail); }
    });
    if ($('[data-checkout]')) {
      const saved = localStorage.getItem('organichy.payment');
      if (saved) {
        const radio = $(`input[name="payment"][value="${saved}"]`);
        if (radio) {
          radio.checked = true;
          $$('.paytab').forEach((tab) => tab.classList.toggle('is-active', $('input', tab).checked));
        }
      }
    }
    quote();
    motion();

    // keep tabs in sync (open checkout in another tab → refresh when focused)
    window.addEventListener('focus', () => {
      try {
        const syncRaw = JSON.parse(sessionStorage.getItem('organichy.cart.sync') || 'null');
        if (syncRaw && JSON.stringify(syncRaw) !== JSON.stringify(read())) write(syncRaw);
      } catch {}
      quote();
    });
    window.addEventListener('storage', (e) => {
      if (e.key === KEY) {
        badge();
        quote();
      }
    });
  });
})();
