const CONSTANTS = {
  pi:    { name: 'π (Pi)',      symbol: 'π',  file: 'data/pi.txt',    decimalAt: 1 },
  e:     { name: 'e (Euler)',   symbol: 'e',  file: 'data/e.txt',     decimalAt: 1 },
  sqrt2: { name: '√2',         symbol: '√2', file: 'data/sqrt2.txt', decimalAt: 1 },
  sqrt3: { name: '√3',         symbol: '√3', file: 'data/sqrt3.txt', decimalAt: 1 },
};

// 10-color palette (kept for shirt designer)
const DIGIT_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#F1948A',
];
const DIGIT_COLORS_LIGHT = [
  '#CC4444', '#2A9D8F', '#2680A0', '#5F9A78', '#D4A017',
  '#A855A0', '#4A9A88', '#C4A830', '#8855AA', '#CC5544',
];

// 100-color palette for digit pairs (00-99), golden-angle hue distribution
var PAIR_COLORS = (() => {
  const arr = [];
  for (let i = 0; i < 100; i++) {
    arr.push(`hsl(${(i * 137.508) % 360}, 72%, 68%)`);
  }
  return arr;
})();

var PAIR_COLORS_LIGHT = (() => {
  const arr = [];
  for (let i = 0; i < 100; i++) {
    arr.push(`hsl(${(i * 137.508) % 360}, 55%, 42%)`);
  }
  return arr;
})();
