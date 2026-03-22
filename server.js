const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PORT = process.env.PORT || 8080;
const STATIC_DIR = __dirname;
const CHUNKS_DIR = path.join(__dirname, 'data', 'pi-chunks');
const PI_TXT = path.join(__dirname, 'data', 'pi.txt');
const DESIGNS_DIR = path.join(__dirname, 'uploads', 'designs');

// Ensure uploads dir exists
if (!fs.existsSync(DESIGNS_DIR)) fs.mkdirSync(DESIGNS_DIR, { recursive: true });

// ─── Printful helper ───

function printfulRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'api.printful.com',
      path: endpoint,
      method,
      headers: {
        'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`,
        'Content-Type': 'application/json',
      },
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);

    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve(body); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ─── Printful product mappings ───

const PRINTFUL_PRODUCTS = {
  tshirt: {
    productId: 71, // Bella+Canvas 3001
    variants: {
      'White-XS': 9526, 'White-S': 4011, 'White-M': 4012, 'White-L': 4013,
      'White-XL': 4014, 'White-2XL': 4015, 'White-3XL': 5294, 'White-4XL': 5309,
      'Black-XS': 9527, 'Black-S': 4016, 'Black-M': 4017, 'Black-L': 4018,
      'Black-XL': 4019, 'Black-2XL': 4020, 'Black-3XL': 5295, 'Black-4XL': 5310,
    },
    placements: { front: 'front', back: 'back' },
  },
  cap: {
    productId: 864, // Otto Cap 18-253
    variants: {
      'White-One Size': 22669,
      'Black-One Size': 22663,
    },
    placements: { front: 'embroidery_front' },
  },
};

const PRICE_CENTS = 3141; // $31.41

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// ─── Static file server ───

