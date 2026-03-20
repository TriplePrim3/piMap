const Search = (() => {
  let results = [];
  let currentIndex = -1;
  let lastConvertedQuery = '';
  let lastSearchWord = ''; // The original word searched (for shirt designer)

  function convertQuery(query) {
    const isAllDigits = /^\d+$/.test(query);
    if (isAllDigits) {
      return { digitQuery: query, mode: 'digits', display: query };
    }

    const hasLetters = /[a-zA-Z]/.test(query);
    if (!hasLetters) {
      return { digitQuery: query.replace(/[^0-9]/g, ''), mode: 'digits', display: query };
    }

    // Pair encoding: each letter → 2-digit pair (A=00, B=01, ..., Z=25)
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

    const word = query.replace(/[^a-zA-Z]/g, '').toUpperCase();
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

    // For text searches, matches must align with pair boundaries
    // Pairs start at decimalAt (1), then every 2 digits: 1,3,5,7...
    const needsPairAlign = converted.mode === 'alpha26';
    const decimalAt = 1; // all constants have decimalAt=1

    for (let i = 0; i < digits.length; i++) {
      while (j > 0 && digits[i] !== pattern[j]) j = fail[j - 1];
      if (digits[i] === pattern[j]) j++;
      if (j === pattern.length) {
        const matchStart = i - pattern.length + 1;
        if (!needsPairAlign || (matchStart >= decimalAt && (matchStart - decimalAt) % 2 === 0)) {
          results.push(matchStart);
        }
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
    find, getResults, getLastConvertedQuery, getLastSearchWord,
    getCurrentIndex, getCurrentMatch,
    next, prev, clear, convertQuery,
  };
})();
