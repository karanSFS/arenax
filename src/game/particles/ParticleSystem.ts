// ═══════════════════════════════════════════
// PARTICLE SYSTEM
// Lightweight Canvas-based particle system
// ═══════════════════════════════════════════

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
  gravity: number;
  decay: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private maxParticles: number;

  constructor(maxParticles = 500) {
    this.maxParticles = maxParticles;
  }

  private addParticle(p: Omit<Particle, "alpha">) {
    if (this.particles.length >= this.maxParticles) {
      // Remove oldest particle
      this.particles.shift();
    }
    this.particles.push({ ...p, alpha: 1 });
  }

  // ─── Effect Types ──────────────────────────────────────────────────────────

  hit(x: number, y: number, color = "#ff6b00", count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 2 + Math.random() * 4;
      this.addParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.3 + Math.random() * 0.3,
        maxLife: 0.6,
        size: 2 + Math.random() * 4,
        color,
        gravity: 0.1,
        decay: 2,
      });
    }
  }

  explosion(x: number, y: number, color = "#ff6b00", count = 24) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 8;
      this.addParticle({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 0.5 + Math.random() * 0.8,
        maxLife: 1.3,
        size: 3 + Math.random() * 8,
        color,
        gravity: 0.15,
        decay: 1,
      });
    }
  }

  death(x: number, y: number, color = "#ff2d78") {
    this.explosion(x, y, color, 40);
    // Add some dark particles
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.addParticle({
        x,
        y,
        vx: Math.cos(angle) * (2 + Math.random() * 3),
        vy: Math.sin(angle) * (2 + Math.random() * 3) - 4,
        life: 1 + Math.random(),
        maxLife: 2,
        size: 2 + Math.random() * 3,
        color: "#1a0020",
        gravity: 0.05,
        decay: 0.7,
      });
    }
  }

  projectileTrail(x: number, y: number, color = "#00f5ff") {
    if (Math.random() > 0.6) {
      this.addParticle({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 1,
        vy: (Math.random() - 0.5) * 1,
        life: 0.2 + Math.random() * 0.2,
        maxLife: 0.4,
        size: 1 + Math.random() * 3,
        color,
        gravity: 0,
        decay: 3,
      });
    }
  }

  ambient(x: number, y: number, color = "#00f5ff") {
    if (Math.random() > 0.97) {
      this.addParticle({
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -0.5 - Math.random() * 0.5,
        life: 1 + Math.random() * 2,
        maxLife: 3,
        size: 1 + Math.random() * 2,
        color,
        gravity: -0.02,
        decay: 0.5,
      });
    }
  }

  sparks(x: number, y: number, color = "#ffd700", count = 6) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      this.addParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.1 + Math.random() * 0.3,
        maxLife: 0.4,
        size: 1 + Math.random() * 2,
        color,
        gravity: 0.2,
        decay: 4,
      });
    }
  }

  healEffect(x: number, y: number) {
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      this.addParticle({
        x,
        y,
        vx: Math.cos(angle) * 2,
        vy: Math.sin(angle) * 2 - 1,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1,
        size: 3 + Math.random() * 3,
        color: "#39ff14",
        gravity: -0.05,
        decay: 1,
      });
    }
  }

  // ─── Update & Render ───────────────────────────────────────────────────────

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.98;
      p.life -= dt * p.decay;
      p.alpha = Math.max(0, p.life / p.maxLife);

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    ctx.save();
    for (const p of this.particles) {
      const screenX = p.x - cameraX;
      const screenY = p.y - cameraY;

      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      // Glow effect for larger particles
      if (p.size > 4) {
        ctx.shadowBlur = p.size * 2;
        ctx.shadowColor = p.color;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.arc(screenX, screenY, p.size * p.alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  clear() {
    this.particles = [];
  }

  get count() {
    return this.particles.length;
  }
}