function serveStatic(req, res) {
  let filePath = path.join(STATIC_DIR, req.url.split('?')[0]);
  if (filePath.endsWith(path.sep) || filePath === STATIC_DIR) {
    filePath = path.join(STATIC_DIR, 'index.html');
  }
  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

// ─── KMP search ───

function buildFailure(pattern) {
  const fail = new Array(pattern.length).fill(0);
  let j = 0;
  for (let i = 1; i < pattern.length; i++) {
    while (j > 0 && pattern[i] !== pattern[j]) j = fail[j - 1];
    if (pattern[i] === pattern[j]) j++;
    fail[i] = j;
  }
  return fail;
}

function kmpSearch(text, pattern, fail, maxResults) {
  const results = [];
  let j = 0;
  for (let i = 0; i < text.length; i++) {
    while (j > 0 && text[i] !== pattern[j]) j = fail[j - 1];
    if (text[i] === pattern[j]) j++;
    if (j === pattern.length) {
      results.push(i - pattern.length + 1);
      if (results.length >= maxResults) return results;
      j = fail[j - 1];
    }
  }
  return results;
}

// ─── Chunk-based pi search ───

let chunkMeta = null;   // loaded once
let chunkFiles = [];    // sorted list of chunk file paths
let totalDigits = 0;

function loadChunkMeta() {
  const metaPath = path.join(CHUNKS_DIR, 'meta.json');
  if (fs.existsSync(metaPath)) {
    chunkMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    totalDigits = chunkMeta.totalDigits;

    // List chunk files in order
    chunkFiles = [];
    for (let i = 0; i < chunkMeta.chunkCount; i++) {
      const name = `chunk_${String(i).padStart(6, '0')}.txt`;
      const p = path.join(CHUNKS_DIR, name);
      if (fs.existsSync(p)) chunkFiles.push({ path: p, index: i });
    }
    console.log(`  Loaded ${chunkFiles.length} chunks, ${totalDigits.toLocaleString()} digits`);
    return true;
  }

  // No chunks — fall back to pi.txt as single "chunk"
  if (fs.existsSync(PI_TXT)) {
    const raw = fs.readFileSync(PI_TXT, 'utf8').replace(/[^0-9]/g, '');
    totalDigits = raw.length;
    chunkMeta = { totalDigits, chunkSize: raw.length, overlap: 0, chunkCount: 1 };
    chunkFiles = [{ path: PI_TXT, index: 0, preloaded: raw }];
    console.log(`  Using pi.txt as single chunk: ${totalDigits.toLocaleString()} digits`);
    return true;
  }

  console.log('  No pi data found. Run: node scripts/download-pi.js');
  return false;
}

function searchChunks(pattern, pairAligned) {
  if (!chunkMeta || chunkFiles.length === 0) return null;

  const fail = buildFailure(pattern);
  const chunkSize = chunkMeta.chunkSize;
  const overlap = chunkMeta.overlap;
  const step = chunkSize - overlap;
  const results = [];
  const maxResults = 100;
  const seen = new Set(); // deduplicate matches in overlap zones
  const startTime = Date.now();

  for (const cf of chunkFiles) {
    const chunkData = cf.preloaded || fs.readFileSync(cf.path, 'utf8');
    const chunkOffset = cf.index * step; // global digit offset of this chunk's start

    const localMatches = kmpSearch(chunkData, pattern, fail, maxResults * 2);

    for (const localPos of localMatches) {
      const globalPos = chunkOffset + localPos;

      // Skip duplicates from overlap zones
      if (seen.has(globalPos)) continue;
      seen.add(globalPos);

      // Pair alignment check: match must start at an even offset from decimal (position 1)
      // decimalAt = 1 for pi, so valid starts are 1, 3, 5, 7, ...
      if (pairAligned && globalPos >= 1 && (globalPos - 1) % 2 !== 0) continue;

      // Get context: 20 digits before and after
      let before = '', after = '';
      const beforeStart = Math.max(0, localPos - 20);
      before = chunkData.slice(beforeStart, localPos);
      const afterEnd = Math.min(chunkData.length, localPos + pattern.length + 20);
      after = chunkData.slice(localPos + pattern.length, afterEnd);

      results.push({
        position: globalPos,
        before,
        after,
      });

      if (results.length >= maxResults) break;
    }

    if (results.length >= maxResults) break;
  }

  const elapsed = Date.now() - startTime;
  return {
    found: results.length > 0,
    results,
    count: results.length,
    totalDigits,
    elapsed,
  };
}

// ─── Context fetcher (get N digits around a position) ───

function handlePiContext(posStr, radiusStr, res) {
  const pos = parseInt(posStr);
  const radius = parseInt(radiusStr) || 500;

  if (!chunkMeta || isNaN(pos) || pos < 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid position or no data' }));
    return;
  }

  const step = chunkMeta.chunkSize - chunkMeta.overlap;
  const chunkIdx = Math.min(Math.floor(pos / step), chunkFiles.length - 1);
  const cf = chunkFiles[chunkIdx];
  const chunkData = cf.preloaded || fs.readFileSync(cf.path, 'utf8');
  const chunkOffset = chunkIdx * step;

  const localPos = pos - chunkOffset;
  const localStart = Math.max(0, localPos - radius);
  const localEnd = Math.min(chunkData.length, localPos + radius);

  const digits = chunkData.slice(localStart, localEnd);
  const globalStart = chunkOffset + localStart;
  const matchOffset = pos - globalStart;

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ digits, start: globalStart, matchOffset, totalDigits }));
}

// ─── Digit fetcher (get N digits from offset) ───

