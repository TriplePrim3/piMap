/**
 * Download pi digits and split into chunk files for search.
 *
 * Usage:
 *   node download-pi.js              Download 1B digits from MIT, chunk them
 *   node download-pi.js --local-only Use only existing data/pi.txt
 *   node download-pi.js --file path  Use a local pi file
 *
 * Chunk format:
 *   data/pi-chunks/chunk_000000.txt  →  digits 0..CHUNK_SIZE-1
 *   Consecutive chunks overlap by OVERLAP digits so boundary matches aren't missed.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const CHUNK_SIZE = 1_000_000;  // 1M digits per chunk
const OVERLAP = 50;            // overlap >= max query length
const CHUNKS_DIR = path.join(__dirname, '..', 'data', 'pi-chunks');
const PI_TXT = path.join(__dirname, '..', 'data', 'pi.txt');
const RAW_FILE = path.join(__dirname, '..', 'data', 'pi-billion-raw.txt');

const MIT_URL = 'https://stuff.mit.edu/afs/sipb/contrib/pi/pi-billion.txt';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── Stream download to disk ───

function downloadToFile(destPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading 1 billion digits from MIT (~1 GB)...`);
    console.log(`URL: ${MIT_URL}`);
    console.log(`Saving to: ${destPath}`);

    const fileStream = fs.createWriteStream(destPath);

    const get = (url) => {
      const mod = url.startsWith('https') ? https : http;
      mod.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          get(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let downloaded = 0;

        res.on('data', (chunk) => {
          fileStream.write(chunk);
          downloaded += chunk.length;
          if (totalBytes > 0) {
            const pct = ((downloaded / totalBytes) * 100).toFixed(1);
            const mb = (downloaded / 1e6).toFixed(0);
            process.stdout.write(`\r  ${mb} MB / ${(totalBytes / 1e6).toFixed(0)} MB (${pct}%)`);
          }
        });

        res.on('end', () => {
          fileStream.end(() => {
            console.log('\n  Download complete.');
            resolve(destPath);
          });
        });

        res.on('error', (err) => {
          fileStream.close();
          reject(err);
        });
      }).on('error', reject);
    };

    get(MIT_URL);
  });
}

// ─── Stream-chunk a large file on disk ───

function chunkFromFile(srcPath, chunkDir) {
  ensureDir(chunkDir);
  console.log(`Chunking ${srcPath} into ${chunkDir}...`);

  const step = CHUNK_SIZE - OVERLAP;
  const fd = fs.openSync(srcPath, 'r');
  const stat = fs.statSync(srcPath);
  const fileSize = stat.size;

  // Read buffer — slightly larger than chunk to handle digit extraction
  const readBuf = Buffer.alloc(CHUNK_SIZE + 1024);

  let fileOffset = 0;
  let digitOffset = 0;   // how many digits we've processed so far
  let chunkIdx = 0;
  let leftover = '';      // non-digit chars can split across reads
  let totalDigits = 0;
  let firstChunk = true;

  // We need to track the global digit position and write overlapping chunks.
  // Strategy: read the file sequentially, extract digits, and write chunks
  // with proper overlap.

  // First pass: stream through file, extract digits, write chunks
  const digitBuf = [];    // accumulates digits for the current chunk
  let globalDigitPos = 0; // total digits seen so far
  let chunkStart = 0;     // global digit offset for current chunk start
  let nextChunkStart = 0; // when to start the next chunk

  const stream = fs.createReadStream(srcPath, { highWaterMark: 4 * 1024 * 1024 }); // 4MB reads

  return new Promise((resolve, reject) => {
    stream.on('data', (rawChunk) => {
      // Extract digits from this raw chunk
      const text = rawChunk.toString('ascii');
      for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        if (c >= 48 && c <= 57) { // '0'-'9'
          digitBuf.push(text[i]);
          globalDigitPos++;

          // When we have a full chunk, write it
          if (digitBuf.length === CHUNK_SIZE) {
            const name = `chunk_${String(chunkIdx).padStart(6, '0')}.txt`;
            fs.writeFileSync(path.join(chunkDir, name), digitBuf.join(''));
            process.stdout.write(`\r  Wrote ${name} (offset ${chunkStart.toLocaleString()}, ${globalDigitPos.toLocaleString()} digits processed)`);
            chunkIdx++;

            // Keep the last OVERLAP digits for the next chunk
            const keep = digitBuf.splice(digitBuf.length - OVERLAP);
            digitBuf.length = 0;
            digitBuf.push(...keep);
            chunkStart = globalDigitPos - OVERLAP;
          }
        }
      }
    });

    stream.on('end', () => {
      // Write remaining digits as final chunk
      if (digitBuf.length > 0) {
        const name = `chunk_${String(chunkIdx).padStart(6, '0')}.txt`;
        fs.writeFileSync(path.join(chunkDir, name), digitBuf.join(''));
        process.stdout.write(`\r  Wrote ${name} (offset ${chunkStart.toLocaleString()}, final)`);
        chunkIdx++;
      }

      totalDigits = globalDigitPos;

      // Write metadata
      const meta = {
        totalDigits,
        chunkSize: CHUNK_SIZE,
        overlap: OVERLAP,
        chunkCount: chunkIdx,
        createdAt: new Date().toISOString(),
      };
      fs.writeFileSync(path.join(chunkDir, 'meta.json'), JSON.stringify(meta, null, 2));
      console.log(`\n  Done: ${chunkIdx} chunks, ${totalDigits.toLocaleString()} total digits`);
      resolve(meta);
    });

    stream.on('error', reject);
  });
}

// ─── Small file: load into memory ───

function chunkFromString(digits, chunkDir) {
  ensureDir(chunkDir);
  let offset = 0;
  let idx = 0;
  const step = CHUNK_SIZE - OVERLAP;

  while (offset < digits.length) {
    const end = Math.min(offset + CHUNK_SIZE, digits.length);
    const chunk = digits.slice(offset, end);
    const name = `chunk_${String(idx).padStart(6, '0')}.txt`;
    fs.writeFileSync(path.join(chunkDir, name), chunk);
    process.stdout.write(`\r  Wrote ${name} (${chunk.length} digits, offset ${offset.toLocaleString()})`);
    idx++;
    offset += step;
  }

  const meta = {
    totalDigits: digits.length,
    chunkSize: CHUNK_SIZE,
    overlap: OVERLAP,
    chunkCount: idx,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(chunkDir, 'meta.json'), JSON.stringify(meta, null, 2));
  console.log(`\n  Done: ${idx} chunks, ${digits.length.toLocaleString()} total digits`);
  return meta;
}

async function main() {
  const args = process.argv.slice(2);

  // Option 1: local file provided
  const fileIdx = args.indexOf('--file');
  if (fileIdx !== -1 && args[fileIdx + 1]) {
    const filePath = args[fileIdx + 1];
    console.log(`Chunking from local file: ${filePath}`);
    await chunkFromFile(filePath, CHUNKS_DIR);
    return;
  }

  // Option 2: download from MIT (stream to disk, then chunk)
  if (!args.includes('--local-only')) {
    try {
      // Download to disk first (avoids memory limit)
      await downloadToFile(RAW_FILE);
      console.log(`\nChunking downloaded file...`);
      await chunkFromFile(RAW_FILE, CHUNKS_DIR);

      // Optionally clean up the raw file to save space
      // fs.unlinkSync(RAW_FILE);
      console.log(`\nRaw file kept at: ${RAW_FILE}`);
      console.log('(Delete it manually to save ~1 GB disk space)');
      return;
    } catch (err) {
      console.error(`  MIT download failed: ${err.message}`);
    }
  }

  // Option 3: fall back to existing pi.txt
  console.log(`Falling back to local data/pi.txt`);
  if (fs.existsSync(PI_TXT)) {
    const raw = fs.readFileSync(PI_TXT, 'utf8');
    const digits = raw.replace(/[^0-9]/g, '');
    console.log(`  ${digits.length.toLocaleString()} digits`);
    chunkFromString(digits, CHUNKS_DIR);
  } else {
    console.error('No pi data found.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
