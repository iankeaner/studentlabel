// Student Label Stripe Checkout Worker (Cloudflare Workers)
// Requires a secret named STRIPE_SECRET_KEY. Prices live here, never trusted from the browser.
// Product ids must match assets/products.js (school-slug + "-" + design).
const PRICE_CATALOG = {
  'uw-madison-beer': { name: 'BEER TEE — UW–Madison', price: 25.00 },
  'uw-madison-college': { name: 'COLLEGE TEE — UW–Madison', price: 25.00 },
  'uw-madison-sports': { name: 'SPORTS TEE — UW–Madison', price: 25.00 },
  'ut-austin-beer': { name: 'BEER TEE — UT Austin', price: 25.00 },
  'ut-austin-college': { name: 'COLLEGE TEE — UT Austin', price: 25.00 },
  'ut-austin-sports': { name: 'SPORTS TEE — UT Austin', price: 25.00 },
  'nvidia-procaffeination': { name: 'PROCAFFEINATION TEE — NVIDIA', price: 30.00 },
  'nvidia-engineer': { name: 'ENGINEER TEE — NVIDIA', price: 30.00 },
  'nvidia-beer-elements': { name: 'BEER (ELEMENTS) TEE — NVIDIA', price: 30.00 },
  'tmcc-beer': { name: 'BEER TEE — TMCC', price: 25.00 },
  'tmcc-college': { name: 'COLLEGE TEE — TMCC', price: 25.00 },
  'tmcc-sports': { name: 'SPORTS TEE — TMCC', price: 25.00 },
  'unc-chapel-hill-beer': { name: 'BEER TEE — UNC CHAPEL HILL', price: 25.00 },
  'unc-chapel-hill-college': { name: 'COLLEGE TEE — UNC CHAPEL HILL', price: 25.00 },
  'unc-chapel-hill-sports': { name: 'SPORTS TEE — UNC CHAPEL HILL', price: 25.00 },
  'ohio-state-beer': { name: 'BEER TEE — OHIO STATE', price: 25.00 },
  'ohio-state-college': { name: 'COLLEGE TEE — OHIO STATE', price: 25.00 },
  'ohio-state-sports': { name: 'SPORTS TEE — OHIO STATE', price: 25.00 },
  'texas-am-beer': { name: 'BEER TEE — TEXAS A&M', price: 25.00 },
  'texas-am-college': { name: 'COLLEGE TEE — TEXAS A&M', price: 25.00 },
  'texas-am-sports': { name: 'SPORTS TEE — TEXAS A&M', price: 25.00 },
};

const SUCCESS_URL = 'https://studentlabel.com/order-success/?session_id={CHECKOUT_SESSION_ID}';
const CANCEL_URL = 'https://studentlabel.com/cart/';
const ALLOWED_ORIGIN = 'https://studentlabel.com';

function cors() {
  return { 'Access-Control-Allow-Origin': ALLOWED_ORIGIN, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
}
function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors() } });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors() });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors() });

    let cart;
    try { cart = await request.json(); } catch (e) { return json({ error: 'Invalid cart data' }, 400); }
    if (!Array.isArray(cart) || cart.length === 0) return json({ error: 'Cart is empty' }, 400);

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', SUCCESS_URL);
    params.append('cancel_url', CANCEL_URL);
    params.append('allow_promotion_codes', 'true');

    let i = 0;
    cart.forEach((item) => {
      const entry = PRICE_CATALOG[item.id];
      if (!entry) return;
      const colorway = String(item.colorway || '').slice(0, 60);
      const size = String(item.size || '').slice(0, 10);
      const qty = Math.max(1, Math.min(20, parseInt(item.qty, 10) || 1));
      params.append(`line_items[${i}][price_data][currency]`, 'usd');
      params.append(`line_items[${i}][price_data][product_data][name]`, `${entry.name} — ${colorway} — Size ${size}`);
      params.append(`line_items[${i}][price_data][unit_amount]`, String(Math.round(entry.price * 100)));
      params.append(`line_items[${i}][quantity]`, String(qty));
      i++;
    });
    if (i === 0) return json({ error: 'No valid items in cart' }, 400);

    params.append('shipping_address_collection[allowed_countries][0]', 'US');

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const session = await res.json();
    if (!res.ok) return json({ error: session.error?.message || 'Stripe error' }, 500);
    return json({ url: session.url }, 200);
  },
};
