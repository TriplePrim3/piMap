const Layout = (() => {
  let current = 'spiral';
  let cols = 100;
  const cellW = 22;  // single digit width
  const cellH = 26;  // height of each cell

  function setCols(c) {
    cols = c;
  }

  function setType(type) {
    current = type;
  }

  function getType() {
    return current;
  }

  function getCellW() { return cellW; }
  function getCellH() { return cellH; }
  // Legacy compat — some code uses getCellSize for square-ish ops
  function getCellSize() { return cellW; }

  function getCols() {
    return cols;
  }

  function getPosition(index) {
    if (current === 'spiral') return getSpiralPosition(index);
    if (current === 'wave') return getWavePosition(index);
    return getGridPosition(index);
  }

  const PADDING = 60;

  function getGridPosition(index) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    return {
      x: PADDING + col * cellW,
      y: PADDING + row * cellH,
    };
  }

  function getSpiralPosition(index) {
    const spacing = cellW * 1.5;
    const b = spacing / (2 * Math.PI);
    const angle = Math.sqrt(index * 5.5);
    const r = b * angle + cellW * 0.6;
    return {
      x: r * Math.cos(angle),
      y: r * Math.sin(angle),
    };
  }

  function getWavePosition(index) {
    return {
      x: PADDING + index * cellW,
      y: 0,
    };
  }

  function getIndexAtPosition(wx, wy) {
    if (current === 'spiral') {
      const r = Math.sqrt(wx * wx + wy * wy);
      const spacing = cellW * 1.5;
      const b = spacing / (2 * Math.PI);
      // Get angle from position
      let theta = Math.atan2(wy, wx);
      if (theta < 0) theta += 2 * Math.PI;
      // Approximate spiral angle from radius
      const spiralAngle = Math.max(0, (r - cellW * 0.6)) / b;
      // Find which full revolution we're on
      const rev = Math.floor((spiralAngle - theta) / (2 * Math.PI));
      // Test candidate angles on adjacent revolutions
      let bestIdx = -1;
      let bestDist = Infinity;
      for (let d = -1; d <= 2; d++) {
        const candidateAngle = theta + (rev + d) * 2 * Math.PI;
        if (candidateAngle < 0) continue;
        const idx = Math.round((candidateAngle * candidateAngle) / 5.5);
        if (idx < 0) continue;
        const pos = getSpiralPosition(idx);
        const dist = (pos.x - wx) * (pos.x - wx) + (pos.y - wy) * (pos.y - wy);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = idx;
        }
      }
      // Only return if close enough to the cell
      const threshold = cellW * 0.8;
      if (bestDist < threshold * threshold) return bestIdx;
      return -1;
    }
    if (current === 'wave') {
      return Math.max(0, Math.round((wx - PADDING) / cellW));
    }
    const col = Math.floor((wx - PADDING) / cellW);
    const row = Math.floor((wy - PADDING) / cellH);
    if (col < 0 || col >= cols || row < 0) return -1;
    return row * cols + col;
  }

  function getVisibleRange(camX, camY, camZoom, canvasW, canvasH) {
    if (current !== 'grid') return null;

    const left = camX - PADDING;
    const top = camY - PADDING;
    const viewW = canvasW / camZoom;
    const viewH = canvasH / camZoom;

    const startCol = Math.max(0, Math.floor(left / cellW) - 1);
    const endCol = Math.min(cols - 1, Math.ceil((left + viewW) / cellW) + 1);
    const startRow = Math.max(0, Math.floor(top / cellH) - 1);
    const endRow = Math.ceil((top + viewH) / cellH) + 1;

    return { startCol, endCol, startRow, endRow };
  }

  function getBounds(cellCount) {
    if (current === 'grid') {
      const rows = Math.ceil(cellCount / cols);
      return {
        minX: 0,
        minY: 0,
        maxX: PADDING * 2 + cols * cellW,
        maxY: PADDING * 2 + rows * cellH,
      };
    }
    if (current === 'spiral') {
      const spacing = cellW * 1.5;
      const b = spacing / (2 * Math.PI);
      const angle = Math.sqrt(cellCount * 5.5);
      const r = b * angle + cellW * 0.6 + cellW * 5;
      return { minX: -r, minY: -r, maxX: r, maxY: r };
    }
    if (current === 'wave') {
      return {
        minX: -cellW * 5,
        minY: -window.innerHeight,
        maxX: cellCount * cellW + cellW * 5,
        maxY: window.innerHeight,
      };
    }
    return null;
  }

  return {
    setType, getType, setCols, getCols, getCellSize, getCellW, getCellH,
    getPosition, getIndexAtPosition, getVisibleRange, getBounds,
  };
})();
