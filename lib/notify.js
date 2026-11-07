'use strict';
/**
 * lib/notify.js — the notification queue.
 *
 * Every order event is written to data/notifications.json and shown on the
 * admin Overview so nothing is silently dropped in demo mode. Wiring real
 * delivery is intentionally a 5-line change, not an architecture: uncomment the
 * blocks below, add the keys to .env, done.
 */
const db = require('./db');
const config = require('./config');
const { money, weekdayDate, addDays } = require('./util');

function queue(entry) {
  const record = {
    id: db.newId('n'),
    createdAt: new Date().toISOString(),
    status: 'queued',
    ...entry,
  };
  db.addNotification(record);
  // eslint-disable-next-line no-console
  console.log(`[notify] ${record.kind} → ${record.to || 'admin'} (${record.channel})`);
  return record;
}

function orderSummary(order) {
  const items = (order.items || [])
    .map((l) => `${l.qty} × ${l.name} (${l.variant})`)
    .join(', ');
  return `Order ${order.id}
${items}
Items ${money(order.subtotal)}${order.discount ? ` · coupon ${order.coupon} −${money(order.discount)}` : ''}
Delivery ${order.shippingFee ? money(order.shippingFee) : 'FREE'}${order.codFee ? ` · COD handling ${money(order.codFee)}` : ''}
Total ${money(order.total)}
Deliver to: ${order.customer.address}, ${order.customer.city}, ${order.customer.state} ${order.customer.pincode}`;
}

function onOrderCreated(order) {
  const subject = `ORGANICHY order ${order.id} confirmed`;
  const body = `Hi ${order.customer.name.split(' ')[0]},

Thanks for ordering! We pack within 24 hours on business days (${config.shipping.dispatchDays}) and you will get a tracking link the moment the courier picks up your box.

${orderSummary(order)}

Expected delivery: ${weekdayDate(addDays(config.shipping.etaMinDays + 2))} or a day either side.
Questions? WhatsApp ${config.brand.phoneDisplay} — a human reads it.

— Team ORGANICHY, ${config.brand.city}`;

  queue({
    channel: order.payment === 'cod' ? 'whatsapp' : 'email',
    kind: 'order.created',
    to: order.payment === 'cod' ? order.customer.phone : order.customer.email,
    subject,
    body,
    orderId: order.id,
  });
  queue({
    channel: 'admin',
    kind: 'order.created.admin',
    to: config.brand.email,
    subject: `New order ${order.id} — ${money(order.total)} (${order.payment === 'cod' ? 'COD' : 'prepaid'})`,
    body: `${order.customer.name} · ${order.customer.phone} · ${order.customer.city} ${order.customer.pincode}\n${orderSummary(order)}`,
    orderId: order.id,
  });
}

const STATUS_COPY = {
  packed: 'Your jar is boxed and sealed in Moradabad. Courier pickup is usually tomorrow morning.',
  shipped: 'The courier has your parcel. Track it any time from My Account with your order ID.',
  delivered: 'Delivered! If anything looks off, photograph it and WhatsApp us within 48 hours — we replace it.',
  cancelled: 'Your order was cancelled. Anything prepaid is refunded to the source account in 3–5 working days.',
};

function onOrderStatus(order, status, note) {
  const body = `Hi ${order.customer.name.split(' ')[0]},

Order ${order.id} update: ${String(status).toUpperCase()}.
${STATUS_COPY[status] || ''}
${note ? `\nNote from us: ${note}` : ''}
${order.awb ? `\nConsignment note (AWB): ${order.awb} via ${order.courier || 'our courier'}.\n` : ''}
— Team ORGANICHY`;

  queue({
    channel: 'email',
    kind: `order.${status}`,
    to: order.customer.email,
    subject: `Order ${order.id} — ${status}`,
    body,
    orderId: order.id,
  });
  if (order.customer.phone) {
    queue({
      channel: 'whatsapp',
      kind: `order.${status}.whatsapp`,
      to: order.customer.phone,
      subject: `Order ${order.id}: ${status}`,
      body: `ORGANICHY ${status}: order ${order.id}. ${STATUS_COPY[status] || ''}`.replace(/\s+/g, ' ').trim(),
      orderId: order.id,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Real delivery — uncomment when the client supplies keys.            */
/* ------------------------------------------------------------------ */
/*
async function sendEmail({ to, subject, body }) {
  // Node 18+ has fetch built in; for SMTP use any provider (Resend shown here).
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `ORGANICHY <${config.brand.email}>`,
      to: [to],
      subject,
      text: body,
    }),
  });
  if (!res.ok) throw new Error(`email failed: ${res.status} ${await res.text()}`);
}

async function sendWhatsApp({ to, body }) {
  const res = await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: String(to).replace(/\D/g, ''), type: 'text', text: { body } }),
  });
  if (!res.ok) throw new Error(`whatsapp failed: ${res.status} ${await res.text()}`);
}
*/

function deliver(record) {
  // Hook point: route to sendEmail / sendWhatsApp once keys exist.
  return record;
}

module.exports = { onOrderCreated, onOrderStatus, orderSummary, queue, deliver };
