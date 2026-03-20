const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8080;
const STATIC_DIR = __dirname;
const CHUNKS_DIR = path.join(__dirname, 'data', 'pi-chunks');
const PI_TXT = path.join(__dirname, 'data', 'pi.txt');

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.png': 'image/png',
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

// ─── Server ───

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);

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

server.listen(PORT, () => {
  console.log(`\npiMap server running at http://localhost:${PORT}`);
  console.log(`Search API: http://localhost:${PORT}/api/pisearch?q=14159`);
  console.log(`Status API: http://localhost:${PORT}/api/pistatus`);
});
