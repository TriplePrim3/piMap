const Camera = (() => {
  let x = 0;
  let y = 0;
  let zoom = 1;
  let targetX = 0;
  let targetY = 0;
  let targetZoom = 1;
  let animating = false;
  let animStart = 0;
  let animDuration = 800;
  let startX = 0, startY = 0, startZoom = 1;
  let dirty = true;

  const MIN_ZOOM = 0.15;
  const MAX_ZOOM = 15;

  function getState() {
    return { x, y, zoom };
  }

  function isDirty() {
    return dirty;
  }

  function clearDirty() {
    dirty = false;
  }

  function markDirty() {
    dirty = true;
  }

  function setPosition(nx, ny) {
    x = nx;
    y = ny;
    clampToBounds();
    dirty = true;
  }

  // Center the viewport on a world coordinate
  function centerOn(wx, wy) {
    x = wx - window.innerWidth / 2 / zoom;
    y = wy - window.innerHeight / 2 / zoom;
    clampToBounds();
    dirty = true;
  }

  function setZoom(z) {
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
    clampToBounds();
    dirty = true;
  }

  function pan(dx, dy) {
    x -= dx / zoom;
    y -= dy / zoom;
    clampToBounds();
    dirty = true;
  }

  function zoomAt(factor, cx, cy) {
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
    const worldX = x + cx / zoom;
    const worldY = y + cy / zoom;
    zoom = newZoom;
    x = worldX - cx / zoom;
    y = worldY - cy / zoom;
    clampToBounds();
    dirty = true;
  }

  function clampToBounds() {
    const digits = typeof App !== 'undefined' && App.getDigits ? App.getDigits() : null;
    if (!digits) return;

    // Use effective cell count (accounts for paired mode)
    const effLen = typeof Renderer !== 'undefined' && Renderer.getEffectiveLength
      ? Renderer.getEffectiveLength()
      : digits.length;
    const bounds = Layout.getBounds(effLen);
    if (!bounds) return;

    const viewW = window.innerWidth / zoom;
    const viewH = window.innerHeight / zoom;

    // Don't let the camera show too much empty space beyond the content
    const margin = Math.max(viewW, viewH) * 0.3;

    x = Math.max(bounds.minX - margin, Math.min(bounds.maxX - viewW + margin, x));
    y = Math.max(bounds.minY - margin, Math.min(bounds.maxY - viewH + margin, y));
  }

  function animateTo(tx, ty, tz, duration) {
    animDuration = duration || 800;
    startX = x;
    startY = y;
    startZoom = zoom;
    targetX = tx;
    targetY = ty;
    targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, tz));
    animStart = performance.now();
    animating = true;
    dirty = true;
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function update() {
    if (!animating) return;

    const now = performance.now();
    const elapsed = now - animStart;
    let t = Math.min(elapsed / animDuration, 1);
    const ease = easeInOutCubic(t);

    x = startX + (targetX - startX) * ease;
    y = startY + (targetY - startY) * ease;
    zoom = startZoom + (targetZoom - startZoom) * ease;
    dirty = true;

    if (t >= 1) {
      animating = false;
      clampToBounds();
    }
  }

  function isAnimating() {
    return animating;
  }

  return {
    getState, isDirty, clearDirty, markDirty,
    setPosition, setZoom, centerOn, pan, zoomAt,
    animateTo, update, isAnimating, clampToBounds,
    MIN_ZOOM, MAX_ZOOM,
  };
})();
