const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
require('dotenv').config();

// Lazy-init Stripe to avoid crash if env var isn't ready at module load
let stripe = null;
function getStripe() {
  if (!stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not set');
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

const PORT = process.env.PORT || 8080;
const STATIC_DIR = __dirname;
// Prefer persistent volume for chunks so they survive redeploys
const CHUNKS_DIR = process.env.PERSIST_DIR
  ? path.join(process.env.PERSIST_DIR, 'pi-chunks')
  : path.join(__dirname, 'data', 'pi-chunks');
const PI_TXT = path.join(__dirname, 'data', 'pi.txt');

// Persistent data directory — set PERSIST_DIR to a Railway Volume mount for durability
const PERSIST_DIR = process.env.PERSIST_DIR || path.join(__dirname, 'persist');
const DESIGNS_DIR = path.join(PERSIST_DIR, 'designs');
const ORDERS_DIR = path.join(PERSIST_DIR, 'orders');
const MOCKUPS_DIR = path.join(PERSIST_DIR, 'mockups');

// Ensure dirs exist — retry briefly in case volume mount is still attaching
function ensureDirs() {
  for (const dir of [DESIGNS_DIR, ORDERS_DIR, MOCKUPS_DIR]) {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
      console.warn(`Could not create ${dir}: ${err.message} — will retry on first use`);
    }
  }
}
ensureDirs();

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
    placements: { front: 'embroidery_front_large' },
  },
  mug: {
    productId: 19, // Glossy Mug 11oz
    variants: {
      'White-11oz': 1320,
      'Black-11oz': 4830,
    },
    placements: { front: 'default' },
  },
  sticker: {
    productId: 358, // Kiss-Cut Stickers
    variants: {
      'White-3×3': 10163,
    },
    placements: { front: 'default' },
  },
};

// Pricing: multiples of π
const PI = Math.PI;
const PRODUCT_PRICES = {
  tshirt:  Math.round(10 * PI * 100), // 10π = $31.42
  cap:     Math.round(10 * PI * 100), // 10π = $31.42
  mug:     Math.round(10 * PI * 100), // 10π = $31.42
  sticker: Math.round(3 * PI * 100),  //  3π = $9.42
};

// Shipping rate tiers (cents) — based on Printful rates + small handling buffer
// Printful fulfillment: 2-5 days. Delivery on top of that.
// Rates use shirt pricing (slightly higher than caps).
// Stripe allows max 5 shipping_options, so we consolidate into 5 tiers.
// Flat shipping rate — $4.95 first item + $2.20 each additional
const SHIPPING_FLAT = { amount: 495, additional: 220, delivery: '5-12 business days' };

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
  '.xml': 'application/xml',
};

// ─── Order Store ───

function generateOrderId() {
  return `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function saveOrder(order) {
  if (!fs.existsSync(ORDERS_DIR)) fs.mkdirSync(ORDERS_DIR, { recursive: true });
  const filePath = path.join(ORDERS_DIR, `${order.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(order, null, 2));
}

