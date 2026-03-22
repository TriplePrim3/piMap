const UI = (() => {
  let searchTimeout = null;
  let currentConstant = 'pi';
  const spiralLinesEnabled = true;
  const ENC_COLORS = { t9: '#ff6b9d', compact: '#4ecdc4', alpha26: '#7c6ff7' };

  // Famous patterns in π (position is the digit index after "3.")
  const FAMOUS_PATTERNS = [
    { name: 'Feynman Point', pattern: '999999', pos: 761, icon: '🎯', desc: 'Six consecutive 9s', section: 'Famous Sequences',
      facts: [
        'Richard Feynman once joked he wanted to memorize π up to this point, then say "nine nine nine nine nine nine and so on," implying π is rational. It\'s at position 762!',
        'Six 9s in a row at position 762. Feynman was a physicist, a bongo player, and apparently a π troll.',
        'The Feynman Point is like π rickrolling mathematicians since 1988.',
      ] },
    { name: 'First 1234', pattern: '1234', pos: 13806, icon: '📈', desc: 'Counting up 1–4', section: 'Consecutive Runs',
      facts: [
        'You\'d expect a random 4-digit pattern around position 10,000. 1234 is a little late to the party at 13,807.',
        '1234 shows up at 13,807. Even π uses basic passwords sometimes.',
      ] },
    { name: 'First 12345', pattern: '12345', pos: 49701, icon: '📈', desc: 'Counting up 1–5', section: 'Consecutive Runs',
      facts: [
        'The counting sequence 12345 first shows up at position 49,702. Earlier than you might expect for a 5-digit string!',
        '12345 at position 49,702. π\'s password game is as weak as yours.',
      ] },
    { name: 'First 123456', pattern: '123456', pos: 2458884, icon: '📈', desc: 'Counting up 1–6', section: 'Consecutive Runs',
      facts: [
        'Finding 123456 in π took over 2.4 million digits. Adding just one more digit (1234567) pushes it to 9.5 million!',
        'π counted to 6 at position 2.4M. For a number that goes on forever, it sure took its time.',
      ] },
    { name: 'First 0123456789', pattern: '0123456789', pos: 17387594880, icon: '🔢', desc: 'All digits in order', section: 'Consecutive Runs',
      facts: [
        'The first time all ten digits appear in order (0123456789) in π is at the 17.4 billionth digit. That\'s deep!',
        'π had to think about it for 17.4 billion digits before counting to 9. Relatable.',
        '0123456789 in π? It took 17.4 billion digits. π really said "I\'ll do it in my own time."',
      ] },
    { name: 'First 00000', pattern: '00000', pos: 17533, icon: '⭕', desc: 'Five consecutive 0s', section: 'Repeated Digits',
      facts: [
        'Five zeros in a row at position 17,534. The nothingness within infinity. Oddly poetic for a math constant.',
        '00000 at position 17,534. π took a five-digit nap.',
      ] },
    { name: 'First 11111', pattern: '11111', pos: 32787, icon: '🔁', desc: 'Five consecutive 1s', section: 'Repeated Digits',
      facts: [
        'Five 1s in a row appear relatively early. Fun fact: the probability of five consecutive same digits at any point is 1 in 100,000.',
        '11111 at position 32,788. π was just making sure the 1 key works.',
      ] },
    { name: 'Six 7s', pattern: '777777', pos: 399578, icon: '🎰', desc: 'Six consecutive 7s', section: 'Repeated Digits',
      facts: [
        'Six 7s in a row? That\'s lowkey 6/7 no cap. π was serving before it was cool. Position 399,579.',
        'Six 7s — a jackpot in π! If π were a slot machine, this would be the big win at position 399,579.',
        '777777 at position 399,579. Vegas wishes it had these odds.',
      ] },
    { name: 'Seven 3s', pattern: '3333333', pos: 710099, icon: '🔁', desc: 'Seven consecutive 3s', section: 'Repeated Digits',
      facts: [
        'Seven 3s in a row! The digit 3 is the first digit of π after the decimal, so maybe π is just playing favorites.',
        'Seven 3s at position 710,100. π really said "3 is my main character."',
      ] },
    { name: '1414 (√2)', pattern: '1414', pos: 1635, icon: '√', desc: '√2 appears in π', section: 'Constants in π',
      facts: [
        '√2 (1.414...) appears in π very early at position 1,636. The first irrational number most people learn, hiding inside another.',
        '√2 at position 1,636. Irrationals supporting irrationals. You love to see it.',
      ] },
    { name: '1618 (φ)', pattern: '1618', pos: 6003, icon: 'φ', desc: 'Golden ratio in π', section: 'Constants in π',
      facts: [
        'The golden ratio φ (1.618...) shows up at position 6,004. Nature\'s favorite number, tucked inside the circle constant.',
        'φ inside π at position 6,004. The golden ratio and the circle constant in one place? Math is beautiful.',
      ] },
    { name: '2718 (e)', pattern: '2718', pos: 11705, icon: 'e', desc: 'Euler\'s number in π', section: 'Constants in π',
      facts: [
        'π contains the start of e (2.718...) at position 11,706. Two of math\'s most famous constants, forever intertwined.',
        'e hiding inside π at position 11,706. These two constants are basically besties.',
      ] },
  ];

  let mascotTimer = null;
  let cakeClickCount = 0;

  const CAKE_QUIPS = [
    "There's definitely cake... it's just at the end of π. Keep going! 🍰",
    "Oh there it goes again! The cake is always one step ahead...",
    "You almost had it! But π had other plans.",
    "The cake isn't a lie — it's just... infinitely far away.",
    "π keeps adding digits just to keep the cake out of reach.",
    "At this rate, the cake will be stale by the time you get there.",
    "Fun fact: the cake has been running since Archimedes first tried.",
    "Maybe the real cake was the digits we computed along the way?",
    "Still chasing cake? π respects the hustle.",
    "Legend says if you reach the last digit of π, the cake is chocolate.",
  ];

  const MASCOT_TIPS = [
    'Try searching for your birthday!',
    'Type <b>#100</b> to jump to the 100th digit.',
    'Every finite sequence appears in π... probably.',
    'The Feynman Point has six 9s in a row at position 762!',
    'π has been computed to 105 trillion digits.',
    'Click the last digit to expand π further.',
    'Try searching a word — it gets encoded into digits!',
    'π is irrational. It never repeats, never ends.',
  ];

  let _typewriterTimer = null;

  function mascotSay(html, duration) {
    const bubble = document.getElementById('mascotBubble');
    bubble.classList.remove('hidden');

    // Kill any in-progress typewriter
    if (_typewriterTimer) { clearInterval(_typewriterTimer); _typewriterTimer = null; }
    clearTimeout(mascotTimer);
    Sounds.stopBabble();

    // Parse HTML into nodes, then reveal text character by character
    // We render the full HTML invisibly first to preserve structure,
    // then reveal characters one at a time
    bubble.innerHTML = html;
    const fullHTML = bubble.innerHTML;

    // Collect all text nodes and their content
    const textNodes = [];
    function walk(node) {
      if (node.nodeType === 3) { // text node
        if (node.textContent.length > 0) textNodes.push(node);
      } else {
        for (const child of node.childNodes) walk(child);
      }
    }
    walk(bubble);

    // Store original text, blank them all out
    const originals = textNodes.map(n => n.textContent);
    textNodes.forEach(n => { n.textContent = ''; });

    let nodeIdx = 0;
    let charIdx = 0;
    const speed = 25; // ms per character

    _typewriterTimer = setInterval(() => {
      if (nodeIdx >= textNodes.length) {
        clearInterval(_typewriterTimer);
        _typewriterTimer = null;
        // Start hide timer after typing finishes
        if (duration) {
          mascotTimer = setTimeout(() => bubble.classList.add('hidden'), duration);
        }
        return;
      }

      const orig = originals[nodeIdx];
      charIdx++;
      textNodes[nodeIdx].textContent = orig.substring(0, charIdx);

      // Play tick sound for visible characters (skip spaces)
      const ch = orig[charIdx - 1];
      if (ch && ch !== ' ') Sounds.typeTick();

      if (charIdx >= orig.length) {
        nodeIdx++;
        charIdx = 0;
      }
    }, speed);
  }

  function mascotHide() {
    document.getElementById('mascotBubble').classList.add('hidden');
    clearTimeout(mascotTimer);
  }

  function setupMascot() {
    const body = document.getElementById('mascotBody');
    const pupilL = document.getElementById('mascotPupilL');
    const pupilR = document.getElementById('mascotPupilR');

    body.addEventListener('click', (e) => {
      e.stopPropagation();
      const bubble = document.getElementById('mascotBubble');
      if (!bubble.classList.contains('hidden')) {
        mascotHide();
        return;
      }
      const tip = MASCOT_TIPS[Math.floor(Math.random() * MASCOT_TIPS.length)];
      mascotSay(`<div class="bubble-title">Did you know?</div>${tip}`, 6000);
    });

    // Eyes follow mouse
    const eyeLCenter = { x: 17, y: 16 };
    const eyeRCenter = { x: 35, y: 16 };
    const maxMove = 2.5;

    window.addEventListener('mousemove', (e) => {
      const rect = body.getBoundingClientRect();
      const bodyCX = rect.left + rect.width / 2;
      const bodyCY = rect.top + rect.height / 2;
      const dx = e.clientX - bodyCX;
      const dy = e.clientY - bodyCY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const clamp = Math.min(1, dist / 150);
      const offX = (dx / dist) * maxMove * clamp;
      const offY = (dy / dist) * maxMove * clamp;
      pupilL.setAttribute('cx', eyeLCenter.x + offX);
      pupilL.setAttribute('cy', eyeLCenter.y + offY);
      pupilR.setAttribute('cx', eyeRCenter.x + offX);
      pupilR.setAttribute('cy', eyeRCenter.y + offY);
    });

    // Initial greeting
    setTimeout(() => {
      mascotSay(`<div class="bubble-title">Hey there!</div>These are the first million digits of π!<br>Try searching your name, it's hiding somewhere in here.<br>Check out Famous in π in the top bar.<br>There's also 🍰 cake at the end...<br><i style="opacity:0.6">if you can find it.</i>`, 12000);
    }, 1500);
  }

  // ─── Birthday ───

  function askBirthday() {
    mascotSay(
      `<div class="bubble-title">🎂 When's your birthday?</div>`
      + `Let me find it in π and leave you a cake there!`
      + `<div class="bday-input"><input type="date" id="bdayPicker"><button id="bdayGo">Find it!</button></div>`,
      0
    );
    // Need to defer listener attachment to next tick (DOM not yet updated)
    setTimeout(() => {
      const picker = document.getElementById('bdayPicker');
      const btn = document.getElementById('bdayGo');
      if (!picker || !btn) return;
      btn.addEventListener('click', () => {
        const val = picker.value;
        if (!val) return;
        handleBirthday(val);
      });
      picker.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const val = picker.value;
          if (val) handleBirthday(val);
        }
      });
    }, 50);
  }

  function handleBirthday(dateStr) {
    // dateStr is YYYY-MM-DD from the date picker
    const [y, m, d] = dateStr.split('-');
    const digits = App.getDigits();
    if (!digits) return;

    // Try formats from longest to shortest
    const formats = [
      { str: d + m + y.slice(2), label: `${d}/${m}/${y.slice(2)}` },
      { str: d + m, label: `${d}/${m}` },
    ];

    let found = null;
    for (const fmt of formats) {
      const results = Search.findPattern(digits, fmt.str);
      if (results.length > 0) {
        found = { pos: results[0], str: fmt.str, label: fmt.label };
        break;
      }
    }

    const input = document.getElementById('searchInput');

    if (found) {
      input.value = found.str;
      doSearch();
      Renderer.setBirthdayMarker(found.pos, found.str.length);
      mascotSay(
        `<div class="bubble-title">🎂 Happy birthday!</div>`
        + `Found <b>${found.label}</b> in π!<br>`
        + `I left a cake there for you!`,
        8000
      );
      unlock('birthday');
    } else {
      // Neither format found — still search the shorter one
      const shortStr = d + m;
      input.value = shortStr;
      doSearch();
      mascotSay(
        `<div class="bubble-title">🎂 Rare birthday!</div>`
        + `<b>${d}/${m}/${y.slice(2)}</b> doesn't appear in the first million digits of π.<br>`
        + `Your birthday is rarer than the Feynman Point!`,
        8000
      );
      unlock('birthday');
    }
  }

  // ─── Achievements ───

  const ACHIEVEMENTS = [
    { id: 'cake_lie', icon: '🍰', name: 'The Cake Is a Lie', desc: 'Clicked the cake at the end of π' },
    { id: 'birthday', icon: '🎂', name: 'The Cake Is Alive', desc: 'Found your birthday cake in π' },
    { id: 'name_search', icon: '🧘', name: 'Self Discovery', desc: 'Searched a name in π' },
    { id: 'feynman', icon: '🎯', name: 'Feynman Fan', desc: 'Visited the Feynman Point' },
    { id: 'explorer', icon: '🧭', name: 'Explorer', desc: 'Navigated to 10 different positions' },
    { id: 'encoding', icon: '🔣', name: 'Code Breaker', desc: 'Tried all 3 text encodings' },
    { id: 'expander', icon: '🚀', name: 'Infinity & Beyond', desc: 'Expanded π beyond 1 million digits' },
    { id: 'zoom_master', icon: '🔬', name: 'Zoom Master', desc: 'Zoomed in past 8x magnification' },
    { id: 'thats_deep', icon: '🌊', name: "That's Deep", desc: 'Found something beyond 1 million digits' },
    { id: 'far_out', icon: '🛸', name: 'Far Out, Man', desc: 'Searched beyond a billion digits into π' },
    { id: 'both_sides', icon: '🌗', name: 'Both Sides of π', desc: 'Toggled between light and dark mode' },
    { id: 'multi_part', icon: '🧩', name: 'Scattered Across π', desc: 'Found your word in multiple parts of π' },
    { id: 'shopaholic', icon: '🛍️', name: 'Shopaholic', desc: 'Added something to the cart' },
    { id: 'pi_owner', icon: '👕', name: 'Pi Owner', desc: 'Bought your place in π' },
  ];

  let unlockedSet = new Set(JSON.parse(localStorage.getItem('pimap_achievements') || '[]'));
  let navCount = parseInt(localStorage.getItem('pimap_navcount') || '0');
  let encodingsUsed = new Set(JSON.parse(localStorage.getItem('pimap_encodings') || '[]'));

  function unlock(id) {
    if (unlockedSet.has(id)) return;
    unlockedSet.add(id);
    localStorage.setItem('pimap_achievements', JSON.stringify([...unlockedSet]));
    updateAchievementsCount();

    // Toast notification + sound
    Sounds.achievement();
    const ach = ACHIEVEMENTS.find(a => a.id === id);
    if (!ach) return;
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `<span class="toast-icon">${ach.icon}</span><div><div style="font-size:11px;opacity:0.6;text-transform:uppercase;letter-spacing:1px">Achievement Unlocked!</div>${ach.name}</div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  function trackNavigation() {
    navCount++;
    localStorage.setItem('pimap_navcount', String(navCount));
    if (navCount >= 10) unlock('explorer');
  }

  function trackEncoding(mode) {
    encodingsUsed.add(mode);
    localStorage.setItem('pimap_encodings', JSON.stringify([...encodingsUsed]));
    if (encodingsUsed.size >= 3) unlock('encoding');
  }

  function setupAchievements() {
    const btn = document.getElementById('achievementsBtn');
    const panel = document.getElementById('achievementsPanel');
    const close = document.getElementById('achievementsClose');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.classList.toggle('hidden');
      if (!panel.classList.contains('hidden')) renderAchievements();
    });
    close.addEventListener('click', () => panel.classList.add('hidden'));
    panel.addEventListener('mousedown', (e) => e.stopPropagation());

    document.addEventListener('click', (e) => {
      if (!panel.classList.contains('hidden') && !panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
        panel.classList.add('hidden');
      }
    });

    updateAchievementsCount();
  }

  function updateAchievementsCount() {
    const countEl = document.getElementById('achievementsCount');
    if (countEl) countEl.textContent = `${unlockedSet.size}/${ACHIEVEMENTS.length}`;
  }

  function renderAchievements() {
    const list = document.getElementById('achievementsList');
    let html = '';
    const locked = ACHIEVEMENTS.filter(a => !unlockedSet.has(a.id));
    const unlocked = ACHIEVEMENTS.filter(a => unlockedSet.has(a.id));
    for (const ach of unlocked) {
      html += `<div class="achievement-item unlocked">
        <span class="ach-icon">${ach.icon}</span>
        <div class="ach-info">
          <div class="ach-name">${ach.name}</div>
          <div class="ach-desc">${ach.desc}</div>
        </div>
        <span class="ach-check">✓</span>
      </div>`;
    }
    // Some achievements are shown even when locked (visible hints)
    const VISIBLE_LOCKED = new Set(['multi_part', 'shopaholic', 'pi_owner']);
    if (locked.length > 0) {
      for (const ach of locked) {
        if (VISIBLE_LOCKED.has(ach.id)) {
          html += `<div class="achievement-item locked">
            <span class="ach-icon">${ach.icon}</span>
            <div class="ach-info">
              <div class="ach-name">${ach.name}</div>
              <div class="ach-desc">${ach.desc}</div>
            </div>
          </div>`;
        } else {
          html += `<div class="achievement-item locked">
            <span class="ach-icon">❓</span>
            <div class="ach-info">
              <div class="ach-name">???</div>
              <div class="ach-desc">Keep exploring to unlock</div>
            </div>
          </div>`;
        }
      }
    }
    list.innerHTML = html;
  }

  function setupMuteButton() {
    const btn = document.getElementById('muteBtn');
    const waves = document.getElementById('muteSoundWaves');
    function updateIcon() {
      if (Sounds.isMuted()) {
        btn.classList.add('muted');
        waves.style.display = 'none';
      } else {
        btn.classList.remove('muted');
        waves.style.display = '';
      }
    }
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      Sounds.setMuted(!Sounds.isMuted());
      updateIcon();
    });
    updateIcon();
  }

  function init() {
    setupSearch();
    setupConstants();
    setupPanel();
    setupMappings();
    setupLayouts();
    setupTheme();
    setupCanvasInteraction();
    setupFamousPatterns();
    setupMascot();
    setupAchievements();
    Sounds.init();
    Shop.init();
    setupMuteButton();

    document.getElementById('apiResultClose').addEventListener('click', hideApiBanner);

    setupMobileDrawer();
    updateInfoBar();
  }

  function setupMobileDrawer() {
    const menuBtn = document.getElementById('mobileMenuBtn');
    const drawer = document.getElementById('mobileDrawer');
    if (!menuBtn || !drawer) return;

    const backdrop = drawer.querySelector('.mobile-drawer-backdrop');
    const closeBtn = document.getElementById('mobileDrawerClose');
    const itemsEl = drawer.querySelector('.mobile-drawer-items');

    function openDrawer() { drawer.classList.remove('hidden'); }
    function closeDrawer() { drawer.classList.add('hidden'); }

    menuBtn.addEventListener('click', openDrawer);
    closeBtn.addEventListener('click', closeDrawer);
    backdrop.addEventListener('click', closeDrawer);

    // Populate drawer items
    itemsEl.innerHTML = `
      <button class="mobile-drawer-item" data-action="search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        Search
      </button>
      <button class="mobile-drawer-item" data-action="shop">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
        Shop
      </button>
      <button class="mobile-drawer-item" data-action="famous">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>
        Famous in π
      </button>
      <button class="mobile-drawer-item" data-action="achievements">
        <span style="font-size:20px">🏆</span>
        Achievements
      </button>
      <div class="mobile-drawer-section">Constant</div>
      <button class="mobile-drawer-item" data-action="const-pi">π — Pi</button>
      <button class="mobile-drawer-item" data-action="const-e">e — Euler's number</button>
      <button class="mobile-drawer-item" data-action="const-sqrt2">√2</button>
      <button class="mobile-drawer-item" data-action="const-sqrt3">√3</button>
      <div class="mobile-drawer-section">Settings</div>
      <button class="mobile-drawer-item" data-action="settings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
        Settings
      </button>
      <button class="mobile-drawer-item" data-action="mute">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg>
        Toggle Sound
      </button>
    `;

    // Handle drawer item clicks
    itemsEl.addEventListener('click', (e) => {
      const item = e.target.closest('[data-action]');
      if (!item) return;
      const action = item.dataset.action;
      closeDrawer();

      switch (action) {
        case 'search':
          document.body.classList.add('mobile-search-active');
          setTimeout(() => document.getElementById('searchInput').focus(), 100);
          break;
        case 'shop':
          document.getElementById('shopBtn').click();
          break;
        case 'famous':
          _showMobileFamous();
          break;
        case 'achievements':
          document.getElementById('achievementsBtn').click();
          break;
        case 'const-pi':
        case 'const-e':
        case 'const-sqrt2':
        case 'const-sqrt3':
          const key = action.replace('const-', '');
          App.switchConstant(key);
          document.querySelectorAll('.const-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.constant === key);
          });
          break;
        case 'settings':
          document.getElementById('panelToggle').click();
          break;
        case 'mute':
          document.getElementById('muteBtn').click();
          break;
      }
    });

    // Close mobile search when clicking outside
    document.addEventListener('click', (e) => {
      if (!document.body.classList.contains('mobile-search-active')) return;
      const searchContainer = document.querySelector('.search-container');
      if (searchContainer && !searchContainer.contains(e.target)) {
        document.body.classList.remove('mobile-search-active');
      }
    });

    // Mobile famous overlay
    const famousOverlay = document.getElementById('mobileFamousOverlay');
    const famousClose = document.getElementById('mobileFamousClose');
    if (famousOverlay && famousClose) {
      famousClose.addEventListener('click', () => famousOverlay.classList.add('hidden'));
      famousOverlay.addEventListener('click', (e) => {
        if (e.target === famousOverlay) famousOverlay.classList.add('hidden');
      });
    }
  }

  function _showMobileFamous() {
    const overlay = document.getElementById('mobileFamousOverlay');
    const list = document.getElementById('mobileFamousList');
    if (!overlay || !list) return;

    // Copy the famous patterns content from the desktop panel
    const desktopList = document.getElementById('famousPatterns');
    if (desktopList) {
      list.innerHTML = desktopList.innerHTML;
      // Re-bind click handlers on the cloned items
      list.querySelectorAll('.famous-item').forEach(item => {
        item.addEventListener('click', () => {
          const pattern = item.dataset.pattern;
          const pos = parseInt(item.dataset.pos);
          if (pattern) {
            overlay.classList.add('hidden');
            document.getElementById('searchInput').value = pattern;
            document.getElementById('searchInput').dispatchEvent(new Event('input'));
          }
        });
      });
    }
    overlay.classList.remove('hidden');
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
      const cleaned = input.value.replace(/[^a-zA-Z0-9# ]/g, '');
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
        Renderer.clearBirthdayMarker();
        Minimap.clearSpiralLines();
        nav.classList.add('hidden');
        badge.classList.add('hidden');
        document.getElementById('searchConversion').classList.add('hidden');
        document.getElementById('searchEncoding').classList.add('hidden');
        hideApiBanner();
        mascotHide();
        input.blur();
      }
    });

    document.getElementById('nextMatch').addEventListener('click', goToNext);
    document.getElementById('prevMatch').addEventListener('click', goToPrev);

    // Encoding mode selector
    document.querySelectorAll('input[name="searchEnc"]').forEach(radio => {
      radio.addEventListener('change', () => {
        Search.setTextEncoding(radio.value);
        trackEncoding(radio.value);
        // Re-search with new encoding if there's a text query
        const query = input.value.trim();
        if (query && /[a-zA-Z]/.test(query)) {
          doSearch();
        }
      });
    });
    // Prevent encoding pills from triggering canvas drag
    document.getElementById('searchEncoding').addEventListener('mousedown', (e) => e.stopPropagation());

    // Encoding info buttons
    const encExplain = {
      alpha26: '<div class="bubble-title">Alpha-26</div>Each letter becomes 2 digits.<br><b>A=00, B=01, C=02, ... Z=25</b><br>So "HI" becomes <b>0708</b>.<br>Longer sequences, but every letter is the same width.',
      compact: '<div class="bubble-title">Compact</div>A-J use 1 digit, K-Z use 2.<br><b>A=0, B=1, ... J=9, K=10, ... Z=25</b><br>So "HI" becomes <b>78</b>.<br>Shorter sequences, easier to find in π!',
      t9: '<div class="bubble-title">T9 Keypad</div>Like old phone texting!<br><b>ABC=2, DEF=3, GHI=4, JKL=5, MNO=6, PQRS=7, TUV=8, WXYZ=9</b><br>So "HI" becomes <b>44</b>.<br>Shortest sequences, but different letters map to the same digit.',
    };
    // Non-continuous toggle — re-trigger search on change
    const chunkBox = document.getElementById('chunkSearch');
    if (chunkBox) {
      chunkBox.addEventListener('change', () => {
        const query = input.value.trim();
        if (query && /[a-zA-Z]/.test(query)) {
          doSearch();
        }
      });
    }

    document.querySelectorAll('.enc-info').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const mode = btn.dataset.encInfo;
        if (encExplain[mode]) mascotSay(encExplain[mode], 10000);
      });
    });

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

  function updateSpiralLines(query) {
    if (!query || !/[a-zA-Z]/.test(query)) {
      Minimap.clearSpiralLines();
      return;
    }
    const digits = App.getDigits();
    if (!digits) return;

    const modes = ['t9', 'compact', 'alpha26'];
    const modeLabels = { alpha26: 'Alpha-26', compact: 'Compact', t9: 'T9' };
    const lines = [];

    for (const mode of modes) {
      const conv = Search.convertWithMode(query, mode);
      if (!conv.digitQuery) continue;
      const hits = Search.findPattern(digits, conv.digitQuery);
      if (hits.length > 0) {
        lines.push({
          idx: hits[0],
          color: ENC_COLORS[mode],
          label: modeLabels[mode],
        });
      }
    }

    Minimap.setSpiralLines(lines.length > 0 ? lines : null);
  }

  function doSearch() {
    const input = document.getElementById('searchInput');
    const nav = document.getElementById('searchNav');
    const badge = document.getElementById('searchResults');
    const matchIdx = document.getElementById('matchIndex');
    const convEl = document.getElementById('searchConversion');
    const encEl = document.getElementById('searchEncoding');
    const displayWord = input.value.trim();
    const query = displayWord.replace(/\s+/g, '');

    hideApiBanner();
    Renderer.clearChunkConnectors();
    Minimap.clearChunkLines();

    if (!query) {
      Search.clear();
      Renderer.setSearchHighlights(null, 0);
      Renderer.clearChunkConnectors();
      Minimap.clearMarkers();
      Minimap.clearChunkLines();
      nav.classList.add('hidden');
      badge.classList.add('hidden');
      convEl.classList.add('hidden');
      encEl.classList.add('hidden');
      mascotHide();
      return;
    }

    // Go-to-digit: #N navigates to the Nth digit
    const goToMatch = query.match(/^#(\d+)$/);
    if (goToMatch) {
      const idx = parseInt(goToMatch[1], 10);
      const digits = App.getDigits();
      const effLen = Renderer.getEffectiveLength();
      if (digits && idx >= 0 && idx < effLen) {
        Search.clear();
        Renderer.setSearchHighlights([idx], 1);
        Minimap.clearMarkers();
        Minimap.setAllMarkerLayers([{ mode: 'digits', results: [idx] }]);
        Minimap.setSearchMarkers([idx], 1, 'digits');
        Minimap.setCurrentMatch(0);
        nav.classList.add('hidden');
        badge.classList.add('hidden');
        encEl.classList.add('hidden');
        convEl.classList.add('hidden');
        mascotSay(`<div class="bubble-title">Go to digit</div>Digit <b>#${idx.toLocaleString()}</b> = <b style="color:var(--accent)">${digits[idx]}</b>`, 5000);
        navigateToMatch(idx, 1);
      } else if (idx >= effLen) {
        nav.classList.add('hidden');
        badge.classList.add('hidden');
        encEl.classList.add('hidden');
        convEl.classList.add('hidden');
        mascotSay(`<div class="bubble-title">Go to digit</div>Digit <b>#${idx.toLocaleString()}</b> is beyond my loaded digits (${_compactNum(effLen)}). Try expanding!`, 6000);
      }
      return;
    }

    const digits = App.getDigits();
    if (!digits) return;

    // Show encoding selector when query has letters
    const hasLetters = /[a-zA-Z]/.test(query);
    if (hasLetters) {
      encEl.classList.remove('hidden');
      if (/^[a-zA-Z]{2,}$/.test(query)) unlock('name_search');
    } else {
      encEl.classList.add('hidden');
    }

    const { results, converted } = Search.find(digits, query);
    const digitPatternLen = converted.digitQuery.length;

    Renderer.setSearchHighlights(results, digitPatternLen);

    // Show conversion info for text searches in its own banner
    if (converted.mode !== 'digits') {
      trackEncoding(converted.mode);
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
      const pos = results[0];
      const count = results.length;
      const makeBtn = `<br><button class="mascot-action-btn" id="makeItMineLocal">Wear it</button>`;
      if (converted.mode === 'digits') {
        mascotSay(`<div class="bubble-title">Got it!</div>"<b>${converted.digitQuery}</b>" shows up <b>${count.toLocaleString()}</b> time${count > 1 ? 's' : ''}! First one is ${_posWords(pos)}. ${_posReaction(pos)}${makeBtn}`, 0);
      } else {
        const encLabel = converted.mode === 't9' ? 'T9' : converted.mode === 'compact' ? 'Compact' : 'Alpha-26';
        mascotSay(`<div class="bubble-title">Found it!</div>"<b>${query}</b>" as ${encLabel} (<b>${converted.digitQuery}</b>) appears <b>${count.toLocaleString()}</b> time${count > 1 ? 's' : ''}! First at ${_posWords(pos)}. ${_posReaction(pos)}${makeBtn}`, 0);
      }
      setTimeout(() => {
        const mineBtn = document.getElementById('makeItMineLocal');
        if (mineBtn) {
          mineBtn.addEventListener('click', () => {
            Shop.captureDesign(displayWord, null, pos);
          });
        }
      }, 50);
    } else {
      badge.classList.add('hidden');
      nav.classList.add('hidden');
      if (!hasLetters) Minimap.clearMarkers();

      // No local results — for text queries, check multi-part first, then API
      const chunkEnabled = document.getElementById('chunkSearch')?.checked;
      if (hasLetters && chunkEnabled) {
        // Multi-part: chunk the current encoding locally
        const digits = App.getDigits();
        if (digits) {
          const chunks = Search.findChunked(digits, converted.digitQuery);
          if (chunks.length > 1) {
            showChunkedResults(query, converted, chunks, displayWord);
            return;
          }
        }
      }
      if (hasLetters && currentConstant === 'pi') {
        searchAllEncodings(query, displayWord);
      } else if (currentConstant === 'pi' && converted.digitQuery.length >= 4) {
        searchPiApi(query, converted);
      } else {
        let notFoundMsg = `"<b>${converted.digitQuery}</b>" isn't in the first million digits!`;
        if (converted.mode !== 'digits') {
          const altEnc = converted.mode === 't9' ? 'Compact' : 'T9';
          notFoundMsg += `<br><i style="opacity:0.7">Try <b>${altEnc}</b> encoding for a shorter sequence!</i>`;
        }
        mascotSay(`<div class="bubble-title">Nope!</div>${notFoundMsg}`, 6000);
      }
    }

    // Update spiral lines if enabled
    if (spiralLinesEnabled && hasLetters) {
      updateSpiralLines(query);
    } else if (!hasLetters) {
      Minimap.clearSpiralLines();
    }
  }

  let chunkedPositions = []; // stored for chunk navigation
  let currentChunkIdx = 0;

  function showChunkedResults(query, converted, chunks, origWord) {
    chunkedPositions = chunks;
    currentChunkIdx = 0;

    // Highlight all chunk positions
    const allPositions = [];
    const allLengths = [];
    for (const c of chunks) {
      allPositions.push(c.pos);
      allLengths.push(c.digitStr.length);
    }
    // Highlight using the first chunk's positions combined
    const highlightSet = [];
    for (const c of chunks) {
      for (let i = 0; i < c.digitStr.length; i++) {
        highlightSet.push(c.pos + i);
      }
    }
    // Use the longest chunk length for highlight display
    Renderer.setSearchHighlights(allPositions, chunks[0].digitStr.length);
    Minimap.setAllMarkerLayers([{ mode: converted.mode, results: allPositions }]);

    // Set chunk connector lines on main canvas and minimap
    Renderer.setChunkConnectors(chunks);
    Minimap.clearSpiralLines();
    Minimap.setChunkLines(chunks);

    // Zoom out to fit ALL chunks on screen
    navigateToFitChunks(chunks);

    // Build mascot message showing the breakdown
    const word = query.replace(/[^a-zA-Z]/g, '').toUpperCase();
    let chunkHtml = '';
    // Map digit offsets back to letters
    const letterMap = _mapLettersToDigits(word, converted);

    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const letters = _getLettersForChunk(letterMap, c.offset, c.offset + c.digitStr.length);
      const letterLabel = letters ? ` <span style="opacity:0.6">(${letters})</span>` : '';
      chunkHtml += `<div style="margin:2px 0;cursor:pointer" data-chunk="${i}">`
        + `<span style="color:var(--accent);font-weight:700">${c.digitStr}</span>${letterLabel}`
        + ` → digit <b>#${c.pos.toLocaleString()}</b></div>`;
    }

    unlock('multi_part');

    const badge = document.getElementById('searchResults');
    const nav = document.getElementById('searchNav');
    const matchIdx = document.getElementById('matchIndex');
    badge.textContent = `${chunks.length} parts`;
    badge.classList.remove('hidden');
    nav.classList.remove('hidden');
    matchIdx.textContent = `1/${chunks.length}`;

    mascotSay(
      `<div class="bubble-title">Found in ${chunks.length} parts!</div>`
      + `"<b>${word}</b>" is too long to find in one go, but I found it in parts:<br>`
      + chunkHtml
      + `<br><button class="mascot-action-btn" id="makeItMineBtn">Wear it</button>`,
      0
    );

    // Make chunk lines and "Wear it" clickable
    setTimeout(() => {
      const bubble = document.getElementById('mascotBubble');
      bubble.querySelectorAll('[data-chunk]').forEach(el => {
        el.addEventListener('click', (e) => {
          const idx = parseInt(el.dataset.chunk);
          currentChunkIdx = idx;
          navigateToMatch(chunks[idx].pos, chunks[idx].digitStr.length);
          matchIdx.textContent = `${idx + 1}/${chunks.length}`;
        });
      });
      const mineBtn = document.getElementById('makeItMineBtn');
      if (mineBtn) {
        mineBtn.addEventListener('click', () => {
          Shop.captureDesign(origWord || word, chunks, -1);
        });
      }
    }, 50);

    // Override next/prev for chunk navigation
    const nextBtn = document.getElementById('nextMatch');
    const prevBtn = document.getElementById('prevMatch');
    const nextHandler = () => {
      currentChunkIdx = (currentChunkIdx + 1) % chunks.length;
      navigateToMatch(chunks[currentChunkIdx].pos, chunks[currentChunkIdx].digitStr.length);
      matchIdx.textContent = `${currentChunkIdx + 1}/${chunks.length}`;
    };
    const prevHandler = () => {
      currentChunkIdx = (currentChunkIdx - 1 + chunks.length) % chunks.length;
      navigateToMatch(chunks[currentChunkIdx].pos, chunks[currentChunkIdx].digitStr.length);
      matchIdx.textContent = `${currentChunkIdx + 1}/${chunks.length}`;
    };
    // Replace handlers temporarily by cloning
    const newNext = nextBtn.cloneNode(true);
    const newPrev = prevBtn.cloneNode(true);
    nextBtn.parentNode.replaceChild(newNext, nextBtn);
    prevBtn.parentNode.replaceChild(newPrev, prevBtn);
    newNext.addEventListener('click', nextHandler);
    newPrev.addEventListener('click', prevHandler);
  }

  // Map each letter to its digit offset range in the encoded string
  function _mapLettersToDigits(word, converted) {
    const map = []; // [{letter, start, end}]
    let offset = 0;
    for (const ch of word) {
      let encoded;
      if (converted.mode === 't9') encoded = Mappings.letterToT9(ch);
      else if (converted.mode === 'compact') encoded = Mappings.letterToCompact(ch);
      else encoded = Mappings.letterToPair(ch);
      if (encoded) {
        map.push({ letter: ch, start: offset, end: offset + encoded.length });
        offset += encoded.length;
      }
    }
    return map;
  }

  // Get the letters that correspond to a digit range
  function _getLettersForChunk(letterMap, digitStart, digitEnd) {
    const letters = [];
    for (const m of letterMap) {
      if (m.start >= digitStart && m.end <= digitEnd) {
        letters.push(m.letter);
      } else if (m.start < digitEnd && m.end > digitStart) {
        letters.push(m.letter.toLowerCase()); // partial overlap
      }
    }
    return letters.length > 0 ? letters.join('') : '';
  }

  async function searchAllEncodings(query, origDisplayWord) {
    const word = query.replace(/[^a-zA-Z]/g, '').toUpperCase();
    const _displayWord = origDisplayWord || word;
    const modes = ['t9', 'compact', 'alpha26']; // shortest digit strings first
    const banner = document.getElementById('apiResultBanner');
    const icon = document.getElementById('apiResultIcon');
    const title = document.getElementById('apiResultTitle');
    const detail = document.getElementById('apiResultDetail');
    const ctxPanel = document.getElementById('apiContextPanel');
    const modeLabels = { alpha26: 'Alpha-26', compact: 'Compact', t9: 'T9' };

    banner.classList.remove('hidden');
    banner.classList.add('loading');
    ctxPanel.classList.add('hidden');
    icon.textContent = '';
    title.textContent = `Searching all encodings for "${word}" in π...`;
    detail.textContent = 'Trying T9, Compact, and Alpha-26...';
    mascotSay(`<div class="bubble-title">Hang on...</div>Searching for "<b>${word}</b>" across all encodings...`, 0);

    const found = [];
    const notFound = []; // encodings beyond the API corpus
    let apiTotalDigits = 1e12;

    for (const mode of modes) {
      const conv = Search.convertWithMode(query, mode);
      if (!conv.digitQuery || conv.digitQuery.length < 1) continue;

      try {
        const result = await PiApi.search(conv.digitQuery, false);
        apiTotalDigits = result.totalDigits || apiTotalDigits;
        if (result.found && result.results.length > 0) {
          const pos = result.results[0].position;
          found.push({
            mode,
            label: modeLabels[mode],
            digitStr: conv.digitQuery,
            pos,
            before: result.results[0].before || '',
            after: result.results[0].after || '',
            totalDigits: result.totalDigits,
            elapsed: result.elapsed,
          });
        } else {
          notFound.push({
            mode,
            label: modeLabels[mode],
            digitStr: conv.digitQuery,
            totalDigits: result.totalDigits,
          });
        }
      } catch (e) {
        if (e.name === 'AbortError') { banner.classList.add('hidden'); return; }
      }
    }

    banner.classList.remove('loading');

    if (found.length > 0 || notFound.length > 0) {
      // Sort found by position (earliest first)
      found.sort((a, b) => a.pos - b.pos);
      const best = found.length > 0 ? found[0] : null;

      if (best) {
        icon.textContent = '\u{1F3AF}';
        title.innerHTML = `Found "<b>${word}</b>" in π`
          + `<span class="api-position">digit #${best.pos.toLocaleString()}</span>`;
      } else {
        icon.textContent = '\u{1F50D}';
        title.innerHTML = `"<b>${word}</b>" is beyond ${_compactNum(apiTotalDigits)} digits in all encodings`;
      }

      // Show all encoding results (found + not found) with matching colors
      let detailHtml = '';
      for (const f of found) {
        const color = ENC_COLORS[f.mode] || '#ccc';
        const isBest = f === best;
        detailHtml += `<div style="margin:2px 0;${isBest ? 'font-weight:700' : 'opacity:0.7'}">`
          + `<span style="color:${color}">&#9679;</span> ${f.label}: ${_posWords(f.pos)}`
          + ` <span style="opacity:0.5">(digit #${f.pos.toLocaleString()})</span>`
          + `${isBest ? ' ✓' : ''}</div>`;
      }
      for (const nf of notFound) {
        const color = ENC_COLORS[nf.mode] || '#ccc';
        detailHtml += `<div style="margin:2px 0;opacity:0.5">`
          + `<span style="color:${color}">&#9679;</span> ${nf.label}: beyond ${_compactNum(nf.totalDigits)} digits</div>`;
      }
      detail.innerHTML = detailHtml;

      // Mascot announces — human-friendly
      const bestReaction = best ? _posReaction(best.pos) : '';
      let mascotHtml = `<div class="bubble-title">${best ? `Found "${word}"!` : `"${word}" is way out there!`}</div>`;
      if (best) mascotHtml += `${bestReaction}<br><br>`;
      for (const f of found) {
        mascotHtml += `<span style="color:${ENC_COLORS[f.mode]}"><b>${f.label}</b></span>: ${_posWords(f.pos)}<br>`;
      }
      for (const nf of notFound) {
        mascotHtml += `<span style="color:${ENC_COLORS[nf.mode]}"><b>${nf.label}</b></span>: <i>beyond ${_compactNum(nf.totalDigits)} digits!</i><br>`;
      }
      // Achievements
      if (notFound.length > 0) unlock('far_out');
      if (best && best.pos > 1e9) unlock('far_out');
      if (best && best.pos > 1e6) unlock('thats_deep');
      if (notFound.length > 0 && found.length === 0) {
        // Everything is beyond the corpus
      }

      // Offer multi-part as a clickable option
      const digits = App.getDigits();
      let _apiChunks = null;
      if (digits) {
        const converted = Search.convertQuery(query);
        _apiChunks = Search.findChunked(digits, converted.digitQuery);
        if (_apiChunks.length > 1) {
          mascotHtml += `<br><br>I can also find it in <b>${_apiChunks.length} parts</b> locally!`
            + `<br><button class="mascot-action-btn" id="tryMultiPart">Try Multi-Part</button>`;
        }
      }

      // "Wear it" for single result
      if (best) {
        mascotHtml += `<br><button class="mascot-action-btn" id="makeItMineApi" style="margin-left:4px">Wear it</button>`;
      }

      mascotSay(mascotHtml, 0);
      showApiContextPanelMulti(found, notFound, word);
      if (best) Minimap.setApiMarker(best.pos, word);

      // Wire up buttons
      const _bestPos = best ? best.pos : -1;
      const _word = word;
      setTimeout(() => {
        const mineBtn = document.getElementById('makeItMineApi');
        if (mineBtn) {
          mineBtn.addEventListener('click', () => {
            Shop.captureDesign(_displayWord, null, _bestPos);
          });
        }
        const btn = document.getElementById('tryMultiPart');
        if (btn) {
          btn.addEventListener('click', () => {
            const chunkBox = document.getElementById('chunkSearch');
            if (chunkBox) chunkBox.checked = true;
            const converted = Search.convertQuery(query);
            const digs = App.getDigits();
            if (digs) {
              const chunks = Search.findChunked(digs, converted.digitQuery);
              if (chunks.length > 1) showChunkedResults(query, converted, chunks, _displayWord);
            }
          });
        }
      }, 50);
    } else {
      // Nothing found in any encoding — offer multi-part
      icon.textContent = '\u{1F50D}';
      title.textContent = `"${word}" not found in any encoding`;
      detail.textContent = 'Tried T9, Compact, and Alpha-26 across all available digits.';
      let msg = `"<b>${word}</b>" is playing hard to get! Couldn't find it in any encoding.`;

      const digits = App.getDigits();
      if (digits) {
        const converted = Search.convertQuery(query);
        const chunks = Search.findChunked(digits, converted.digitQuery);
        if (chunks.length > 1) {
          msg += `<br><br>But I can find it in <b>${chunks.length} parts</b>!`
            + `<br><button class="mascot-action-btn" id="tryMultiPart2">Try Multi-Part</button>`;
        }
      }

      mascotSay(`<div class="bubble-title">Hmm...</div>${msg}`, 0);

      setTimeout(() => {
        const btn = document.getElementById('tryMultiPart2');
        if (btn) {
          btn.addEventListener('click', () => {
            const chunkBox = document.getElementById('chunkSearch');
            if (chunkBox) chunkBox.checked = true;
            const converted = Search.convertQuery(query);
            const digs = App.getDigits();
            if (digs) {
              const chunks = Search.findChunked(digs, converted.digitQuery);
              if (chunks.length > 1) {
                banner.classList.add('hidden');
                showChunkedResults(query, converted, chunks, _displayWord);
              }
            }
          });
        }
      }, 50);
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
    mascotSay(`<div class="bubble-title">Hang on...</div>Digging deeper for "<b>${word || digitStr}</b>"...`, 0);

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
        mascotSay(`<div class="bubble-title">Found it!</div>"<b>${label}</b>" is ${_posWords(pos)}! ${_posReaction(pos)}`, 8000);
        if (pos > 1e9) unlock('far_out');
        if (pos > 1e6) unlock('thats_deep');

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
        let apiNotFoundMsg = `"<b>${word || digitStr}</b>" is hiding beyond ${totalFormatted} digits! That's seriously far out.`;
        if (word) {
          const curEnc = converted.mode;
          const altEnc = curEnc === 't9' ? 'Compact' : curEnc === 'compact' ? 'T9' : 'Compact or T9';
          apiNotFoundMsg += `<br><i style="opacity:0.7">Try <b>${altEnc}</b> encoding for a shorter sequence!</i>`;
        }
        mascotSay(`<div class="bubble-title">Whoa!</div>${apiNotFoundMsg}`, 8000);
        const total = result.totalDigits || 0;
        if (total > 1e9) unlock('far_out');
        if (total > 1e6) unlock('thats_deep');
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
      mascotSay(`<div class="bubble-title">Oops! ⚠️</div>The search server isn't running. Start it with <b>node server.js</b>`, 8000);
    }
  }

  async function showApiContextPanel(globalPos, matchLen, digitStr, label, totalDigits) {
    const ctxPanel = document.getElementById('apiContextPanel');
    const strip = document.getElementById('apiContextStrip');
    const localEl = document.getElementById('scaleLocal');
    const pinEl = document.getElementById('scalePin');
    const totalLabel = document.getElementById('scaleTotalLabel');

    // Clean up multi-pins, restore single pin
    const track = pinEl.parentElement;
    track.querySelectorAll('.scale-pin-multi').forEach(el => el.remove());
    pinEl.style.display = '';

    const localDigits = App.getDigits() ? App.getDigits().length : 1e6;

    // Scale bar
    const localFrac = _logScale(localDigits, totalDigits) * 100;
    const matchFrac = _logScale(globalPos, totalDigits) * 100;
    localEl.style.width = Math.max(0.5, localFrac) + '%';
    pinEl.style.left = matchFrac + '%';
    totalLabel.textContent = _compactNum(totalDigits);

    // Render tick marks
    _renderScaleTicks(totalDigits);

    // Fetch context digits
    _fetchContextStrip(globalPos, matchLen, strip, ctxPanel);
  }

  function showApiContextPanelMulti(found, notFound, word) {
    const ctxPanel = document.getElementById('apiContextPanel');
    const localEl = document.getElementById('scaleLocal');
    const pinEl = document.getElementById('scalePin');
    const totalLabel = document.getElementById('scaleTotalLabel');
    const strip = document.getElementById('apiContextStrip');

    const totalDigits = (found.length > 0 ? found[0].totalDigits : notFound[0]?.totalDigits) || 1e12;
    const localDigits = App.getDigits() ? App.getDigits().length : 1e6;

    // Scale bar — local range
    const localFrac = _logScale(localDigits, totalDigits) * 100;
    localEl.style.width = Math.max(0.5, localFrac) + '%';
    totalLabel.textContent = _compactNum(totalDigits);

    // Hide the default single pin
    pinEl.style.display = 'none';

    // Remove any previous multi-pins
    const track = pinEl.parentElement;
    track.querySelectorAll('.scale-pin-multi').forEach(el => el.remove());

    // Add a pin for each found encoding result
    for (const f of found) {
      const pct = _logScale(f.pos, totalDigits) * 100;
      const color = ENC_COLORS[f.mode] || '#ff6b9d';
      _addScalePin(track, pct, color, f.label, _compactNum(f.pos));
    }

    // Add pins for not-found encodings — pinned at the far right edge
    for (const nf of notFound) {
      const color = ENC_COLORS[nf.mode] || '#e84393';
      _addScalePin(track, 97, color, nf.label, '>' + _compactNum(nf.totalDigits));
    }

    // Render tick marks + log scale indicator
    _renderScaleTicks(totalDigits);
    // Add log scale label if not already present
    if (!track.querySelector('.log-scale-label')) {
      const logLabel = document.createElement('div');
      logLabel.className = 'log-scale-label';
      logLabel.style.cssText = `position:absolute;top:50%;right:4px;transform:translateY(-50%);`
        + `font-size:8px;letter-spacing:0.5px;opacity:0.35;font-family:var(--font-mono);color:var(--text);text-transform:uppercase;`;
      logLabel.textContent = 'log scale';
      track.appendChild(logLabel);
    }

    // Show context strips for all found encodings
    if (found.length > 0) {
      strip.innerHTML = '';
      ctxPanel.classList.remove('hidden');
      for (const f of found) {
        _appendContextStrip(f.pos, f.digitStr.length, f.label, ENC_COLORS[f.mode], strip);
      }
    } else {
      strip.innerHTML = '<span class="ctx-ellipsis" style="opacity:0.5">All encodings are beyond the searchable corpus</span>';
      ctxPanel.classList.remove('hidden');
    }
  }

  function _addScalePin(track, pct, color, label, posLabel) {
    const pin = document.createElement('div');
    pin.className = 'scale-pin-multi';
    pin.style.cssText = `position:absolute;top:-4px;left:${pct}%;width:3px;height:26px;`
      + `background:${color};border-radius:2px;box-shadow:0 0 8px ${color}80;z-index:2;`;
    const dot = document.createElement('div');
    dot.style.cssText = `position:absolute;top:-4px;left:50%;transform:translateX(-50%);`
      + `width:10px;height:10px;background:${color};border-radius:50%;box-shadow:0 0 6px ${color}80;`;
    pin.appendChild(dot);
    // Position number above the pin
    if (posLabel) {
      const posEl = document.createElement('div');
      posEl.style.cssText = `position:absolute;top:-22px;left:50%;transform:translateX(-50%);`
        + `font-size:10px;font-weight:700;white-space:nowrap;color:${color};font-family:var(--font-mono);`;
      posEl.textContent = posLabel;
      pin.appendChild(posEl);
    }
    // Encoding name below the pin
    const lbl = document.createElement('div');
    lbl.className = 'scale-pin-label';
    lbl.style.cssText = `position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);`
      + `font-size:9px;font-weight:700;white-space:nowrap;color:${color};font-family:var(--font-mono);`;
    lbl.textContent = label;
    pin.appendChild(lbl);
    track.appendChild(pin);
  }

  async function _fetchContextStrip(globalPos, matchLen, strip, ctxPanel) {
    try {
      const resp = await fetch(`/api/picontext?pos=${globalPos}&radius=15`);
      if (!resp.ok) { ctxPanel.classList.add('hidden'); return; }
      const data = await resp.json();
      strip.innerHTML = _buildContextHtml(data, matchLen);
      ctxPanel.classList.remove('hidden');
    } catch (e) {
      ctxPanel.classList.add('hidden');
    }
  }

  async function _appendContextStrip(globalPos, matchLen, label, color, container) {
    try {
      const resp = await fetch(`/api/picontext?pos=${globalPos}&radius=15`);
      if (!resp.ok) return;
      const data = await resp.json();

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin:4px 0;';
      const tag = document.createElement('span');
      tag.style.cssText = `color:${color};font-size:11px;font-weight:700;font-family:var(--font-mono);min-width:60px;text-align:right;`;
      tag.textContent = label;
      const digits = document.createElement('span');
      digits.className = 'api-context-strip';
      digits.style.cssText = 'flex:1;margin:0;padding:4px 0;';
      digits.innerHTML = _buildContextHtml(data, matchLen, color);
      row.appendChild(tag);
      row.appendChild(digits);
      container.appendChild(row);
    } catch (e) { /* skip */ }
  }

  function _buildContextHtml(data, matchLen, highlightColor) {
    const allDigits = data.digits;
    const mOff = data.matchOffset;
    const before = Math.min(10, mOff);
    const after = Math.min(10, allDigits.length - mOff - matchLen);
    const start = mOff - before;
    const contextDigits = allDigits.substring(start, mOff + matchLen + after);
    const matchStart = before;
    const colors = Renderer.getDigitColors ? Renderer.getDigitColors() : null;
    const matchColor = highlightColor || 'var(--accent)';

    let html = '<span class="ctx-ellipsis">...</span>';
    for (let i = 0; i < contextDigits.length; i++) {
      const d = contextDigits[i];
      const isMatch = i >= matchStart && i < matchStart + matchLen;
      const color = colors ? colors[Number(d)] : 'var(--text)';
      if (isMatch) {
        html += `<span class="ctx-digit match" style="color:${matchColor};text-shadow:0 0 6px ${matchColor}80">${d}</span>`;
      } else {
        html += `<span class="ctx-digit">${d}</span>`;
      }
    }
    html += '<span class="ctx-ellipsis">...</span>';
    return html;
  }

  function hideApiBanner() {
    // Clean up multi-pins
    const track = document.querySelector('.scale-track');
    if (track) track.querySelectorAll('.scale-pin-multi').forEach(el => el.remove());
    const pinEl = document.getElementById('scalePin');
    if (pinEl) pinEl.style.display = '';
    const banner = document.getElementById('apiResultBanner');
    banner.classList.add('hidden');
    banner.classList.remove('loading');
    document.getElementById('apiContextPanel').classList.add('hidden');
    Minimap.setApiMarker(null);
    PiApi.cancel();
  }

  function _logScale(value, total) {
    if (value <= 0) return 0;
    return Math.log(1 + value) / Math.log(1 + total);
  }

  // Human-friendly position description
  function _posWords(pos) {
    if (pos < 1000) return `only ${pos} digits in`;
    if (pos < 1e4) return `about ${(pos / 1000).toFixed(1)}K digits deep`;
    if (pos < 1e6) return `${Math.round(pos / 1000).toLocaleString()}K digits deep`;
    if (pos < 1e7) return `${(pos / 1e6).toFixed(1)} million digits deep`;
    if (pos < 1e9) return `${Math.round(pos / 1e6).toLocaleString()} million digits deep`;
    return `${(pos / 1e9).toFixed(1)} billion digits deep`;
  }

  function _posReaction(pos) {
    if (pos < 1000) return 'Right here in the neighborhood!';
    if (pos < 1e4) return 'Not too far!';
    if (pos < 1e5) return 'A bit of a journey!';
    if (pos < 1e6) return 'That took some digging!';
    if (pos < 1e7) return 'Woah, way out there!';
    if (pos < 1e8) return 'Buried deep in the digits!';
    if (pos < 1e9) return 'That\'s incredibly far in!';
    return 'Mind-blowingly deep!!';
  }

  function _compactNum(n) {
    if (n >= 1e12) { const v = n / 1e12; return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + 'T'; }
    if (n >= 1e9)  { const v = n / 1e9;  return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + 'B'; }
    if (n >= 1e6)  { const v = n / 1e6;  return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + 'M'; }
    if (n >= 1e3)  { const v = n / 1e3;  return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + 'K'; }
    return String(n);
  }

  // Render log-scale tick marks into the scale track
  function _renderScaleTicks(totalDigits) {
    const ticksEl = document.getElementById('scaleTicks');
    if (!ticksEl) return;

    // Generate tick values: 1K, 10K, 100K, 1M, 2M, 4M, 10M, 20M, 50M, 100M, 200M, 500M, 1B, 2B, 5B, 10B...
    const ticks = [];
    const bases = [1, 2, 5];
    for (let exp = 3; exp <= 15; exp++) {
      const mag = Math.pow(10, exp);
      for (const b of bases) {
        const v = b * mag;
        if (v >= totalDigits) break;
        // Skip ticks too close to 0 or to the end
        const frac = _logScale(v, totalDigits);
        if (frac > 0.03 && frac < 0.97) {
          ticks.push(v);
        }
      }
    }

    // Filter out ticks that would overlap (need at least 8% gap)
    const filtered = [];
    let lastFrac = -1;
    for (const v of ticks) {
      const frac = _logScale(v, totalDigits);
      if (lastFrac < 0 || frac - lastFrac > 0.08) {
        filtered.push(v);
        lastFrac = frac;
      }
    }

    let html = '';
    for (const v of filtered) {
      const pct = _logScale(v, totalDigits) * 100;
      html += `<div class="scale-tick" style="left:${pct}%"><span class="scale-tick-label">${_compactNum(v)}</span></div>`;
    }
    ticksEl.innerHTML = html;
  }

  function showFamousPositionBanner(name, pattern, pos) {
    const banner = document.getElementById('apiResultBanner');
    const icon = document.getElementById('apiResultIcon');
    const title = document.getElementById('apiResultTitle');
    const detail = document.getElementById('apiResultDetail');
    const ctxPanel = document.getElementById('apiContextPanel');
    const localEl = document.getElementById('scaleLocal');
    const pinEl = document.getElementById('scalePin');
    const totalLabel = document.getElementById('scaleTotalLabel');
    const strip = document.getElementById('apiContextStrip');

    const totalDigits = 1e12; // known extent of computed pi
    const localDigits = App.getDigits() ? App.getDigits().length : 1e6;

    // Clean up multi-pins from encoding search
    const track = pinEl.parentElement;
    track.querySelectorAll('.scale-pin-multi').forEach(el => el.remove());
    pinEl.style.display = '';

    banner.classList.remove('hidden', 'loading');
    icon.textContent = '\u{1F4CD}';
    title.innerHTML = `<b>${name}</b> — "${pattern}" appears at`
      + `<span class="api-position">digit #${pos.toLocaleString()}</span>`;
    detail.textContent = `This position is far beyond your loaded ${_compactNum(localDigits)} digits.`;
    mascotSay(`<div class="bubble-title">${name}</div>"${pattern}" is at digit <b>#${pos.toLocaleString()}</b> — way beyond your loaded ${_compactNum(localDigits)} digits! Check the scale bar below.`, 8000);
    if (pos > 1e9) unlock('far_out');
    if (pos > 1e6) unlock('thats_deep');

    // Scale bar
    const localFrac = _logScale(localDigits, totalDigits) * 100;
    const matchFrac = _logScale(pos, totalDigits) * 100;
    localEl.style.width = Math.max(0.5, localFrac) + '%';
    pinEl.style.left = matchFrac + '%';
    totalLabel.textContent = _compactNum(totalDigits);

    // Render tick marks
    _renderScaleTicks(totalDigits);

    // No context strip for static display
    strip.innerHTML = '';
    ctxPanel.classList.remove('hidden');

    Minimap.setApiMarker(pos, name);
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

  function navigateToFitChunks(chunks) {
    const cw = Layout.getCellW();
    const ch = Layout.getCellH();

    // Compute bounding box of all chunk positions in world coords
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    // Include spiral center (0,0) in bbox for polygon visualization
    if (Layout.getType() === 'spiral') {
      minX = Math.min(minX, 0);
      minY = Math.min(minY, 0);
      maxX = Math.max(maxX, 0);
      maxY = Math.max(maxY, 0);
    }

    for (const c of chunks) {
      for (let d = 0; d <= c.digitStr.length; d++) {
        const pos = Layout.getPosition(c.pos + d);
        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y);
        maxX = Math.max(maxX, pos.x + cw);
        maxY = Math.max(maxY, pos.y + ch);
      }
    }

    // Add padding
    const padW = cw * 8;
    const padH = ch * 8;
    minX -= padW;
    minY -= padH;
    maxX += padW;
    maxY += padH;

    const bboxW = maxX - minX;
    const bboxH = maxY - minY;

    // Calculate zoom to fit bbox on screen
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const zoomX = screenW / bboxW;
    const zoomY = screenH / bboxH;
    const targetZoom = Math.min(zoomX, zoomY, 4); // cap at 4x

    // Center camera on bbox center
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const tx = cx - screenW / 2 / targetZoom;
    const ty = cy - screenH / 2 / targetZoom;

    Camera.animateTo(tx, ty, targetZoom, 800);
    trackNavigation();
  }

  function navigateToMatch(rawDigitIndex, patternLength) {
    const cw = Layout.getCellW();
    const ch = Layout.getCellH();
    const layoutType = Layout.getType();

    // Center on the middle of the matched pattern
    const midIdx = rawDigitIndex + Math.floor(patternLength / 2);
    const midPos = Layout.getPosition(midIdx);

    if (layoutType === 'wave') {
      // For wave, just center horizontally on the middle digit
      const targetZoom = 1;
      const tx = midPos.x - (window.innerWidth / 2) / targetZoom;
      const ty = midPos.y - (window.innerHeight / 2) / targetZoom;
      Camera.animateTo(tx, ty, targetZoom, 800);
    } else {
      const targetZoom = 4;
      const tx = midPos.x - (window.innerWidth / 2) / targetZoom;
      const ty = midPos.y - (window.innerHeight / 2) / targetZoom;
      Camera.animateTo(tx, ty, targetZoom, 800);
    }
    trackNavigation();
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
          Camera.setZoom(2.5);
          Camera.centerOn(0, 0);
        } else if (radio.value === 'wave') {
          Camera.setZoom(1);
          Camera.centerOn(0, 0);
        } else {
          Camera.setZoom(1);
          Camera.setPosition(0, 10);
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
        unlock('both_sides');
      });
    });
  }

  function setupCanvasInteraction() {
    const canvas = document.getElementById('digitCanvas');
    let dragging = false;
    let lastX = 0, lastY = 0;
    let mouseDownX = 0, mouseDownY = 0;

    canvas.addEventListener('mousedown', (e) => {
      // Only start drag if not clicking on UI elements
      if (e.target !== canvas) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      mouseDownX = e.clientX;
      mouseDownY = e.clientY;
      canvas.style.cursor = 'grabbing';
    });

    const tooltip = document.getElementById('digitTooltip');

    window.addEventListener('mousemove', (e) => {
      if (dragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        Camera.pan(dx, dy);
        lastX = e.clientX;
        lastY = e.clientY;
        tooltip.classList.add('hidden');
        return;
      }

      // Hover tooltip
      if (e.target !== canvas) {
        tooltip.classList.add('hidden');
        return;
      }
      const { x: camX, y: camY, zoom } = Camera.getState();
      const wx = camX + e.clientX / zoom;
      const wy = camY + e.clientY / zoom;
      let idx = Layout.getIndexAtPosition(wx, wy);
      const digits = App.getDigits();
      const effLen = Renderer.getEffectiveLength();

      // Check if hovering near the repelled last digit
      const last = Renderer.getLastDigitScreenPos();
      let isLastDigit = false;
      if (last && App.getCurrentConstant() === 'pi' && !Renderer.isExpanding()) {
        const lcx = last.x + last.w / 2;
        const lcy = last.y + last.h / 2;
        const ldist = Math.sqrt((e.clientX - lcx) ** 2 + (e.clientY - lcy) ** 2);
        if (ldist < Math.max(last.w, last.h) * 1.2) {
          idx = last.idx;
          isLastDigit = true;
        }
      }

      if (idx >= 0 && idx < effLen && digits) {
        const d = digits[idx];
        const colors = Renderer.getDigitColors();
        const color = colors ? colors[Number(d)] : 'var(--accent)';
        let html = `<span class="tt-digit" style="color:${color}">${d}</span><span class="tt-pos">digit #${idx.toLocaleString()}</span>`;
        if (isLastDigit) {
          html += `<div class="tt-note">\uD83C\uDF70 The cake is at the end of \u03C0</div>`;
        }
        tooltip.innerHTML = html;
        tooltip.classList.remove('hidden');
        tooltip.style.left = (e.clientX + 14) + 'px';
        tooltip.style.top = (e.clientY - 10) + 'px';
      } else {
        tooltip.classList.add('hidden');
      }
    });

    window.addEventListener('mouseup', (e) => {
      const wasDrag = dragging && (Math.abs(e.clientX - mouseDownX) > 5 || Math.abs(e.clientY - mouseDownY) > 5);
      dragging = false;
      canvas.style.cursor = 'grab';

      // Click (not drag) — check if clicking on the last digit
      if (!wasDrag && e.target === canvas && App.getCurrentConstant() === 'pi') {
        const last = Renderer.getLastDigitScreenPos();
        if (last && !Renderer.isExpanding()) {
          const margin = Math.max(last.w, last.h) * 0.8;
          if (e.clientX >= last.x - margin && e.clientX <= last.x + last.w + margin &&
              e.clientY >= last.y - margin && e.clientY <= last.y + last.h + margin) {
            Renderer.expandDigits(5000);
            Sounds.cakeClick();
            unlock('cake_lie');
            if (Renderer.getEffectiveLength() > 1e6) unlock('expander');
            cakeClickCount++;
            if (cakeClickCount === 1) {
              // First click — the realization
              mascotSay(
                `<div class="bubble-title">🍰 The Cake</div>`
                + `Oh that's right... π has no end.<br>Does that mean the cake is a lie?<br>`
                + `<i style="opacity:0.6">There's got to be another way to get it.</i>`,
                0
              );
            } else if (cakeClickCount === 2) {
              // Second click — offer birthday
              mascotSay(
                `<div class="bubble-title">🍰 Wait...</div>`
                + `What if the cake comes to you?<br>Tell me your birthday and I'll find it a place in π!`
                + `<div class="bday-input"><input type="date" id="bdayPicker"><button id="bdayGo">🎂 Find my birthday!</button></div>`,
                0
              );
              setTimeout(() => {
                const picker = document.getElementById('bdayPicker');
                const btn = document.getElementById('bdayGo');
                if (!picker || !btn) return;
                btn.addEventListener('click', () => { if (picker.value) handleBirthday(picker.value); });
                picker.addEventListener('keydown', (e) => { if (e.key === 'Enter' && picker.value) handleBirthday(picker.value); });
              }, 50);
            } else {
              const quip = CAKE_QUIPS[cakeClickCount % CAKE_QUIPS.length];
              mascotSay(`<div class="bubble-title">🍰 The Cake</div>${quip}`, 6000);
            }
          }
        }
      }
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      Camera.zoomAt(factor, e.clientX, e.clientY);
      updateInfoBar();
      if (Camera.getState().zoom > 8) unlock('zoom_master');
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

    // Collapsible toggle
    const toggle = document.getElementById('famousToggle');
    if (toggle) {
      // Start collapsed by default
      panel.classList.add('collapsed');
      toggle.addEventListener('click', () => {
        panel.classList.toggle('collapsed');
      });
    }

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

      // Show fun fact via mascot
      const famousEntry = FAMOUS_PATTERNS.find(p => p.pattern === pattern && p.pos === pos);
      if (famousEntry && famousEntry.facts) {
        const fact = famousEntry.facts[Math.floor(Math.random() * famousEntry.facts.length)];
        mascotSay(`<div class="bubble-title">${famousEntry.name}</div>${fact}`, 10000);
      }
      if (pattern === '999999') unlock('feynman');
      trackNavigation();

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
        // Position is beyond loaded digits — show on scale without searching
        const input = document.getElementById('searchInput');
        input.value = pattern;
        const name = item.querySelector('.famous-name')?.textContent || pattern;
        showFamousPositionBanner(name, pattern, pos);
      }
    });

    // Prevent canvas drag
    panel.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  return { init, updateInfoBar, unlock };
})();
