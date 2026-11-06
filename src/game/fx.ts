// Particles, floating score text, shake and banners. Visual only: nothing here changes the rules.

import { COLOR } from "./palette";

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
}

export interface Ring {
  x: number;
  y: number;
  age: number;
  max: number;
  radius: number;
  color: string;
}

export interface Floater {
  x: number;
  y: number;
  age: number;
  text: string;
  color: string;
}

export interface Banner {
  age: number;
  max: number;
  title: string;
  detail: string;
}

const MAX_PARTICLES = 420;
const MAX_FLOATERS = 14;

export class Fx {
  particles: Particle[] = [];
  rings: Ring[] = [];
  floaters: Floater[] = [];
  banner: Banner | null = null;
  shake = 0;
  flash = 0;

  constructor(private readonly reduced: boolean) {}

  reset(): void {
    this.particles = [];
    this.rings = [];
    this.floaters = [];
    this.banner = null;
    this.shake = 0;
    this.flash = 0;
  }

  burst(x: number, y: number, count: number, color: string, speed: number, life = 0.6): void {
    const total = this.reduced ? Math.ceil(count / 3) : count;
    for (let i = 0; i < total; i++) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const angle = Math.random() * Math.PI * 2;
      const pace = speed * (0.35 + Math.random() * 0.75);
      const span = life * (0.6 + Math.random() * 0.6);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * pace,
        vy: Math.sin(angle) * pace,
        life: span,
        max: span,
        size: 2 + Math.random() * 3,
        color,
      });
    }
  }

  ring(x: number, y: number, color: string, radius = 42, max = 0.4): void {
    this.rings.push({ x, y, age: 0, max, radius, color });
  }

  float(x: number, y: number, text: string, color: string): void {
    if (this.floaters.length >= MAX_FLOATERS) this.floaters.shift();
    this.floaters.push({ x, y, age: 0, text, color });
  }

  /** Screen shake. Under reduced motion the red flash carries the same message instead. */
  impact(strength: number): void {
    if (!this.reduced) this.shake = Math.max(this.shake, strength);
    this.flash = Math.max(this.flash, Math.min(0.32, strength / 50));
  }

  announce(title: string, detail: string): void {
    this.banner = { age: 0, max: 1.5, title, detail };
  }

  /** Runs on real time, so effects finish even while the world is slowed. */
  update(dt: number): void {
    const drag = Math.exp(-3.2 * dt);
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= drag;
      p.vy *= drag;
      return p.life > 0;
    });
    this.rings = this.rings.filter((ring) => (ring.age += dt) < ring.max);
    this.floaters = this.floaters.filter((floater) => {
      floater.age += dt;
      floater.y -= 46 * dt;
      return floater.age < 0.85;
    });
    if (this.banner && (this.banner.age += dt) >= this.banner.max) this.banner = null;
    this.shake = this.shake < 0.2 ? 0 : this.shake * Math.exp(-7 * dt);
    this.flash = this.flash < 0.01 ? 0 : this.flash * Math.exp(-6 * dt);
  }
}

export const CRASH_COLORS = [COLOR.danger, COLOR.white, COLOR.accent] as const;