function handlePiDigits(offsetStr, countStr, res) {
  const offset = parseInt(offsetStr) || 0;
  const count = Math.min(parseInt(countStr) || 10000, 100000);

  if (!chunkMeta || offset < 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid offset or no data' }));
    return;
  }

  if (offset >= totalDigits) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ digits: '', offset, totalDigits }));
    return;
  }

  const step = chunkMeta.chunkSize - chunkMeta.overlap;
  let result = '';
  let pos = offset;
  const end = Math.min(offset + count, totalDigits);

  while (pos < end) {
    const chunkIdx = Math.min(Math.floor(pos / step), chunkFiles.length - 1);
    const cf = chunkFiles[chunkIdx];
    const chunkData = cf.preloaded || fs.readFileSync(cf.path, 'utf8');
    const chunkOffset = chunkIdx * step;
    const localPos = pos - chunkOffset;
    const available = Math.min(chunkData.length - localPos, end - pos);
    result += chunkData.slice(localPos, localPos + available);
    pos += available;
    if (available <= 0) break;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ digits: result, offset, totalDigits }));
}

// ─── API handler ───

function handlePiSearch(query, pairAligned, res) {
  if (!query || !/^\d+$/.test(query)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Query must be digits only' }));
    return;
  }

  const result = searchChunks(query, pairAligned);
  if (!result) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'No pi data loaded. Run: node scripts/download-pi.js' }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result));
}

// ─── Read POST body ───

