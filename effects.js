/**
 * Zarif kar tanecikleri ve kutlama konfetisi efektleri.
 * Paletteki tonlarla uyumlu (krem, şampanya altını, kızılcık, çam yeşili).
 */

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Arka planda çok hafif, dikkat dağıtmayan kış kar taneleri çizer.
 * @param {HTMLCanvasElement | null} canvas
 */
export function initAmbientSnow(canvas) {
  if (!canvas || prefersReducedMotion()) return () => {};

  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  let width = 0;
  let height = 0;
  let rafId = 0;

  const flakes = [];
  const FLAKE_COUNT = 34;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seedFlakes() {
    flakes.length = 0;
    for (let i = 0; i < FLAKE_COUNT; i++) {
      flakes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 1.2 + Math.random() * 2.2,
        speedY: 0.22 + Math.random() * 0.42,
        driftPhase: Math.random() * Math.PI * 2,
        driftAmp: 0.18 + Math.random() * 0.35,
        opacity: 0.18 + Math.random() * 0.32,
        goldTint: i % 5 === 0,
      });
    }
  }

  function step() {
    ctx.clearRect(0, 0, width, height);

    for (const f of flakes) {
      f.y += f.speedY;
      f.driftPhase += 0.012;
      f.x += Math.sin(f.driftPhase) * f.driftAmp;

      if (f.y > height + 8) {
        f.y = -8;
        f.x = Math.random() * width;
      }
      if (f.x > width + 8) f.x = -8;
      if (f.x < -8) f.x = width + 8;

      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fillStyle = f.goldTint
        ? `rgba(197, 155, 39, ${f.opacity * 0.75})`
        : `rgba(20, 54, 43, ${f.opacity * 0.28})`;
      ctx.fill();
    }

    rafId = window.requestAnimationFrame(step);
  }

  resize();
  seedFlakes();
  rafId = window.requestAnimationFrame(step);

  window.addEventListener('resize', resize, { passive: true });

  return () => {
    window.cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
  };
}

/**
 * Zarf açılışında altın, kızılcık ve çam yeşili tonlarında zarif konfeti patlaması.
 * @param {HTMLCanvasElement | null} canvas
 */
export function triggerFestiveConfetti(canvas) {
  if (!canvas || prefersReducedMotion()) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const palette = [
    '#C59B27', // Fırçalanmış şampanya altını
    '#DFBC5E', // Açık altın varak
    '#A62639', // Kızılcık kırmızısı
    '#14362B', // Derin çam yeşili
    '#E8DCCB', // Sıcak parşömen
  ];

  const originX = width / 2;
  const originY = height * 0.44;
  const particles = Array.from({ length: 64 }, (_, idx) => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.45;
    const speed = 3.5 + Math.random() * 7.2;
    return {
      x: originX + (Math.random() - 0.5) * 36,
      y: originY + (Math.random() - 0.5) * 20,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.2,
      w: 5 + Math.random() * 5,
      h: 3 + Math.random() * 4,
      rotation: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.18,
      color: palette[idx % palette.length],
      alpha: 1,
      isCircle: idx % 7 === 0,
    };
  });

  let frame = 0;
  const MAX_FRAMES = 115;

  function render() {
    frame += 1;
    ctx.clearRect(0, 0, width, height);

    let activeCount = 0;
    for (const p of particles) {
      p.vy += 0.14;
      p.vx *= 0.988;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.vr;

      if (frame > MAX_FRAMES * 0.55) {
        p.alpha = Math.max(0, p.alpha - 0.025);
      }

      if (p.alpha <= 0 || p.y > height + 24) continue;
      activeCount += 1;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;

      if (p.isCircle) {
        ctx.beginPath();
        ctx.arc(0, 0, p.w * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    }

    if (activeCount > 0 && frame < MAX_FRAMES) {
      window.requestAnimationFrame(render);
    } else {
      ctx.clearRect(0, 0, width, height);
    }
  }

  window.requestAnimationFrame(render);
}
