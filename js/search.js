const Search = (() => {
  let results = [];
  let currentIndex = -1;
  let lastConvertedQuery = '';
  let lastSearchWord = ''; // The original word searched (for shirt designer)
  let textEncoding = 'alpha26'; // 'alpha26' | 'compact' | 't9'

  function setTextEncoding(mode) {
    textEncoding = mode;
  }

  function getTextEncoding() {
    return textEncoding;
  }

  function convertQuery(query) {
    const isAllDigits = /^\d+$/.test(query);
    if (isAllDigits) {
      return { digitQuery: query, mode: 'digits', display: query };
    }

    const hasLetters = /[a-zA-Z]/.test(query);
    if (!hasLetters) {
      return { digitQuery: query.replace(/[^0-9]/g, ''), mode: 'digits', display: query };
    }

    const word = query.replace(/[^a-zA-Z]/g, '').toUpperCase();

    if (textEncoding === 't9') {
      let digitQuery = '';
      let parts = [];
      for (const ch of query) {
        if (/[a-zA-Z]/.test(ch)) {
          const d = Mappings.letterToT9(ch);
          if (d) {
            digitQuery += d;
            parts.push(`${ch.toUpperCase()}=${d}`);
          }
        } else if (/\d/.test(ch)) {
          digitQuery += ch;
          parts.push(ch);
        }
      }
      return {
        digitQuery,
        mode: 't9',
        display: `T9: "${word}" → ${parts.join(' ')} (${digitQuery.length} digits)`,
      };
    }

    if (textEncoding === 'compact') {
      let digitQuery = '';
      let parts = [];
      for (const ch of query) {
        if (/[a-zA-Z]/.test(ch)) {
          const d = Mappings.letterToCompact(ch);
          if (d) {
            digitQuery += d;
            parts.push(`${ch.toUpperCase()}=${d}`);
          }
        } else if (/\d/.test(ch)) {
          digitQuery += ch;
          parts.push(ch);
        }
      }
      return {
        digitQuery,
        mode: 'compact',
        display: `Compact: "${word}" → ${parts.join(' ')} (${digitQuery.length} digits)`,
      };
    }

    // Default: alpha26 — 2 digits per letter
    let digitQuery = '';
    let parts = [];
    for (const ch of query) {
      if (/[a-zA-Z]/.test(ch)) {
        const pair = Mappings.letterToPair(ch);
        if (pair) {
          digitQuery += pair;
          parts.push(`${ch.toUpperCase()}=${pair}`);
        }
      } else if (/\d/.test(ch)) {
        digitQuery += ch;
        parts.push(ch);
      }
    }

    return {
      digitQuery,
      mode: 'alpha26',
      display: `"${word}" → ${parts.join(' ')}`,
    };
  }

  function buildFailure(pattern) {
    const fail = new Array(pattern.length).fill(0);
    let j = 0;
    for (let i = 1; i < pattern.length; i++) {
      while (j > 0 && pattern[i] !== pattern[j]) j = fail[j - 1];
      if (pattern[i] === pattern[j]) j++;
      fail[i] = j;
    }
    return fail;
  }

  // Stateless KMP search — returns array of match positions
  function findPattern(digits, pattern) {
    if (!pattern || pattern.length === 0) return [];
    const fail = buildFailure(pattern);
    const matches = [];
    let j = 0;
    for (let i = 0; i < digits.length; i++) {
      while (j > 0 && digits[i] !== pattern[j]) j = fail[j - 1];
      if (digits[i] === pattern[j]) j++;
      if (j === pattern.length) {
        matches.push(i - pattern.length + 1);
        j = fail[j - 1];
      }
    }
    return matches;
  }

  // Convert a query using a specific encoding (doesn't change state)
  function convertWithMode(query, mode) {
    const saved = textEncoding;
    textEncoding = mode;
    const result = convertQuery(query);
    textEncoding = saved;
    return result;
  }

  function find(digits, rawQuery) {
    const converted = convertQuery(rawQuery);
    const pattern = converted.digitQuery;
    lastConvertedQuery = pattern;
    lastSearchWord = rawQuery.replace(/[^a-zA-Z]/g, '').toUpperCase();

    if (!pattern || pattern.length === 0) {
      results = [];
      currentIndex = -1;
      return { results: [], converted };
    }

    const fail = buildFailure(pattern);
    results = [];
    let j = 0;

    // No pair alignment for any mode — always raw string search
    for (let i = 0; i < digits.length; i++) {
      while (j > 0 && digits[i] !== pattern[j]) j = fail[j - 1];
      if (digits[i] === pattern[j]) j++;
      if (j === pattern.length) {
        results.push(i - pattern.length + 1);
        j = fail[j - 1];
      }
    }

    currentIndex = results.length > 0 ? 0 : -1;
    return { results, converted };
  }

  function getResults() { return results; }
  function getLastConvertedQuery() { return lastConvertedQuery; }
  function getLastSearchWord() { return lastSearchWord; }
  function getCurrentIndex() { return currentIndex; }

  function getCurrentMatch() {
    if (currentIndex < 0 || currentIndex >= results.length) return -1;
    return results[currentIndex];
  }

  function next() {
    if (results.length === 0) return -1;
    currentIndex = (currentIndex + 1) % results.length;
    return results[currentIndex];
  }

  function prev() {
    if (results.length === 0) return -1;
    currentIndex = (currentIndex - 1 + results.length) % results.length;
    return results[currentIndex];
  }

  function clear() {
    results = [];
    currentIndex = -1;
    lastConvertedQuery = '';
    lastSearchWord = '';
  }

  return {
    find, findPattern, convertWithMode,
    getResults, getLastConvertedQuery, getLastSearchWord,
    getCurrentIndex, getCurrentMatch,
    next, prev, clear, convertQuery,
    setTextEncoding, getTextEncoding,
  };
})();
