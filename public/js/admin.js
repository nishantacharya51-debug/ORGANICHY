'use strict';
/* ==========================================================================
   ORGANICHY — public/js/admin.js
   Progressive enhancement over the server-rendered console: tab switching,
   order search + status filters, status/AWB updates, inline stock edits,
   product + coupon creation, and the login form. Talks to /api/admin/*.
   ========================================================================== */
(function () {
  const TOKEN_KEY = 'organichy.admin.token';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const token = () => sessionStorage.getItem(TOKEN_KEY) || '';
  async function api(path, opts = {}) {
    const res = await fetch(path, {
      method: opts.method || 'GET',
      headers: Object.assign(
        opts.body ? { 'Content-Type': 'application/json' } : {},
        token() ? { Authorization: `Bearer ${token()}` } : {}
      ),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
    });
    if (res.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY);
      location.href = '/admin';
      throw new Error('session expired');
    }
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('json') ? await res.json() : { ok: res.ok };
    if (!res.ok && !data.error) data.error = `Request failed (${res.status})`;
    return data;
  }

  let tEl;
  let timer;
  function flash(msg, kind) {
    if (!tEl) {
      tEl = document.createElement('div');
      tEl.className = 'toast';
      tEl.style.zIndex = '300';
      document.body.appendChild(tEl);
    }
    tEl.innerHTML = `<span>${esc(msg)}</span>`;
    tEl.classList.toggle('toast--err', kind === 'err');
    tEl.classList.add('is-on');
    clearTimeout(timer);
    timer = setTimeout(() => tEl.classList.remove('is-on'), 2600);
  }

  /* ------------------------------------------------------------------ */
  /* Login                                                              */
  /* ------------------------------------------------------------------ */
  const loginForm = $('[data-admin-login]');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('button[type="submit"]', loginForm);
      const pw = $('[name="password"]', loginForm);
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Checking…';
      }
      try {
        const data = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ password: pw.value }),
        }).then((r) => r.json());
        if (data.ok && data.token) {
          sessionStorage.setItem(TOKEN_KEY, data.token);
          location.href = '/admin';
        } else {
          flash(data.error || 'Wrong password', 'err');
          if (pw) {
            pw.classList.add('is-bad');
            pw.select();
          }
        }
      } catch (err) {
        flash('Could not reach the server', 'err');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Open the console';
        }
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Console                                                            */
  /* ------------------------------------------------------------------ */
  const admin = $('[data-admin]');
  if (!admin) return;

  // grab the token if the page was loaded after a redirect-based login
  const fromUrl = new URL(location.href).searchParams.get('token');
  if (fromUrl) sessionStorage.setItem(TOKEN_KEY, fromUrl);

  function setTab(name) {
    $$('.adm__tab').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === name));
    $$('.adm__panel').forEach((p) => p.classList.toggle('is-active', p.dataset.panel === name));
    const label = ($(`.adm__tab[data-tab="${name}"]`) || {}).textContent || 'Overview';
    const title = $('[data-admin-title]');
    if (title) title.textContent = label.trim();
    location.hash = name;
  }
  admin.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab && tab.classList.contains('adm__tab')) {
      e.preventDefault();
      setTab(tab.dataset.tab);
      return;
    }
    const jump = e.target.closest('[data-goto-tab]');
    if (jump) {
      e.preventDefault();
      setTab(jump.dataset.gotoTab);
      return;
    }
    if (e.target.closest('[data-admin-refresh]')) {
      location.reload();
      return;
    }
    if (e.target.closest('[data-admin-logout]')) {
      api('/api/admin/logout', { method: 'POST' }).then(() => {
        sessionStorage.removeItem(TOKEN_KEY);
        location.href = '/admin';
      });
      return;
    }
    const read1 = e.target.closest('[data-read-message]');
    if (read1) {
      api(`/api/admin/messages/${encodeURIComponent(read1.dataset.readMessage)}/read`, { method: 'POST' }).then(() => {
        const msg = read1.closest('.msg');
        if (msg) msg.classList.remove('is-new');
        read1.remove();
        flash('Marked as read');
      });
      return;
    }
    const saveP = e.target.closest('[data-save-product]');
    if (saveP) return saveProduct(saveP.dataset.saveProduct);
    const chip = e.target.closest('[data-filter-status]');
    if (chip) {
      $$('[data-filter-status]').forEach((c) => c.classList.toggle('is-active', c === chip));
      filterOrders();
    }
  });

  /* ------------------------------------------------------ order table --- */
  function filterOrders() {
    const status = ($('[data-filter-status].is-active') || {}).dataset ? $('[data-filter-status].is-active').dataset.filterStatus : 'all';
    const q = ($('[data-order-search]') || {}).value ? $('[data-order-search]').value.trim().toLowerCase() : '';
    let shown = 0;
    $$('[data-orders-table] tbody tr').forEach((tr) => {
      const okStatus = status === 'all' || tr.dataset.status === status;
      const okText = !q || (tr.dataset.search || '').includes(q);
      const on = okStatus && okText;
      tr.hidden = !on;
      if (on) shown += 1;
    });
    const label = $('.adm__panel[data-panel="orders"] .muted');
    if (label && q) flash(`${shown} order${shown === 1 ? '' : 's'} match`);
  }
  const search = $('[data-order-search]');
  if (search) search.addEventListener('input', () => filterOrders());

  admin.addEventListener('submit', async (e) => {
    const orderForm = e.target.closest('[data-order-form]');
    if (orderForm) {
      e.preventDefault();
      const id = orderForm.dataset.orderForm;
      const body = Object.fromEntries(new FormData(orderForm).entries());
      const res = await api(`/api/admin/orders/${encodeURIComponent(id)}/status`, { method: 'POST', body });
      if (res.ok) {
        const tr = orderForm.closest('tr');
        const pill = tr.querySelector('.pill');
        if (pill) {
          pill.textContent = res.order.status;
          pill.className = `pill pill--${res.order.status}`;
        }
        tr.dataset.status = res.order.status;
        const awbCell = tr.querySelector('.rowform input[name="awb"]');
        flash(`Order ${id} → ${res.order.status}. Customer notified.`);
        if (body.awb) {
          const cell = tr.children[6];
          if (cell) cell.innerHTML = `<code>${esc(body.awb)}</code><br><span class="muted">${esc(body.courier || 'Delhivery Surface')}</span>`;
        }
      } else flash(res.error || 'Could not update the order', 'err');
      return;
    }
    const newP = e.target.closest('[data-new-product]');
    if (newP) {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(newP).entries());
      const res = await api('/api/admin/products', { method: 'POST', body });
      formMsg(newP, res);
      if (res.ok) setTimeout(() => location.reload(), 700);
      return;
    }
    const newC = e.target.closest('[data-new-coupon]');
    if (newC) {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(newC).entries());
      const res = await api('/api/admin/coupons', { method: 'POST', body });
      formMsg(newC, res);
      if (res.ok) setTimeout(() => location.reload(), 700);
    }
  });

  function formMsg(form, res) {
    const el = $('[data-form-msg]', form);
    if (!el) return;
    el.textContent = res.ok ? 'Saved.' : res.error || 'Failed.';
    el.className = `form-msg ${res.ok ? 'is-ok' : 'is-err'}`;
    if (res.ok) form.reset();
  }

  /* --------------------------------------------------- product editor --- */
  async function saveProduct(productId) {
    const rows = $$(`[data-save-product="${productId}"]`).map((b) => b.closest('tr'));
    const variants = [];
    $$('[data-variant]').forEach((input) => {
      const tr = input.closest('tr');
      if (!rows.includes(tr)) return;
      const found = variants.find((v) => v.id === input.dataset.variant);
      const patch = found || { id: input.dataset.variant };
      patch[input.dataset.field] = Number(input.value) || 0;
      if (!found) variants.push(patch);
    });
    const toggles = {};
    const active = rows[0] && rows[0].querySelector('[data-toggle-active]');
    const featured = rows[0] && rows[0].querySelector('[data-toggle-featured]');
    if (active) toggles.active = active.checked;
    if (featured) toggles.featured = featured.checked;
    const res = await api(`/api/admin/products/${encodeURIComponent(productId)}`, { method: 'POST', body: { variants, ...toggles } });
    if (res.ok) {
      rows.forEach((tr) => tr.classList.add('is-flash'));
      setTimeout(() => rows.forEach((tr) => tr.classList.remove('is-flash')), 900);
      const total = (res.product.variants || []).reduce((s, v) => s + (Number(v.stock) || 0), 0);
      flash(`${res.product.name} saved · ${total} jars on hand`);
    } else flash(res.error || 'Could not save', 'err');
  }
  $$('[data-toggle-active], [data-toggle-featured]').forEach((cb) =>
    cb.addEventListener('change', () => saveProduct(cb.dataset.product))
  );

  /* keep the price × MRP row tidy while typing */
  admin.addEventListener('blur', (e) => {
    const input = e.target.closest('[data-field="price"], [data-field="mrp"], [data-field="stock"]');
    if (!input) return;
    const v = Math.max(input.dataset.field === 'stock' ? 0 : 1, Number(input.value) || 0);
    input.value = String(v);
  }, true);

  /* deep-link to a tab: /admin#orders */
  const initial = (location.hash || '#overview').slice(1);
  if (initial !== 'overview' && $(`.adm__panel[data-panel="${initial}"]`)) setTab(initial);
  admin.addEventListener('keydown', (e) => {
    if (!e.altKey) return;
    const n = Number(e.key);
    const tabs = ['overview', 'orders', 'products', 'coupons', 'inbox', 'notify'];
    if (n >= 1 && n <= tabs.length) {
      e.preventDefault();
      setTab(tabs[n - 1]);
    }
  });
})();
