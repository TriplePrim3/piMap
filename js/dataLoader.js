const DataLoader = (() => {
  const cache = new Map();

  async function load(constantKey) {
    if (cache.has(constantKey)) return cache.get(constantKey);

    const info = CONSTANTS[constantKey];
    if (!info) throw new Error(`Unknown constant: ${constantKey}`);

    const resp = await fetch(info.file);
    if (!resp.ok) throw new Error(`Failed to load ${info.file}`);

    const text = await resp.text();
    let digits = text.replace(/[^0-9]/g, '');
    // Cap initial load at 1M digits — extra digits are available via /api/pidigits for expansion
    if (digits.length > 1000000) digits = digits.slice(0, 1000000);
    cache.set(constantKey, digits);
    return digits;
  }

  return { load };
})();
