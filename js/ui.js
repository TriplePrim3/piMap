const UI = (() => {
  let searchTimeout = null;
  let currentConstant = 'pi';

  // Famous patterns in π (position is the digit index after "3.")
  const FAMOUS_PATTERNS = [
    { name: 'Feynman Point', pattern: '999999', pos: 761, icon: '🎯', desc: 'Six consecutive 9s', section: 'Famous Sequences' },
    { name: 'First 0123456789', pattern: '0123456789', pos: 17387594880, icon: '🔢', desc: 'All digits in order', section: 'Famous Sequences' },
    { name: 'First 123456', pattern: '123456', pos: 2458884, icon: '📈', desc: 'Counting up 1–6', section: 'Consecutive Runs' },
    { name: 'First 12345', pattern: '12345', pos: 49701, icon: '📈', desc: 'Counting up 1–5', section: 'Consecutive Runs' },
    { name: 'First 1234', pattern: '1234', pos: 13806, icon: '📈', desc: 'Counting up 1–4', section: 'Consecutive Runs' },
    { name: 'Seven 3s', pattern: '3333333', pos: 710099, icon: '🔁', desc: 'Seven consecutive 3s', section: 'Repeated Digits' },
    { name: 'Six 7s', pattern: '777777', pos: 399578, icon: '🎰', desc: 'Six consecutive 7s', section: 'Repeated Digits' },
    { name: 'First 11111', pattern: '11111', pos: 32787, icon: '🔁', desc: 'Five consecutive 1s', section: 'Repeated Digits' },
    { name: 'First 00000', pattern: '00000', pos: 17533, icon: '⭕', desc: 'Five consecutive 0s', section: 'Repeated Digits' },
    { name: '2718 (e)', pattern: '2718', pos: 11705, icon: 'e', desc: 'Euler\'s number in π', section: 'Constants in π' },
    { name: '1414 (√2)', pattern: '1414', pos: 1635, icon: '√', desc: '√2 appears in π', section: 'Constants in π' },
    { name: '1618 (φ)', pattern: '1618', pos: 6003, icon: 'φ', desc: 'Golden ratio in π', section: 'Constants in π' },
  ];

  function init() {
    setupSearch();
    setupConstants();
    setupPanel();
    setupMappings();
    setupLayouts();
    setupTheme();
    setupCanvasInteraction();
    setupFamousPatterns();

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

    // Filter input: only allow alphanumeric characters
    input.addEventListener('input', () => {
      const cleaned = input.value.replace(/[^a-zA-Z0-9]/g, '');
      if (cleaned !== input.value) {
        const pos = input.selectionStart - (input.value.length - cleaned.length);
        input.value = cleaned;
        input.setSelectionRange(pos, pos);
      }
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
        document.getElementById('searchEncoding').classList.add('hidden');
        hideApiBanner();
        input.blur();
      }
    });

    document.getElementById('nextMatch').addEventListener('click', goToNext);
    document.getElementById('prevMatch').addEventListener('click', goToPrev);

    // Encoding mode selector
    document.querySelectorAll('input[name="searchEnc"]').forEach(radio => {
      radio.addEventListener('change', () => {
        Search.setTextEncoding(radio.value);
        // Re-search with new encoding if there's a text query
        const query = input.value.trim();
        if (query && /[a-zA-Z]/.test(query)) {
          doSearch();
        }
      });
    });
    // Prevent encoding pills from triggering canvas drag
    document.getElementById('searchEncoding').addEventListener('mousedown', (e) => e.stopPropagation());

    // Global shortcut: Ctrl+F or / to focus search
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey && e.key === 'f') || (e.key === '/' && document.activeElement !== input)) {
        e.preventDefault();
        input.focus();
        input.select();
      }
    });
  }

  function buildConversionHTML(query, converted) {
    const mode = converted.mode;
    const modeLabels = { alpha26: 'Alpha-26', compact: 'Compact', t9: 'T9 Keypad' };
    const modeColors = { alpha26: '#7c6ff7', compact: '#4ecdc4', t9: '#ff6b9d' };
    const color = modeColors[mode] || '#7c6ff7';

    // Build per-character mapping display
    const parts = [];
    for (const ch of query) {
      if (/[a-zA-Z]/.test(ch)) {
        let encoded;
        if (mode === 't9') encoded = Mappings.letterToT9(ch);
        else if (mode === 'compact') encoded = Mappings.letterToCompact(ch);
        else encoded = Mappings.letterToPair(ch);
        if (encoded) {
          parts.push(`<span style="color:${color}">${ch.toUpperCase()}</span><span class="conv-arrow">=</span><span style="color:var(--text)">${encoded}</span>`);
        }
      } else if (/\d/.test(ch)) {
        parts.push(`<span style="color:var(--text)">${ch}</span>`);
      }
    }

    return `<span class="conv-label">${modeLabels[mode] || mode} encoding</span>`
      + `<span class="conv-mapping">${parts.join('  ')}</span>`
      + `<span class="conv-arrow" style="margin-left:12px">→</span> `
      + `<span style="color:${color};font-size:20px;font-weight:800">${converted.digitQuery}</span>`
      + `<span style="color:var(--text-dim);font-size:12px;margin-left:8px">(${converted.digitQuery.length} digits)</span>`;
  }

  function doSearch() {
    const input = document.getElementById('searchInput');
    const nav = document.getElementById('searchNav');
    const badge = document.getElementById('searchResults');
    const matchIdx = document.getElementById('matchIndex');
    const convEl = document.getElementById('searchConversion');
    const encEl = document.getElementById('searchEncoding');
    const query = input.value.trim();

    hideApiBanner();

    if (!query) {
      Search.clear();
      Renderer.setSearchHighlights(null, 0);
      Minimap.clearMarkers();
      nav.classList.add('hidden');
      badge.classList.add('hidden');
      convEl.classList.add('hidden');
      encEl.classList.add('hidden');
      return;
    }

    const digits = App.getDigits();
    if (!digits) return;

    // Show encoding selector when query has letters
    const hasLetters = /[a-zA-Z]/.test(query);
    if (hasLetters) {
      encEl.classList.remove('hidden');
    } else {
      encEl.classList.add('hidden');
    }

    const { results, converted } = Search.find(digits, query);
    const digitPatternLen = converted.digitQuery.length;

    Renderer.setSearchHighlights(results, digitPatternLen);

    // Show conversion info for text searches
    if (converted.mode !== 'digits') {
      convEl.innerHTML = buildConversionHTML(query, converted);
      convEl.classList.remove('hidden');
    } else {
      convEl.classList.add('hidden');
    }

    // Run all 3 encodings for minimap when query has letters
    if (hasLetters) {
      const modes = ['alpha26', 'compact', 't9'];
      const layers = [];
      for (const mode of modes) {
        const conv = Search.convertWithMode(query, mode);
        if (conv.digitQuery) {
          const hits = Search.findPattern(digits, conv.digitQuery);
          layers.push({ mode, results: hits });
        }
      }
      Minimap.setAllMarkerLayers(layers);
    } else {
      // Digit-only: single layer
      Minimap.setAllMarkerLayers([{ mode: 'digits', results }]);
    }

    if (results.length > 0) {
      badge.textContent = results.length.toLocaleString();
      badge.classList.remove('hidden');
      nav.classList.remove('hidden');
      matchIdx.textContent = `1/${results.length.toLocaleString()}`;
      Minimap.setSearchMarkers(results, digitPatternLen, converted.mode);
      Minimap.setCurrentMatch(0);
      Minimap.setApiMarker(null);
      navigateToMatch(results[0], digitPatternLen);
    } else {
      badge.textContent = '0';
      badge.classList.remove('hidden');
      nav.classList.add('hidden');
      if (!hasLetters) Minimap.clearMarkers();

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
    const ctxPanel = document.getElementById('apiContextPanel');

    const digitStr = converted.digitQuery;
    const word = query.replace(/[^a-zA-Z]/g, '').toUpperCase();
    const pairAligned = false;

    // Show loading state
    banner.classList.remove('hidden');
    banner.classList.add('loading');
    ctxPanel.classList.add('hidden');
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

        const before = first.before || '';
        const after = first.after || '';
        detail.innerHTML =
          `\u03C0 = 3.<span class="ellipsis">...${before}</span>`
          + `<span class="match-highlight">${digitStr}</span>`
          + `<span class="ellipsis">${after}...</span>`
          + ` <span style="opacity:0.5">(${result.elapsed}ms, ${totalFormatted} digits)</span>`;

        // Show expanded context panel in the banner itself
        showApiContextPanel(pos, digitStr.length, digitStr, label, result.totalDigits);

        Minimap.setApiMarker(pos, label);
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

  async function showApiContextPanel(globalPos, matchLen, digitStr, label, totalDigits) {
    const ctxPanel = document.getElementById('apiContextPanel');
    const strip = document.getElementById('apiContextStrip');
    const localEl = document.getElementById('scaleLocal');
    const pinEl = document.getElementById('scalePin');
    const totalLabel = document.getElementById('scaleTotalLabel');

    // Log-scale helper
    function logScale(value, total) {
      if (value <= 0) return 0;
      return Math.log(1 + value) / Math.log(1 + total);
    }
    function compactNum(n) {
      if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
      if (n >= 1e6) return (n / 1e6).toFixed(0) + 'M';
      if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
      return String(n);
    }

    const localDigits = App.getDigits() ? App.getDigits().length : 1e6;

    // Scale bar
    const localFrac = logScale(localDigits, totalDigits) * 100;
    const matchFrac = logScale(globalPos, totalDigits) * 100;
    localEl.style.width = Math.max(0.5, localFrac) + '%';
    pinEl.style.left = matchFrac + '%';
    totalLabel.textContent = compactNum(totalDigits);

    // Fetch context digits
    try {
      const resp = await fetch(`/api/picontext?pos=${globalPos}&radius=15`);
      if (!resp.ok) { ctxPanel.classList.add('hidden'); return; }
      const data = await resp.json();

      const allDigits = data.digits;
      const mOff = data.matchOffset;
      const before = Math.min(10, mOff);
      const after = Math.min(10, allDigits.length - mOff - matchLen);
      const start = mOff - before;
      const contextDigits = allDigits.substring(start, mOff + matchLen + after);
      const matchStart = before;
      const colors = Renderer.getDigitColors ? Renderer.getDigitColors() : null;

      let html = '<span class="ctx-ellipsis">...</span>';
      for (let i = 0; i < contextDigits.length; i++) {
        const d = contextDigits[i];
        const isMatch = i >= matchStart && i < matchStart + matchLen;
        const color = colors ? colors[Number(d)] : 'var(--text)';
        if (isMatch) {
          html += `<span class="ctx-digit match" style="color:${color}">${d}</span>`;
        } else {
          html += `<span class="ctx-digit">${d}</span>`;
        }
      }
      html += '<span class="ctx-ellipsis">...</span>';

      strip.innerHTML = html;
      ctxPanel.classList.remove('hidden');
    } catch (e) {
      ctxPanel.classList.add('hidden');
    }
  }

  function hideApiBanner() {
    const banner = document.getElementById('apiResultBanner');
    banner.classList.add('hidden');
    banner.classList.remove('loading');
    document.getElementById('apiContextPanel').classList.add('hidden');
    Minimap.setApiMarker(null);
    PiApi.cancel();
  }

  function goToNext() {
    const pos = Search.next();
    if (pos >= 0) {
      const patLen = Search.getLastConvertedQuery().length;
      navigateToMatch(pos, patLen);
      updateMatchCounter();
      Minimap.setCurrentMatch(Search.getCurrentIndex());
    }
  }

  function goToPrev() {
    const pos = Search.prev();
    if (pos >= 0) {
      const patLen = Search.getLastConvertedQuery().length;
      navigateToMatch(pos, patLen);
      updateMatchCounter();
      Minimap.setCurrentMatch(Search.getCurrentIndex());
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

    const pos = Layout.getPosition(rawDigitIndex);
    const targetZoom = 4;
    const halfLen = (patternLength * cw) / 2;
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
        // Show famous panel only for pi
        const famousPanel = document.getElementById('famousPanel');
        if (famousPanel) famousPanel.style.display = key === 'pi' ? '' : 'none';
        await App.switchConstant(key);
      });
    });
  }

  function setupPanel() {
    const toggle = document.getElementById('panelToggle');
    const dropdown = document.getElementById('settingsDropdown');

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('hidden');
    });

    // Prevent dropdown clicks from panning the canvas
    dropdown.addEventListener('mousedown', (e) => e.stopPropagation());

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!dropdown.classList.contains('hidden') && !dropdown.contains(e.target) && e.target !== toggle && !toggle.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
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
          Camera.setZoom(1.5);
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
        Minimap.invalidate();
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

  function setupFamousPatterns() {
    const panel = document.getElementById('famousPanel');
    const list = document.getElementById('famousPatterns');
    if (!list) return;

    // Build list content
    let html = '';
    let lastSection = '';
    for (const p of FAMOUS_PATTERNS) {
      if (p.section !== lastSection) {
        html += `<div class="famous-section">${p.section}</div>`;
        lastSection = p.section;
      }
      const posLabel = p.pos >= 1e9 ? (p.pos / 1e9).toFixed(1) + 'B'
        : p.pos >= 1e6 ? (p.pos / 1e6).toFixed(1) + 'M'
        : p.pos >= 1e3 ? (p.pos / 1e3).toFixed(1) + 'K'
        : String(p.pos);
      html += `<div class="famous-item" data-pattern="${p.pattern}" data-pos="${p.pos}">
        <span class="famous-icon">${p.icon}</span>
        <div class="famous-info">
          <div class="famous-name">${p.name}</div>
          <div class="famous-desc">${p.desc}</div>
        </div>
        <span class="famous-pos">#${posLabel}</span>
      </div>`;
    }
    list.innerHTML = html;

    // Handle pattern click
    list.addEventListener('click', (e) => {
      const item = e.target.closest('.famous-item');
      if (!item) return;

      const pattern = item.dataset.pattern;
      const pos = parseInt(item.dataset.pos, 10);

      const digits = App.getDigits();
      const effLen = Renderer.getEffectiveLength();

      // If the position is within our loaded digits, navigate directly
      if (pos + pattern.length <= effLen) {
        const input = document.getElementById('searchInput');
        input.value = pattern;
        const results = Search.findPattern(digits, pattern);
        if (results.length > 0) {
          Renderer.setSearchHighlights(results, pattern.length);
          Minimap.setAllMarkerLayers([{ mode: 'digits', results }]);
          Minimap.setSearchMarkers(results, pattern.length, 'digits');

          // Find the match closest to the famous position
          let bestIdx = 0;
          let bestDist = Math.abs(results[0] - pos);
          for (let i = 1; i < results.length; i++) {
            const d = Math.abs(results[i] - pos);
            if (d < bestDist) { bestDist = d; bestIdx = i; }
          }
          Minimap.setCurrentMatch(bestIdx);

          const nav = document.getElementById('searchNav');
          const badge = document.getElementById('searchResults');
          const matchIdx = document.getElementById('matchIndex');
          badge.textContent = results.length.toLocaleString();
          badge.classList.remove('hidden');
          nav.classList.remove('hidden');
          matchIdx.textContent = `${bestIdx + 1}/${results.length.toLocaleString()}`;

          navigateToMatch(results[bestIdx], pattern.length);
        }
      } else {
        // Position is beyond loaded digits — use API
        const input = document.getElementById('searchInput');
        input.value = pattern;
        const converted = { digitQuery: pattern, mode: 'digits', display: pattern };
        searchPiApi(pattern, converted);
      }
    });

    // Prevent canvas drag
    panel.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  return { init, updateInfoBar };
})();
