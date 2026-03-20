const Particles = (() => {
  const MAX_PARTICLES = 200;
  let particles = [];

  function emit(worldX, worldY, count, colors) {
    for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 80;
      particles.push({
        x: worldX,
        y: worldY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.6 + Math.random() * 0.8,
        size: 2 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  function burst(worldX, worldY, count) {
    emit(worldX, worldY, count || 30, DIGIT_COLORS);
  }

  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= p.decay * dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  function render(ctx, camX, camY, camZoom) {
    for (const p of particles) {
      const sx = (p.x - camX) * camZoom;
      const sy = (p.y - camY) * camZoom;
      const size = p.size * camZoom;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function hasParticles() {
    return particles.length > 0;
  }

  function clear() {
    particles = [];
  }

  return { burst, emit, update, render, hasParticles, clear };
})();
