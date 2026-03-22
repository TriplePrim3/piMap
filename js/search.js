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

  // Find the first match at or after minPos
  function findPatternAfter(digits, pattern, minPos) {
    const hits = findPattern(digits, pattern);
    for (const h of hits) {
      if (h >= minPos) return h;
    }
    return -1;
  }

  // Build array of valid split offsets for a given word + encoding mode
  // e.g. "MAN" in alpha26 → [0, 2, 4, 6] (every 2 digits)
  function _letterBreaks(word, mode) {
    const breaks = [0];
    let pos = 0;
    for (const ch of word) {
      if (!/[a-zA-Z]/i.test(ch)) continue;
      let len;
      if (mode === 't9') len = 1;
      else if (mode === 'compact') len = (ch.toUpperCase().charCodeAt(0) - 65) < 10 ? 1 : 2;
      else len = 2; // alpha26
      pos += len;
      breaks.push(pos);
    }
    return breaks;
  }

  // Greedy chunked search: break digitStr into largest sequential chunks in pi
  // breaks = valid split offsets (letter boundaries) — if null, any offset is valid
  function findChunked(digits, digitStr, breaks) {
    const chunks = [];
    let offsetIdx = 0; // index into breaks array
    let minPos = 0; // each chunk must appear after the previous one

    // If no breaks provided, allow any offset (backwards compat)
    if (!breaks || breaks.length < 2) {
      breaks = [];
      for (let i = 0; i <= digitStr.length; i++) breaks.push(i);
    }

    while (offsetIdx < breaks.length - 1) {
      const offset = breaks[offsetIdx];
      let bestEndIdx = -1;
      let bestPos = -1;

      // Binary search for the longest prefix starting at offset
      // that ends on a letter boundary and exists in pi after minPos
      let lo = offsetIdx + 1, hi = breaks.length - 1;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const endOffset = breaks[mid];
        const sub = digitStr.substring(offset, endOffset);
        const pos = findPatternAfter(digits, sub, minPos);
        if (pos >= 0) {
          bestEndIdx = mid;
          bestPos = pos;
          lo = mid + 1; // try longer
        } else {
          hi = mid - 1; // try shorter
        }
      }

      if (bestEndIdx < 0) {
        // Minimum: one letter
        const endOffset = breaks[offsetIdx + 1];
        const sub = digitStr.substring(offset, endOffset);
        const pos = findPatternAfter(digits, sub, minPos);
        bestEndIdx = offsetIdx + 1;
        bestPos = pos >= 0 ? pos : 0;
      }

      const endOffset = breaks[bestEndIdx];
      chunks.push({
        digitStr: digitStr.substring(offset, endOffset),
        pos: bestPos,
        offset: offset,
      });
      minPos = bestPos + (endOffset - offset); // next chunk must come after this one
      offsetIdx = bestEndIdx;
    }

    return chunks;
  }

  return {
    find, findPattern, convertWithMode, findChunked, letterBreaks: _letterBreaks,
    getResults, getLastConvertedQuery, getLastSearchWord,
    getCurrentIndex, getCurrentMatch,
    next, prev, clear, convertQuery,
    setTextEncoding, getTextEncoding,
  };
})();
