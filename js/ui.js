const UI = (() => {
  let searchTimeout = null;
  let currentConstant = 'pi';

  function init() {
    setupSearch();
    setupConstants();
    setupPanel();
    setupMappings();
    setupLayouts();
    setupTheme();
    setupCanvasInteraction();

    document.getElementById('apiResultClose').addEventListener('click', hideApiBanner);

    updateInfoBar();
  }

  function setupSearch() {
    const input = document.getElementById('searchInput');
    const nav = document.getElementById('searchNav');
    const badge = document.getElementById('searchResults');
    const matchIdx = document.getElementById('matchIndex');

    // Prevent canvas interactions from stealing focus
    input.addEventListener('mousedown', (e) => e.stopPropagation());
    input.addEventListener('click', (e) => e.stopPropagation());

    input.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        doSearch();
      }, 200);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          goToPrev();
        } else {
          if (Search.getResults().length === 0) {
            doSearch();
          } else {
            goToNext();
          }
        }
      }
      if (e.key === 'Escape') {
        input.value = '';
        Search.clear();
        Renderer.setSearchHighlights(null, 0);
        nav.classList.add('hidden');
        badge.classList.add('hidden');
        document.getElementById('searchConversion').classList.add('hidden');
        hideApiBanner();
        input.blur();
      }
    });

    document.getElementById('nextMatch').addEventListener('click', goToNext);
    document.getElementById('prevMatch').addEventListener('click', goToPrev);

    // Global shortcut: Ctrl+F or / to focus search
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey && e.key === 'f') || (e.key === '/' && document.activeElement !== input)) {
        e.preventDefault();
        input.focus();
        input.select();
      }
    });
  }

  function doSearch() {
    const input = document.getElementById('searchInput');
    const nav = document.getElementById('searchNav');
    const badge = document.getElementById('searchResults');
    const matchIdx = document.getElementById('matchIndex');
    const convEl = document.getElementById('searchConversion');
    const query = input.value.trim();

    hideApiBanner();

    if (!query) {
      Search.clear();
      Renderer.setSearchHighlights(null, 0);
      nav.classList.add('hidden');
      badge.classList.add('hidden');
      convEl.classList.add('hidden');
      return;
    }

    const digits = App.getDigits();
    if (!digits) return;

    const { results, converted } = Search.find(digits, query);
    const digitPatternLen = converted.digitQuery.length;

    Renderer.setSearchHighlights(results, digitPatternLen);

    // Show conversion info for text searches
    if (converted.mode !== 'digits') {
      convEl.textContent = converted.display;
      convEl.classList.remove('hidden');
    } else {
      convEl.classList.add('hidden');
    }

    if (results.length > 0) {
      badge.textContent = results.length.toLocaleString();
      badge.classList.remove('hidden');
      nav.classList.remove('hidden');
      matchIdx.textContent = `1/${results.length.toLocaleString()}`;
      navigateToMatch(results[0], digitPatternLen);
    } else {
      badge.textContent = '0';
      badge.classList.remove('hidden');
      nav.classList.add('hidden');

      // No local results — try the Pi search API if this is a pi constant
      if (currentConstant === 'pi' && converted.digitQuery.length >= 4) {
        searchPiApi(query, converted);
      }
    }
  }

  async function searchPiApi(query, converted) {
    const banner = document.getElementById('apiResultBanner');
    const icon = document.getElementById('apiResultIcon');
    const title = document.getElementById('apiResultTitle');
    const detail = document.getElementById('apiResultDetail');

    const digitStr = converted.digitQuery;
    const word = query.replace(/[^a-zA-Z]/g, '').toUpperCase();
    const pairAligned = converted.mode === 'alpha26';

    // Show loading state
    banner.classList.remove('hidden');
    banner.classList.add('loading');
    icon.textContent = '';
    title.textContent = `Searching extended \u03C0 digits for "${word || digitStr}"...`;
    detail.textContent = 'Scanning digit chunks with KMP...';

    try {
      const result = await PiApi.search(digitStr, pairAligned);

      banner.classList.remove('loading');

      if (result.found && result.results.length > 0) {
        const first = result.results[0];
        const pos = first.position;
        const posFormatted = pos.toLocaleString();
        const totalFormatted = result.totalDigits.toLocaleString();

        icon.textContent = '\u{1F3AF}';
        const label = word || digitStr;
        title.innerHTML = `Found "<b>${label}</b>" in \u03C0`
          + `<span class="api-position">digit #${posFormatted}</span>`;

        // Build context display with "..." truncation
        const before = first.before || '';
        const after = first.after || '';
        detail.innerHTML =
          `\u03C0 = 3.<span class="ellipsis">...${before}</span>`
          + `<span class="match-highlight">${digitStr}</span>`
          + `<span class="ellipsis">${after}...</span>`
          + ` <span style="opacity:0.5">(${result.elapsed}ms, ${totalFormatted} digits)</span>`;
      } else {
        const totalFormatted = (result.totalDigits || 0).toLocaleString();
        icon.textContent = '\u{1F50D}';
        title.textContent = `"${word || digitStr}" not found in ${totalFormatted} digits of \u03C0`;
        detail.textContent = `Sequence "${digitStr}" doesn't appear in the available digits. Download more with: node scripts/download-pi.js`;
      }
    } catch (err) {
      banner.classList.remove('loading');
      if (err.name === 'AbortError') {
        banner.classList.add('hidden');
        return;
      }
      icon.textContent = '\u{26A0}\u{FE0F}';
      title.textContent = 'Search server not running';
      detail.textContent = 'Start it with: node server.js';
    }
  }

  function hideApiBanner() {
    const banner = document.getElementById('apiResultBanner');
    banner.classList.add('hidden');
    banner.classList.remove('loading');
    PiApi.cancel();
  }

  function goToNext() {
    const pos = Search.next();
    if (pos >= 0) {
      const patLen = Search.getLastConvertedQuery().length;
      navigateToMatch(pos, patLen);
      updateMatchCounter();
    }
  }

  function goToPrev() {
    const pos = Search.prev();
    if (pos >= 0) {
      const patLen = Search.getLastConvertedQuery().length;
      navigateToMatch(pos, patLen);
      updateMatchCounter();
    }
  }

  function updateMatchCounter() {
    const results = Search.getResults();
    const idx = Search.getCurrentIndex();
    document.getElementById('matchIndex').textContent =
      `${(idx + 1).toLocaleString()}/${results.length.toLocaleString()}`;
  }

  function navigateToMatch(rawDigitIndex, patternLength) {
    const cw = Layout.getCellW();
    const ch = Layout.getCellH();

    const cellIdx = Renderer.rawToCell(rawDigitIndex);
    const cellEndIdx = Renderer.rawToCell(rawDigitIndex + patternLength - 1);
    const cellPatLen = cellEndIdx - cellIdx + 1;

    const pos = Layout.getPosition(cellIdx);
    const targetZoom = 4;
    const halfLen = (cellPatLen * cw) / 2;
    const tx = pos.x + halfLen - (window.innerWidth / 2) / targetZoom;
    const ty = pos.y - (window.innerHeight / 2) / targetZoom + ch / 2;

    Camera.animateTo(tx, ty, targetZoom, 800);
  }

  function setupConstants() {
    document.querySelectorAll('.const-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const key = btn.dataset.constant;
        if (key === currentConstant) return;

        document.querySelector('.const-btn.active').classList.remove('active');
        btn.classList.add('active');
        currentConstant = key;
        await App.switchConstant(key);
      });
    });
  }

  function setupPanel() {
    const toggle = document.getElementById('panelToggle');
    const content = document.getElementById('panelContent');

    toggle.addEventListener('click', () => {
      content.classList.toggle('hidden');
    });

    // Prevent panel clicks from panning the canvas
    content.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  function setupMappings() {
    document.querySelectorAll('input[name="mapping"]').forEach(radio => {
      radio.addEventListener('change', () => {
        Mappings.set(radio.value);
        Renderer.buildAtlas();
      });
    });
  }

  function setupLayouts() {
    document.querySelectorAll('input[name="layout"]').forEach(radio => {
      radio.addEventListener('change', () => {
        Layout.setType(radio.value);
        if (radio.value === 'spiral') {
          Camera.setZoom(0.3);
          Camera.centerOn(0, 0);
        } else if (radio.value === 'wave') {
          Camera.setZoom(1);
          Camera.centerOn(0, 0);
        } else {
          Camera.setZoom(1);
          Camera.centerOn(Layout.getCols() * Layout.getCellW() / 2, Layout.getCellH() * 5);
        }
      });
    });
  }

  function setupTheme() {
    document.querySelectorAll('input[name="theme"]').forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.value === 'light') {
          document.documentElement.setAttribute('data-theme', 'light');
        } else {
          document.documentElement.removeAttribute('data-theme');
        }
        Renderer.buildAtlas();
      });
    });
  }

  function setupCanvasInteraction() {
    const canvas = document.getElementById('digitCanvas');
    let dragging = false;
    let lastX = 0, lastY = 0;

    canvas.addEventListener('mousedown', (e) => {
      // Only start drag if not clicking on UI elements
      if (e.target !== canvas) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      Camera.pan(dx, dy);
      lastX = e.clientX;
      lastY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      dragging = false;
      canvas.style.cursor = 'grab';
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      Camera.zoomAt(factor, e.clientX, e.clientY);
      updateInfoBar();
    }, { passive: false });

    canvas.style.cursor = 'grab';

    // Touch support
    let lastTouchDist = 0;

    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        dragging = true;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        dragging = false;
        lastTouchDist = getTouchDist(e.touches);
      }
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && dragging) {
        const dx = e.touches[0].clientX - lastX;
        const dy = e.touches[0].clientY - lastY;
        Camera.pan(dx, dy);
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        const dist = getTouchDist(e.touches);
        const center = getTouchCenter(e.touches);
        const factor = dist / lastTouchDist;
        Camera.zoomAt(factor, center.x, center.y);
        lastTouchDist = dist;
        updateInfoBar();
      }
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
      dragging = false;
    });
  }

  function getTouchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getTouchCenter(touches) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }

  function updateInfoBar() {
    const { x, y, zoom } = Camera.getState();
    const centerIdx = Layout.getIndexAtPosition(
      x + window.innerWidth / 2 / zoom,
      y + window.innerHeight / 2 / zoom
    );
    const digits = App.getDigits();
    document.getElementById('digitPosition').textContent = `Digit #${Math.max(0, centerIdx).toLocaleString()}`;
    document.getElementById('totalDigits').textContent = `of ${digits ? digits.length.toLocaleString() : '0'} digits`;
    document.getElementById('zoomLevel').textContent = `Zoom: ${zoom.toFixed(1)}x`;
  }

  return { init, updateInfoBar };
})();
