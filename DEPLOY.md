# Deploying ORGANICHY

Everything below assumes the app runs with `node server.js` and no build step.
Pick one path. The Render route is the one the client can maintain alone.

---

## 0. Before any deploy

```bash
cp .env.example .env            # then edit
node server.js                  # sanity check locally
npm test                        # 60 acceptance checks, boots its own server
```

Decide the datastore question first, because it decides the platform:

| | orders survive a redeploy? | cost |
|---|---|---|
| Render free plan | **no** — ephemeral disk, data resets on deploy/sleep | ₹0 |
| Render Starter + 1 GB disk (`render.yaml`) | yes | ~₹600/mo |
| VPS with a data directory | yes | ₹500–800/mo |
| Postgres (Render/Neon/RDS) + `lib/db.js` rewrite | yes | ₹0–700/mo |

Never take real orders on the free tier. Use it to show the client the site.

---

## 1. GitHub → Render (recommended)

```bash
cd organichy
git init -b main
git add -A && git commit -m "ORGANICHY — storefront, admin, deploy config"
gh repo create organichy --private --source=. --push      # or push to a repo you made in the UI
```

1. [render.com](https://render.com) → **New +** → **Blueprint** → authorise and pick the repo.
   Render reads [`render.yaml`](render.yaml) and previews: web service, Node runtime,
   `plan: starter`, empty build command, `node server.js`, health check `/api/health`,
   1 GB disk at `/var/data/organichy`.
2. It will prompt for the `sync: false` secrets: **`ADMIN_PASSWORD`** (required),
   `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`. Leave the Razorpay ones blank to stay in
   demo mode.
3. **Apply** → first deploy. Watch the log for:
   ```
   [db] seeded 7 collections into /var/data/organichy/
   ORGANICHY 1.0.0 — listening on http://localhost:10000
   ```
4. Open `https://<name>.onrender.com/api/health` → `{"ok":true,…}`.

**Env vars are the only edits you should make in the dashboard** — anything changed by
hand drifts from `render.yaml`. Keep the blueprint as the source of truth and edit the file.

### Custom domain
Render → your service → **Settings → Custom Domains** → add `organichy.in`
(also add `www`). At your registrar create `A` → `216.24.39.161` (Render asks you to
point `CNAME` at `.<region>.onrender.com` for `www`). Auto-SSL issues in a minute.
Then set `SITE_URL=https://organichy.in`, redeploy, and re-run
`curl -s https://organichy.in/sitemap.xml | head` to confirm the canonical URLs flipped.

### Backups
Orders are JSON files in the disk mount. Nightly, from any cron:

```bash
curl -s -H "Authorization: Bearer $TOKEN" https://organichy.in/api/admin/orders.csv > orders-$(date +%F).csv
```
Or shell in (Render → Service → Shell) and `tar czf - /var/data/organichy | pbcopy`.
`POST /api/admin/login` with `Accept: application/json` mints a token if you need one.

---

## 2. Railway (fine for a demo, disk is not persistent by default)

```bash
npm i -g @railway/cli && railway login
railway init && railway up
railway variables set ADMIN_PASSWORD=… SITE_URL=…
```
Railway builds with `Dockerfile` (there is no `railway.json` in the repo). Add a
**Volume** service and mount it at `/app/data`, then set `DATA_DIR=/app/data` —
otherwise the same reset problem as Render free tier applies.

---

## 3. Fly.io (persistent volume, ~₹250/mo at the smallest size)

```bash
fly launch --no-deploy                       # reads Dockerfile
fly volumes create organichy_data --size 1 --region bom1
fly secrets set ADMIN_PASSWORD=… DATA_DIR=/data SITE_URL=https://organichy.fly.dev
```
`fly.toml` needs:
```toml
[mounts]
  source = "organichy_data"
  destination = "/data"
```
`fly deploy`. The `Dockerfile` already `VOLUME`s `/app/data`; setting
`DATA_DIR=/data` points the app at the mount instead.

---

## 4. VPS + nginx + Certbot (cheapest to run, most to maintain)

On a 1 GB Hetzner/DO/OVH box (Ubuntu 22.04):

```bash
# system + Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs git
adduser --disabled-password --gecos "" organichy && sudo loginctl enable-linger organichy

# app
sudo -u organichy git clone https://github.com/<you>/organichy /home/organichy/app
sudo -u organichy mkdir -p /home/organichy/app/.env && sudo -u organichy nano /home/organichy/app/.env
```

`/etc/systemd/system/organichy.service`:
```ini
[Unit]
Description=ORGANICHY storefront
After=network.target

[Service]
User=organichy
WorkingDirectory=/home/organichy/app
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production PORT=3000 HOST=127.0.0.1
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=read-only
ProtectSystem=strict
ReadWritePaths=/home/organichy/app/data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now organichy && systemctl status organichy --no-pager
```

`/etc/nginx/sites-available/organichy`:
```nginx
server {
    listen 80;
    server_name organichy.in www.organichy.in;

    access_log /var/log/nginx/organichy.access.log;
    client_max_body_size 1m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;   # rate limiting keys on this
        proxy_read_timeout 60s;
    }
    # the app sets its own CSP/HSTS-safe headers; nginx only adds compression
    gzip on;
    gzip_types text/css application/javascript image/svg+xml application/json;
    gzip_min_length 1024;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/organichy /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d organichy.in -d www.organichy.in --redirect -m you@organichy.in --agree-tos
```

**Deploys** are `git pull && sudo systemctl restart organichy` — no install step, so
they take two seconds and cannot break on a lockfile.

---

## 5. Post-deploy verification

```bash
BASE=https://organichy.in
for p in / /shop /product/classic-creamy-peanut-butter /faqs /contact /cart /checkout \
         /account /terms /admin /sitemap.xml /robots.txt /api/health /api/products; do
  printf '%s  %s\n' "$(curl -s -o /dev/null -w '%{http_code}' $BASE$p)" "$p"
done
curl -s $BASE/api/health | head -c 300            # db counts + payments mode
curl -s -X POST $BASE/api/cart/price -H 'content-type: application/json' \
  -d '{"items":[{"productId":"p-creamy","variant":"500 g","qty":2}],"coupon":"ORGANICHY10","payment":"cod"}'
# → subtotal 1098, discount 110, shippingFee 0, codFee 29, total 1017
```

Then the human pass: add to cart → apply `ORGANICHY10` → checkout with COD →
copy the order ID → track it at `/account` with the phone number → change the
status to *shipped* in `/admin` and confirm the timeline and AWB appear on the
customer page. On mobile, check 390px (sticky buy bar, drawer), 768px and 1440px.

### If `/admin` keeps showing the login card

The password is usually right — the browser refused to keep the `oh_admin` cookie
(embedded preview, cookie blocking, `SameSite` hardening). The console then rides the
token instead: a successful login hands back `redirect: "/admin?token=…"` and that URL
needs no cookie at all. From a shell:

```bash
T=$(curl -s -X POST $BASE/api/admin/login -H 'content-type: application/json' \
    -H 'accept: application/json' -d '{"password":"…"}' | sed -n 's/.*"token":"\([a-f0-9]*\)".*/\1/p')
curl -s "$BASE/admin?token=$T" | grep -c adm__panel        # → 6 panels
curl -s "$BASE/api/admin/orders.csv?token=$T" | head -2    # export without a cookie jar
```

Only *wrong* passwords are rate limited (`ADMIN_LOGIN_ATTEMPTS`, 10 per 5 minutes) and
the card counts them down, so a correct password can never lock the owner out.
`ADMIN_SESSION_HOURS` sets how long a login stays valid.

---

## 6. Razorpay, live

1. Get `key_id` / `key_secret` from the Razorpay dashboard after KYC.
2. Set both as env vars. Presence of both flips `config.payments.mode` to `live`;
   nothing else changes.
3. `POST /api/payment/create` calls `POST https://api.razorpay.com/v1/orders`;
   `public/js/main.js` opens `window.Razorpay` when the checkout response carries a
   `razorpay` block. Load Razorpay's script tag in `lib/views/cart.js` if you want
   the checkout sheet (it is not loaded in demo mode on purpose).
4. After the payment, `POST /api/payment/verify` HMAC-checks
   `orderId|paymentId` with the key secret before an order is marked paid.
5. Add the dashboard webhook → `https://<domain>/api/payment/verify` (Razorpay
   signs with `X-Razorpay-Signature`; verify the same HMAC and flip
   `paymentStatus` there rather than trusting the browser callback).

## 7. Notifications, live

`lib/notify.js` has the two real senders commented out. Uncomment `sendEmail`
(Resend or any SMTP), `sendWhatsApp` (WhatsApp Cloud API), and `await` them from
`deliver()`. Keys go in the env. Until then every message is written to
`data/notifications.json` and shown in **Admin → Notifications**, which is honest for
a launch week and enough to demo the flow.

## 8. Rollback

Every platform above is one command: Render → *Images* → deploy a previous commit;
VPS → `git checkout <sha> && systemctl restart organichy`. Data is not in the image,
so a rollback never touches orders. If a bad deploy corrupted `data/*.json`, restore
the last nightly CSV/tar and restart — the JSON files are human-readable and
hand-editable.
