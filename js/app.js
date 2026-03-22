const App = (() => {
  let digits = '';
  let currentConstant = 'pi';
  let lastTime = 0;

  async function init() {
    // Init renderer
    const canvas = document.getElementById('digitCanvas');
    Renderer.init(canvas);

    // Load default constant
    await loadConstant('pi');

    // Init UI & minimap
    UI.init();
    Minimap.init();

    // Handle resize
    window.addEventListener('resize', () => {
      Renderer.resize();
      Minimap.resize();
    });

    // Hide loading overlay
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.remove(), 600);

    // Check for checkout result
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      setTimeout(() => {
        if (typeof UI !== 'undefined' && UI.unlock) UI.unlock('pi_owner');
        const toast = document.createElement('div');
        toast.className = 'achievement-toast';
        toast.innerHTML = '<span class="toast-icon">🎉</span><div><div style="font-size:11px;opacity:0.6;text-transform:uppercase;letter-spacing:1px">Order Placed!</div>Your custom Pi merch is on its way!</div>';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 6000);
      }, 800);
      // Clean URL
      window.history.replaceState({}, '', '/');
    } else if (params.get('checkout') === 'cancel') {
      window.history.replaceState({}, '', '/');
    }

    // Start render loop
    lastTime = performance.now();
    requestAnimationFrame(renderLoop);
  }

  async function loadConstant(key) {
    digits = await DataLoader.load(key);
    currentConstant = key;

    // Set grid columns based on viewport
    const cols = Math.max(30, Math.floor(window.innerWidth / Layout.getCellW()));
    Layout.setCols(cols);

    Renderer.setDigits(digits, key);
    Minimap.invalidate();

    // Center camera on the first digit (with a small offset so it looks nice)
    resetCamera();
  }

  function resetCamera() {
    const cw = Layout.getCellW();
    const ch = Layout.getCellH();
    const type = Layout.getType();

    if (type === 'wave') {
      Camera.setZoom(1);
      Camera.centerOn(0, 0);
    } else if (type === 'spiral') {
      Camera.setZoom(1.5);
      Camera.centerOn(0, 0);
    } else {
      Camera.setZoom(1);
      Camera.centerOn(Layout.getCols() * cw / 2, ch * 5);
    }
  }

  async function switchConstant(key) {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
      // Create a mini loader
      await loadConstant(key);
      // Clear search
      Search.clear();
      Renderer.setSearchHighlights(null, 0);
      document.getElementById('searchInput').value = '';
      document.getElementById('searchNav').classList.add('hidden');
      document.getElementById('searchResults').classList.add('hidden');
      document.getElementById('apiResultBanner').classList.add('hidden');
      Renderer.setRemoteSegment(null);
      Minimap.clearMarkers();
      return;
    }
    await loadConstant(key);
  }

  function appendDigits(extra) {
    digits += extra;
    Renderer.setDigits(digits, currentConstant);
    Camera.markDirty();
    Minimap.invalidate();
  }

  function getDigits() {
    return digits;
  }

  function getCurrentConstant() {
    return currentConstant;
  }

  function renderLoop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    Camera.update();
    Particles.update(dt);

    const needsRender = Camera.isDirty() || Camera.isAnimating() || Particles.hasParticles()
      || Layout.getType() === 'wave' || Renderer.isExpanding();
    if (needsRender) {
      Renderer.render();
      Camera.clearDirty();
      UI.updateInfoBar();
      Minimap.render();
    }

    requestAnimationFrame(renderLoop);
  }

  // Start the app
  document.addEventListener('DOMContentLoaded', init);

  return { getDigits, appendDigits, getCurrentConstant, switchConstant, resetCamera };
})();