function loadOrder(orderId) {
  const filePath = path.join(ORDERS_DIR, `${orderId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listOrders(status) {
  const files = fs.readdirSync(ORDERS_DIR).filter(f => f.endsWith('.json'));
  const orders = files.map(f => JSON.parse(fs.readFileSync(path.join(ORDERS_DIR, f), 'utf8')));
  if (status) return orders.filter(o => o.status === status);
  return orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

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
    // No caching for HTML/CSS/JS so deploys take effect immediately
    const noCache = ['.html', '.css', '.js'].includes(ext);
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': noCache ? 'no-cache, no-store, must-revalidate' : 'public, max-age=86400',
    });
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

let chunkMeta = null;
let chunkFiles = [];
let totalDigits = 0;

function loadChunkMeta() {
  const metaPath = path.join(CHUNKS_DIR, 'meta.json');
  if (fs.existsSync(metaPath)) {
    chunkMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    totalDigits = chunkMeta.totalDigits;

    chunkFiles = [];
    for (let i = 0; i < chunkMeta.chunkCount; i++) {
      const name = `chunk_${String(i).padStart(6, '0')}.txt`;
      const p = path.join(CHUNKS_DIR, name);
      if (fs.existsSync(p)) chunkFiles.push({ path: p, index: i });
    }
    console.log(`  Loaded ${chunkFiles.length} chunks, ${totalDigits.toLocaleString()} digits`);
    return true;
  }

  if (fs.existsSync(PI_TXT)) {
    const raw = fs.readFileSync(PI_TXT, 'utf8').replace(/[^0-9]/g, '');
    totalDigits = raw.length;
    chunkMeta = { totalDigits, chunkSize: raw.length, overlap: 0, chunkCount: 1 };
    chunkFiles = [{ path: PI_TXT, index: 0, preloaded: raw }];
    console.log(`  Using pi.txt as single chunk: ${totalDigits.toLocaleString()} digits`);
    return 'fallback';
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
  const seen = new Set();
  const startTime = Date.now();

  for (const cf of chunkFiles) {
    const chunkData = cf.preloaded || fs.readFileSync(cf.path, 'utf8');
    const chunkOffset = cf.index * step;

    const localMatches = kmpSearch(chunkData, pattern, fail, maxResults * 2);

    for (const localPos of localMatches) {
      const globalPos = chunkOffset + localPos;

      if (seen.has(globalPos)) continue;
      seen.add(globalPos);

      if (pairAligned && globalPos >= 1 && (globalPos - 1) % 2 !== 0) continue;

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

// ─── Context fetcher ───

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

// ─── Digit fetcher ───

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

function handlePiSearch(query, pairAligned, stream, res) {
  if (!query || !/^\d+$/.test(query)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Query must be digits only' }));
    return;
  }

  if (!chunkMeta || chunkFiles.length === 0) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'No pi data loaded.' }));
    return;
  }

  if (stream) {
    // SSE streaming search with progress updates
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',        // disable nginx proxy buffering
      'Content-Encoding': 'identity',    // prevent compression buffering
    });
    res.flushHeaders();

    const fail = buildFailure(query);
    const step = chunkMeta.chunkSize - chunkMeta.overlap;
    const results = [];
    const maxResults = 10;
    const seen = new Set();
    const startTime = Date.now();
    let chunkIndex = 0;
    const total = chunkFiles.length;
    let aborted = false;

    res.on('close', () => { aborted = true; });

    function searchNextChunk() {
      if (aborted || chunkIndex >= total || results.length >= maxResults) {
        // Done — send final result
        const elapsed = Date.now() - startTime;
        const data = JSON.stringify({
          type: 'result',
          found: results.length > 0,
          results,
          count: results.length,
          totalDigits,
          elapsed,
          searched: chunkIndex * chunkMeta.chunkSize,
        });
        res.write(`data: ${data}\n\n`);
        res.end();
        return;
      }

      const cf = chunkFiles[chunkIndex];
      const chunkData = cf.preloaded || fs.readFileSync(cf.path, 'utf8');
      const chunkOffset = cf.index * step;
      const localMatches = kmpSearch(chunkData, query, fail, maxResults * 2);

      for (const localPos of localMatches) {
        const globalPos = chunkOffset + localPos;
        if (seen.has(globalPos)) continue;
        seen.add(globalPos);
        if (pairAligned && globalPos >= 1 && (globalPos - 1) % 2 !== 0) continue;

        const beforeStart = Math.max(0, localPos - 20);
        results.push({
          position: globalPos,
          before: chunkData.slice(beforeStart, localPos),
          after: chunkData.slice(localPos + query.length, Math.min(chunkData.length, localPos + query.length + 20)),
        });
        if (results.length >= maxResults) break;
      }

      chunkIndex++;

      // Send progress every 10 chunks (~10M digits)
      if (chunkIndex % 10 === 0 || results.length > 0) {
        const progress = JSON.stringify({
          type: 'progress',
          searched: chunkIndex * chunkMeta.chunkSize,
          totalDigits,
          found: results.length,
          elapsed: Date.now() - startTime,
        });
        res.write(`data: ${progress}\n\n`);
      }

      // If we found results, finish immediately
      if (results.length >= maxResults) {
        searchNextChunk(); return;
      }

      // Yield to event loop so the server stays responsive
      setImmediate(searchNextChunk);
    }

    searchNextChunk();
  } else {
    // Non-streaming search (original)
    const result = searchChunks(query, pairAligned);
    if (!result) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No pi data loaded.' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }
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

    if (!orderId || !designs) {
      return jsonResponse(res, 400, { error: 'Missing orderId or designs' });
    }

    const urls = {};
    for (const [key, dataUrl] of Object.entries(designs)) {
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const ext = dataUrl.startsWith('data:image/jpeg') ? 'jpg' : 'png';
      const fileName = `${orderId}_${key}.${ext}`;
      if (!fs.existsSync(DESIGNS_DIR)) fs.mkdirSync(DESIGNS_DIR, { recursive: true });
      fs.writeFileSync(path.join(DESIGNS_DIR, fileName), base64, 'base64');
      urls[key] = `/designs/${fileName}`;
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

    if (!items || items.length === 0) {
      return jsonResponse(res, 400, { error: 'No items' });
    }

    const siteUrl = process.env.SITE_URL || `http://localhost:${PORT}`;

    // Create persistent order record BEFORE charging
    const orderId = generateOrderId();
    const order = {
      id: orderId,
      status: 'pending',       // pending → paid → fulfilled / failed
      createdAt: Date.now(),
      items: items.map(i => ({
        product: i.product,
        color: i.colorName,
        size: i.size,
        word: i.word,
        designUrls: i.designUrls,
      })),
      stripeSessionId: null,   // filled after session creation
      shipping: null,          // filled on webhook
      printfulOrderIds: [],    // filled on fulfillment
      error: null,
    };
    saveOrder(order);

    // Tax codes: apparel (tshirt/cap), home accessories (mug), paper goods (sticker)
    const TAX_CODES = { tshirt: 'txcd_30011000', cap: 'txcd_30011000', mug: 'txcd_35010000', sticker: 'txcd_38000000' };

    const lineItems = items.map(item => {
      const productData = {
        name: `${item.productLabel} — "${item.word}"`,
        description: `${item.colorName}, ${item.size} | Your Place in π`,
        tax_code: TAX_CODES[item.product] || TAX_CODES.tshirt,
      };
      if (item.mockupUrl) {
        productData.images = [siteUrl + item.mockupUrl];
      } else if (item.designUrls?.front) {
        productData.images = [siteUrl + item.designUrls.front];
      }
      return {
        price_data: {
          currency: 'usd',
          product_data: productData,
          unit_amount: PRODUCT_PRICES[item.product] || PRODUCT_PRICES.tshirt,
          tax_behavior: 'exclusive',
        },
        quantity: 1,
      };
    });

    // Flat shipping — $4.95 first item + $2.20 each additional
    const itemCount = items.length;
    const shippingTotal = SHIPPING_FLAT.amount + (itemCount > 1 ? SHIPPING_FLAT.additional * (itemCount - 1) : 0);

    const session = await getStripe().checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      automatic_tax: { enabled: true },
      customer_creation: 'always',
      shipping_address_collection: {
        allowed_countries: ['US','CA','GB','AU','NZ','JP','BR','KR','SG','MY','TH','PH','ID','TW','HK','IN',
          'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT',
          'NL','PL','PT','RO','SK','SI','ES','SE','CH','NO','IS','MX','CL','CO','AR','PE','IL','AE','SA','TR',
          'ZA','NG','EG','UA','RS','BA','ME','MK','AL','MD','GE','KZ'],
      },
      shipping_options: [{
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: shippingTotal, currency: 'usd' },
          tax_behavior: 'exclusive',
          display_name: 'Standard Shipping',
          delivery_estimate: {
            minimum: { unit: 'business_day', value: 5 },
            maximum: { unit: 'business_day', value: 12 },
          },
        },
      }],
      metadata: { order_id: orderId },
      success_url: `${siteUrl}?checkout=success`,
      cancel_url: `${siteUrl}?checkout=cancel`,
    });

    // Update order with Stripe session ID
    order.stripeSessionId = session.id;
    saveOrder(order);

    jsonResponse(res, 200, { url: session.url });
  } catch (err) {
    console.error('Checkout error:', err.message);
    jsonResponse(res, 500, { error: 'Checkout failed. Please try again later.' });
  }
}

