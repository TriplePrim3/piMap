const Sounds = (() => {
  let ctx = null;
  let muted = false;

  let userGesture = false;

  function getCtx() {
    if (!userGesture) return null;
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function unlockAudio() {
    if (userGesture) return;
    userGesture = true;
    // Create and resume context on first gesture
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  }

  function isMuted() { return muted; }
  function setMuted(v) { muted = v; localStorage.setItem('pimap_muted', v ? '1' : '0'); }

  // ─── Helpers ───

  function playTone(freq, duration, type = 'sine', vol = 0.15, detune = 0) {
    if (muted) return;
    const ac = getCtx();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    if (detune) osc.detune.value = detune;
    gain.gain.setValueAtTime(vol, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + duration);
  }

  // ─── Sound Effects ───

  // Achievement unlock — triumphant arpeggio
  function achievement() {
    if (muted) return;
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      setTimeout(() => {
        playTone(freq, 0.3, 'sine', 0.12);
        playTone(freq * 1.5, 0.2, 'triangle', 0.06); // shimmer
      }, i * 100);
    });
  }

  // Typewriter tick — short click per character, slight pitch variation
  function typeTick() {
    if (muted) return;
    const ac = getCtx();
    if (!ac) return;
    const t = ac.currentTime;
    const freq = 600 + Math.random() * 200; // 600-800 Hz — gentle variation
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.02, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.03);
  }

  // No-op kept for backward compat — babble replaced by typewriter
  function mascotSpeak() {}
  function stopBabble() {}

  // Digit print tick — tiny click, pitch varies by digit
  function digitTick(digit) {
    if (muted) return;
    const ac = getCtx();
    if (!ac) return;
    // Short noise burst filtered to a click
    const freq = 1200 + (digit || 0) * 80;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.04, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.03);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.03);
  }

  // Cake click — whimsical whoosh
  function cakeClick() {
    if (muted) return;
    playTone(600, 0.15, 'sine', 0.1);
    setTimeout(() => playTone(400, 0.2, 'sine', 0.08), 80);
    setTimeout(() => playTone(300, 0.15, 'triangle', 0.06), 150);
  }

  // Init — restore mute state, listen for first user gesture
  function init() {
    muted = localStorage.getItem('pimap_muted') === '1';
    const events = ['click', 'keydown', 'touchstart'];
    const handler = () => {
      unlockAudio();
      events.forEach(e => document.removeEventListener(e, handler, true));
    };
    events.forEach(e => document.addEventListener(e, handler, { once: false, capture: true }));
  }

  return { init, isMuted, setMuted, achievement, mascotSpeak, typeTick, stopBabble, digitTick, cakeClick };
})();