function readBody(req, maxSize = 50 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > maxSize) { req.destroy(); reject(new Error('Body too large')); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function jsonResponse(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ─── Upload design images ───

function handleUploadDesign(req, res) {
  readBody(req).then(buf => {
    const body = JSON.parse(buf.toString());
    const { orderId, designs } = body;
    // designs: { front: 'data:image/png;base64,...', back: '...' }

    if (!orderId || !designs) {
      return jsonResponse(res, 400, { error: 'Missing orderId or designs' });
    }

    const urls = {};
    for (const [key, dataUrl] of Object.entries(designs)) {
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const ext = dataUrl.startsWith('data:image/jpeg') ? 'jpg' : 'png';
      const fileName = `${orderId}_${key}.${ext}`;
      fs.writeFileSync(path.join(DESIGNS_DIR, fileName), base64, 'base64');
      urls[key] = `/uploads/designs/${fileName}`;
    }

    jsonResponse(res, 200, { urls });
  }).catch(err => {
    console.error('Upload error:', err);
    jsonResponse(res, 500, { error: 'Upload failed' });
  });
}

// ─── Create Stripe Checkout Session ───

async function handleCheckout(req, res) {
  try {
    const buf = await readBody(req);
    const body = JSON.parse(buf.toString());
    const { items } = body;
    // items: [{ product, colorName, size, word, designUrls: { front, back? } }]

    if (!items || items.length === 0) {
      return jsonResponse(res, 400, { error: 'No items' });
    }

    const siteUrl = process.env.SITE_URL || `http://localhost:${PORT}`;

    const lineItems = items.map(item => {
      const productData = {
        name: `${item.productLabel} — "${item.word}"`,
        description: `${item.colorName}, ${item.size} | Your Place in π`,
      };
      // Add mockup image (design on shirt) for Stripe checkout display
      if (item.mockupUrl) {
        productData.images = [siteUrl + item.mockupUrl];
      } else if (item.designUrls?.front) {
        productData.images = [siteUrl + item.designUrls.front];
      }
      return {
        price_data: {
          currency: 'usd',
          product_data: productData,
          unit_amount: PRICE_CENTS,
        },
        quantity: 1,
      };
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IN', 'JP'],
      },
      metadata: {
        order_items: JSON.stringify(items.map(i => ({
          product: i.product,
          color: i.colorName,
          size: i.size,
          word: i.word,
          designUrls: i.designUrls,
        }))),
      },
      success_url: `${siteUrl}?checkout=success`,
      cancel_url: `${siteUrl}?checkout=cancel`,
    });

    jsonResponse(res, 200, { url: session.url });
  } catch (err) {
    console.error('Checkout error:', err.message);
    jsonResponse(res, 500, { error: err.message });
  }
}

// ─── Stripe Webhook → Printful Order ───

async function handleStripeWebhook(req, res) {
  try {
    const buf = await readBody(req);
    const sig = req.headers['stripe-signature'];

    // In production, verify webhook signature with endpoint secret
    // const event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
    const event = JSON.parse(buf.toString());

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const shipping = session.shipping_details || session.customer_details;
      const items = JSON.parse(session.metadata.order_items || '[]');
      const siteUrl = process.env.SITE_URL || `http://localhost:${PORT}`;

      console.log(`\n✓ Payment received! Order for ${items.length} item(s)`);

      // Submit each item to Printful
      for (const item of items) {
        const productMap = PRINTFUL_PRODUCTS[item.product];
        if (!productMap) { console.error('Unknown product:', item.product); continue; }

        const variantKey = `${item.color}-${item.size}`;
        const variantId = productMap.variants[variantKey];
        if (!variantId) { console.error('Unknown variant:', variantKey); continue; }

        const printfulItem = {
          variant_id: variantId,
          quantity: 1,
          files: [],
        };

        // Add design files
        if (item.designUrls?.front) {
          printfulItem.files.push({
            type: productMap.placements.front,
            url: siteUrl + item.designUrls.front,
          });
        }
        if (item.designUrls?.back && productMap.placements.back) {
          printfulItem.files.push({
            type: productMap.placements.back,
            url: siteUrl + item.designUrls.back,
          });
        }

        const order = {
          recipient: {
            name: shipping?.name || 'Customer',
            address1: shipping?.address?.line1 || '',
            address2: shipping?.address?.line2 || '',
            city: shipping?.address?.city || '',
            state_code: shipping?.address?.state || '',
            country_code: shipping?.address?.country || '',
            zip: shipping?.address?.postal_code || '',
          },
          items: [printfulItem],
        };

        console.log('Submitting to Printful:', JSON.stringify(order, null, 2));
        const result = await printfulRequest('POST', '/orders', order);
        console.log('Printful response:', JSON.stringify(result, null, 2));
      }
    }

    jsonResponse(res, 200, { received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    jsonResponse(res, 400, { error: err.message });
  }
}

// ─── Server ───

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);

  // ── Shop API ──
  if (req.method === 'POST' && parsed.pathname === '/api/upload-design') {
    handleUploadDesign(req, res);
    return;
  }
  if (req.method === 'POST' && parsed.pathname === '/api/checkout') {
    handleCheckout(req, res);
    return;
  }
  if (req.method === 'POST' && parsed.pathname === '/api/stripe-webhook') {
    handleStripeWebhook(req, res);
    return;
  }

  // ── Serve uploaded designs ──
  if (parsed.pathname.startsWith('/uploads/designs/')) {
    const filePath = path.join(__dirname, parsed.pathname);
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(fs.readFileSync(filePath));
      return;
    }
  }

  if (parsed.pathname === '/api/pisearch') {
    const q = parsed.query.q;
    const pairAligned = parsed.query.aligned === '1';
    handlePiSearch(q, pairAligned, res);
    return;
  }

  if (parsed.pathname === '/api/picontext') {
    handlePiContext(parsed.query.pos, parsed.query.radius, res);
    return;
  }

  if (parsed.pathname === '/api/pidigits') {
    handlePiDigits(parsed.query.offset, parsed.query.count, res);
    return;
  }

  if (parsed.pathname === '/api/pistatus') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ready: chunkMeta !== null,
      totalDigits,
      chunkCount: chunkFiles.length,
      chunkSize: chunkMeta?.chunkSize || 0,
    }));
    return;
  }

  serveStatic(req, res);
});

// Boot
console.log('piMap server starting...');
console.log('Loading pi digit chunks...');
loadChunkMeta();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\npiMap server running at http://localhost:${PORT}`);
  console.log(`Search API: http://localhost:${PORT}/api/pisearch?q=14159`);
  console.log(`Status API: http://localhost:${PORT}/api/pistatus`);
});
