const Minimap = (() => {
  let canvas, ctx;
  let dragging = false;

  const MAP_W = 340;
  const MAP_H = 240;

  // Multiple marker layers: one per encoding mode
  // Each layer: { mode, positions: [{cellIdx}], color }
  let markerLayers = [];
  let activeMode = 'digits'; // which mode is selected for navigation
  let activeMarkers = [];    // markers for the active mode (for current match highlight)
  let apiMarkers = [];
  let currentMatchIdx = -1;

  // Encoding-specific marker colors
  const ENC_COLORS = {
    digits:  'rgba(124, 111, 247, 0.9)',  // purple
    alpha26: 'rgba(124, 111, 247, 0.9)',   // purple
    compact: 'rgba(78, 205, 196, 0.9)',    // teal
    t9:      'rgba(255, 107, 157, 0.9)',   // pink
  };
  const ENC_HIGHLIGHT = {
    digits:  '#ff6b9d',
    alpha26: '#ff6b9d',
    compact: '#ffe66d',
    t9:      '#7c6ff7',
  };

  function init() {
    canvas = document.getElementById('minimapCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(MAP_W * dpr);
    canvas.height = Math.round(MAP_H * dpr);
    canvas.style.width = MAP_W + 'px';
    canvas.style.height = MAP_H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    setupInteraction();
  }

  function resize() {
    // Fixed size, no resize needed
  }

  // ─── Render a zoomed-out clone of the main canvas ───

  function render() {
    if (!canvas) return;
    const digits = App.getDigits();
    if (!digits) return;

    const effLen = Renderer.getEffectiveLength();
    if (effLen <= 0) return;

    const bounds = Layout.getBounds(effLen);
    if (!bounds) return;

    // Expand bounds to include context strip if present
    const remotePos = Renderer.getRemoteSegmentWorldPos();
    if (remotePos && apiMarkers.length > 0) {
      const cw = Layout.getCellW();
      const ch = Layout.getCellH();
      bounds.minX = Math.min(bounds.minX, remotePos.x - cw * 2);
      bounds.minY = Math.min(bounds.minY, remotePos.y - ch * 2);
      bounds.maxX = Math.max(bounds.maxX, remotePos.x + cw * 30);
      bounds.maxY = Math.max(bounds.maxY, remotePos.y + ch * 4);
    }

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';

    // Clear (save/restore to prevent clip accumulation)
    ctx.save();
    ctx.fillStyle = isLight ? '#e8e8f0' : '#0d0d1f';
    ctx.beginPath();
    ctx.roundRect(0, 0, MAP_W, MAP_H, 8);
    ctx.fill();
    ctx.clip();

    // Calculate scale to fit the entire content into the minimap
    const contentW = bounds.maxX - bounds.minX;
    const contentH = bounds.maxY - bounds.minY;
    if (contentW <= 0 || contentH <= 0) return;

    const pad = 8;
    const scaleX = (MAP_W - pad * 2) / contentW;
    const scaleY = (MAP_H - pad * 2) / contentH;
    const scale = Math.min(scaleX, scaleY);

    // Offset to center the content
    const offX = pad + ((MAP_W - pad * 2) - contentW * scale) / 2 - bounds.minX * scale;
    const offY = pad + ((MAP_H - pad * 2) - contentH * scale) / 2 - bounds.minY * scale;

    // Draw digits as tiny colored dots
    const colors = isLight ? DIGIT_COLORS_LIGHT : DIGIT_COLORS;

    // Determine how many cells to draw (skip some if too many)
    const maxDots = 8000;
    const step = Math.max(1, Math.floor(effLen / maxDots));

    for (let cellIdx = 0; cellIdx < effLen; cellIdx += step) {
      const pos = Layout.getPosition(cellIdx);
      const sx = pos.x * scale + offX;
      const sy = pos.y * scale + offY;

      const d = Number(digits[cellIdx]);
      ctx.fillStyle = colors[d];
      const dotSize = Math.max(0.5, Math.min(2, Layout.getCellW() * scale * 0.6));
      ctx.fillRect(sx, sy, dotSize, dotSize);
    }

    // Draw all encoding marker layers
    for (const layer of markerLayers) {
      if (layer.positions.length === 0) continue;
      ctx.fillStyle = ENC_COLORS[layer.mode] || ENC_COLORS.digits;
      for (const m of layer.positions) {
        const pos = Layout.getPosition(m.cellIdx);
        const sx = pos.x * scale + offX;
        const sy = pos.y * scale + offY;
        ctx.fillRect(sx - 1, sy - 1, 3, 3);
      }
    }

    // Highlight current match in the active mode
    if (currentMatchIdx >= 0 && currentMatchIdx < activeMarkers.length) {
      const cm = activeMarkers[currentMatchIdx];
      const pos = Layout.getPosition(cm.cellIdx);
      const sx = pos.x * scale + offX;
      const sy = pos.y * scale + offY;
      ctx.fillStyle = ENC_HIGHLIGHT[activeMode] || ENC_HIGHLIGHT.digits;
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw legend when multiple encoding layers are shown
    if (markerLayers.length > 1) {
      const legendLabels = { alpha26: 'Alpha-26', compact: 'Compact', t9: 'T9' };
      const legendSolidColors = { alpha26: '#7c6ff7', compact: '#4ecdc4', t9: '#ff6b9d' };
      let ly = 6;
      ctx.font = 'bold 7px system-ui';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      for (const layer of markerLayers) {
        const label = legendLabels[layer.mode] || layer.mode;
        const count = layer.positions.length;
        const solidColor = legendSolidColors[layer.mode] || '#7c6ff7';
        // Dot
        ctx.fillStyle = solidColor;
        ctx.beginPath();
        ctx.arc(10, ly + 5, 3, 0, Math.PI * 2);
        ctx.fill();
        // Label + count
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText(`${label} (${count})`, 17, ly + 5);
        ly += 12;
      }
    }

    // Draw remote result badge (text only, no empty space)
    if (apiMarkers.length > 0) {
      const am = apiMarkers[0];
      const badgeText = `${am.label} → #${am.digitPos}`;
      ctx.font = 'bold 8px system-ui';
      const tw = ctx.measureText(badgeText).width + 10;
      const bx = MAP_W - tw - 4;
      const by = MAP_H - 16;

      // Badge background
      ctx.fillStyle = 'rgba(255, 107, 157, 0.9)';
      ctx.beginPath();
      ctx.roundRect(bx, by, tw, 13, 3);
      ctx.fill();

      // Badge text
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, bx + 5, by + 6.5);
    }

    // Draw viewport rectangle
    drawViewport(scale, offX, offY, isLight);

    // Border
    ctx.beginPath();
    ctx.roundRect(0.5, 0.5, MAP_W - 1, MAP_H - 1, 8);
    ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore(); // matches the save() before clip

    // Cake pointer at last digit (drawn OUTSIDE clip so emoji isn't clipped at edges)
    drawCakePointer(scale, offX, offY, effLen);

    // Store transform for click handling
    canvas._mapScale = scale;
    canvas._mapOffX = offX;
    canvas._mapOffY = offY;
  }

  function drawCakePointer(scale, offX, offY, effLen) {
    if (effLen <= 0) return;
    const lastPos = Layout.getPosition(effLen - 1);
    let cx = lastPos.x * scale + offX;
    let cy = lastPos.y * scale + offY;

    const pad = 14;
    const inside = cx >= pad && cx <= MAP_W - pad && cy >= pad && cy <= MAP_H - pad;

    ctx.save();
    ctx.globalAlpha = 1;

    if (inside) {
      // Cake sits right on the dot
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\uD83C\uDF70', cx, cy);
    } else {
      // Clamp to edge and draw an arrow pointing outward
      const edgeX = Math.max(pad, Math.min(MAP_W - pad, cx));
      const edgeY = Math.max(pad, Math.min(MAP_H - pad, cy));

      // Arrow direction
      const dx = cx - edgeX;
      const dy = cy - edgeY;
      const angle = Math.atan2(dy, dx);

      ctx.translate(edgeX, edgeY);
      ctx.rotate(angle);

      // Small arrow
      ctx.fillStyle = '#ff6b9d';
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(0, -4);
      ctx.lineTo(0, 4);
      ctx.closePath();
      ctx.fill();

      ctx.rotate(-angle);
      // Cake emoji next to arrow
      ctx.font = '12px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\uD83C\uDF70', 0, -12);
    }
    ctx.restore();
  }

  function drawViewport(scale, offX, offY, isLight) {
    const { x: camX, y: camY, zoom } = Camera.getState();
    const viewW = window.innerWidth / zoom;
    const viewH = window.innerHeight / zoom;

    const rx = camX * scale + offX;
    const ry = camY * scale + offY;
    const rw = viewW * scale;
    const rh = viewH * scale;

    // Clamp to minimap bounds
    const x1 = Math.max(0, rx);
    const y1 = Math.max(0, ry);
    const x2 = Math.min(MAP_W, rx + rw);
    const y2 = Math.min(MAP_H, ry + rh);

    if (x2 <= x1 || y2 <= y1) return;

    ctx.fillStyle = isLight ? 'rgba(108,92,231,0.15)' : 'rgba(124,111,247,0.12)';
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

    ctx.strokeStyle = isLight ? 'rgba(108,92,231,0.8)' : 'rgba(124,111,247,0.7)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  }

  function formatCompact(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }

  // ─── Interaction ───

  function setupInteraction() {
    canvas.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      dragging = true;
      handleClick(e.offsetX, e.offsetY);
    });

    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const rect = canvas.getBoundingClientRect();
      handleClick(e.clientX - rect.left, e.clientY - rect.top);
    });

    window.addEventListener('mouseup', () => { dragging = false; });
  }

  function handleClick(mx, my) {
    const scale = canvas._mapScale;
    const offX = canvas._mapOffX;
    const offY = canvas._mapOffY;
    if (!scale) return;

    // Convert minimap coords back to world coords
    const worldX = (mx - offX) / scale;
    const worldY = (my - offY) / scale;

    const { zoom } = Camera.getState();
    Camera.setPosition(
      worldX - window.innerWidth / 2 / zoom,
      worldY - window.innerHeight / 2 / zoom
    );
  }

  // ─── Markers ───

  // Set markers for the active (selected) encoding mode
  function setSearchMarkers(matchPositions, patternLen, encMode) {
    activeMode = encMode || 'digits';
    activeMarkers = [];
    if (!matchPositions) return;
    const limit = Math.min(matchPositions.length, 200);
    for (let i = 0; i < limit; i++) {
      activeMarkers.push({ cellIdx: matchPositions[i], index: i });
    }
  }

  // Set all encoding layers at once: layers = [{ mode, results }]
  function setAllMarkerLayers(layers) {
    markerLayers = [];
    for (const l of layers) {
      if (!l.results || l.results.length === 0) continue;
      const positions = [];
      const limit = Math.min(l.results.length, 200);
      for (let i = 0; i < limit; i++) {
        positions.push({ cellIdx: l.results[i] });
      }
      markerLayers.push({ mode: l.mode, positions });
    }
  }

  function setApiMarker(digitPos, label) {
    if (digitPos == null) { apiMarkers = []; return; }
    // Format digit position compactly
    let posStr;
    if (typeof digitPos === 'number') {
      if (digitPos >= 1e9) posStr = (digitPos / 1e9).toFixed(1) + 'B';
      else if (digitPos >= 1e6) posStr = (digitPos / 1e6).toFixed(1) + 'M';
      else if (digitPos >= 1e3) posStr = (digitPos / 1e3).toFixed(0) + 'K';
      else posStr = String(digitPos);
    } else {
      posStr = String(digitPos);
    }
    apiMarkers = [{ digitPos: posStr, label }];
  }

  function clearMarkers() {
    markerLayers = [];
    activeMarkers = [];
    apiMarkers = [];
    currentMatchIdx = -1;
  }

  function setCurrentMatch(idx) { currentMatchIdx = idx; }
  function invalidate() {}

  return {
    init, resize, render, invalidate,
    setSearchMarkers, setAllMarkerLayers, setApiMarker, setCurrentMatch, clearMarkers,
  };
})();
