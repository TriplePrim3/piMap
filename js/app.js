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

    // Init UI
    UI.init();

    // Handle resize
    window.addEventListener('resize', () => {
      Renderer.resize();
    });

    // Hide loading overlay
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.remove(), 600);

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
      Camera.setZoom(0.3);
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
      return;
    }
    await loadConstant(key);
  }

  function getDigits() {
    return digits;
  }

  function renderLoop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    Camera.update();
    Particles.update(dt);

    const alwaysRender = Layout.getType() === 'wave';
    if (Camera.isDirty() || Camera.isAnimating() || Particles.hasParticles() || alwaysRender) {
      Renderer.render();
      Camera.clearDirty();
      UI.updateInfoBar();
    }

    requestAnimationFrame(renderLoop);
  }

  // Start the app
  document.addEventListener('DOMContentLoaded', init);

  return { getDigits, switchConstant, resetCamera };
})();
