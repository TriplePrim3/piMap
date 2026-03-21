const Renderer = (() => {
  let canvas, ctx;
  let digits = '';
  let decimalAt = 1;
  let constKey = 'pi';
  let searchPatternLen = 0;
  let searchMatchSet = null;
  let mouseScreenX = -1000;
  let mouseScreenY = -1000;
  let atlasReady = false;
  let remoteSegment = null; // { digits, matchOffset, matchLen, label, globalPos, totalDigits }

  const FONT = '"Cascadia Code", "Fira Code", Consolas, monospace';

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resize();
    atlasReady = true;

    canvas.addEventListener('mousemove', (e) => {
      mouseScreenX = e.clientX;
      mouseScreenY = e.clientY;
      if (Layout.getType() === 'wave') Camera.markDirty();
    });

    canvas.addEventListener('mouseleave', () => {
      mouseScreenX = -1000;
      mouseScreenY = -1000;
      if (Layout.getType() === 'wave') Camera.markDirty();
    });
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    Camera.markDirty();
  }

  function setDigits(d, key) {
    digits = d;
    constKey = key;
    decimalAt = CONSTANTS[key].decimalAt;
    Camera.markDirty();
  }

  function buildAtlas() {
    // No atlas needed — direct rendering
    Camera.markDirty();
  }

  function getDigitColors() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    return isLight ? DIGIT_COLORS_LIGHT : DIGIT_COLORS;
  }

  function setSearchHighlights(matchPositions, patternLength) {
    if (!matchPositions || matchPositions.length === 0) {
      searchMatchSet = null;
      searchPatternLen = 0;
      Camera.markDirty();
      return;
    }
    searchPatternLen = patternLength;
    searchMatchSet = new Set();
    const limit = Math.min(matchPositions.length, 10000);
    for (let m = 0; m < limit; m++) {
      const pos = matchPositions[m];
      for (let i = 0; i < patternLength; i++) {
        searchMatchSet.add(pos + i);
      }
    }
    Camera.markDirty();
  }


  // Each cell = one digit (cell index = raw digit index)
  function getEffectiveLength() {
    if (!digits) return 0;
    return digits.length;
  }

  function rawToCell(rawIdx) {
    return rawIdx;
  }

  function isCellHighlighted(cellIdx) {
    if (!searchMatchSet) return false;
    return searchMatchSet.has(cellIdx);
  }

  function isCellCurrentMatch(cellIdx) {
    const currentMatch = Search.getCurrentMatch();
    if (currentMatch < 0) return false;
    const patLen = searchPatternLen || 0;
    return cellIdx >= currentMatch && cellIdx < currentMatch + patLen;
  }

  // Draw search highlight
  function drawHighlight(sx, sy, w, h, isCurrent) {
    const r = Math.min(4, h * 0.22);
    if (isCurrent) {
      ctx.fillStyle = 'rgba(124, 111, 247, 0.5)';
      ctx.strokeStyle = 'rgba(124, 111, 247, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(sx, sy, w, h, r);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(124, 111, 247, 0.25)';
      ctx.beginPath();
      ctx.roundRect(sx, sy, w, h, r);
      ctx.fill();
    }
  }

  function drawCell(cellIdx, sx, sy, w, h) {
    const colors = getDigitColors();
    const d = Number(digits[cellIdx]);
    const color = colors[d];
    const mapping = Mappings.currentName();

    if (mapping === 'blocks') {
      const r = Math.min(4, h * 0.22);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(sx + 1, sy + 1, w - 2, h - 2, r);
      ctx.fill();
      return;
    }

    if (mapping === 'braille') {
      const fontSize = Math.max(6, h * 0.7);
      ctx.font = `${fontSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.fillText(String.fromCharCode(0x2800 + d + 1), sx + w / 2, sy + h / 2);
      return;
    }

    // Digit mode — show the single digit
    const fontSize = Math.max(6, h * 0.72);
    ctx.font = `bold ${fontSize}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    const label = cellIdx === 0 ? d + '.' : String(d);
    ctx.fillText(label, sx + w / 2, sy + h / 2);
  }

  function drawDot(cellIdx, sx, sy, w, h) {
    const colors = getDigitColors();
    const d = Number(digits[cellIdx]);
    ctx.fillStyle = colors[d];
    const dotW = Math.max(1, w * 0.6);
    const dotH = Math.max(1, h * 0.6);
    ctx.fillRect(sx + (w - dotW) / 2, sy + (h - dotH) / 2, dotW, dotH);
  }

  function render() {
    const { x: camX, y: camY, zoom } = Camera.getState();
    const w = window.innerWidth;
    const h = window.innerHeight;

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    ctx.fillStyle = isLight ? '#f0f0f8' : '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    if (!digits || !atlasReady) return;

    const layoutType = Layout.getType();
    if (layoutType === 'grid') {
      renderGrid(camX, camY, zoom, w, h);
    } else if (layoutType === 'spiral') {
      renderSpiral(camX, camY, zoom, w, h);
    } else if (layoutType === 'wave') {
      renderWave(camX, camY, zoom, w, h);
    }

    // Draw remote segment (API search result context)
    if (remoteSegment) {
      renderRemoteSegment(camX, camY, zoom, w, h);
    }

    Particles.render(ctx, camX, camY, zoom);
  }

  // ─── Remote segment rendering (scale HUD + context card) ───

  const CONTEXT_RADIUS = 10; // digits before/after the match to show

  function setRemoteSegment(seg) {
    // seg = { digits, matchOffset, matchLen, label, globalPos, totalDigits }
    Renderer._remoteSegmentData = seg;
    if (!seg) {
      remoteSegment = null;
      Camera.setExtraBounds(null);
      Camera.markDirty();
      return;
    }
    remoteSegment = { ...seg };
    _calcRemoteLayout();
    Camera.markDirty();
  }

  // Log-scale mapping: gives local data visible space while showing true distance
  function _logScale(value, total) {
    if (value <= 0) return 0;
    return Math.log(1 + value) / Math.log(1 + total);
  }

  function _calcRemoteLayout() {
    const seg = remoteSegment;
    const effLen = getEffectiveLength();
    const bounds = Layout.getBounds(effLen);
    const cw = Layout.getCellW();
    const ch = Layout.getCellH();
    const totalDig = seg.totalDigits || 1e9;
    const localDigits = digits.length;

    // Store scale info
    seg._localEndFrac = _logScale(localDigits, totalDig);
    seg._matchFrac = _logScale(seg.globalPos, totalDig);
    seg._totalDigits = totalDig;
    seg._localDigits = localDigits;

    // ── Scale bar positioned below main content ──
    const contentCX = (bounds.minX + bounds.maxX) / 2;

    const scaleGap = ch * 2;
    // Fixed width: enough for context strip (CONTEXT_RADIUS + match + CONTEXT_RADIUS)
    const contextLen = CONTEXT_RADIUS + seg.matchLen + CONTEXT_RADIUS;
    const scaleBarW = Math.max(contextLen * cw * 1.8, 32 * cw);
    seg._scaleX = contentCX - scaleBarW / 2;
    seg._scaleY = bounds.maxY + scaleGap;
    seg._scaleW = scaleBarW;
    seg._scaleH = ch * 1.6;

    // Context strip sits just below the scale bar
    seg._stripY = seg._scaleY + seg._scaleH + ch * 3;

    // Trim context digits to CONTEXT_RADIUS before/after match
    const mOff = seg.matchOffset;
    const mLen = seg.matchLen;
    const allDigits = seg.digits;
    const before = Math.min(CONTEXT_RADIUS, mOff);
    const after = Math.min(CONTEXT_RADIUS, allDigits.length - mOff - mLen);
    seg._stripStart = mOff - before;
    seg._stripDigits = allDigits.substring(seg._stripStart, mOff + mLen + after);
    seg._stripMatchStart = before; // offset within strip where match begins
    seg._stripMatchLen = mLen;
    seg._stripLen = seg._stripDigits.length;

    // Center the strip on the scale bar center
    seg._stripX = contentCX - (seg._stripLen * cw) / 2;

    // ── Concentric rings (spiral only) ──
    if (Layout.getType() === 'spiral') {
      const spacing = cw * 1.5;
      const b = spacing / (2 * Math.PI);
      const maxLocalAngle = Math.sqrt(effLen * 5.5);
      const maxLocalR = b * maxLocalAngle + cw * 0.6;
      seg._localRadius = maxLocalR;
      seg._rings = [];
      const steps = 3;
      for (let i = 1; i <= steps; i++) {
        seg._rings.push(maxLocalR * (1 + i * 0.15));
      }
    }

    // Expand camera bounds to include strip
    Camera.setExtraBounds({
      minX: bounds.minX - 100,
      minY: bounds.minY - 100,
      maxX: Math.max(bounds.maxX, seg._stripX + seg._stripLen * cw + 100),
      maxY: seg._stripY + ch * 4,
    });
  }

  function getRemoteSegmentWorldPos() {
    if (!remoteSegment) return null;
    return { x: remoteSegment._stripX, y: remoteSegment._stripY };
  }

  function getRemoteCardCenter() {
    if (!remoteSegment) return null;
    const seg = remoteSegment;
    const cw = Layout.getCellW();
    const ch = Layout.getCellH();
    return {
      x: seg._stripX + (seg._stripLen * cw) / 2,
      y: seg._stripY + ch / 2,
    };
  }

  function renderRemoteSegment(camX, camY, zoom, w, h) {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';

    // 1. Concentric distance rings (spiral only, decorative)
    if (Layout.getType() === 'spiral') {
      _drawDistanceRings(camX, camY, zoom, w, h, isLight);
    }

    // 2. World-space scale bar
    _drawScaleBar(camX, camY, zoom, w, h, isLight);

    // 3. Context strip (inline digits centered on match)
    _drawContextStrip(camX, camY, zoom, w, h, isLight);
  }

  // ── Concentric rings (decorative, spiral only) ──
  function _drawDistanceRings(camX, camY, zoom, w, h, isLight) {
    const seg = remoteSegment;
    if (!seg._rings) return;

    ctx.save();
    const cx = -camX * zoom;
    const cy = -camY * zoom;

    for (let i = 0; i < seg._rings.length; i++) {
      const r = seg._rings[i] * zoom;
      const alpha = 0.04 + 0.02 * i;
      ctx.strokeStyle = isLight
        ? `rgba(108,92,231,${alpha})`
        : `rgba(124,111,247,${alpha})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ── World-space scale bar between content and card ──
  function _drawScaleBar(camX, camY, zoom, w, h, isLight) {
    const seg = remoteSegment;
    const totalDig = seg._totalDigits;

    const sx = (seg._scaleX - camX) * zoom;
    const sy = (seg._scaleY - camY) * zoom;
    const sW = seg._scaleW * zoom;
    const sH = seg._scaleH * zoom;

    // Early out if off-screen
    if (sy + sH < -100 || sy > h + 100 || sx + sW < -100 || sx > w + 100) return;

    ctx.save();

    // Track background
    const trackR = sH / 2;
    ctx.fillStyle = isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.roundRect(sx, sy, sW, sH, trackR);
    ctx.fill();
    ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Local segment (highlighted purple)
    const localW = Math.max(4 * zoom, seg._localEndFrac * sW);
    ctx.fillStyle = isLight ? 'rgba(108,92,231,0.45)' : 'rgba(124,111,247,0.4)';
    ctx.beginPath();
    ctx.roundRect(sx, sy, localW, sH, trackR);
    ctx.fill();

    // "Your map" label above local segment
    const fontSize = Math.max(11, 13 * zoom);
    ctx.font = `bold ${fontSize}px system-ui`;
    ctx.fillStyle = isLight ? 'rgba(108,92,231,0.9)' : 'rgba(124,111,247,0.85)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`Your map (${_compactNum(seg._localDigits)} digits)`, sx, sy - 6 * zoom);

    // Tick marks (log-scaled)
    ctx.fillStyle = isLight ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.2)';
    const tickFont = Math.max(10, 11 * zoom);
    ctx.font = `600 ${tickFont}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const tickY = sy + sH + 4 * zoom;
    const tickValues = [1e6, 10e6, 50e6, 100e6, 200e6, 500e6, 1e9];
    for (const tv of tickValues) {
      if (tv >= totalDig) break;
      const frac = _logScale(tv, totalDig);
      const tx = sx + frac * sW;
      if (tx < sx + 30 * zoom || tx > sx + sW - 30 * zoom) continue;
      // Tick line
      ctx.fillRect(tx - 0.5, sy, 1, sH);
      ctx.fillText(_compactNum(tv), tx, tickY);
    }

    // End labels
    ctx.font = `bold ${tickFont}px system-ui`;
    ctx.textAlign = 'left';
    ctx.fillText('0', sx, tickY);
    ctx.textAlign = 'right';
    ctx.fillText(_compactNum(totalDig), sx + sW, tickY);

    // Match pin
    const matchX = sx + seg._matchFrac * sW;

    // Glowing pin
    ctx.save();
    ctx.shadowColor = '#ff6b9d';
    ctx.shadowBlur = 8 * zoom;
    ctx.fillStyle = '#ff6b9d';
    ctx.beginPath();
    ctx.arc(matchX, sy - 6 * zoom, 5 * zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Pin stem
    ctx.strokeStyle = '#ff6b9d';
    ctx.lineWidth = 2 * zoom;
    ctx.beginPath();
    ctx.moveTo(matchX, sy - 1 * zoom);
    ctx.lineTo(matchX, sy + sH + 1 * zoom);
    ctx.stroke();

    // Match label above pin
    const matchFont = Math.max(12, 14 * zoom);
    ctx.font = `bold ${matchFont}px system-ui`;
    ctx.fillStyle = '#ff6b9d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`digit #${seg.globalPos.toLocaleString()}`,
      matchX, sy - 16 * zoom);

    // Dashed line from pin down to context strip
    const stripCX = (seg._stripX + (seg._stripLen * Layout.getCellW()) / 2 - camX) * zoom;
    const stripTop = (seg._stripY - camY) * zoom;
    if (stripTop > sy + sH) {
      ctx.strokeStyle = 'rgba(255, 107, 157, 0.15)';
      ctx.lineWidth = 1 * zoom;
      ctx.setLineDash([3 * zoom, 3 * zoom]);
      ctx.beginPath();
      ctx.moveTo(matchX, sy + sH + 1 * zoom);
      ctx.lineTo(stripCX, stripTop - 2 * zoom);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  function _compactNum(n) {
    if (n >= 1e12) { const v = n / 1e12; return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + 'T'; }
    if (n >= 1e9)  { const v = n / 1e9;  return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + 'B'; }
    if (n >= 1e6)  { const v = n / 1e6;  return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + 'M'; }
    if (n >= 1e3)  { const v = n / 1e3;  return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + 'K'; }
    return String(n);
  }

  // ── Context strip: single row of digits centered on the match ──
  function _drawContextStrip(camX, camY, zoom, w, h, isLight) {
    const seg = remoteSegment;
    const cw = Layout.getCellW();
    const ch = Layout.getCellH();
    const cellPxW = cw * zoom;
    const cellPxH = ch * zoom;
    const colors = getDigitColors();
    const stripDigits = seg._stripDigits;
    const stripLen = seg._stripLen;
    const mStart = seg._stripMatchStart;
    const mEnd = mStart + seg._stripMatchLen;

    const baseX = (seg._stripX - camX) * zoom;
    const baseY = (seg._stripY - camY) * zoom;
    const totalW = stripLen * cellPxW;

    // Early out
    if (baseY + cellPxH * 2 < 0 || baseY - cellPxH * 2 > h ||
        baseX + totalW < -100 || baseX > w + 100) return;

    ctx.save();

    // Subtle pill background behind entire strip
    const pad = 6 * zoom;
    const pillR = (cellPxH + pad * 2) / 2;
    ctx.fillStyle = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.03)';
    ctx.beginPath();
    ctx.roundRect(baseX - pad, baseY - pad, totalW + pad * 2, cellPxH + pad * 2, pillR);
    ctx.fill();

    // Draw each digit
    for (let i = 0; i < stripLen; i++) {
      const sx = baseX + i * cellPxW;
      const sy = baseY;
      const d = Number(stripDigits[i]);
      const isMatch = i >= mStart && i < mEnd;

      if (isMatch) {
        drawHighlight(sx, sy, cellPxW, cellPxH, true);
      }

      if (cellPxH >= 8) {
        const fontSize = Math.max(5, cellPxH * 0.72);
        ctx.font = `bold ${fontSize}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Context digits are dimmer, match digits are bright
        if (isMatch) {
          ctx.fillStyle = colors[d];
        } else {
          ctx.fillStyle = isLight ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.25)';
        }
        ctx.fillText(String(d), sx + cellPxW / 2, sy + cellPxH / 2);
      }
    }

    // Ellipsis at edges
    if (cellPxH >= 8) {
      const ellFont = Math.max(8, cellPxH * 0.5);
      ctx.font = `bold ${ellFont}px ${FONT}`;
      ctx.fillStyle = isLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.15)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText('...', baseX - pad - 2 * zoom, baseY + cellPxH / 2);
      ctx.textAlign = 'left';
      ctx.fillText('...', baseX + totalW + pad + 2 * zoom, baseY + cellPxH / 2);
    }

    // Word label centered above the match region
    const matchCX = baseX + (mStart + seg._stripMatchLen / 2) * cellPxW;
    const labelFont = Math.max(13, 16 * zoom);
    ctx.font = `bold ${labelFont}px system-ui`;
    ctx.fillStyle = '#ff6b9d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`"${seg.label}"`, matchCX, baseY - pad - 4 * zoom);

    ctx.restore();
  }

  function renderGrid(camX, camY, zoom, w, h) {
    const cw = Layout.getCellW();
    const ch = Layout.getCellH();
    const range = Layout.getVisibleRange(camX, camY, zoom, w, h);
    if (!range) return;

    const { startCol, endCol, startRow, endRow } = range;
    const cols = Layout.getCols();
    const effectiveLen = getEffectiveLength();
    const cellPxH = ch * zoom;
    const cellPxW = cw * zoom;
    const renderText = cellPxH >= 8;

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const cellIdx = row * cols + col;
        if (cellIdx >= effectiveLen) return;

        const pos = Layout.getPosition(cellIdx);
        const sx = (pos.x - camX) * zoom;
        const sy = (pos.y - camY) * zoom;

        if (isCellCurrentMatch(cellIdx) || isCellHighlighted(cellIdx)) {
          drawHighlight(sx, sy, cellPxW, cellPxH, isCellCurrentMatch(cellIdx));
        }

        if (renderText) {
          drawCell(cellIdx, sx, sy, cellPxW, cellPxH);
        } else {
          drawDot(cellIdx, sx, sy, cellPxW, cellPxH);
        }
      }
    }
  }

  function renderSpiral(camX, camY, zoom, w, h) {
    const cw = Layout.getCellW();
    const ch = Layout.getCellH();
    const cellPxW = cw * zoom;
    const cellPxH = ch * zoom;
    const renderText = cellPxH >= 8;
    const effectiveLen = getEffectiveLength();
    for (let cellIdx = 0; cellIdx < effectiveLen; cellIdx++) {
      const pos = Layout.getPosition(cellIdx);
      const sx = (pos.x - camX) * zoom;
      const sy = (pos.y - camY) * zoom;

      if (sx < -cellPxW || sx > w + cellPxW ||
          sy < -cellPxH || sy > h + cellPxH) {
        continue;
      }

      if (isCellCurrentMatch(cellIdx) || isCellHighlighted(cellIdx)) {
        drawHighlight(sx, sy, cellPxW, cellPxH, isCellCurrentMatch(cellIdx));
      }

      if (renderText) {
        drawCell(cellIdx, sx, sy, cellPxW, cellPxH);
      } else {
        drawDot(cellIdx, sx, sy, cellPxW, cellPxH);
      }
    }
  }

  function renderWave(camX, camY, zoom, w, h) {
    const cw = Layout.getCellW();
    const ch = Layout.getCellH();
    const effectiveLen = getEffectiveLength();
    const centerScreenX = w / 2;
    const centerScreenY = h / 2;

    const centerWorldX = camX + centerScreenX / zoom;
    const centerCellIdx = Math.round(centerWorldX / cw);
    const maxCount = Math.ceil(w / (cw * zoom * 0.3)) + 30;
    const startCell = Math.max(0, centerCellIdx - maxCount);
    const endCell = Math.min(effectiveLen - 1, centerCellIdx + maxCount);

    const hoverRadius = 180;
    const hoverMaxScale = 2.8;
    const centerRadius = w * 0.35;
    const centerMaxScale = 2.5;
    const baseW = cw * zoom;
    const baseH = ch * zoom;

    const count = endCell - startCell + 1;
    if (count <= 0) return;
    const scale = new Float64Array(count);

    for (let i = 0; i < count; i++) {
      const idx = startCell + i;
      const nx = (idx * cw - camX) * zoom;
      const distC = Math.abs(nx - centerScreenX);
      const cScale = 1 + (centerMaxScale - 1) * Math.max(0, 1 - Math.pow(distC / centerRadius, 1.5));
      const distM = Math.abs(nx - mouseScreenX);
      const mScale = 1 + (hoverMaxScale - 1) * Math.max(0, 1 - Math.pow(distM / hoverRadius, 2));
      scale[i] = Math.max(cScale, mScale);
    }

    const positions = new Float64Array(count);
    const widths = new Float64Array(count);
    const heights = new Float64Array(count);
    const spacing = 0.75;

    for (let i = 0; i < count; i++) {
      widths[i] = baseW * scale[i];
      heights[i] = baseH * scale[i];
    }

    const centerLocal = centerCellIdx - startCell;
    if (centerLocal >= 0 && centerLocal < count) {
      positions[centerLocal] = centerScreenX - widths[centerLocal] * spacing / 2;
      for (let i = centerLocal + 1; i < count; i++) {
        positions[i] = positions[i - 1] + widths[i - 1] * spacing;
      }
      for (let i = centerLocal - 1; i >= 0; i--) {
        positions[i] = positions[i + 1] - widths[i] * spacing;
      }
    }

    const colors = getDigitColors();

    for (let i = 0; i < count; i++) {
      const cellIdx = startCell + i;
      const sx = positions[i];
      const sw = widths[i];
      const sh = heights[i];
      const charW = sw * spacing;

      if (sx + charW < -20 || sx > w + 20) continue;
      const dy = centerScreenY - sh / 2;

      if (isCellCurrentMatch(cellIdx)) {
        ctx.fillStyle = 'rgba(124, 111, 247, 0.5)';
        ctx.beginPath();
        ctx.roundRect(sx, dy, charW, sh, 4);
        ctx.fill();
      } else if (isCellHighlighted(cellIdx)) {
        ctx.fillStyle = 'rgba(124, 111, 247, 0.2)';
        ctx.beginPath();
        ctx.roundRect(sx, dy, charW, sh, 4);
        ctx.fill();
      }

      const edgeDist = Math.min(sx + charW / 2, w - sx - charW / 2);
      ctx.globalAlpha = Math.max(0.05, Math.min(1, edgeDist / 80));

      const fontSize = Math.max(6, 18 * (sh / ch) * 0.85);
      ctx.font = `bold ${fontSize}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const d = Number(digits[cellIdx]);
      if (!isNaN(d)) {
        ctx.fillStyle = colors[d];
        const mapping = Mappings.currentName();
        if (mapping === 'blocks') {
          ctx.fillRect(sx + 2, dy + 2, charW - 4, sh - 4);
        } else if (mapping === 'braille') {
          ctx.fillText(String.fromCharCode(0x2800 + d + 1), sx + charW / 2, centerScreenY);
        } else {
          const label = cellIdx === 0 ? d + '.' : String(d);
          ctx.fillText(label, sx + charW / 2, centerScreenY);
        }
      }

      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = 'rgba(124, 111, 247, 0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(centerScreenX, 0);
    ctx.lineTo(centerScreenX, h);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  return { init, resize, setDigits, buildAtlas, setSearchHighlights, render, getEffectiveLength, rawToCell, setRemoteSegment, getRemoteSegmentWorldPos, getRemoteCardCenter, getDigitColors };
})();
