const Shop = (() => {
  const PRINT_SIZE = 3000;
  const PREVIEW_SIZE = 500;
  const FONT = '"Cascadia Code", "Fira Code", Consolas, monospace';

  // ── Color palettes for polygon / heatmap ──
  const PALETTES = {
    vibgyor:   { name: 'VIBGYOR',    colors: ['#9400D3','#4B0082','#0000FF','#00AA00','#FFD700','#FF8C00','#FF0000'] },
    neon:      { name: 'Neon',       colors: ['#FF00FF','#00FFFF','#39FF14','#FFFF00','#FF6EC7','#7DF9FF','#FF3131'] },
    ocean:     { name: 'Ocean',      colors: ['#0A2463','#1E6091','#168AAD','#34A0A4','#52B69A','#76C893','#99D98C'] },
    fire:      { name: 'Fire',       colors: ['#590D22','#800F2F','#A4133C','#C9184A','#FF4D6D','#FF758F','#FFB3C1'] },
    mono:      { name: 'Mono',       colors: ['#FFFFFF','#D4D4D4','#A3A3A3','#737373','#525252','#404040','#262626'] },
    gold:      { name: 'Gold',       colors: ['#FFD700','#FFC300','#FFB000','#FF9500','#FF7B00','#FF6000','#FF4500'] },
    aurora:    { name: 'Aurora',     colors: ['#00F5D4','#00BBF9','#9B5DE5','#F15BB5','#FEE440','#00F5D4','#00BBF9'] },
  };
  let selectedPalette = 'vibgyor';

  // Text color presets for print
  const TEXT_COLORS = [
    { name: 'None',   hex: null },
    { name: 'White',  hex: '#ffffff' },
    { name: 'Black',  hex: '#111111' },
    { name: 'Gold',   hex: '#FFD700' },
    { name: 'Silver', hex: '#C0C0C0' },
    { name: 'Pink',   hex: '#ff6b9d' },
    { name: 'Purple', hex: '#7c6ff7' },
  ];
  let textColorIdx = 2; // default black (will auto-set based on shirt color)

  // Font presets for shirt text (not the π logo)
  const FONTS = [
    { name: 'System',    css: 'system-ui, sans-serif' },
    { name: 'Serif',     css: 'Georgia, "Times New Roman", serif' },
    { name: 'Mono',      css: '"Cascadia Code", "Fira Code", Consolas, monospace' },
    { name: 'Cursive',   css: '"Brush Script MT", "Segoe Script", cursive' },
    { name: 'Bold',      css: 'Impact, "Arial Black", sans-serif' },
  ];
  let fontIdx = 0;

  // ── Pricing: multiples of π ──
  const PI = Math.PI;
  const PRICES = {
    tshirt: { mult: 10, cents: Math.round(10 * PI * 100), label: '10π' },
    cap:    { mult: 10, cents: Math.round(10 * PI * 100), label: '10π' },
    mug:    { mult: 10, cents: Math.round(10 * PI * 100), label: '10π' },
    sticker:{ mult: 3,  cents: Math.round(3 * PI * 100),  label: '3π' },
  };
  function _price(productKey) { return PRICES[productKey] || PRICES.tshirt; }
  function _priceDollars(productKey) { return (_price(productKey).cents / 100).toFixed(2); }
  function _priceLabel(productKey) { return `${_price(productKey).label} ($${_priceDollars(productKey)})`; }

  // ── Product configs ──

  const PRODUCTS = {
    tshirt: {
      label: 'T-Shirt',
      colors: [
        { name: 'White', swatch: '#ffffff', src: 'mockups/tee-white.jpg', dark: false },
        { name: 'Black', swatch: '#1a1a1a', src: 'mockups/tee-black.jpg', dark: true },
      ],
      // Crop regions (% of source 1920×1229, front+back side by side)
      frontCrop: { x: 0.05, y: 0.05, w: 0.43, h: 0.92 },
      backCrop:  { x: 0.53, y: 0.05, w: 0.43, h: 0.92 },
      // Print zones (% of cropped frame)
      frontPrint: { x: 0.22, y: 0.30, w: 0.56, h: 0.45 },
      backPrint:  { x: 0.16, y: 0.26, w: 0.60, h: 0.50 },
      hasBack: true,
    },
    cap: {
      label: 'Cap',
      colors: [
        { name: 'White', swatch: '#ffffff', src: 'mockups/cap-mockup.jpg', dark: false,
          cropOverride: { x: 0.02, y: 0.02, w: 0.46, h: 0.31 } },
        { name: 'Black', swatch: '#1a1a1a', src: 'mockups/cap-mockup.jpg', dark: true,
          cropOverride: { x: 0.52, y: 0.02, w: 0.46, h: 0.31 } },
      ],
      frontCrop: { x: 0.02, y: 0.02, w: 0.46, h: 0.31 },
      backCrop: null,
      frontPrint: { x: 0.28, y: 0.12, w: 0.44, h: 0.44 },
      backPrint: null,
      hasBack: false,
    },
    mug: {
      label: 'Mug',
      colors: [
        { name: 'White', swatch: '#ffffff', src: 'mockups/mug-white-polygon.png', dark: false,
          backSrc: 'mockups/mug-white-pi.png' },
        { name: 'Black', swatch: '#1a1a1a', src: 'mockups/mug-black-polygon.png?v=2', dark: true,
          backSrc: 'mockups/mug-black-pi.png',
          printOverride: { x: 0.18, y: 0.32, w: 0.40, h: 0.55 } },
      ],
      frontCrop: { x: 0, y: 0, w: 1, h: 1 },
      backCrop:  { x: 0, y: 0, w: 1, h: 1 },
      // Print zone centered on the gray circle
      frontPrint: { x: 0.20, y: 0.30, w: 0.40, h: 0.55 },
      backPrint: null,
      hasBack: true,
      isMug: true,
    },
    sticker: {
      label: 'Sticker',
      colors: [
        { name: 'White', swatch: '#ffffff', src: 'mockups/sticker-white.jpg', dark: false },
      ],
      frontCrop: { x: 0.05, y: 0.05, w: 0.90, h: 0.90 },
      backCrop: null,
      frontPrint: { x: 0.10, y: 0.10, w: 0.80, h: 0.80 },
      backPrint: null,
      hasBack: false,
    },
  };

  let product = 'tshirt';
  let capturedWord = '';
  let capturedChunks = null;
  let capturedSinglePos = -1;
  let backDesign = 'polygon';   // 'polygon' or 'heatmap'
  let capDesign = 'pimark';     // 'pimark' or 'polygon' — single design for cap front
  let flipped = false;          // false = pimark front, back design back
  let colorIdx = 0;             // index into current product's colors
  let selectedSize = 'M';       // default size
  let designImages = {};        // { polygon, heatmap, pimark }
  let cart = [];                // [ { product, word, color, ... } ]
  let shopEncoding = '';        // current encoding for shop designs: 'alpha26' | 'compact' | 't9' | 'digits'

  // ─── Public entry ───

  // Auto-pick text color: black for light shirts, white for dark
  function _autoTextColor() {
    const col = _getColor();
    textColorIdx = col.dark ? 1 : 2; // 1=White, 2=Black
  }

  function _reRenderDesigns() {
    const designs = ['polygon', 'polygon-lines', 'pimark', 'heatmap'];
    for (const d of designs) {
      try { designImages[d] = _renderDesign(d, PREVIEW_SIZE); } catch (e) { console.error(e); }
    }
    _renderPreview();
  }

  function _recomputeForEncoding(mode) {
    const digits = App.getDigits();
    if (!digits || !capturedWord) return;

    shopEncoding = mode;
    const conv = Search.convertWithMode(capturedWord, mode);
    if (!conv.digitQuery) return;

    // Try single match first
    const hits = Search.findPattern(digits, conv.digitQuery);
    if (hits.length > 0) {
      capturedChunks = null;
      capturedSinglePos = hits[0];
    } else {
      // Fall back to chunked search
      const chunks = Search.findChunked(digits, conv.digitQuery);
      if (chunks.length > 1) {
        capturedChunks = chunks;
        capturedSinglePos = -1;
      } else if (chunks.length === 1) {
        capturedChunks = null;
        capturedSinglePos = chunks[0].pos;
      }
    }

    // Re-render all designs
    designImages = {};
    const designs = ['polygon', 'polygon-lines', 'pimark', 'heatmap'];
    let i = 0;
    function renderNext() {
      if (i >= designs.length) return;
      const d = designs[i++];
      try { designImages[d] = _renderDesign(d, PREVIEW_SIZE); } catch (e) { console.error(e); }
      _renderPreview();
      if (i < designs.length) setTimeout(renderNext, 0);
    }
    setTimeout(renderNext, 0);
  }

  function captureDesign(word, chunks, singlePos) {
    // Shop only supports spiral layout — switch if needed
    if (Layout.getType() !== 'spiral') {
      Layout.setType('spiral');
      Camera.setZoom(2.5);
      Camera.centerOn(0, 0);
      const radio = document.querySelector('input[name="layout"][value="spiral"]');
      if (radio) radio.checked = true;
    }
    capturedWord = (word || '').trim();
    capturedChunks = chunks;
    capturedSinglePos = singlePos;
    backDesign = 'polygon';
    flipped = false;
    product = 'tshirt';
    colorIdx = 0;
    selectedSize = 'M';
    designImages = {};
    fontIdx = 0;
    shopEncoding = Search.getTextEncoding() || 'alpha26';
    _autoTextColor();

    // Pre-fill search input
    const input = document.getElementById('shopSearchInput');
    if (input) input.value = capturedWord;

    // Show modal and preview immediately (mockups render without designs)
    showPreview();

    // Render designs in background, yielding between each to keep UI responsive
    const designs = ['polygon', 'polygon-lines', 'pimark', 'heatmap'];
    let i = 0;
    function renderNext() {
      if (i >= designs.length) return;
      const d = designs[i++];
      try {
        designImages[d] = _renderDesign(d, PREVIEW_SIZE);
      } catch (e) {
        console.error(`Shop: failed to render ${d}`, e);
      }
      _renderPreview();
      if (i < designs.length) setTimeout(renderNext, 0);
    }
    setTimeout(renderNext, 0);
  }

  // ─── Design Renderers ───

  function _renderDesign(type, size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    if (type === 'polygon') _renderPolygon(ctx, size);
    else if (type === 'polygon-lines') _renderPolygon(ctx, size, true);
    else if (type === 'heatmap') _renderHeatmap(ctx, size);
    else if (type === 'pimark') _renderPiMark(ctx, size);

    _drawPrintText(ctx, size, type);
    // Always use PNG to preserve transparency for t-shirt printing
    return canvas.toDataURL('image/png');
  }

  function _getSpiralTransform(size) {
    const digits = App.getDigits();
    if (!digits) return null;
    const effLen = Renderer.getEffectiveLength();
    const cw = Layout.getCellW();
    const ch = Layout.getCellH();
    const bounds = Layout.getBounds(effLen);
    if (!bounds) return null;

    let minX = Math.min(bounds.minX, 0);
    let minY = Math.min(bounds.minY, 0);
    let maxX = Math.max(bounds.maxX, 0);
    let maxY = Math.max(bounds.maxY, 0);

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const artSize = size * 0.75;
    const pad = 40;
    const scaleX = (artSize - pad * 2) / contentW;
    const scaleY = (artSize - pad * 2) / contentH;
    const scale = Math.min(scaleX, scaleY);
    const offX = (size - contentW * scale) / 2 - minX * scale;
    const offY = size * 0.05 + (artSize - contentH * scale) / 2 - minY * scale;

    return { digits, effLen, cw, ch, scale, offX, offY };
  }

  function _drawSpiralDots(ctx, t, alpha) {
    const colors = Renderer.getDigitColors();
    const maxDots = 15000;
    const step = Math.max(1, Math.floor(t.effLen / maxDots));
    if (alpha !== undefined) ctx.globalAlpha = alpha;

    for (let i = 0; i < t.effLen; i += step) {
      const pos = Layout.getPosition(i);
      const sx = pos.x * t.scale + t.offX;
      const sy = pos.y * t.scale + t.offY;
      const d = Number(t.digits[i]);
      ctx.fillStyle = colors[d];
      const dotSize = Math.max(1.2, Math.min(4, t.cw * t.scale * 0.8));
      ctx.fillRect(sx, sy, dotSize, dotSize);
    }
    ctx.globalAlpha = 1;
  }

  // ─── Polygon ───

  // Preload HD spiral background
  let _spiralBgImg = null;
  let _spiralBgLoaded = false;
  (function() {
    const img = new Image();
    img.onload = () => { _spiralBgImg = img; _spiralBgLoaded = true; };
    img.src = 'assets/pi-spiral-bg.png';
  })();

  function _drawSpiralBg(ctx, t, size) {
    if (!_spiralBgImg) return;
    // Center on the spiral origin (digit 0) and cover the full art area
    const imgSize = size * 0.73;
    ctx.drawImage(_spiralBgImg,
      t.offX - imgSize / 2,
      t.offY - imgSize / 2,
      imgSize, imgSize);
  }

  function _renderPolygon(ctx, size, linesOnly) {
    const t = _getSpiralTransform(size);
    if (!t) return;

    if (!linesOnly) {
      if (_spiralBgLoaded) {
        _drawSpiralBg(ctx, t, size);
      } else {
        _drawSpiralDots(ctx, t);
      }
    }

    if (capturedChunks && capturedChunks.length > 0) {
      _drawChunkPolygon(ctx, t, size);
    } else if (capturedSinglePos >= 0 && capturedSinglePos < t.effLen) {
      _drawSingleLine(ctx, t, size);
    }
  }

  function _drawChunkPolygon(ctx, t, size) {
    const n = capturedChunks.length;
    const chunkPts = [];
    for (let i = 0; i < n; i++) {
      const chunk = capturedChunks[i];
      const midIdx = chunk.pos + Math.floor(chunk.digitStr.length / 2);
      if (midIdx >= t.effLen) continue;
      const pos = Layout.getPosition(midIdx);
      chunkPts.push({
        sx: pos.x * t.scale + t.offX + t.cw * t.scale / 2,
        sy: pos.y * t.scale + t.offY + t.ch * t.scale / 2,
        color: _paletteColor(i, n),
        chunk,
        idx: i,
      });
    }
    if (chunkPts.length === 0) return;

    const center = { sx: t.offX, sy: t.offY };

    // Filled triangles
    for (let i = 0; i < chunkPts.length; i++) {
      const a = chunkPts[i];
      const b = chunkPts[(i + 1) % chunkPts.length];
      ctx.fillStyle = _hexToRgba(a.color, 0.15);
      ctx.beginPath();
      ctx.moveTo(center.sx, center.sy);
      ctx.lineTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.closePath();
      ctx.fill();
    }

    // Lines
    for (const p of chunkPts) {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(2, size * 0.004);
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(center.sx, center.sy);
      ctx.lineTo(p.sx, p.sy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Highlight boxes
    for (const pt of chunkPts) {
      const chunk = pt.chunk;
      for (let d = 0; d < chunk.digitStr.length; d++) {
        const idx = chunk.pos + d;
        if (idx >= t.effLen) continue;
        const pos = Layout.getPosition(idx);
        const sx = pos.x * t.scale + t.offX;
        const sy = pos.y * t.scale + t.offY;
        ctx.fillStyle = _hexToRgba(pt.color, 0.35);
        ctx.fillRect(sx, sy, t.cw * t.scale, t.ch * t.scale);
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(sx, sy, t.cw * t.scale, t.ch * t.scale);
      }
    }

    // Dots
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(center.sx, center.sy, Math.max(4, size * 0.008), 0, Math.PI * 2);
    ctx.fill();
    for (const p of chunkPts) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, Math.max(5, size * 0.01), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function _drawSingleLine(ctx, t, size) {
    const pos = Layout.getPosition(capturedSinglePos);
    const sx = pos.x * t.scale + t.offX + t.cw * t.scale / 2;
    const sy = pos.y * t.scale + t.offY + t.ch * t.scale / 2;
    const cx = t.offX;
    const cy = t.offY;

    // Glow
    ctx.save();
    ctx.strokeStyle = '#7c6ff7';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#7c6ff7';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(sx, sy, t.cw * t.scale * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Line
    ctx.strokeStyle = '#7c6ff7';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(sx, sy);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Dots
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7c6ff7';
    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // ─── Heat Map ───

  function _renderHeatmap(ctx, size) {
    const t = _getSpiralTransform(size);
    if (!t) return;
    const digits = t.digits;

    const matchPositions = [];
    const query = capturedWord;
    const hasLetters = /[a-zA-Z]/.test(query);
    if (hasLetters) {
      // Use selected encoding for the heat map
      const enc = shopEncoding || 'alpha26';
      const conv = Search.convertWithMode(query, enc);
      if (conv.digitQuery) {
        const hits = Search.findPattern(digits, conv.digitQuery);
        for (const h of hits) matchPositions.push(h);
      }
    } else {
      const conv = Search.convertQuery(query);
      if (conv.digitQuery) {
        const hits = Search.findPattern(digits, conv.digitQuery);
        for (const h of hits) matchPositions.push(h);
      }
    }
    if (capturedChunks) {
      for (const c of capturedChunks) matchPositions.push(c.pos);
    }
    if (capturedSinglePos >= 0 && capturedSinglePos < t.effLen) matchPositions.push(capturedSinglePos);

    const validPositions = matchPositions.filter(p => p < t.effLen);

    // Spiral as base
    if (_spiralBgLoaded) {
      _drawSpiralBg(ctx, t, size);
    } else {
      _drawSpiralDots(ctx, t, 0.5);
    }

    if (validPositions.length === 0) return;

    // Build heat grid
    const gridRes = 200;
    const heat = new Float64Array(gridRes * gridRes);
    const heatRadius = size * 0.08;

    for (const mIdx of validPositions) {
      const pos = Layout.getPosition(mIdx);
      const sx = pos.x * t.scale + t.offX;
      const sy = pos.y * t.scale + t.offY;
      const gx = Math.floor(sx / size * gridRes);
      const gy = Math.floor(sy / size * gridRes);
      const r = Math.ceil(heatRadius / size * gridRes);

      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const px = gx + dx;
          const py = gy + dy;
          if (px < 0 || px >= gridRes || py < 0 || py >= gridRes) continue;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > r) continue;
          const intensity = 1 - dist / r;
          heat[py * gridRes + px] += intensity * intensity;
        }
      }
    }

    let maxHeat = 0;
    for (let i = 0; i < heat.length; i++) {
      if (heat[i] > maxHeat) maxHeat = heat[i];
    }
    if (maxHeat <= 0) return;

    // Build heat color ramp from active palette
    const pal = _getActivePalette();
    function _heatColor(v) {
      const t2 = v * (pal.length - 1);
      const lo = Math.floor(t2);
      const hi = Math.min(lo + 1, pal.length - 1);
      const f = t2 - lo;
      const parse = hex => [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
      const a = parse(pal[lo]), b = parse(pal[hi]);
      const r = Math.round(a[0] + (b[0]-a[0])*f);
      const g = Math.round(a[1] + (b[1]-a[1])*f);
      const bl = Math.round(a[2] + (b[2]-a[2])*f);
      return `rgba(${r},${g},${bl},${Math.min(0.55, v * 0.6)})`;
    }

    const cellW = size / gridRes;
    for (let gy = 0; gy < gridRes; gy++) {
      for (let gx = 0; gx < gridRes; gx++) {
        const v = heat[gy * gridRes + gx] / maxHeat;
        if (v < 0.01) continue;
        ctx.fillStyle = _heatColor(v);
        ctx.fillRect(gx * cellW, gy * cellW, cellW + 0.5, cellW + 0.5);
      }
    }

    // Redraw spiral on top
    _drawSpiralDots(ctx, t, 0.35);

    // Bright dots at match positions
    for (const mIdx of validPositions) {
      const pos = Layout.getPosition(mIdx);
      const sx = pos.x * t.scale + t.offX;
      const sy = pos.y * t.scale + t.offY;
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(2, size * 0.004), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ─── Pi Mark ───

  // Hand-crafted π grid (1 = digit, 0 = empty). 28 cols × 24 rows.
  const PI_GRID = [
    '0000000000000000000000000000',
    '0011111111111111111111111100',
    '0011111111111111111111111100',
    '0011111111111111111111111100',
    '0000000111110000001111100000',
    '0000000111110000001111100000',
    '0000000111110000001111100000',
    '0000000111110000001111100000',
    '0000000111110000001111100000',
    '0000000111110000001111100000',
    '0000000111110000001111100000',
    '0000000111110000001111100000',
    '0000000111110000001111100000',
    '0000000111110000001111100000',
    '0000000111110000001111100000',
    '0000000111110000001111100000',
    '0000000111110000001111100000',
    '0000000111110000001111100000',
    '0000000111110000011111100000',
    '0000000111110000111111000000',
    '0000001111110001111110000000',
    '0000011111100011111100000000',
    '0000111111000111111000000000',
    '0000000000000000000000000000',
  ];
  const PI_ROWS = PI_GRID.length;
  const PI_COLS = PI_GRID[0].length;

  function _piGridInsideCount() {
    let n = 0;
    for (let r = 0; r < PI_ROWS; r++)
      for (let c = 0; c < PI_COLS; c++)
        if (PI_GRID[r][c] === '1') n++;
    return n;
  }

  function _buildPiSequence(insideCount) {
    const digits = App.getDigits();
    if (!digits) return [];
    const colors = Renderer.getDigitColors();
    const INTRO_LEN = 10;
    const SEP = '·π·';
    const SEP_LEN = SEP.length;

    // Build match set for highlighting
    const matchSet = new Set();
    if (capturedChunks) {
      for (const c of capturedChunks) {
        for (let d = 0; d < c.digitStr.length; d++) matchSet.add(c.pos + d);
      }
    } else if (capturedSinglePos >= 0) {
      const hasLetters = /[a-zA-Z]/.test(capturedWord);
      const converted = hasLetters
        ? Search.convertWithMode(capturedWord, shopEncoding || 'alpha26')
        : Search.convertQuery(capturedWord);
      const patLen = converted.digitQuery ? converted.digitQuery.length : capturedWord.length;
      for (let d = 0; d < patLen; d++) matchSet.add(capturedSinglePos + d);
    }

    function pushDigit(seq, i) {
      if (i < 0 || i >= digits.length) return;
      const d = Number(digits[i]);
      seq.push({ ch: String(d), color: colors[d], hl: matchSet.has(i) });
    }
    function pushSep(seq) {
      for (const ch of SEP) seq.push({ ch, color: 'rgba(255,255,255,0.45)', hl: false, sep: true });
    }

    // Compute how many segments we have and how much context each gets
    let segments = []; // { pos, len } for each match section
    if (capturedChunks && capturedChunks.length > 0) {
      for (const c of capturedChunks) segments.push({ pos: c.pos, len: c.digitStr.length });
    } else if (capturedSinglePos >= 0 && capturedSinglePos < digits.length) {
      const hasLetters2 = /[a-zA-Z]/.test(capturedWord);
      const converted2 = hasLetters2
        ? Search.convertWithMode(capturedWord, shopEncoding || 'alpha26')
        : Search.convertQuery(capturedWord);
      const patLen = converted2.digitQuery ? converted2.digitQuery.length : capturedWord.length;
      segments.push({ pos: capturedSinglePos, len: patLen });
    }

    const numSeg = segments.length;
    if (numSeg === 0) {
      // No match — just fill with π digits
      const seq = [];
      for (let i = 0; i < insideCount && i < digits.length; i++) pushDigit(seq, i);
      return seq;
    }

    // Fixed space: intro + separators + chunk digits
    const chunkDigitsTotal = segments.reduce((s, c) => s + c.len, 0);
    const numSeps = numSeg; // one ··· before each segment
    const fixedSlots = INTRO_LEN + (numSeps * SEP_LEN) + chunkDigitsTotal;
    const remaining = Math.max(0, insideCount - fixedSlots);

    // Distribute remaining evenly: each segment gets before + after context
    // That's numSeg*2 context zones
    const contextSlots = numSeg * 2;
    const perContext = Math.floor(remaining / contextSlots);

    const seq = [];

    // 1. First 10 digits of π
    for (let i = 0; i < Math.min(INTRO_LEN, digits.length); i++) pushDigit(seq, i);

    // 2. For each segment: ··· + perContext before + MATCH (red) + perContext after
    for (let si = 0; si < numSeg; si++) {
      const seg = segments[si];
      pushSep(seq);

      // Context before
      const beforeStart = Math.max(0, seg.pos - perContext);
      for (let i = beforeStart; i < seg.pos; i++) pushDigit(seq, i);

      // Match digits (highlighted via matchSet)
      for (let i = seg.pos; i < seg.pos + seg.len && i < digits.length; i++) pushDigit(seq, i);

      // Context after
      const afterEnd = Math.min(digits.length, seg.pos + seg.len + perContext);
      for (let i = seg.pos + seg.len; i < afterEnd; i++) pushDigit(seq, i);
    }

    // 3. Fill any leftover with continuing π digits (in case of rounding)
    let fillIdx = INTRO_LEN;
    while (seq.length < insideCount) {
      // Skip indices we've already used
      pushDigit(seq, fillIdx);
      fillIdx++;
      if (fillIdx >= digits.length) fillIdx = 0;
    }

    return seq;
  }

  function _renderPiMark(ctx, size) {
    const insideCount = _piGridInsideCount();
    const seq = _buildPiSequence(insideCount);
    if (seq.length === 0) return;

    // Compute cell size to fit π grid centered in the canvas
    const artSize = size * 0.8;
    const cellW = artSize / PI_COLS;
    const cellH = artSize / PI_ROWS;
    const fontSize = Math.min(cellW, cellH) * 0.85;
    const offX = (size - PI_COLS * cellW) / 2;
    const offY = (size - PI_ROWS * cellH) / 2;

    ctx.save();
    ctx.clearRect(0, 0, size, size);
    ctx.font = `bold ${fontSize}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let si = 0;
    for (let r = 0; r < PI_ROWS; r++) {
      for (let c = 0; c < PI_COLS; c++) {
        if (PI_GRID[r][c] !== '1') continue;
        if (si >= seq.length) break;
        const s = seq[si++];
        const cx = offX + c * cellW + cellW / 2;
        const cy = offY + r * cellH + cellH / 2;
        // Separator π gets a slightly bigger font
        if (s.sep && s.ch === 'π') {
          ctx.font = `bold ${fontSize * 1.3}px ${FONT}`;
        } else {
          ctx.font = `bold ${fontSize}px ${FONT}`;
        }

        if (s.hl) {
          const pal = _getActivePalette();
          ctx.fillStyle = pal[pal.length - 1];
          ctx.globalAlpha = 1;
        } else if (s.dim) {
          ctx.fillStyle = s.color;
          ctx.globalAlpha = 0.4;
        } else {
          ctx.fillStyle = s.color;
          ctx.globalAlpha = 0.9;
        }
        ctx.fillText(s.ch, cx, cy);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ─── Shared helpers ───

  function _getActivePalette() {
    return PALETTES[selectedPalette]?.colors || PALETTES.vibgyor.colors;
  }

  function _paletteColor(i, total) {
    const pal = _getActivePalette();
    const idx = total <= 1 ? 0 : Math.round(i * (pal.length - 1) / (total - 1));
    return pal[Math.min(idx, pal.length - 1)];
  }

  function _hexToRgba(hex, a) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function _drawPrintText(ctx, size, type) {
    // Only show text on spiral-based designs, and only if text color is set
    if (type === 'pimark') return;
    if (product !== 'tshirt') return;
    const tc = TEXT_COLORS[textColorIdx].hex;
    if (!tc) return;
    const cx = size / 2;
    const y = size * 0.86;

    ctx.save();

    // Logo: magnifying glass (circle + handle) + π
    const logoSize = size * 0.045;
    const grad = ctx.createLinearGradient(cx - logoSize, y - logoSize, cx + logoSize, y + logoSize * 0.5);
    grad.addColorStop(0, '#7c6ff7');
    grad.addColorStop(1, '#ff6b9d');

    // Measure π to compute total logo width
    ctx.font = `700 ${logoSize * 1.8}px system-ui`;
    const piW = ctx.measureText('π').width;
    const glassR = logoSize * 0.55;
    const totalLogoW = glassR * 2 + logoSize * 0.2 + piW;
    const startX = cx - totalLogoW / 2;

    // Magnifying glass circle
    const glassCx = startX + glassR;
    const glassCy = y;
    ctx.strokeStyle = grad;
    ctx.lineWidth = size * 0.004;
    ctx.beginPath();
    ctx.arc(glassCx, glassCy, glassR, 0, Math.PI * 2);
    ctx.stroke();

    // Handle
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(glassCx - glassR * 0.3, glassCy + glassR * 0.7);
    ctx.lineTo(glassCx - glassR * 0.3, glassCy + glassR * 2);
    ctx.stroke();

    // π symbol
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = grad;
    ctx.font = `700 ${logoSize * 1.8}px system-ui`;
    ctx.fillText('π', startX + glassR * 2 + logoSize * 0.2, y);

    // Search word underneath — lower, with word-wrap for long text
    if (capturedWord) {
      const wordSize = size * 0.048;
      const fontFamily = FONTS[fontIdx].css;
      const weight = fontIdx === 4 ? '900' : '600';
      ctx.textAlign = 'center';
      ctx.font = `${weight} ${wordSize}px ${fontFamily}`;
      ctx.letterSpacing = `${size * 0.004}px`;
      ctx.fillStyle = tc;
      ctx.globalAlpha = 0.85;

      const maxW = size * 0.85;
      const textW = ctx.measureText(capturedWord).width;
      if (textW > maxW) {
        // Word-wrap: split on spaces first, else mid-word
        const words = capturedWord.split(/(\s+)/);
        const lines = [];
        let cur = '';
        for (const w of words) {
          const test = cur + w;
          if (ctx.measureText(test).width > maxW && cur.length > 0) {
            lines.push(cur);
            cur = w.trimStart();
          } else {
            cur = test;
          }
        }
        if (cur) lines.push(cur);

        const lineH = wordSize * 1.25;
        const startY = y + size * 0.12 - ((lines.length - 1) * lineH) / 2;
        for (let li = 0; li < lines.length; li++) {
          ctx.fillText(lines[li], cx, startY + li * lineH);
        }
      } else {
        ctx.fillText(capturedWord, cx, y + size * 0.09);
      }
      ctx.letterSpacing = '0px';
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ─── Vicinity strip ───

  function _renderVicinityStrip() {
    const strip = document.getElementById('piVicinityStrip');
    if (!strip) return;

    const insideCount = _piGridInsideCount();
    const seq = _buildPiSequence(insideCount);
    if (seq.length === 0) { strip.classList.add('hidden'); return; }

    // Build HTML grid using the same PI_GRID
    let si = 0;
    let gridHtml = '<div class="vic-pi-grid">';
    for (let r = 0; r < PI_ROWS; r++) {
      for (let c = 0; c < PI_COLS; c++) {
        if (PI_GRID[r][c] !== '1') {
          gridHtml += '<span class="vic-empty">\u2009</span>';
        } else if (si < seq.length) {
          const s = seq[si++];
          if (s.hl) {
            const pal = _getActivePalette();
            gridHtml += `<span class="vic-highlight" style="color:${pal[pal.length - 1]}">${s.ch}</span>`;
          } else if (s.sep) {
            gridHtml += `<span style="color:${s.color}">${s.ch}</span>`;
          } else if (s.dim) {
            gridHtml += `<span style="color:${s.color};opacity:0.4">${s.ch}</span>`;
          } else {
            gridHtml += `<span style="color:${s.color};opacity:0.85">${s.ch}</span>`;
          }
        } else {
          gridHtml += '<span class="vic-dim">0</span>';
        }
      }
      gridHtml += '\n';
    }
    gridHtml += '</div>';

    // Explanatory text + part labels
    let info = '<div class="vic-info">';
    info += '<div class="vic-explain">The front design is this π — made from the actual digits of π, starting with 3.14159… and continuing to your match.</div>';
    if (capturedChunks && capturedChunks.length > 0) {
      info += '<div class="vic-parts">';
      for (let i = 0; i < capturedChunks.length; i++) {
        const c = capturedChunks[i];
        const letter = String.fromCharCode(65 + i);
        const partColor = _paletteColor(i, capturedChunks.length);
        info += `<span class="vic-part">Part ${letter}: digit <b>#${c.pos.toLocaleString()}</b> → <span style="color:${partColor};font-weight:700">${c.digitStr}</span></span>`;
      }
      info += '</div>';
    } else if (capturedSinglePos >= 0) {
      info += `<div class="vic-parts"><span class="vic-part">Match at digit <b>#${capturedSinglePos.toLocaleString()}</b></span></div>`;
    }
    info += '</div>';

    strip.innerHTML = gridHtml + info;
    strip.classList.remove('hidden');
  }

  // ─── Mockup compositing ───

  function _getProductConfig() { return PRODUCTS[product]; }
  function _getColor() { return _getProductConfig().colors[colorIdx]; }

  // Cache loaded mockup images to avoid reloading on every preview update
  const _mockupCache = {};

  function _compositeFrame(container, cropRegion, printZone, designDataUrl, colorObj, srcOverride) {
    const col = colorObj || _getColor();
    const crop = col.cropOverride || cropRegion;
    const print = col.printOverride || printZone;

    function _doComposite(img) {
      const srcX = crop.x * img.width;
      const srcY = crop.y * img.height;
      const srcW = crop.w * img.width;
      const srcH = crop.h * img.height;

      const outW = product === 'cap' ? 480 : 320;
      const outH = (srcH / srcW) * outW;

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);

      if (!designDataUrl) {
        canvas.className = 'mockup-canvas';
        container.innerHTML = '';
        container.appendChild(canvas);
        return;
      }

      const dImg = new Image();
      dImg.onload = () => {
        const px = print.x * outW;
        const py = print.y * outH;
        const pw = print.w * outW;
        const ph = print.h * outH;

        function drawDesign() {
          if (product === 'mug') {
            // Barrel warp for cylindrical mug surface
            const slices = 50, curve = 0.12;
            for (let i = 0; i < slices; i++) {
              const t = i / slices;
              const yOff = curve * Math.pow((t - 0.5) * 2, 2) * ph;
              ctx.drawImage(dImg,
                t * dImg.width, 0, dImg.width / slices, dImg.height,
                px + t * pw, py + yOff / 2, pw / slices + 1, ph - yOff);
            }
          } else {
            ctx.drawImage(dImg, px, py, pw, ph);
          }
        }

        if (col.dark) {
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = 0.9;
          drawDesign();
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 0.25;
          drawDesign();
        } else {
          ctx.globalCompositeOperation = 'multiply';
          ctx.globalAlpha = 1;
          drawDesign();
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 0.55;
          drawDesign();
        }

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;

        canvas.className = 'mockup-canvas';
        container.innerHTML = '';
        container.appendChild(canvas);
      };
      dImg.src = designDataUrl;
    }

    // Use cached mockup image if available
    const mockupSrc = srcOverride || col.src;
    if (_mockupCache[mockupSrc]) {
      _doComposite(_mockupCache[mockupSrc]);
    } else {
      const img = new Image();
      img.onload = () => {
        _mockupCache[mockupSrc] = img;
        _doComposite(img);
      };
      img.src = mockupSrc;
    }
  }

  // ─── Preview Modal ───

  function showPreview() {
    // Shop only supports spiral layout — switch if needed
    if (Layout.getType() !== 'spiral') {
      Layout.setType('spiral');
      Camera.setZoom(2.5);
      Camera.centerOn(0, 0);
      const radio = document.querySelector('input[name="layout"][value="spiral"]');
      if (radio) radio.checked = true;
    }
    const modal = document.getElementById('shopModal');
    if (!modal) return;
    modal.classList.remove('hidden');

    // Pre-fill shop search with current word
    const input = document.getElementById('shopSearchInput');
    if (input) input.value = capturedWord;

    _renderPreview();
  }

  function hidePreview() {
    const modal = document.getElementById('shopModal');
    if (modal) modal.classList.add('hidden');
  }

  function _renderPreview() {
    const cfg = _getProductConfig();
    const frameFront = document.getElementById('frameFront');
    const frameBack = document.getElementById('frameBack');
    const labelLeft = document.getElementById('frameLabelLeft');
    const labelRight = document.getElementById('frameLabelRight');
    const backFrame = document.getElementById('shopFrameBack');
    if (!frameFront) return;

    // Update price tag
    const priceTag = document.getElementById('shopPriceTag');
    if (priceTag) priceTag.textContent = `${_price(product).label} — $${_priceDollars(product)}`;

    // Product tabs
    const productPicker = document.getElementById('productPicker');
    if (productPicker) {
      productPicker.innerHTML = '';
      for (const key of Object.keys(PRODUCTS)) {
        const btn = document.createElement('button');
        btn.className = 'shop-pill' + (key === product ? ' active' : '');
        btn.textContent = PRODUCTS[key].label;
        btn.addEventListener('click', () => {
          product = key;
          colorIdx = 0;
          selectedSize = key === 'tshirt' ? 'M' : key === 'mug' ? '11oz' : key === 'sticker' ? '3×3' : 'One Size';
          _reRenderDesigns();
        });
        productPicker.appendChild(btn);
      }
    }

    // Show/hide back frame & tshirt-only controls
    const backDesignGroup = document.getElementById('backDesignGroup');
    const showBack = cfg.hasBack;
    if (showBack) {
      if (backFrame) backFrame.classList.remove('hidden');
    } else {
      if (backFrame) backFrame.classList.add('hidden');
    }
    // Back design picker only for t-shirt (mug back is fixed pi mockup)
    if (cfg.hasBack && product !== 'mug') {
      if (backDesignGroup) backDesignGroup.classList.remove('hidden');
    } else {
      if (backDesignGroup) backDesignGroup.classList.add('hidden');
    }

    // Flip button: only for t-shirt (not mug — back is static)
    const flipBtn = document.getElementById('shopFlip');
    if (flipBtn) flipBtn.classList.toggle('hidden', product !== 'tshirt');

    // Front frame
    if (product === 'mug') {
      // Mug FRONT: composite polygon lines onto blank mockup with barrel warp
      labelLeft.textContent = 'FRONT';
      labelRight.textContent = 'BACK';
      _compositeFrame(frameFront, cfg.frontCrop, cfg.frontPrint, designImages['polygon-lines']);
      // Mug BACK: show the pi digits mockup as-is (design baked into photo)
      const col = _getColor();
      const backSrc = col.backSrc;
      if (backSrc) {
        _compositeFrame(frameBack, cfg.backCrop, null, null, col, backSrc);
      }
    } else if (product === 'sticker') {
      // Sticker: render polygon design directly
      labelLeft.textContent = 'STICKER';
      const dataUrl = designImages['polygon'];
      if (dataUrl) {
        const img = new Image();
        img.onload = () => {
          const sz = 300;
          const canvas = document.createElement('canvas');
          canvas.width = sz; canvas.height = sz;
          const ctx = canvas.getContext('2d');
          ctx.beginPath();
          const r = sz * 0.08;
          ctx.moveTo(r, 0); ctx.lineTo(sz - r, 0); ctx.quadraticCurveTo(sz, 0, sz, r);
          ctx.lineTo(sz, sz - r); ctx.quadraticCurveTo(sz, sz, sz - r, sz);
          ctx.lineTo(r, sz); ctx.quadraticCurveTo(0, sz, 0, sz - r);
          ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
          ctx.closePath(); ctx.clip();
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, sz, sz);
          const pad = sz * 0.05;
          ctx.drawImage(img, pad, pad, sz - pad * 2, sz - pad * 2);
          canvas.className = 'mockup-canvas';
          frameFront.innerHTML = '';
          frameFront.appendChild(canvas);
        };
        img.src = dataUrl;
      }
    } else if (cfg.hasBack) {
      // T-shirt: front + back
      const frontDesign = flipped ? backDesign : 'pimark';
      const backDesignKey = flipped ? 'pimark' : backDesign;
      labelLeft.textContent = 'FRONT';
      labelRight.textContent = 'BACK';

      _compositeFrame(frameFront, cfg.frontCrop, cfg.frontPrint, designImages[frontDesign]);
      _compositeFrame(frameBack, cfg.backCrop, cfg.backPrint, designImages[backDesignKey]);
    } else {
      // Cap: single front
      labelLeft.textContent = 'FRONT';
      _compositeFrame(frameFront, cfg.frontCrop, cfg.frontPrint, designImages[capDesign]);
    }

    // Pi vicinity strip — show what digits fill the π (not for sticker)
    if (product === 'sticker') {
      const strip = document.getElementById('piVicinityStrip');
      if (strip) strip.classList.add('hidden');
    } else {
      _renderVicinityStrip();
    }

    // Back design picker (t-shirt only, not mug)
    const picker = document.getElementById('backDesignPicker');
    if (picker) {
      picker.innerHTML = '';
      if (cfg.hasBack && product !== 'mug') {
        for (const d of ['polygon', 'heatmap']) {
          const btn = document.createElement('button');
          btn.className = 'shop-pill' + (d === backDesign ? ' active' : '');
          btn.textContent = d === 'polygon' ? 'Polygon' : 'Heat Map';
          btn.addEventListener('click', () => { backDesign = d; _renderPreview(); });
          picker.appendChild(btn);
        }
      }
    }

    // Encoding picker (for letter-based queries)
    const encPicker = document.getElementById('shopEncodingPicker');
    const encGroup = document.getElementById('shopEncodingGroup');
    const hasLetters = /[a-zA-Z]/.test(capturedWord);
    if (encPicker && encGroup) {
      if (hasLetters) {
        encGroup.classList.remove('hidden');
        encPicker.innerHTML = '';
        for (const enc of ['alpha26', 'compact', 't9']) {
          const btn = document.createElement('button');
          btn.className = 'shop-pill' + (enc === shopEncoding ? ' active' : '');
          btn.textContent = enc === 'alpha26' ? 'Alpha-26' : enc === 'compact' ? 'Compact' : 'T9';
          btn.addEventListener('click', () => { _recomputeForEncoding(enc); });
          encPicker.appendChild(btn);
        }
      } else {
        encGroup.classList.add('hidden');
      }
    }

    // Palette picker
    const palGroup = document.getElementById('shopPaletteGroup');
    const palPicker = document.getElementById('shopPalettePicker');
    if (palGroup && palPicker) {
      palGroup.classList.remove('hidden');
      palPicker.innerHTML = '';
      for (const key of Object.keys(PALETTES)) {
        const p = PALETTES[key];
        const btn = document.createElement('button');
        btn.className = 'shop-palette-swatch' + (key === selectedPalette ? ' active' : '');
        btn.title = p.name;
        // Mini gradient preview
        const grad = p.colors.map((c, i) => `${c} ${Math.round(i/(p.colors.length-1)*100)}%`).join(',');
        btn.style.background = `linear-gradient(90deg, ${grad})`;
        btn.addEventListener('click', () => {
          selectedPalette = key;
          _reRenderDesigns();
        });
        palPicker.appendChild(btn);
      }
    }

    // Cap design picker (cap only, not sticker/mug)
    const capPicker = document.getElementById('capDesignGroup');
    if (capPicker) {
      if (!cfg.hasBack && product === 'cap') {
        capPicker.classList.remove('hidden');
        const capRow = document.getElementById('capDesignPicker');
        if (capRow) {
          capRow.innerHTML = '';
          for (const d of ['pimark', 'polygon']) {
            const btn = document.createElement('button');
            btn.className = 'shop-pill' + (d === capDesign ? ' active' : '');
            btn.textContent = d === 'pimark' ? 'Pi Mark' : 'Polygon';
            btn.addEventListener('click', () => { capDesign = d; _renderPreview(); });
            capRow.appendChild(btn);
          }
        }
      } else {
        capPicker.classList.add('hidden');
      }
    }

    // Color picker (hide for single-color products)
    const colorPicker = document.getElementById('shirtColorPicker');
    const colorRow = colorPicker?.closest('.shop-option-row');
    if (colorPicker) {
      if (colorRow) colorRow.classList.toggle('hidden', cfg.colors.length <= 1);
      colorPicker.innerHTML = '';
      cfg.colors.forEach((c, i) => {
        const btn = document.createElement('button');
        btn.className = 'shop-color-swatch' + (i === colorIdx ? ' active' : '');
        btn.style.background = c.swatch;
        if (c.swatch === '#ffffff') btn.style.border = '1px solid var(--border)';
        btn.title = c.name;
        btn.addEventListener('click', () => {
          colorIdx = i;
          _autoTextColor();
          _reRenderDesigns();
        });
        colorPicker.appendChild(btn);
      });
    }

    // Text color picker (t-shirt only)
    const textPicker = document.getElementById('textColorPicker');
    const textRow = textPicker?.closest('.shop-option-row');
    if (textPicker) {
      const showText = product === 'tshirt';
      if (textRow) textRow.classList.toggle('hidden', !showText);
      textPicker.innerHTML = '';
      TEXT_COLORS.forEach((c, i) => {
        const btn = document.createElement('button');
        btn.className = 'shop-color-swatch' + (i === textColorIdx ? ' active' : '');
        if (c.hex) {
          btn.style.background = c.hex;
          if (c.hex === '#ffffff') btn.style.border = '1px solid var(--border)';
        } else {
          // "None" — diagonal strike-through
          btn.style.background = 'var(--bg-surface)';
          btn.style.border = '1px solid var(--border)';
          btn.style.position = 'relative';
          btn.style.overflow = 'hidden';
          btn.innerHTML = '<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--text-dim)">✕</span>';
        }
        btn.title = c.name;
        btn.addEventListener('click', () => {
          textColorIdx = i;
          _reRenderDesigns();
        });
        textPicker.appendChild(btn);
      });
    }

    // Font picker (t-shirt only, when text is visible)
    const fontPicker = document.getElementById('fontPicker');
    const fontRow = fontPicker?.closest('.shop-option-row');
    if (fontPicker) {
      const showFont = product === 'tshirt' && TEXT_COLORS[textColorIdx].hex;
      if (fontRow) fontRow.classList.toggle('hidden', !showFont);
      fontPicker.innerHTML = '';
      FONTS.forEach((f, i) => {
        const btn = document.createElement('button');
        btn.className = 'shop-pill' + (i === fontIdx ? ' active' : '');
        btn.textContent = f.name;
        btn.style.fontFamily = f.css;
        btn.addEventListener('click', () => {
          fontIdx = i;
          _reRenderDesigns();
        });
        fontPicker.appendChild(btn);
      });
    }

    // Size picker
    const sizePicker = document.getElementById('sizePicker');
    if (sizePicker) {
      const sizes = product === 'tshirt' ? ['XS','S','M','L','XL','XXL']
        : product === 'mug' ? ['11oz']
        : product === 'sticker' ? ['3×3']
        : ['One Size'];
      sizePicker.innerHTML = '';
      sizes.forEach(s => {
        const btn = document.createElement('button');
        btn.className = 'shop-pill' + (s === selectedSize ? ' active' : '');
        btn.textContent = s;
        btn.addEventListener('click', () => { selectedSize = s; _renderPreview(); });
        sizePicker.appendChild(btn);
      });
    }
  }


  function _getFrontDesignKey() {
    const cfg = _getProductConfig();
    if (!cfg.hasBack) return capDesign;
    return flipped ? backDesign : 'pimark';
  }

  function _getBackDesignKey() {
    return flipped ? 'pimark' : backDesign;
  }

  // ─── Cart ───

  function addToCart() {
    const cfg = _getProductConfig();
    const col = _getColor();
    if (typeof UI !== 'undefined' && UI.unlock) UI.unlock('shopaholic');

    // Render high-res print files for this item
    const frontHires = _renderDesign(_getFrontDesignKey(), PRINT_SIZE);
    const backHires = cfg.hasBack ? _renderDesign(_getBackDesignKey(), PRINT_SIZE) : null;

    // Capture the mockup preview (design on shirt) for Stripe checkout image
    const frameFront = document.getElementById('frameFront');
    const mockupCanvas = frameFront && frameFront.querySelector('canvas');
    const mockupImg = mockupCanvas ? mockupCanvas.toDataURL('image/jpeg', 0.7) : null;

    const cartItem = {
      product,
      productLabel: cfg.label,
      word: capturedWord,
      size: selectedSize,
      colorName: col.name,
      colorSwatch: col.swatch,
      backDesign,
      flipped,
      frontImg: designImages[_getFrontDesignKey()],
      backImg: cfg.hasBack ? designImages[_getBackDesignKey()] : null,
      frontHires,
      backHires,
      mockupImg,
      // Will be filled by background upload
      _uploadReady: null,
    };

    // Start uploading designs immediately in background
    const orderId = `order_${Date.now()}_${cart.length}`;
    const designs = { front: frontHires };
    if (backHires) designs.back = backHires;
    if (mockupImg) designs.mockup = mockupImg;

    cartItem._uploaded = false;
    cartItem._uploadFailed = false;
    cartItem._uploadPct = 0;

    const payload = JSON.stringify({ orderId, designs });
    cartItem._uploadReady = new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          cartItem._uploadPct = Math.round((e.loaded / e.total) * 100);
          _updateCartStatus();
        }
      });
      xhr.addEventListener('load', () => {
        if (xhr.status !== 200) { reject(new Error('Design upload failed')); return; }
        const data = JSON.parse(xhr.responseText);
        cartItem._designUrls = { front: data.urls.front, ...(data.urls.back && { back: data.urls.back }) };
        cartItem._mockupUrl = data.urls.mockup || null;
        cartItem._uploaded = true;
        cartItem._uploadPct = 100;
        cartItem.frontHires = null;
        cartItem.backHires = null;
        cartItem.mockupImg = null;
        _renderCart();
        resolve();
      });
      xhr.addEventListener('error', () => reject(new Error('Network error')));
      xhr.open('POST', '/api/upload-design');
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(payload);
    }).catch(err => {
      console.warn('Background upload failed, will retry at checkout:', err);
      cartItem._designUrls = null;
      cartItem._uploadFailed = true;
      _renderCart();
    });

    cart.push(cartItem);
    _renderCart();
  }

  // Lightweight update — only patches status text without rebuilding DOM (keeps spinner alive)
  function _updateCartStatus() {
    const itemsEl = document.getElementById('cartItems');
    if (!itemsEl) return;
    cart.forEach((item, i) => {
      const row = itemsEl.children[i];
      if (!row) return;
      const statusEl = row.querySelector('.cart-item-status');
      if (!statusEl) return;
      if (item._uploaded) {
        if (!statusEl.classList.contains('ready')) {
          statusEl.className = 'cart-item-status ready';
          statusEl.textContent = 'Ready to print';
        }
      } else if (item._uploadFailed) {
        if (!statusEl.classList.contains('failed')) {
          statusEl.className = 'cart-item-status failed';
          statusEl.textContent = 'Upload failed — will retry at checkout';
        }
      } else {
        // Update percentage text only — leave spinner element alone
        const pctNode = statusEl.querySelector('.cart-upload-pct');
        if (pctNode) pctNode.textContent = `${item._uploadPct}%`;
      }
    });
  }

  function removeFromCart(idx) {
    cart.splice(idx, 1);
    _renderCart();
  }

  function _cartTotal() {
    return cart.reduce((sum, item) => sum + _price(item.product).cents, 0);
  }

  function _renderCart() {
    const cartEl = document.getElementById('shopCart');
    const countEl = document.getElementById('cartCount');
    const itemsEl = document.getElementById('cartItems');
    const checkoutBtn = document.getElementById('shopCheckout');
    if (!cartEl || !itemsEl) return;

    // Always show the cart section
    cartEl.classList.remove('hidden');
    countEl.textContent = cart.length;
    checkoutBtn.disabled = cart.length === 0;

    const totalCents = _cartTotal();
    checkoutBtn.textContent = cart.length > 0
      ? `Checkout — $${(totalCents / 100).toFixed(2)}`
      : 'Checkout';

    itemsEl.innerHTML = '';
    if (cart.length === 0) {
      itemsEl.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-dim);font-size:13px">Cart is empty</div>';
    }
    cart.forEach((item, i) => {
      const row = document.createElement('div');
      row.className = 'shop-cart-item';
      const uploadMsgs = [
        'Baking your slice of \u03C0...',
        'Sending your digits to the press...',
        'Wrapping your place in \u03C0...',
        'Stitching \u03C0xels together...',
        'Beaming your design to the universe...',
        'Rolling your \u03C0 into a shirt...',
      ];
      const uploadMsg = uploadMsgs[i % uploadMsgs.length];
      const statusHtml = item._uploaded
        ? '<span class="cart-item-status ready">Ready to print</span>'
        : item._uploadFailed
          ? '<span class="cart-item-status failed">Upload failed — will retry at checkout</span>'
          : `<span class="cart-item-status uploading"><span class="cart-spinner"></span>${uploadMsg} <span class="cart-upload-pct">${item._uploadPct}%</span></span>`;
      row.innerHTML = `
        <div class="cart-item-thumb" style="background:${item.colorSwatch};${item.colorSwatch === '#ffffff' ? 'border:1px solid var(--border)' : ''}">
          <img src="${item.frontImg}" class="cart-item-img" alt="Front">
        </div>
        <div class="cart-item-info">
          <div class="cart-item-word">${item.word}</div>
          <div class="cart-item-detail">${item.productLabel} · ${item.colorName} · ${item.size}</div>
          ${statusHtml}
        </div>
        <div class="cart-item-price"><span class="cart-pi-price">${_price(item.product).label}</span> $${_priceDollars(item.product)}</div>
        <button class="cart-item-remove" data-idx="${i}">&times;</button>
      `;
      row.querySelector('.cart-item-remove').addEventListener('click', () => removeFromCart(i));
      itemsEl.appendChild(row);
    });
  }

  // ─── Checkout ───

  async function checkout() {
    if (cart.length === 0) return;

    const checkoutBtn = document.getElementById('shopCheckout');
    if (checkoutBtn) {
      checkoutBtn.disabled = true;
      checkoutBtn.textContent = 'Processing...';
    }

    try {
      // 1. Wait for background uploads that started at add-to-cart time
      await Promise.all(cart.map(item => item._uploadReady));

      // Retry any that failed during background upload
      for (const item of cart) {
        if (item._designUrls) continue;
        const orderId = `order_${Date.now()}_retry`;
        const designs = { front: item.frontHires };
        if (item.backHires) designs.back = item.backHires;
        if (item.mockupImg) designs.mockup = item.mockupImg;
        const res = await fetch('/api/upload-design', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, designs }),
        });
        if (!res.ok) throw new Error('Design upload failed');
        const data = await res.json();
        item._designUrls = { front: data.urls.front, ...(data.urls.back && { back: data.urls.back }) };
        item._mockupUrl = data.urls.mockup || null;
      }

      const items = cart.map(item => ({
        product: item.product,
        productLabel: item.productLabel,
        word: item.word,
        size: item.size,
        colorName: item.colorName,
        designUrls: item._designUrls,
        mockupUrl: item._mockupUrl,
      }));

      // 2. Create Stripe checkout session
      const checkoutRes = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok) throw new Error(checkoutData.error || 'Checkout failed');

      // 3. Redirect to Stripe
      if (typeof UI !== 'undefined' && UI.unlock) UI.unlock('pi_owner');
      window.location.href = checkoutData.url;
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Checkout failed: ' + err.message);
      if (checkoutBtn) {
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = `Checkout — $${(_cartTotal() / 100).toFixed(2)}`;
      }
    }
  }

  // ─── In-shop search ───

  function _shopSearch() {
    const input = document.getElementById('shopSearchInput');
    const status = document.getElementById('shopSearchStatus');
    if (!input || !status) return;

    const displayWord = input.value.trim();
    const searchWord = displayWord.replace(/[^a-zA-Z0-9]/g, '');
    if (!searchWord) return;

    const digits = App.getDigits();
    if (!digits) return;

    status.classList.remove('hidden');
    status.textContent = 'Searching…';

    const hasLetters = /[a-zA-Z]/.test(searchWord);
    const converted = hasLetters
      ? Search.convertWithMode(searchWord, shopEncoding || 'alpha26')
      : Search.convertQuery(searchWord);
    if (!converted.digitQuery) {
      status.textContent = 'Could not encode — try letters or digits.';
      return;
    }

    // Try direct local search first
    const hits = Search.findPattern(digits, converted.digitQuery);
    if (hits.length > 0) {
      status.innerHTML = `Found "<b>${displayWord}</b>" at digit #${hits[0].toLocaleString()}`;
      captureDesign(displayWord, null, hits[0]);
      return;
    }

    // Try multi-part
    const chunks = Search.findChunked(digits, converted.digitQuery);
    if (chunks.length > 1) {
      status.innerHTML = `Found "<b>${displayWord}</b>" in ${chunks.length} parts (Multi-Part)`;
      captureDesign(displayWord, chunks, -1);
      return;
    }

    status.textContent = `"${displayWord}" not found locally — try from the main search for API lookup.`;
  }

  // ─── Init ───

  function init() {
    const closeBtn = document.getElementById('shopModalClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        hidePreview();
      });
    }


    const addCartBtn = document.getElementById('shopAddCart');
    if (addCartBtn) addCartBtn.addEventListener('click', addToCart);

    const checkoutBtn = document.getElementById('shopCheckout');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', checkout);
    }

    const SHOW_DOWNLOAD = false; // toggle to true to enable download button
    const dlBtn = document.getElementById('shopDownloadDesign');
    if (dlBtn) {
      dlBtn.style.display = SHOW_DOWNLOAD ? 'block' : 'none';
      dlBtn.addEventListener('click', () => {
        const word = capturedWord || 'design';
        const designs = ['pimark', 'polygon', 'heatmap'];
        for (const key of designs) {
          const hires = _renderDesign(key, PRINT_SIZE);
          const a = document.createElement('a');
          a.href = hires;
          a.download = `pimap-${key}-${word}-3000px.png`;
          a.click();
        }
      });
    }

    const flipBtn = document.getElementById('shopFlip');
    if (flipBtn) {
      flipBtn.addEventListener('click', () => {
        flipped = !flipped;
        flipBtn.classList.toggle('flipped', flipped);
        _renderPreview();
      });
    }

    // In-shop search
    const searchBtn = document.getElementById('shopSearchBtn');
    const searchInput = document.getElementById('shopSearchInput');
    if (searchBtn) searchBtn.addEventListener('click', _shopSearch);
    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') _shopSearch();
      });
    }

    const modal = document.getElementById('shopModal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) hidePreview();
      });
    }

    // Shop open button (always visible)
    const shopBtn = document.getElementById('shopBtn');
    if (shopBtn) {
      shopBtn.addEventListener('click', () => {
        // Open shop with default state if no design captured yet
        if (!designImages.pimark) {
          captureDesign('PI', null, -1);
        } else {
          showPreview();
        }
      });
    }
  }

  return { init, captureDesign, showPreview, hidePreview };
})();
