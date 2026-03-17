const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'trueprice-admin';
const STORE_PATH = path.join(__dirname, 'data', 'store.json');

function readStore() {
  return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
}

function writeStore(store) {
  store.updated_at = new Date().toISOString();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
  });
}

function authAdmin(req) {
  return req.headers['x-admin-password'] === ADMIN_PASSWORD;
}

function normalize(text = '') {
  return text.toLowerCase().replace(/гб/g, 'gb').replace(/\s+/g, ' ').trim();
}

function findProduct(store, q) {
  const n = normalize(q);
  const products = store.products.filter((p) => p.active);
  for (const p of products) {
    if (p.aliases.some((a) => n.includes(a))) return { p, approx: false };
  }
  for (const p of products) {
    if (p.aliases.some((a) => n.split(' ').some((w) => w.length > 3 && a.includes(w)))) return { p, approx: true };
  }
  return { p: products[0], approx: true };
}

function round(n) { return Math.round(n); }

function calculate(store, p) {
  const rates = store.rates;
  const customs = store.customs;
  const deDelivery = store.delivery.find((d) => d.route.includes('Amazon.de'));
  const usDelivery = store.delivery.find((d) => d.route.includes('Amazon.com'));
  const deliveryDeAzn = deDelivery.cost * rates[deDelivery.currency];
  const deliveryUsAzn = usDelivery.cost * rates[usDelivery.currency];

  const localOfficial = p.prices.kontakt;
  const localTap = p.prices.tap_private;
  const localAvg = round((p.prices.kontakt + p.prices.irshad) / 2);
  const tapAvg = round((p.prices.tap_business + p.prices.tap_private) / 2);

  const deBaseEur = p.prices.amazon_de + deDelivery.cost;
  const deBaseAzn = deBaseEur * rates.EUR;
  const deDuty = deBaseEur > customs.de_minimis_eur ? deBaseAzn * customs.duty_pct / 100 : 0;
  const deVat = deBaseEur > customs.de_minimis_eur ? (deBaseAzn + deDuty) * customs.vat_pct / 100 : 0;
  const deTotal = round(deBaseAzn + deDuty + deVat);

  const usBaseUsd = p.prices.amazon_us + usDelivery.cost;
  const usBaseAzn = usBaseUsd * rates.USD;
  const usDuty = usBaseUsd / 1.1 > customs.de_minimis_eur ? usBaseAzn * customs.duty_pct / 100 : 0;
  const usVat = usBaseUsd / 1.1 > customs.de_minimis_eur ? (usBaseAzn + usDuty) * customs.vat_pct / 100 : 0;
  const usTotal = round(usBaseAzn + usDuty + usVat);

  const dubaiAzn = p.prices.dubai_eur * rates.EUR;
  const dubaiDuty = p.prices.dubai_eur > customs.personal_limit_eur ? (p.prices.dubai_eur - customs.personal_limit_eur) * rates.EUR * customs.duty_pct / 100 : 0;
  const dubaiTotal = round(dubaiAzn + dubaiDuty);

  const trAzn = p.prices.turkey_try * rates.TRY;
  const vatRefund = trAzn * 0.18 / 1.18;
  const trTotal = round(trAzn - vatRefund);

  const options = [
    { key: 'local', source: 'Официальный ритейл', total: localOfficial },
    { key: 'tap', source: 'Tap.az — вторичный рынок', total: localTap },
    { key: 'de', source: 'Amazon.de → карго → Баку', total: deTotal },
    { key: 'us', source: 'Amazon.com → форвардинг → Баку', total: usTotal },
    { key: 'dubai', source: '🇦🇪 Дубай — Amazon.de / магазин', total: dubaiTotal },
    { key: 'tr', source: '🇹🇷 Турция — Apple Store İstanbul', total: trTotal }
  ];

  const best = [...options].sort((a, b) => a.total - b.total)[0];
  const localBest = Math.min(localOfficial, localTap);
  const savings = Math.max(0, localBest - best.total);

  return {
    product: { display_name: p.display_name, specs: p.specs, updated_at: store.updated_at },
    verdict: {
      text: `→ ${best.source} — выгоднее всего`,
      sub_text: `Экономия ${savings} AZN относительно лучшей локальной цены.`,
      savings_azn: savings,
      savings_pct: localBest ? Math.round((savings / localBest) * 100) : 0,
      best_key: best.key
    },
    rates,
    sections: {
      local: {
        official: { kontakt: p.prices.kontakt, irshad: p.prices.irshad, avg: localAvg, total: localOfficial },
        tap: { business: p.prices.tap_business, private: p.prices.tap_private, avg: tapAvg, count: p.prices.tap_count, total: localTap }
      },
      parcel: {
        de: { price_eur: p.prices.amazon_de, delivery_azn: round(deliveryDeAzn), duty_azn: round(deDuty), total: deTotal },
        us: { price_usd: p.prices.amazon_us, delivery_azn: round(deliveryUsAzn), duty_azn: round(usDuty), total: usTotal }
      },
      carry: {
        dubai: { price_eur: p.prices.dubai_eur, total: dubaiTotal },
        turkey: { price_try: p.prices.turkey_try, vat_refund_azn: round(vatRefund), total: trTotal }
      }
    }
  };
}

function serveFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    return res.end('Not found');
  }
  const ext = path.extname(filePath);
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
  };
  res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain; charset=utf-8' });
  res.end(fs.readFileSync(filePath));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/search' && req.method === 'GET') {
    const store = readStore();
    const q = url.searchParams.get('q') || 'iPhone 16 Pro 256GB';
    const country = (url.searchParams.get('country') || 'az').toLowerCase();
    const activeCountry = store.countries.find((c) => c.code === country && c.status === 'active');
    if (!activeCountry) return sendJson(res, 400, { error: 'Country not supported yet' });
    const found = findProduct(store, q);
    const result = calculate(store, found.p);
    result.match = { approximate: found.approx };
    return sendJson(res, 200, result);
  }

  if (url.pathname === '/api/rates' && req.method === 'GET') {
    const store = readStore();
    return sendJson(res, 200, { rates: store.rates, updated_at: store.updated_at });
  }

  if (url.pathname === '/api/admin/config' && req.method === 'GET') {
    if (!authAdmin(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    const store = readStore();
    return sendJson(res, 200, store);
  }

  if (url.pathname.startsWith('/api/admin/') && req.method === 'POST') {
    if (!authAdmin(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    const body = await parseBody(req);
    const store = readStore();

    if (url.pathname === '/api/admin/chips') store.chips = body.chips || store.chips;
    if (url.pathname === '/api/admin/countries') store.countries = body.countries || store.countries;
    if (url.pathname === '/api/admin/customs') store.customs = { ...store.customs, ...body.customs };
    if (url.pathname === '/api/admin/delivery') store.delivery = body.delivery || store.delivery;
    if (url.pathname === '/api/admin/sku') store.products = body.products || store.products;

    writeStore(store);
    return sendJson(res, 200, { ok: true, updated_at: store.updated_at });
  }

  if (url.pathname === '/' || url.pathname === '/index.html') return serveFile(res, path.join(__dirname, 'index.html'));
  if (url.pathname === '/results' || url.pathname === '/results.html') return serveFile(res, path.join(__dirname, 'results.html'));
  if (url.pathname === '/admin' || url.pathname === '/admin.html') return serveFile(res, path.join(__dirname, 'admin.html'));

  const staticPath = path.join(__dirname, url.pathname.replace(/^\//, ''));
  if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) return serveFile(res, staticPath);

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`TruePrice MVP running on http://localhost:${PORT}`);
});
