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
  let expanding = false;
  let printQueue = '';      // digits waiting to be revealed
  let printVisible = 0;    // how many from printQueue are visible so far
  let printBaseIdx = 0;    // digit index where printing starts
  let printTimer = 0;      // accumulator for print speed
  let printFlashIdx = -1;  // index of the digit currently "flashing" in
  let birthdayPos = -1;    // digit index where user's birthday was found
  let birthdayLen = 0;     // length of birthday digit string
  let chunkConnectors = null; // [{ pos, len }] for chunked search results

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

    // Last digit mouse-avoidance + printing animation
    if (constKey === 'pi') {
      drawLastDigitRepel(camX, camY, zoom, w, h);
      advancePrintAnimation();
    }

    // Chunk connector lines
    if (chunkConnectors && chunkConnectors.length > 1) {
      drawChunkConnectors(camX, camY, zoom);
    }

    // Birthday cake marker
    if (birthdayPos >= 0) {
      drawBirthdayCake(camX, camY, zoom);
    }

    Particles.render(ctx, camX, camY, zoom);
  }

  function drawBirthdayCake(camX, camY, zoom) {
    const cw = Layout.getCellW();
    const ch = Layout.getCellH();
    const cellPxW = cw * zoom;
    const cellPxH = ch * zoom;

    ctx.save();

    // Draw glow ring around each birthday digit
    ctx.strokeStyle = 'rgba(255, 107, 157, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    const pad = 3;

    let sumX = 0, sumY = 0, count = 0;
    for (let i = 0; i < birthdayLen; i++) {
      const pos = Layout.getPosition(birthdayPos + i);
      const sx = (pos.x - camX) * zoom;
      const sy = (pos.y - camY) * zoom;

      // Skip if off screen
      if (sx < -100 || sx > canvas.width + 100 || sy < -100 || sy > canvas.height + 100) continue;

      ctx.strokeRect(sx - pad, sy - pad, cellPxW + pad * 2, cellPxH + pad * 2);
      sumX += sx + cellPxW / 2;
      sumY += sy;
      count++;
    }
    ctx.setLineDash([]);

    // Draw cake emoji above the center of the highlighted digits
    if (count > 0) {
      const cx = sumX / count;
      const cy = sumY / count;
      const cakeSize = Math.max(14, cellPxH * 0.8);
      ctx.font = `${cakeSize}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('\uD83C\uDF82', cx, cy - pad - 2);
    }

    ctx.restore();
  }

  function setBirthdayMarker(pos, len) {
    birthdayPos = pos;
    birthdayLen = len;
    Camera.markDirty();
  }

  function clearBirthdayMarker() {
    birthdayPos = -1;
    birthdayLen = 0;
    Camera.markDirty();
  }

  // ─── Last digit: smooth mouse avoidance ───

  let repelX = 0, repelY = 0; // smoothed repulsion offset

  function drawLastDigitRepel(camX, camY, zoom, w, h) {
    if (isPrinting()) return;
    const effLen = getEffectiveLength();
    if (effLen <= 0) return;
    const lastIdx = effLen - 1;
    const cw = Layout.getCellW();
    const ch = Layout.getCellH();
    const pos = Layout.getPosition(lastIdx);
    const cellPxW = cw * zoom;
    const cellPxH = ch * zoom;

    const sx = (pos.x - camX) * zoom;
    const sy = (pos.y - camY) * zoom;

    // Off screen? skip
    if (sx < -cellPxW * 3 || sx > w + cellPxW * 3 ||
        sy < -cellPxH * 3 || sy > h + cellPxH * 3) return;

    // Compute target repulsion
    const cx = sx + cellPxW / 2;
    const cy = sy + cellPxH / 2;
    const dx = cx - mouseScreenX;
    const dy = cy - mouseScreenY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const repulseRadius = Math.max(100, cellPxH * 5);
    let targetX = 0, targetY = 0;
    if (dist < repulseRadius && dist > 0.1) {
      const strength = 1 - dist / repulseRadius;
      const push = strength * strength * 18;
      targetX = (dx / dist) * push;
      targetY = (dy / dist) * push;
    }

    // Smooth interpolation (ease toward target)
    const lerp = 0.08;
    repelX += (targetX - repelX) * lerp;
    repelY += (targetY - repelY) * lerp;

    ctx.save();
    ctx.translate(sx + cellPxW / 2 + repelX, sy + cellPxH / 2 + repelY);

    // Soft glow that pulses gently
    const t = performance.now() / 1000;
    const glowAlpha = 0.12 + Math.sin(t * 1.5) * 0.06;
    ctx.fillStyle = `rgba(124, 111, 247, ${glowAlpha})`;
    ctx.beginPath();
    ctx.arc(0, 0, cellPxH * 0.8, 0, Math.PI * 2);
    ctx.fill();

    // The digit
    const colors = getDigitColors();
    const d = Number(digits[lastIdx]);
    if (cellPxH >= 8) {
      const fontSize = Math.max(6, cellPxH * 0.72);
      ctx.font = `bold ${fontSize}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = colors[d];
      ctx.fillText(String(d), 0, 0);
    }

    // Tiny cake emoji trailing behind (opposite of repulsion direction)
    if (cellPxH >= 12) {
      const cakeSize = Math.max(8, cellPxH * 0.4);
      ctx.font = `${cakeSize}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.6 + Math.sin(t * 2) * 0.2;
      ctx.fillText('\uD83C\uDF70', -repelX * 0.3, -repelY * 0.3 + cellPxH * 0.7);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // Keep rendering while repulsion is active or pulsing
    const moving = Math.abs(repelX) > 0.1 || Math.abs(repelY) > 0.1;
    if (dist < repulseRadius || moving) Camera.markDirty();
  }

  // ─── Printing animation ───

  function isPrinting() {
    return printQueue.length > 0 && printVisible < printQueue.length;
  }

  function advancePrintAnimation() {
    if (!isPrinting()) return;

    // Gentle speed: ~3 digits per frame at start, slowly ramps up
    const speed = Math.min(20, 3 + printVisible * 0.002);
    printVisible = Math.min(printQueue.length, printVisible + speed);

    // Commit revealed digits
    const revealedTotal = Math.floor(printVisible);
    const committed = digits.length - printBaseIdx;
    if (revealedTotal > committed) {
      const newChunk = printQueue.substring(committed, revealedTotal);
      App.appendDigits(newChunk);
      // Play tick sound for the newest digit (throttled to every 3rd)
      if (revealedTotal % 3 === 0) {
        const lastDigit = Number(newChunk[newChunk.length - 1]) || 0;
        Sounds.digitTick(lastDigit);
      }
    }

    // Flash the newest few digits
    printFlashIdx = printBaseIdx + revealedTotal - 1;

    // Done?
    if (printVisible >= printQueue.length) {
      printQueue = '';
      printVisible = 0;
      printFlashIdx = -1;
    }

    Camera.markDirty();
  }

  function drawPrintFlash(cellIdx, sx, sy, cellPxW, cellPxH) {
    // Glow on the last ~5 printed digits
    if (printFlashIdx < 0 || cellIdx > printFlashIdx || cellIdx < printFlashIdx - 5) return false;
    const age = printFlashIdx - cellIdx; // 0 = newest, 5 = oldest
    const alpha = 0.4 * (1 - age / 6);
    ctx.save();
    ctx.fillStyle = `rgba(124, 111, 247, ${alpha})`;
    ctx.beginPath();
    ctx.arc(sx + cellPxW / 2, sy + cellPxH / 2, cellPxH * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return true;
  }

  function getLastDigitScreenPos() {
    const effLen = getEffectiveLength();
    if (effLen <= 0) return null;
    const lastIdx = effLen - 1;
    const { x: camX, y: camY, zoom } = Camera.getState();
    const pos = Layout.getPosition(lastIdx);
    const cw = Layout.getCellW();
    const ch = Layout.getCellH();
    return {
      x: (pos.x - camX) * zoom + repelX,
      y: (pos.y - camY) * zoom + repelY,
      w: cw * zoom,
      h: ch * zoom,
      idx: lastIdx,
    };
  }

  async function expandDigits(batchSize) {
    if (expanding || isPrinting() || constKey !== 'pi') return;
    expanding = true;
    const count = batchSize || 5000;
    const offset = digits.length;
    try {
      const resp = await fetch(`/api/pidigits?offset=${offset}&count=${count}`);
      if (!resp.ok) { expanding = false; return; }
      const data = await resp.json();
      if (data.digits && data.digits.length > 0) {
        // Queue for print animation
        printBaseIdx = digits.length;
        printQueue = data.digits;
        printVisible = 0;
        printFlashIdx = -1;
        Camera.markDirty();
      }
    } catch (e) {
      // Server not running — silently fail
    }
    expanding = false;
  }

  function isExpanding() { return expanding || isPrinting(); }

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
    const skipLast = constKey === 'pi' && !isPrinting();

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const cellIdx = row * cols + col;
        if (cellIdx >= effectiveLen) return;
        if (skipLast && cellIdx === effectiveLen - 1) continue;

        const pos = Layout.getPosition(cellIdx);
        const sx = (pos.x - camX) * zoom;
        const sy = (pos.y - camY) * zoom;

        drawPrintFlash(cellIdx, sx, sy, cellPxW, cellPxH);

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
    const skipLast = constKey === 'pi' && !isPrinting();

    // Compute visible world-space bounding box
    const worldLeft = camX - cellPxW / zoom;
    const worldRight = camX + (w + cellPxW) / zoom;
    const worldTop = camY - cellPxH / zoom;
    const worldBottom = camY + (h + cellPxH) / zoom;

    // Determine max visible radius from spiral center (0,0)
    const corners = [
      worldLeft * worldLeft + worldTop * worldTop,
      worldRight * worldRight + worldTop * worldTop,
      worldLeft * worldLeft + worldBottom * worldBottom,
      worldRight * worldRight + worldBottom * worldBottom,
    ];
    const maxR = Math.sqrt(Math.max(...corners));

    // Spiral params: angle = sqrt(index * 5.5), r = b * angle + offset
    const spacing = cw * 1.5;
    const b = spacing / (2 * Math.PI);
    const offset = cw * 0.6;

    // Max index that could be visible: r = b * sqrt(i * 5.5) + offset <= maxR
    // sqrt(i * 5.5) <= (maxR - offset) / b => i <= ((maxR - offset) / b)^2 / 5.5
    const maxAngle = Math.max(0, (maxR - offset) / b);
    const maxIdx = Math.min(effectiveLen, Math.ceil(maxAngle * maxAngle / 5.5) + 100);

    // Min visible radius (closest point of viewport to origin)
    let minR = 0;
    if (worldLeft > 0) minR = Math.max(minR, worldLeft);
    else if (worldRight < 0) minR = Math.max(minR, -worldRight);
    if (worldTop > 0) minR = Math.max(minR, worldTop);
    else if (worldBottom < 0) minR = Math.max(minR, -worldBottom);
    // If origin is inside viewport, start from 0
    const originVisible = worldLeft <= 0 && worldRight >= 0 && worldTop <= 0 && worldBottom >= 0;
    const minAngle = originVisible ? 0 : Math.max(0, (minR - offset) / b);
    const startIdx = originVisible ? 0 : Math.max(0, Math.floor(minAngle * minAngle / 5.5) - 100);

    // When very zoomed out, skip digits to avoid overlapping color mess
    // Spiral arm spacing is constant, but digits per revolution increases
    const stride = cellPxW < 2 ? Math.max(1, Math.floor(3 / Math.max(0.5, cellPxW))) : 1;

    for (let cellIdx = startIdx; cellIdx < maxIdx; cellIdx += stride) {
      if (skipLast && cellIdx === effectiveLen - 1) continue;
      const pos = Layout.getPosition(cellIdx);
      const sx = (pos.x - camX) * zoom;
      const sy = (pos.y - camY) * zoom;

      if (sx < -cellPxW || sx > w + cellPxW ||
          sy < -cellPxH || sy > h + cellPxH) {
        continue;
      }

      drawPrintFlash(cellIdx, sx, sy, cellPxW, cellPxH);

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

    const hoverRadius = 250;
    const hoverMaxScale = 4.0;
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

  // ─── Chunk connectors (gold lines between chunked search pieces) ───

  function setChunkConnectors(chunks) {
    // chunks = [{ pos, digitStr }]
    if (!chunks || chunks.length < 2) { chunkConnectors = null; return; }
    chunkConnectors = chunks.map(c => ({ pos: c.pos, len: c.digitStr.length }));
    Camera.markDirty();
  }

  function clearChunkConnectors() {
    chunkConnectors = null;
    Camera.markDirty();
  }

  const VIBGYOR = [
    '#9400D3', // Violet
    '#4B0082', // Indigo
    '#0000FF', // Blue
    '#00AA00', // Green
    '#FFD700', // Yellow
    '#FF8C00', // Orange
    '#FF0000', // Red
  ];

  function _vibgyorColor(i, total) {
    const idx = total <= 1 ? 0 : Math.round(i * (VIBGYOR.length - 1) / (total - 1));
    return VIBGYOR[Math.min(idx, VIBGYOR.length - 1)];
  }

  function _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function drawChunkConnectors(camX, camY, zoom) {
    const cw = Layout.getCellW();
    const ch = Layout.getCellH();
    const isSpiral = Layout.getType() === 'spiral';
    const n = chunkConnectors.length;

    ctx.save();

    // Collect chunk center screen positions with their VIBGYOR color
    const chunkPts = [];
    for (let i = 0; i < n; i++) {
      const chunk = chunkConnectors[i];
      const midIdx = chunk.pos + Math.floor(chunk.len / 2);
      const pos = Layout.getPosition(midIdx);
      chunkPts.push({
        sx: (pos.x - camX) * zoom + cw * zoom / 2,
        sy: (pos.y - camY) * zoom + ch * zoom / 2,
        color: _vibgyorColor(i, n),
      });
    }

    // Spiral center point
    let center = null;
    if (isSpiral) {
      center = { sx: (0 - camX) * zoom, sy: (0 - camY) * zoom };
    }

    // Draw filled triangles from center to each consecutive pair of chunks
    if (center) {
      for (let i = 0; i < chunkPts.length; i++) {
        const a = chunkPts[i];
        const b = chunkPts[(i + 1) % chunkPts.length];
        ctx.fillStyle = _hexToRgba(a.color, 0.12);
        ctx.beginPath();
        ctx.moveTo(center.sx, center.sy);
        ctx.lineTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.closePath();
        ctx.fill();
      }

      // Draw lines from center to each chunk in its color
      for (const p of chunkPts) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(center.sx, center.sy);
        ctx.lineTo(p.sx, p.sy);
        ctx.stroke();
      }
    } else {
      // Non-spiral: just connect chunks with colored segments
      for (let i = 0; i < chunkPts.length - 1; i++) {
        const a = chunkPts[i];
        const b = chunkPts[i + 1];
        ctx.strokeStyle = a.color;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      }
    }

    // Draw highlight boxes around each chunk's digits in its VIBGYOR color
    ctx.globalAlpha = 1;
    for (let i = 0; i < n; i++) {
      const chunk = chunkConnectors[i];
      const color = _vibgyorColor(i, n);
      for (let d = 0; d < chunk.len; d++) {
        const pos = Layout.getPosition(chunk.pos + d);
        const sx = (pos.x - camX) * zoom;
        const sy = (pos.y - camY) * zoom;
        const pw = cw * zoom;
        const ph = ch * zoom;

        ctx.fillStyle = _hexToRgba(color, 0.3);
        ctx.fillRect(sx, sy, pw, ph);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(sx, sy, pw, ph);
      }

      // Label each chunk
      const labelPos = Layout.getPosition(chunk.pos);
      const lx = (labelPos.x - camX) * zoom;
      const ly = (labelPos.y - camY) * zoom - 8;
      ctx.fillStyle = color;
      ctx.font = `bold ${Math.max(10, 14 * zoom / 4)}px system-ui`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`Part ${i + 1}`, lx, ly);
    }

    // Draw vertex dots
    if (center) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(center.sx, center.sy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    for (const p of chunkPts) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  return { init, resize, setDigits, buildAtlas, setSearchHighlights, render, getEffectiveLength, rawToCell, setRemoteSegment, getRemoteSegmentWorldPos, getRemoteCardCenter, getDigitColors, getLastDigitScreenPos, expandDigits, isExpanding, setBirthdayMarker, clearBirthdayMarker, setChunkConnectors, clearChunkConnectors };
})();
