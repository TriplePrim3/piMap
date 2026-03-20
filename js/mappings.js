const Mappings = (() => {
  // Letter ↔ digit-pair mapping: 00=A, 01=B, ..., 25=Z, then loops (26=A, 27=B, ...)
  function letterToPair(ch) {
    const code = ch.toUpperCase().charCodeAt(0) - 65;
    if (code < 0 || code > 25) return null;
    return String(code).padStart(2, '0');
  }

  function pairToLetter(num) {
    return String.fromCharCode(65 + (num % 26));
  }

  const schemes = {
    digits: {
      label: 'Numbers',
      tooltip: 'Shows each 2-digit pair (00-99) from the constant',
    },
    alpha26: {
      label: 'Text (A-Z)',
      tooltip: '2-digit pairs → letters: 00=A, 01=B, … 25=Z, 26=A, … (loops). Enables full name search!',
    },
    blocks: {
      label: 'Color Blocks',
      tooltip: 'Each pair shown as a uniquely colored block (100 colors)',
    },
    braille: {
      label: 'Braille',
      tooltip: 'Pairs encoded as Braille patterns',
    },
  };

  let current = 'digits';

  function set(name) {
    if (schemes[name]) current = name;
  }

  function get() {
    return schemes[current];
  }

  function currentName() {
    return current;
  }

  // Compact encoding: A-J → single digit (0-9), K-Z → two digits (10-25)
  function letterToCompact(ch) {
    const code = ch.toUpperCase().charCodeAt(0) - 65;
    if (code < 0 || code > 25) return null;
    return String(code); // 0-9 = 1 char, 10-25 = 2 chars
  }

  // T9 phone keypad: each letter → 1 digit
  const T9_MAP = {
    A:2,B:2,C:2, D:3,E:3,F:3, G:4,H:4,I:4,
    J:5,K:5,L:5, M:6,N:6,O:6, P:7,Q:7,R:7,S:7,
    T:8,U:8,V:8, W:9,X:9,Y:9,Z:9,
  };

  function letterToT9(ch) {
    const d = T9_MAP[ch.toUpperCase()];
    return d != null ? String(d) : null;
  }

  return { set, get, currentName, schemes, letterToPair, pairToLetter, letterToCompact, letterToT9 };
})();
