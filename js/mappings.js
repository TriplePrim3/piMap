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

  return { set, get, currentName, schemes, letterToPair, pairToLetter };
})();
