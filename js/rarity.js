const Rarity = (() => {
  const MILESTONES = [
    { n: 1e6,  label: '1M' },
    { n: 1e8,  label: '100M' },
    { n: 1e9,  label: '1B' },
  ];

  // P(found) = 1 - exp(-positions / 10^L)  (Poisson approximation, safe for large L)
  // positions = numDigits - digitLen + 1 (valid starting positions for a pattern of length L)
  function probability(digitLen, numDigits) {
    if (digitLen <= 0) return 1;
    const positions = Math.max(0, numDigits - digitLen + 1);
    const lambda = positions / Math.pow(10, digitLen);
    return 1 - Math.exp(-lambda);
  }

  function compute(digitLen) {
    return MILESTONES.map(m => ({
      label: m.label,
      n: m.n,
      prob: probability(digitLen, m.n),
    }));
  }

  function formatProb(p) {
    if (p >= 0.9999) return '~100%';
    if (p >= 0.99) return '>99%';
    if (p >= 0.01) return (p * 100).toFixed(1) + '%';
    if (p >= 0.001) return (p * 100).toFixed(2) + '%';
    if (p >= 0.0001) return (p * 100).toFixed(3) + '%';
    if (p >= 1e-10) return '1 in ' + Math.round(1 / p).toLocaleString();
    return '1 in 10^' + Math.round(-Math.log10(p));
  }

  function tier(probIn1B) {
    if (probIn1B >= 0.9) return { name: 'Common', stars: 1, color: '#888' };
    if (probIn1B >= 0.5) return { name: 'Uncommon', stars: 2, color: '#4ECDC4' };
    if (probIn1B >= 0.1) return { name: 'Rare', stars: 3, color: '#FFEAA7' };
    if (probIn1B >= 0.01) return { name: 'Very Rare', stars: 4, color: '#ff6b9d' };
    return { name: 'Legendary', stars: 5, color: '#7c6ff7' };
  }

  // Build the full HTML block for display
  function buildHTML(digitLen, encoding) {
    const data = compute(digitLen);
    const t = tier(data[2].prob);
    const encLabels = { alpha26: 'Alpha-26', compact: 'Compact', t9: 'T9' };
    const encSuffix = encoding && encLabels[encoding] ? ` (${encLabels[encoding]})` : '';

    let html = `<div class="rarity-block">`;
    html += `<button class="rarity-close" title="Hide" onclick="document.getElementById('rarityDisplay').classList.add('hidden')">&times;</button>`;
    html += `<div class="rarity-header"><span class="rarity-title">Probability to find</span><span class="rarity-digits">${digitLen}-digit pattern${encSuffix}</span></div>`;
    html += `<div class="rarity-odds">`;
    for (const d of data) {
      const p = formatProb(d.prob);
      const barW = Math.max(2, Math.min(100, d.prob * 100));
      html += `<div class="rarity-row"><span class="rarity-label">${d.label}</span><div class="rarity-bar-track"><div class="rarity-bar-fill" style="width:${barW}%;background:${t.color}"></div></div><span class="rarity-prob">${p}</span></div>`;
    }
    html += `</div>`;
    html += `</div>`;
    return html;
  }

  return { compute, probability, formatProb, tier, buildHTML };
})();