// ─── Fulfill a single order → Printful ───

async function fulfillOrder(order) {
  const siteUrl = process.env.SITE_URL || `http://localhost:${PORT}`;
  const errors = [];

  for (let i = 0; i < order.items.length; i++) {
    const item = order.items[i];
    const productMap = PRINTFUL_PRODUCTS[item.product];
    if (!productMap) { errors.push(`Unknown product: ${item.product}`); continue; }

    const variantKey = `${item.color}-${item.size}`;
    const variantId = productMap.variants[variantKey];
    if (!variantId) { errors.push(`Unknown variant: ${variantKey}`); continue; }

    const printfulItem = {
      variant_id: variantId,
      quantity: 1,
      files: [],
    };

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

    const pfOrder = {
      recipient: {
        name: order.shipping?.name || 'Customer',
        address1: order.shipping?.address?.line1 || '',
        address2: order.shipping?.address?.line2 || '',
        city: order.shipping?.address?.city || '',
        state_code: order.shipping?.address?.state || '',
        country_code: order.shipping?.address?.country || '',
        zip: order.shipping?.address?.postal_code || '',
      },
      items: [printfulItem],
    };

    console.log(`  Submitting item ${i + 1}/${order.items.length} to Printful...`);
    const result = await printfulRequest('POST', '/orders', pfOrder);

    if (result?.code === 200 || result?.result?.id) {
      const pfId = result.result?.id || 'unknown';
      order.printfulOrderIds.push(pfId);
      console.log(`  ✓ Printful order created: ${pfId}`);
    } else {
      const errMsg = result?.result || result?.error?.message || JSON.stringify(result);
      errors.push(`Item ${i}: ${errMsg}`);
      console.error(`  ✗ Printful error for item ${i}:`, errMsg);
    }
  }

  if (errors.length > 0) {
    order.status = 'failed';
    order.error = errors.join('; ');
  } else {
    order.status = 'fulfilled';
    order.error = null;
  }

  order.fulfilledAt = Date.now();
  saveOrder(order);
  return errors;
}

// ─── Printful Mockup Generator ───

