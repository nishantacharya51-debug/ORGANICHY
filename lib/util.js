'use strict';
/** Small shared helpers — HTML escaping, Indian currency formatting, dates. */

const config = require('./config');

/** Escape anything before it touches HTML. */
function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape for inside a <script> JSON block. */
function jsonForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** 1234567 -> "12,34,567" (lakh grouping, not thousand grouping). */
function groupIndian(n) {
  const neg = n < 0;
  const s = String(Math.abs(Math.round(n)));
  let out = s;
  if (s.length > 3) {
    const last3 = s.slice(-3);
    let rest = s.slice(0, -3);
    const parts = [];
    while (rest.length > 2) {
      parts.unshift(rest.slice(-2));
      rest = rest.slice(0, -2);
    }
    if (rest) parts.unshift(rest);
    out = parts.join(',') + ',' + last3;
  }
  return (neg ? '-' : '') + out;
}

/** Rupees, no paise — the store prices in whole rupees. */
function money(n) {
  return `${config.pricing.currency}${groupIndian(Number(n) || 0)}`;
}
function plain(n) {
  return groupIndian(Number(n) || 0);
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dateFmt(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function dateTimeFmt(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${dateFmt(d)}, ${hh}:${mm}`;
}
function timeAgo(input) {
  const d = new Date(input).getTime();
  if (Number.isNaN(d)) return '';
  const secs = Math.max(1, Math.round((Date.now() - d) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return dateFmt(d);
}
function addDays(days, from = new Date()) {
  const d = new Date(from.getTime());
  d.setDate(d.getDate() + days);
  return d;
}
function weekdayDate(input) {
  const d = input instanceof Date ? input : new Date(input);
  return `${WEEKDAYS[d.getDay()]}, ${dateFmt(d)}`;
}

/** Deterministic ETA from a pincode so the demo never looks random-refreshed. */
function estimatePincode(pincode) {
  const raw = String(pincode || '').replace(/\D/g, '');
  if (raw.length !== 6) return { ok: false, reason: 'Enter a valid 6-digit Indian pincode.' };
  const sum = raw.split('').reduce((a, c) => a + Number(c), 0);
  const metro = ['201', '110', '400', '560', '600', '700', '380', '302', '226', '244'].includes(raw.slice(0, 3));
  const remote = ['73', '74', '75', '79', '85', '19', '18'].includes(raw.slice(0, 2));
  let days = metro ? 2 + (sum % 2) : remote ? 6 + (sum % 3) : 3 + (sum % 3);
  days = Math.min(config.shipping.etaMaxDays + (remote ? 3 : 0), Math.max(config.shipping.etaMinDays, days));
  return {
    ok: true,
    pincode: raw,
    days,
    from: config.shipping.etaMinDays === 2 ? 2 : config.shipping.etaMinDays,
    window: `${days}–${days + 2} days`,
    date: addDays(days),
    metro,
    remote,
    note: remote
      ? 'Remote route — our courier runs this pincode on a weekly sweep, so we add a day or two of buffer.'
      : metro
        ? 'Metro route — usually lands in 2 days from dispatch.'
        : 'Regular service route.',
  };
}

/** Tiny CSV writer for the admin order export. */
function toCsv(rows, columns) {
  const cols = columns || (rows[0] ? Object.keys(rows[0]) : []);
  const cell = (v) => {
    const s = v === null || v === undefined ? '' : Array.isArray(v) ? v.join(' | ') : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n');
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/** Join class tokens, dropping empties so we never emit class="a  b". */
function cls(...parts) {
  return parts.flat().filter(Boolean).join(' ');
}

module.exports = {
  cls,
  esc,
  jsonForScript,
  money,
  plain,
  groupIndian,
  slugify,
  dateFmt,
  dateTimeFmt,
  timeAgo,
  addDays,
  weekdayDate,
  estimatePincode,
  toCsv,
  clamp,
  MONTHS,
};
