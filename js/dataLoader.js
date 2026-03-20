const DataLoader = (() => {
  const cache = new Map();

  async function load(constantKey) {
    if (cache.has(constantKey)) return cache.get(constantKey);

    const info = CONSTANTS[constantKey];
    if (!info) throw new Error(`Unknown constant: ${constantKey}`);

    const resp = await fetch(info.file);
    if (!resp.ok) throw new Error(`Failed to load ${info.file}`);

    const text = await resp.text();
    const digits = text.replace(/[^0-9]/g, '');
    cache.set(constantKey, digits);
    return digits;
  }

  return { load };
})();