// Upload binary PNG to Printful via multipart form
function printfulUploadFile(pngBuffer) {
  return new Promise((resolve, reject) => {
    const boundary = '----PFUpload' + Date.now();
    const filename = 'design-' + Date.now() + '.png';

    const header = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: image/png\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([header, pngBuffer, footer]);

    const opts = {
      hostname: 'api.printful.com',
      path: '/files',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PRINTFUL_API_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function handleMockupPreview(req, res) {
  try {
    const buf = await readBody(req);
    const { product, color, designBase64 } = JSON.parse(buf.toString());

    const productMap = PRINTFUL_PRODUCTS[product];
    if (!productMap) return jsonResponse(res, 400, { error: 'Unknown product' });

    // Build variant IDs list for the selected color
    const variantIds = [];
    for (const [key, id] of Object.entries(productMap.variants)) {
      if (key.startsWith(color + '-')) variantIds.push(id);
    }
    if (variantIds.length === 0) return jsonResponse(res, 400, { error: 'Unknown variant' });

    // Step 1: Upload PNG to Printful file library via multipart
    const base64Data = designBase64.replace(/^data:image\/\w+;base64,/, '');
    const pngBuffer = Buffer.from(base64Data, 'base64');
    console.log(`Uploading ${(pngBuffer.length / 1024 / 1024).toFixed(1)}MB design to Printful...`);

    const uploadResult = await printfulUploadFile(pngBuffer);
    if (uploadResult.code !== 200 || !uploadResult.result?.id) {
      console.error('Printful file upload failed:', JSON.stringify(uploadResult).slice(0, 500));
      return jsonResponse(res, 500, { error: 'File upload to Printful failed', detail: uploadResult.error?.message });
    }

    const fileId = uploadResult.result.id;
    console.log('Printful file uploaded, id:', fileId);

    // Step 2: Wait for file to be processed (poll until preview_url is available)
    let fileUrl = null;
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const fileStatus = await printfulRequest('GET', `/files/${fileId}`);
      if (fileStatus.result?.status === 'ok' && fileStatus.result?.preview_url) {
        fileUrl = fileStatus.result.preview_url;
        break;
      }
      if (fileStatus.result?.status === 'failed') {
        console.error('File processing failed:', JSON.stringify(fileStatus).slice(0, 300));
        return jsonResponse(res, 500, { error: 'Printful rejected the design file' });
      }
    }
    if (!fileUrl) return jsonResponse(res, 504, { error: 'File processing timed out' });
    console.log('File processed:', fileUrl);

    // Step 3: Create mockup task
    const placement = productMap.placements.front;
    // Get print file dimensions for this product
    const printSpecs = await printfulRequest('GET', `/mockup-generator/printfiles/${productMap.productId}`);
    let areaW = 1800, areaH = 2400;
    if (printSpecs.result?.printfiles) {
      const frontFile = printSpecs.result.printfiles[0];
      if (frontFile) { areaW = frontFile.width; areaH = frontFile.height; }
    }

    const taskBody = {
      variant_ids: [variantIds[0]],
      format: 'jpg',
      files: [{
        placement,
        image_url: fileUrl,
        position: { area_width: areaW, area_height: areaH, width: areaW, height: areaH, top: 0, left: 0 },
      }],
    };

    const createResult = await printfulRequest('POST', `/mockup-generator/create-task/${productMap.productId}`, taskBody);
    if (createResult.code !== 200 || !createResult.result?.task_key) {
      console.error('Mockup create failed:', JSON.stringify(createResult).slice(0, 500));
      return jsonResponse(res, 500, { error: 'Mockup generation failed', detail: createResult.error?.message });
    }

    const taskKey = createResult.result.task_key;
    console.log('Mockup task created:', taskKey);

    // Step 4: Poll for mockup result (up to 30 seconds)
    let mockups = null;
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const status = await printfulRequest('GET', `/mockup-generator/task?task_key=${taskKey}`);
      if (status.result?.status === 'completed') {
        mockups = status.result.mockups;
        break;
      }
      if (status.result?.status === 'failed') {
        console.error('Mockup task failed:', JSON.stringify(status).slice(0, 500));
        return jsonResponse(res, 500, { error: 'Mockup generation failed' });
      }
    }

    if (!mockups) return jsonResponse(res, 504, { error: 'Mockup generation timed out' });

    jsonResponse(res, 200, { mockups });
  } catch (err) {
    console.error('Mockup preview error:', err.message);
    jsonResponse(res, 500, { error: 'Mockup preview failed' });
  }
}

// ─── Mockup Generator (admin) ───

function downloadFile(fileUrl) {
  return new Promise((resolve, reject) => {
    const get = fileUrl.startsWith('https') ? https.get : http.get;
    get(fileUrl, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location).then(resolve, reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// In-memory job state (lost on restart, which is fine for admin tool)
const mockupJobs = new Map();

// The 6 mockup variants we generate
const MOCKUP_MATRIX = [
  { key: 'tshirt_white_normal',  product: 'tshirt', color: 'White', variant: 'M', front: 'pimark', back: 'polygon', label: 'T-Shirt White' },
  { key: 'tshirt_white_flipped', product: 'tshirt', color: 'White', variant: 'M', front: 'polygon', back: 'pimark', label: 'T-Shirt White (flipped)' },
  { key: 'tshirt_black_normal',  product: 'tshirt', color: 'Black', variant: 'M', front: 'pimark', back: 'polygon', label: 'T-Shirt Black' },
  { key: 'tshirt_black_flipped', product: 'tshirt', color: 'Black', variant: 'M', front: 'polygon', back: 'pimark', label: 'T-Shirt Black (flipped)' },
  { key: 'mug_white',  product: 'mug', color: 'White', variant: '11oz', front: 'mug-wrap', label: 'Mug White' },
  { key: 'mug_black',  product: 'mug', color: 'Black', variant: '11oz', front: 'mug-wrap', label: 'Mug Black' },
  { key: 'cap_white',  product: 'cap', color: 'White', variant: 'One Size', front: 'cap-pimark', label: 'Cap White' },
  { key: 'cap_black',  product: 'cap', color: 'Black', variant: 'One Size', front: 'cap-pimark', label: 'Cap Black' },
];

async function runMockupJob(jobId, designUrls) {
  const job = mockupJobs.get(jobId);
  const siteUrl = process.env.SITE_URL || `http://localhost:${PORT}`;

  // Upload all unique design files to Printful first
  const printfulUrls = {};
  for (const [key, localPath] of Object.entries(designUrls)) {
    try {
      const publicUrl = siteUrl + localPath;
      console.log(`[mockup ${jobId}] Uploading ${key}: ${publicUrl}`);
      const uploadRes = await printfulRequest('POST', '/files', { url: publicUrl });
      if (uploadRes.code !== 200) throw new Error(uploadRes.error?.message || 'Upload failed');
      // Poll for processing
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const st = await printfulRequest('GET', `/files/${uploadRes.result.id}`);
        if (st.result?.status === 'ok' && st.result?.preview_url) {
          printfulUrls[key] = st.result.preview_url;
          break;
        }
        if (st.result?.status === 'failed') throw new Error('File rejected by Printful');
      }
      if (!printfulUrls[key]) throw new Error('File processing timed out');
    } catch (err) {
      console.error(`[mockup ${jobId}] Upload ${key} failed:`, err.message);
      job.error = `Upload failed for ${key}: ${err.message}`;
      job.status = 'failed';
      return;
    }
  }

  // Process each mockup variant
  const matrix = job.matrix || MOCKUP_MATRIX;
  for (let i = 0; i < matrix.length; i++) {
    const m = matrix[i];
    job.progress = `${i + 1}/${matrix.length}: ${m.label}`;
    console.log(`[mockup ${jobId}] ${job.progress}`);

    try {
      const pm = PRINTFUL_PRODUCTS[m.product];
      const variantKey = `${m.color}-${m.variant}`;
      const variantId = pm.variants[variantKey];
      if (!variantId) { console.warn(`  No variant ${variantKey}`); continue; }

      // Build placement files
      const files = [];
      if (m.product === 'tshirt') {
        files.push({
          placement: 'front',
          image_url: printfulUrls[m.front],
          position: { area_width: 4500, area_height: 5400, width: 4500, height: 5400, top: 0, left: 0 },
        });
        files.push({
          placement: 'back',
          image_url: printfulUrls[m.back],
          position: { area_width: 4500, area_height: 5400, width: 4500, height: 5400, top: 0, left: 0 },
        });
      } else if (m.product === 'mug') {
        files.push({
          placement: 'default',
          image_url: printfulUrls[m.front],
          position: { area_width: 2700, area_height: 1050, width: 2700, height: 1050, top: 0, left: 0 },
        });
      } else if (m.product === 'cap') {
        files.push({
          placement: 'embroidery_front_large',
          image_url: printfulUrls[m.front],
          position: { area_width: 1650, area_height: 600, width: 1650, height: 600, top: 0, left: 0 },
        });
      }

      // Create mockup task
      const taskRes = await printfulRequest('POST', `/mockup-generator/create-task/${pm.productId}`, {
        variant_ids: [variantId], format: 'jpg', files,
      });

      if (taskRes.code === 429 || taskRes.error?.message?.includes('too many requests')) {
        console.log(`  Rate limited, waiting 60s...`);
        await new Promise(r => setTimeout(r, 60000));
        i--; // retry this one
        continue;
      }
      if (taskRes.code !== 200) throw new Error(taskRes.error?.message || 'Create task failed');

      // Poll for result
      let mockups = null;
      for (let p = 0; p < 30; p++) {
        await new Promise(r => setTimeout(r, 3000));
        const st = await printfulRequest('GET', `/mockup-generator/task?task_key=${taskRes.result.task_key}`);
        if (st.result?.status === 'completed') { mockups = st.result.mockups; break; }
        if (st.result?.status === 'failed') throw new Error('Mockup generation failed');
      }
      if (!mockups) throw new Error('Mockup polling timed out');

      // Download and save each mockup image
      for (const mock of mockups) {
        const urls = [mock.mockup_url];
        if (mock.extra) mock.extra.forEach(e => { const u = typeof e === 'string' ? e : e.url; if (u) urls.push(u); });
        for (const mockUrl of urls) {
          if (!mockUrl) continue;
          // Extract view from URL (e.g., "front", "back", "handle-on-left")
          const viewMatch = mockUrl.match(/-(front|back|left|right|handle-on-left|handle-on-right|left-front|right-front|front-view)[^/]*\.jpg/);
          const view = viewMatch ? viewMatch[1] : 'main';
          // Skip side views for t-shirts (only keep front and back)
          if (m.product === 'tshirt' && view !== 'front' && view !== 'back') continue;
          const fileName = `${job.word}_${m.key}_${view}.jpg`;
          try {
            const imgBuf = await downloadFile(mockUrl);
            fs.writeFileSync(path.join(MOCKUPS_DIR, fileName), imgBuf);
            job.completed.push({ key: m.key, view, url: `/mockups/${fileName}`, label: m.label });
          } catch (dlErr) {
            console.error(`  Download failed for ${view}:`, dlErr.message);
          }
        }
      }

      // Delay between products to avoid rate limits
      if (i < matrix.length - 1) {
        console.log('  Waiting 20s for rate limit...');
        await new Promise(r => setTimeout(r, 20000));
      }
    } catch (err) {
      console.error(`  ${m.label} failed:`, err.message);
      job.completed.push({ key: m.key, view: 'error', error: err.message, label: m.label });
    }
  }

  job.status = 'completed';
  job.progress = `${matrix.length}/${matrix.length}: Done`;
  console.log(`[mockup ${jobId}] All done! ${job.completed.length} images saved.`);
}

async function handleGenerateMockups(req, res) {
  try {
    const buf = await readBody(req);
    const { word, designFiles, products } = JSON.parse(buf.toString());
    if (!word || !designFiles) return jsonResponse(res, 400, { error: 'Missing word or designFiles' });

    // Filter matrix by requested products (e.g. ['tshirt'], ['mug'], ['cap'])
    const matrix = products && products.length > 0
      ? MOCKUP_MATRIX.filter(m => products.includes(m.product))
      : MOCKUP_MATRIX;

    const jobId = 'mj_' + Date.now();
    const sanitizedWord = word.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 30).trim().replace(/ /g, '_').toLowerCase();
    mockupJobs.set(jobId, {
      status: 'running', word: sanitizedWord, progress: '0/' + matrix.length,
      completed: [], error: null, startedAt: Date.now(), matrix,
    });

    jsonResponse(res, 200, { jobId });

    // Run async (don't await — client will poll)
    runMockupJob(jobId, designFiles).catch(err => {
      const job = mockupJobs.get(jobId);
      if (job) { job.status = 'failed'; job.error = err.message; }
    });
  } catch (err) {
    jsonResponse(res, 500, { error: err.message });
  }
}

function handleMockupStatus(query, res) {
  const job = mockupJobs.get(query.jobId);
  if (!job) return jsonResponse(res, 404, { error: 'Job not found' });
  jsonResponse(res, 200, {
    status: job.status, progress: job.progress,
    completed: job.completed, error: job.error,
  });
}

function handleMockupList(res) {
  if (!fs.existsSync(MOCKUPS_DIR)) return jsonResponse(res, 200, { mockups: {} });
  const files = fs.readdirSync(MOCKUPS_DIR).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
  const grouped = {};
  for (const f of files) {
    const word = f.split('_')[0] || 'unknown';
    if (!grouped[word]) grouped[word] = [];
    grouped[word].push({ filename: f, url: `/mockups/${f}` });
  }
  jsonResponse(res, 200, { mockups: grouped });
}

function handleClearMockups(query, res) {
  if (!fs.existsSync(MOCKUPS_DIR)) return jsonResponse(res, 200, { deleted: 0 });
  const files = fs.readdirSync(MOCKUPS_DIR);
  let deleted = 0;
  for (const f of files) {
    if (query.word && !f.startsWith(query.word + '_')) continue;
    try { fs.unlinkSync(path.join(MOCKUPS_DIR, f)); deleted++; } catch {}
  }
  jsonResponse(res, 200, { deleted });
}

// ─── Stripe Webhook → Fulfill Order ───

async function handleStripeWebhook(req, res) {
  try {
    const buf = await readBody(req);
    const sig = req.headers['stripe-signature'];

    let event;
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      event = getStripe().webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      console.warn('⚠ STRIPE_WEBHOOK_SECRET not set — skipping signature verification');
      event = JSON.parse(buf.toString());
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orderId = session.metadata?.order_id;

      if (!orderId) {
        console.error('Webhook: no order_id in metadata');
        return jsonResponse(res, 200, { received: true });
      }

      const order = loadOrder(orderId);
      if (!order) {
        console.error(`Webhook: order ${orderId} not found on disk`);
        return jsonResponse(res, 200, { received: true });
      }

      // Save shipping info from Stripe
      const shipping = session.shipping_details || session.customer_details;
      order.shipping = {
        name: shipping?.name || '',
        address: shipping?.address || {},
      };
      order.status = 'paid';
      order.paidAt = Date.now();
      order.stripePaymentIntent = session.payment_intent;
      saveOrder(order);

      console.log(`\n✓ Payment received for ${orderId} — ${order.items.length} item(s)`);

      // Fulfill → Printful (skip in Stripe test mode to avoid real orders)
      const isTestMode = (process.env.STRIPE_SECRET_KEY || '').startsWith('sk_test_');
      if (isTestMode) {
        console.log(`⏭ Skipping Printful fulfillment — Stripe is in test mode`);
      } else {
        const errors = await fulfillOrder(order);
        if (errors.length > 0) {
          console.error(`⚠ Order ${orderId} had fulfillment errors:`, errors);
        } else {
          console.log(`✓ Order ${orderId} fully fulfilled`);
        }
      }
    }

    jsonResponse(res, 200, { received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    jsonResponse(res, 400, { error: 'Webhook processing failed.' });
  }
}

// ─── Admin auth + rate limiting ───

const adminAttempts = new Map(); // ip → { count, resetAt }
const ADMIN_MAX_ATTEMPTS = 5;
const ADMIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function checkAdmin(req, res) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const now = Date.now();

  // Check rate limit
  const record = adminAttempts.get(ip);
  if (record && record.count >= ADMIN_MAX_ATTEMPTS && now < record.resetAt) {
    const mins = Math.ceil((record.resetAt - now) / 60000);
    jsonResponse(res, 429, { error: `Too many attempts. Try again in ${mins} min.` });
    return false;
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!process.env.ADMIN_KEY || token !== process.env.ADMIN_KEY) {
    // Track failed attempt
    if (!record || now >= (record.resetAt || 0)) {
      adminAttempts.set(ip, { count: 1, resetAt: now + ADMIN_LOCKOUT_MS });
    } else {
      record.count++;
    }
    jsonResponse(res, 401, { error: 'Unauthorized' });
    return false;
  }

  // Success — clear attempts
  adminAttempts.delete(ip);
  return true;
}

// ─── Admin: list orders / retry failed ───

function handleAdminOrders(query, res) {
  const status = query.status || null;
  const orders = listOrders(status);
  // Strip large fields for listing
  const summary = orders.map(o => ({
    id: o.id,
    status: o.status,
    createdAt: new Date(o.createdAt).toISOString(),
    itemCount: o.items?.length || 0,
    word: o.items?.[0]?.word || '',
    error: o.error,
    printfulOrderIds: o.printfulOrderIds,
  }));
  jsonResponse(res, 200, { count: summary.length, orders: summary });
}

async function handleAdminRetry(req, res) {
  try {
    const buf = await readBody(req);
    const { orderId } = JSON.parse(buf.toString());
    const order = loadOrder(orderId);
    if (!order) return jsonResponse(res, 404, { error: 'Order not found' });
    if (order.status === 'fulfilled') return jsonResponse(res, 400, { error: 'Already fulfilled' });

    console.log(`\n↻ Retrying order ${orderId}...`);
    const errors = await fulfillOrder(order);
    if (errors.length > 0) {
      jsonResponse(res, 500, { error: 'Partial failure', errors });
    } else {
      jsonResponse(res, 200, { success: true, orderId });
    }
  } catch (err) {
    console.error('Fulfill error:', err.message);
    jsonResponse(res, 500, { error: 'Order fulfillment failed.' });
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
  // Binary file upload: PUT /api/upload-file?name=foo.png
  if (req.method === 'PUT' && parsed.pathname === '/api/upload-file') {
    const name = parsed.query.name;
    if (!name || /[\/\\]/.test(name)) return jsonResponse(res, 400, { error: 'Bad name' });
    if (!fs.existsSync(DESIGNS_DIR)) fs.mkdirSync(DESIGNS_DIR, { recursive: true });
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      fs.writeFileSync(path.join(DESIGNS_DIR, name), buf);
      jsonResponse(res, 200, { url: `/designs/${name}`, size: buf.length });
    });
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
  if (req.method === 'POST' && parsed.pathname === '/api/mockup-preview') {
    handleMockupPreview(req, res);
    return;
  }

  // ── Admin API (Bearer token + rate limiting) ──
  if (parsed.pathname === '/api/admin/orders') {
    if (!checkAdmin(req, res)) return;
    if (req.method === 'GET') return handleAdminOrders(parsed.query, res);
    if (req.method === 'POST') return handleAdminRetry(req, res);
  }
  if (req.method === 'POST' && parsed.pathname === '/api/generate-mockups') {
    if (!checkAdmin(req, res)) return;
    handleGenerateMockups(req, res);
    return;
  }
  if (req.method === 'GET' && parsed.pathname === '/api/mockup-status') {
    handleMockupStatus(parsed.query, res);
    return;
  }
  if (req.method === 'GET' && parsed.pathname === '/api/mockup-list') {
    handleMockupList(res);
    return;
  }
  if (req.method === 'DELETE' && parsed.pathname === '/api/clear-mockups') {
    if (!checkAdmin(req, res)) return;
    handleClearMockups(parsed.query, res);
    return;
  }

  // ── Serve mockup images from persistent dir ──
  if (parsed.pathname.startsWith('/mockups/')) {
    const fileName = path.basename(parsed.pathname);
    const filePath = path.join(MOCKUPS_DIR, fileName);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(fileName);
      const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=86400' });
      res.end(fs.readFileSync(filePath));
      return;
    }
  }

  // ── Serve uploaded designs from persistent dir ──
  if (parsed.pathname.startsWith('/designs/')) {
    const fileName = path.basename(parsed.pathname);
    const filePath = path.join(DESIGNS_DIR, fileName);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(fileName);
      const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
      res.writeHead(200, { 'Content-Type': mime });
      res.end(fs.readFileSync(filePath));
      return;
    }
  }

  if (parsed.pathname === '/api/pisearch') {
    const q = parsed.query.q;
    const pairAligned = parsed.query.aligned === '1';
    const stream = parsed.query.stream === '1';
    handlePiSearch(q, pairAligned, stream, res);
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

// ─── Auto-download pi chunks if missing (runs once on first Railway deploy) ───

function autoDownloadChunks() {
  return new Promise((resolve, reject) => {
    const MIT_URL = 'https://stuff.mit.edu/afs/sipb/contrib/pi/pi-billion.txt';
    const CHUNK_SIZE = 1_000_000;
    const OVERLAP = 50;

    if (!fs.existsSync(CHUNKS_DIR)) fs.mkdirSync(CHUNKS_DIR, { recursive: true });

    console.log(`Downloading 1 billion digits from MIT...`);
    console.log(`Chunking directly to: ${CHUNKS_DIR}`);

    const get = (reqUrl) => {
      const mod = reqUrl.startsWith('https') ? https : http;
      mod.get(reqUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          get(res.headers.location); return;
        }
        if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let downloaded = 0;
        const digitBuf = [];
        let globalDigitPos = 0;
        let chunkIdx = 0;
        let chunkStart = 0;

        res.on('data', (raw) => {
          downloaded += raw.length;
          const text = raw.toString('ascii');
          for (let i = 0; i < text.length; i++) {
            const c = text.charCodeAt(i);
            if (c >= 48 && c <= 57) {
              digitBuf.push(text[i]);
              globalDigitPos++;
              if (digitBuf.length === CHUNK_SIZE) {
                const name = `chunk_${String(chunkIdx).padStart(6, '0')}.txt`;
                fs.writeFileSync(path.join(CHUNKS_DIR, name), digitBuf.join(''));
                chunkIdx++;
                const keep = digitBuf.splice(digitBuf.length - OVERLAP);
                digitBuf.length = 0;
                digitBuf.push(...keep);
                chunkStart = globalDigitPos - OVERLAP;
              }
            }
          }
          if (totalBytes > 0) {
            const pct = ((downloaded / totalBytes) * 100).toFixed(1);
            console.log(`  Download: ${(downloaded / 1e6).toFixed(0)}MB / ${(totalBytes / 1e6).toFixed(0)}MB (${pct}%) — ${chunkIdx} chunks written`);
          }
        });

        res.on('end', () => {
          if (digitBuf.length > 0) {
            const name = `chunk_${String(chunkIdx).padStart(6, '0')}.txt`;
            fs.writeFileSync(path.join(CHUNKS_DIR, name), digitBuf.join(''));
            chunkIdx++;
          }
          const meta = {
            totalDigits: globalDigitPos,
            chunkSize: CHUNK_SIZE,
            overlap: OVERLAP,
            chunkCount: chunkIdx,
            createdAt: new Date().toISOString(),
          };
          fs.writeFileSync(path.join(CHUNKS_DIR, 'meta.json'), JSON.stringify(meta, null, 2));
          console.log(`  Done: ${chunkIdx} chunks, ${globalDigitPos.toLocaleString()} total digits`);
          resolve(meta);
        });

        res.on('error', reject);
      }).on('error', reject);
    };

    get(MIT_URL);
  });
}

// Boot
console.log('piMap server starting...');
console.log(`Persist dir: ${PERSIST_DIR}`);
console.log(`Chunks dir: ${CHUNKS_DIR}`);
console.log('Loading pi digit chunks...');

const hasChunks = loadChunkMeta();

// Start server immediately so the site is responsive
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\npiMap server running at http://localhost:${PORT}`);
  console.log(`Search API: http://localhost:${PORT}/api/pisearch?q=14159`);
  console.log(`Status API: http://localhost:${PORT}/api/pistatus`);
  console.log(`Orders API: http://localhost:${PORT}/api/admin/orders`);
});

// Auto-download in background if no real chunks and we're on Railway
if (hasChunks !== true && process.env.PERSIST_DIR) {
  console.log('\nNo chunks found on volume — downloading in background...');
  autoDownloadChunks().then(() => {
    console.log('Download complete — loading chunks...');
    loadChunkMeta();
    console.log('Billion-digit search is now live!');
  }).catch(err => {
    console.error('Auto-download failed:', err.message);
  });
}
