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
    // No atlas needed — direct rendering with pair colors
    Camera.markDirty();
  }

  function getPairColors() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    return isLight ? PAIR_COLORS_LIGHT : PAIR_COLORS;
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

  // Cell 0 = integer part, cells 1+ = digit pairs after decimal
  function getEffectiveLength() {
    if (!digits) return 0;
    return 1 + Math.floor((digits.length - decimalAt) / 2);
  }

  function rawToCell(rawIdx) {
    if (rawIdx < decimalAt) return 0;
    return 1 + Math.floor((rawIdx - decimalAt) / 2);
  }

  function cellToRaw(cellIdx) {
    if (cellIdx === 0) return { start: 0, end: decimalAt };
    const start = decimalAt + (cellIdx - 1) * 2;
    return { start, end: start + 2 };
  }

  function isCellHighlighted(cellIdx) {
    if (!searchMatchSet) return false;
    const { start, end } = cellToRaw(cellIdx);
    for (let i = start; i < end; i++) {
      if (searchMatchSet.has(i)) return true;
    }
    return false;
  }

  function isCellCurrentMatch(cellIdx) {
    const currentMatch = Search.getCurrentMatch();
    if (currentMatch < 0) return false;
    const patLen = searchPatternLen || 0;
    const { start, end } = cellToRaw(cellIdx);
    for (let i = start; i < end; i++) {
      if (i >= currentMatch && i < currentMatch + patLen) return true;
    }
    return false;
  }

  function getPairData(cellIdx) {
    const rawIdx = decimalAt + (cellIdx - 1) * 2;
    if (rawIdx + 1 >= digits.length) return null;
    const d1 = Number(digits[rawIdx]);
    const d2 = Number(digits[rawIdx + 1]);
    return { d1, d2, pairVal: d1 * 10 + d2 };
  }

  // Draw the pill/boat frame behind a cell
  function drawFrame(sx, sy, w, h, color) {
    const r = Math.min(4, h * 0.22);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(sx + 1, sy + 1, w - 2, h - 2, r);
    ctx.fill();
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
    const colors = getPairColors();
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const frameBg = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)';

    if (cellIdx === 0) {
      // Integer cell — adapts to current display mode
      const intVal = Number(digits.slice(0, decimalAt));
      const color = colors[intVal % 100];
      drawFrame(sx, sy, w, h, frameBg);
      const fontSize = Math.max(8, h * 0.82);
      ctx.font = `bold ${fontSize}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      const mapping = Mappings.currentName();
      if (mapping === 'alpha26') {
        ctx.fillText(Mappings.pairToLetter(intVal) + '.', sx + w / 2, sy + h / 2);
      } else if (mapping === 'blocks') {
        const r = Math.min(4, h * 0.22);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(sx + 2, sy + 2, w - 4, h - 4, r);
        ctx.fill();
      } else if (mapping === 'braille') {
        ctx.font = `${Math.max(6, h * 0.7)}px monospace`;
        ctx.fillText(String.fromCharCode(0x2800 + (intVal % 64) + 1), sx + w / 2, sy + h / 2);
      } else {
        ctx.fillText(intVal + '.', sx + w / 2, sy + h / 2);
      }
      return;
    }

    const data = getPairData(cellIdx);
    if (!data) return;
    const { d1, d2, pairVal } = data;
    const color = colors[pairVal];
    const mapping = Mappings.currentName();

    // Draw subtle frame
    drawFrame(sx, sy, w, h, frameBg);

    if (mapping === 'blocks') {
      const r = Math.min(4, h * 0.22);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(sx + 2, sy + 2, w - 4, h - 4, r);
      ctx.fill();
      return;
    }

    if (mapping === 'braille') {
      const fontSize = Math.max(6, h * 0.7);
      ctx.font = `${fontSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.fillText(String.fromCharCode(0x2800 + (pairVal % 64) + 1), sx + w / 2, sy + h / 2);
      return;
    }

    if (mapping === 'alpha26') {
      const letterIdx = pairVal % 26;
      const fontSize = Math.max(6, h * 0.78);
      ctx.font = `bold ${fontSize}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.fillText(String.fromCharCode(65 + letterIdx), sx + w / 2, sy + h / 2);
      return;
    }

    // Digits mode: two digits with good spacing inside the frame
    const fontSize = Math.max(5, h * 0.68);
    ctx.font = `bold ${fontSize}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    // Draw each digit in its own half
    ctx.fillText(String(d1), sx + w * 0.28, sy + h / 2);
    ctx.fillText(String(d2), sx + w * 0.72, sy + h / 2);
  }

  function drawDot(cellIdx, sx, sy, w, h) {
    const colors = getPairColors();
    let pairVal;
    if (cellIdx === 0) {
      pairVal = Number(digits[0]) % 100;
    } else {
      const data = getPairData(cellIdx);
      if (!data) return;
      pairVal = data.pairVal;
    }
    ctx.fillStyle = colors[pairVal];
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

    Particles.render(ctx, camX, camY, zoom);
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
    let consecutiveOffScreen = 0;

    for (let cellIdx = 0; cellIdx < effectiveLen; cellIdx++) {
      const pos = Layout.getPosition(cellIdx);
      const sx = (pos.x - camX) * zoom;
      const sy = (pos.y - camY) * zoom;

      if (sx < -cellPxW || sx > w + cellPxW ||
          sy < -cellPxH || sy > h + cellPxH) {
        consecutiveOffScreen++;
        if (consecutiveOffScreen > 2000 && cellIdx > 1000) {
          const jump = Math.min(500, effectiveLen - cellIdx - 1);
          if (jump > 0) { cellIdx += jump - 1; consecutiveOffScreen = 0; }
        }
        continue;
      }
      consecutiveOffScreen = 0;

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

    const colors = getPairColors();

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

      if (cellIdx === 0) {
        const intVal = Number(digits.slice(0, decimalAt));
        ctx.fillStyle = colors[intVal % 100];
        const mapping = Mappings.currentName();
        if (mapping === 'alpha26') {
          ctx.fillText(Mappings.pairToLetter(intVal) + '.', sx + charW / 2, centerScreenY);
        } else if (mapping === 'braille') {
          ctx.fillText(String.fromCharCode(0x2800 + (intVal % 64) + 1), sx + charW / 2, centerScreenY);
        } else if (mapping !== 'blocks') {
          ctx.fillText(intVal + '.', sx + charW / 2, centerScreenY);
        }
      } else {
        const data = getPairData(cellIdx);
        if (data) {
          const { d1, d2, pairVal } = data;
          ctx.fillStyle = colors[pairVal];
          const mapping = Mappings.currentName();
          if (mapping === 'alpha26') {
            ctx.fillText(Mappings.pairToLetter(pairVal), sx + charW / 2, centerScreenY);
          } else if (mapping === 'blocks') {
            ctx.fillRect(sx + 2, dy + 2, charW - 4, sh - 4);
          } else if (mapping === 'braille') {
            ctx.fillText(String.fromCharCode(0x2800 + (pairVal % 64) + 1), sx + charW / 2, centerScreenY);
          } else {
            // digits: two digits spaced apart
            const halfW = charW / 2;
            ctx.fillText(String(d1), sx + halfW * 0.55, centerScreenY);
            ctx.fillText(String(d2), sx + halfW * 1.45, centerScreenY);
          }
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

  return { init, resize, setDigits, buildAtlas, setSearchHighlights, render, getEffectiveLength, rawToCell };
})();
