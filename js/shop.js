const Shop = (() => {
  const PRINT_SIZE = 3000;
  const PREVIEW_SIZE = 500;
  const FONT = '"Cascadia Code", "Fira Code", Consolas, monospace';
  const VIBGYOR = ['#9400D3','#4B0082','#0000FF','#00AA00','#FFD700','#FF8C00','#FF0000'];

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
      backPrint:  { x: 0.18, y: 0.26, w: 0.60, h: 0.50 },
      hasBack: true,
    },
    cap: {
      label: 'Cap',
      colors: [
        // Cap mockup 5111×5111, 2×3 grid. Front views are top row.
        { name: 'White', swatch: '#ffffff', src: 'mockups/cap-mockup.jpg', dark: false,
          cropOverride: { x: 0.02, y: 0.02, w: 0.46, h: 0.31 } },
        { name: 'Black', swatch: '#1a1a1a', src: 'mockups/cap-mockup.jpg', dark: true,
          cropOverride: { x: 0.52, y: 0.02, w: 0.46, h: 0.31 } },
      ],
      frontCrop: { x: 0.02, y: 0.02, w: 0.46, h: 0.31 }, // white default
      backCrop: null,
      // Print zone on cap front panel
      frontPrint: { x: 0.28, y: 0.12, w: 0.44, h: 0.44 },
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

  // ─── Public entry ───

  function captureDesign(word, chunks, singlePos) {
    capturedWord = (word || '').toUpperCase().replace(/\s+/g, '');
    capturedChunks = chunks;
    capturedSinglePos = singlePos;
    backDesign = 'polygon';
    flipped = false;
    product = 'tshirt';
    colorIdx = 0;
    selectedSize = 'M';
    designImages = {};

    // Pre-fill search input
    const input = document.getElementById('shopSearchInput');
    if (input) input.value = capturedWord;

    // Show modal and preview immediately (mockups render without designs)
    showPreview();

    // Render designs in background, yielding between each to keep UI responsive
    const designs = ['polygon', 'pimark', 'heatmap'];
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
    else if (type === 'heatmap') _renderHeatmap(ctx, size);
    else if (type === 'pimark') _renderPiMark(ctx, size);

    _drawPrintText(ctx, size, type);
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

  function _renderPolygon(ctx, size) {
    const t = _getSpiralTransform(size);
    if (!t) return;

    _drawSpiralDots(ctx, t);

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
        color: _vibgyorColor(i, n),
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
    const modes = ['t9', 'compact', 'alpha26'];
    for (const mode of modes) {
      const conv = Search.convertWithMode(query, mode);
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
    _drawSpiralDots(ctx, t, 0.5);

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

    const cellW = size / gridRes;
    for (let gy = 0; gy < gridRes; gy++) {
      for (let gx = 0; gx < gridRes; gx++) {
        const v = heat[gy * gridRes + gx] / maxHeat;
        if (v < 0.01) continue;

        let r, g, b;
        if (v < 0.33) {
          const t2 = v / 0.33;
          r = 0; g = Math.floor(100 * t2); b = Math.floor(200 + 55 * t2);
        } else if (v < 0.66) {
          const t2 = (v - 0.33) / 0.33;
          r = Math.floor(255 * t2); g = Math.floor(100 + 155 * t2); b = Math.floor(255 * (1 - t2));
        } else {
          const t2 = (v - 0.66) / 0.34;
          r = 255; g = Math.floor(255 * (1 - t2 * 0.7)); b = 0;
        }

        ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(0.55, v * 0.6)})`;
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
      const converted = Search.convertQuery(capturedWord);
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
      const converted = Search.convertQuery(capturedWord);
      const patLen = converted.digitQuery ? converted.digitQuery.length : capturedWord.length;
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
          ctx.fillStyle = '#ff6b9d';
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

  function _vibgyorColor(i, total) {
    const idx = total <= 1 ? 0 : Math.round(i * (VIBGYOR.length - 1) / (total - 1));
    return VIBGYOR[Math.min(idx, VIBGYOR.length - 1)];
  }

  function _hexToRgba(hex, a) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function _drawPrintText(ctx, size, type) {
    // No text on any design — just the graphic
    return;

    const cx = size / 2;
    const y = size * 0.84;

    // "Place in π" logo
    ctx.save();
    ctx.textBaseline = 'middle';
    const logoSize = size * 0.028;

    ctx.font = `700 ${logoSize}px system-ui`;
    const pW = ctx.measureText('P').width;
    ctx.font = `300 ${logoSize}px system-ui`;
    const laceW = ctx.measureText('lace in ').width;
    ctx.font = `700 ${logoSize * 1.15}px system-ui`;
    const piW = ctx.measureText('π').width;
    const totalW = pW + laceW + piW;
    let lx = cx - totalW / 2;

    const isDark = _getColor().dark;
    const textMain = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(20,20,40,0.85)';
    const textDim  = isDark ? 'rgba(255,255,255,0.4)'  : 'rgba(20,20,40,0.4)';
    const laceColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(20,20,40,0.6)';

    ctx.textAlign = 'left';
    ctx.fillStyle = '#7c6ff7';
    ctx.font = `700 ${logoSize}px system-ui`;
    ctx.fillText('P', lx, y);
    lx += pW;

    ctx.fillStyle = laceColor;
    ctx.font = `300 ${logoSize}px system-ui`;
    ctx.fillText('lace in ', lx, y);
    lx += laceW;

    ctx.fillStyle = '#ff6b9d';
    ctx.font = `700 ${logoSize * 1.15}px system-ui`;
    ctx.fillText('π', lx, y);
    ctx.restore();

    // Search term (small, elegant)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textMain;
    ctx.font = `300 ${size * 0.022}px system-ui`;
    ctx.fillText(capturedWord, cx, y + size * 0.04);

    // Position subtitle
    ctx.fillStyle = textDim;
    ctx.font = `300 ${size * 0.015}px system-ui`;
    let subtitle = '';
    if (capturedChunks && capturedChunks.length > 0) {
      const positions = capturedChunks.map(c => `#${c.pos.toLocaleString()}`).join(' · ');
      subtitle = `${capturedChunks.length} parts — ${positions}`;
    } else if (capturedSinglePos >= 0) {
      subtitle = `digit #${capturedSinglePos.toLocaleString()}`;
    }
    ctx.fillText(subtitle, cx, y + size * 0.07);
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
            gridHtml += `<span class="vic-highlight">${s.ch}</span>`;
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
        info += `<span class="vic-part">Part ${letter}: digit <b>#${c.pos.toLocaleString()}</b> → <span class="vic-highlight">${c.digitStr}</span></span>`;
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

  function _compositeFrame(container, cropRegion, printZone, designDataUrl, colorObj) {
    const col = colorObj || _getColor();
    // Use color-specific crop if available (e.g. cap black vs white from same image)
    const crop = col.cropOverride || cropRegion;
    const img = new Image();
    img.onload = () => {
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

      // Draw mockup photo
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);

      // Composite design
      if (!designDataUrl) {
        container.innerHTML = '';
        canvas.className = 'mockup-canvas';
        container.appendChild(canvas);

        return;
      }

      const dImg = new Image();
      dImg.onload = () => {
        const pz = printZone;
        const px = pz.x * outW;
        const py = pz.y * outH;
        const pw = pz.w * outW;
        const ph = pz.h * outH;

        const isDark = col.dark;
        if (isDark) {
          // Screen blend for dark fabrics — light design on dark shirt
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = 0.9;
          ctx.drawImage(dImg, px, py, pw, ph);

          // Normal overlay for sharpness
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 0.25;
          ctx.drawImage(dImg, px, py, pw, ph);
        } else {
          // Multiply blend for light fabrics
          ctx.globalCompositeOperation = 'multiply';
          ctx.globalAlpha = 1;
          ctx.drawImage(dImg, px, py, pw, ph);

          // Normal overlay for vibrancy and sharpness
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 0.55;
          ctx.drawImage(dImg, px, py, pw, ph);
        }

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;

        container.innerHTML = '';
        canvas.className = 'mockup-canvas';
        container.appendChild(canvas);

      };
      dImg.src = designDataUrl;
    };
    img.src = col.src;
  }

  // ─── Preview Modal ───

  function showPreview() {
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
          selectedSize = PRODUCTS[key].hasBack ? 'M' : 'One Size';
          _renderPreview();
        });
        productPicker.appendChild(btn);
      }
    }

    // Show/hide back frame & tshirt-only controls
    const flipBtn = document.getElementById('shopFlip');
    const backDesignGroup = document.getElementById('backDesignGroup');
    if (cfg.hasBack) {
      if (backFrame) backFrame.classList.remove('hidden');
      if (flipBtn) flipBtn.classList.remove('hidden');
      if (backDesignGroup) backDesignGroup.classList.remove('hidden');
    } else {
      if (backFrame) backFrame.classList.add('hidden');
      if (flipBtn) flipBtn.classList.add('hidden');
      if (backDesignGroup) backDesignGroup.classList.add('hidden');
    }

    // Front frame
    if (cfg.hasBack) {
      // T-shirt: front + back
      const frontDesign = flipped ? backDesign : 'pimark';
      const backDesignKey = flipped ? 'pimark' : backDesign;
      labelLeft.textContent = 'FRONT';
      labelRight.textContent = 'BACK';

      frameFront.innerHTML = '<div class="mockup-loading">Loading...</div>';
      _compositeFrame(frameFront, cfg.frontCrop, cfg.frontPrint, designImages[frontDesign]);

      frameBack.innerHTML = '<div class="mockup-loading">Loading...</div>';
      _compositeFrame(frameBack, cfg.backCrop, cfg.backPrint, designImages[backDesignKey]);
    } else {
      // Cap: single front
      labelLeft.textContent = 'FRONT';
      frameFront.innerHTML = '<div class="mockup-loading">Loading...</div>';
      _compositeFrame(frameFront, cfg.frontCrop, cfg.frontPrint, designImages[capDesign]);
    }

    // Pi vicinity strip — show what digits fill the π
    _renderVicinityStrip();

    // Back design picker (t-shirt only)
    const picker = document.getElementById('backDesignPicker');
    if (picker) {
      picker.innerHTML = '';
      if (cfg.hasBack) {
        for (const d of ['polygon', 'heatmap']) {
          const btn = document.createElement('button');
          btn.className = 'shop-pill' + (d === backDesign ? ' active' : '');
          btn.textContent = d === 'polygon' ? 'Polygon' : 'Heat Map';
          btn.addEventListener('click', () => { backDesign = d; _renderPreview(); });
          picker.appendChild(btn);
        }
      }
    }

    // Cap design picker
    const capPicker = document.getElementById('capDesignGroup');
    if (capPicker) {
      if (!cfg.hasBack) {
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

    // Color picker
    const colorPicker = document.getElementById('shirtColorPicker');
    if (colorPicker) {
      colorPicker.innerHTML = '';
      cfg.colors.forEach((c, i) => {
        const btn = document.createElement('button');
        btn.className = 'shop-color-swatch' + (i === colorIdx ? ' active' : '');
        btn.style.background = c.swatch;
        if (c.swatch === '#ffffff') btn.style.border = '1px solid var(--border)';
        btn.title = c.name;
        btn.addEventListener('click', () => { colorIdx = i; _renderPreview(); });
        colorPicker.appendChild(btn);
      });
    }

    // Size picker
    const sizePicker = document.getElementById('sizePicker');
    if (sizePicker) {
      const sizes = cfg.hasBack ? ['XS','S','M','L','XL','XXL'] : ['One Size'];
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

  function downloadDesign() {
    const cfg = _getProductConfig();
    const frontFull = _renderDesign(_getFrontDesignKey(), PRINT_SIZE);

    const a1 = document.createElement('a');
    a1.href = frontFull;
    a1.download = `placeinpi-${capturedWord.toLowerCase()}-${product}-front.png`;
    a1.click();

    if (cfg.hasBack) {
      const backFull = _renderDesign(_getBackDesignKey(), PRINT_SIZE);
      setTimeout(() => {
        const a2 = document.createElement('a');
        a2.href = backFull;
        a2.download = `placeinpi-${capturedWord.toLowerCase()}-${product}-back.png`;
        a2.click();
      }, 300);
    }
  }

  // ─── Cart ───

  function addToCart() {
    const cfg = _getProductConfig();
    const col = _getColor();
    if (typeof UI !== 'undefined' && UI.unlock) UI.unlock('shopaholic');

    cart.push({
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
    });

    _renderCart();
  }

  function removeFromCart(idx) {
    cart.splice(idx, 1);
    _renderCart();
  }

  function _renderCart() {
    const cartEl = document.getElementById('shopCart');
    const countEl = document.getElementById('cartCount');
    const itemsEl = document.getElementById('cartItems');
    const checkoutBtn = document.getElementById('shopCheckout');
    if (!cartEl || !itemsEl) return;

    countEl.textContent = cart.length;

    if (cart.length === 0) {
      cartEl.classList.add('hidden');
      return;
    }

    cartEl.classList.remove('hidden');
    checkoutBtn.disabled = true; // Coming soon

    itemsEl.innerHTML = '';
    cart.forEach((item, i) => {
      const row = document.createElement('div');
      row.className = 'shop-cart-item';
      row.innerHTML = `
        <div class="cart-item-thumb" style="background:${item.colorSwatch};${item.colorSwatch === '#ffffff' ? 'border:1px solid var(--border)' : ''}">
          <img src="${item.frontImg}" class="cart-item-img" alt="Front">
        </div>
        <div class="cart-item-info">
          <div class="cart-item-word">${item.word}</div>
          <div class="cart-item-detail">${item.productLabel} · ${item.colorName} · ${item.size}</div>
        </div>
        <button class="cart-item-remove" data-idx="${i}">&times;</button>
      `;
      row.querySelector('.cart-item-remove').addEventListener('click', () => removeFromCart(i));
      itemsEl.appendChild(row);
    });
  }

  // ─── In-shop search ───

  function _shopSearch() {
    const input = document.getElementById('shopSearchInput');
    const status = document.getElementById('shopSearchStatus');
    if (!input || !status) return;

    const raw = input.value.replace(/[^a-zA-Z0-9]/g, '').trim();
    if (!raw) return;

    const digits = App.getDigits();
    if (!digits) return;

    status.classList.remove('hidden');
    status.textContent = 'Searching…';

    const word = raw;
    const converted = Search.convertQuery(word);
    if (!converted.digitQuery) {
      status.textContent = 'Could not encode — try letters or digits.';
      return;
    }

    // Try direct local search first
    const hits = Search.findPattern(digits, converted.digitQuery);
    if (hits.length > 0) {
      status.innerHTML = `Found "<b>${word}</b>" at digit #${hits[0].toLocaleString()}`;
      captureDesign(word, null, hits[0]);
      return;
    }

    // Try multi-part
    const chunks = Search.findChunked(digits, converted.digitQuery);
    if (chunks.length > 1) {
      status.innerHTML = `Found "<b>${word}</b>" in ${chunks.length} parts (Multi-Part)`;
      captureDesign(word, chunks, -1);
      return;
    }

    status.textContent = `"${word}" not found locally — try from the main search for API lookup.`;
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

    const dlBtn = document.getElementById('shopDownload');
    if (dlBtn) dlBtn.addEventListener('click', downloadDesign);

    const addCartBtn = document.getElementById('shopAddCart');
    if (addCartBtn) addCartBtn.addEventListener('click', addToCart);

    const checkoutBtn = document.getElementById('shopCheckout');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', () => {
        if (typeof UI !== 'undefined' && UI.unlock) UI.unlock('pi_owner');
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
