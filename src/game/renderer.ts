// Draws one frame. Reads the game state and the effects, and never changes either.

import { SHIELD_SECONDS } from "./config";
import { trapExtent, trapStage } from "./engine";
import type { Fx } from "./fx";
import { COLOR, FONT } from "./palette";
import type { Bot, GameState, Pickup, Trap, Vec } from "./types";

const TAU = Math.PI * 2;
const GRID = 48;

export interface View {
  /** Seconds since the page opened, for idle animation. */
  now: number;
  /** Seconds of background flow since the page opened. */
  flow: number;
  trail: readonly Vec[];
  hidePlayer: boolean;
  /** Seconds left in the hold after resuming, or 0. */
  resuming: number;
  reduced: boolean;
}

/** A soft round glow, rendered once and stamped each frame: far cheaper than shadowBlur. */
function makeGlow(color: string, radius: number, dpr: number): HTMLCanvasElement {
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = Math.ceil(radius * 2 * dpr);
  const ctx = sprite.getContext("2d") as CanvasRenderingContext2D;
  ctx.scale(dpr, dpr);
  const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
  gradient.addColorStop(0, `${color}aa`);
  gradient.addColorStop(0.35, `${color}44`);
  gradient.addColorStop(1, `${color}00`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, radius * 2, radius * 2);
  return sprite;
}

function hexPath(ctx: CanvasRenderingContext2D, radius: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * TAU + Math.PI / 6;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** The Sybil drone, drawn once. Every bot is a pixel-identical clone of this sprite, which is the joke. */
function makeBotSprite(size: number, dpr: number): HTMLCanvasElement {
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = Math.ceil(size * dpr);
  const ctx = sprite.getContext("2d") as CanvasRenderingContext2D;
  ctx.scale(dpr, dpr);
  ctx.translate(size / 2, size / 2);
  ctx.lineJoin = "round";

  ctx.strokeStyle = COLOR.danger;
  ctx.lineWidth = 2;
  for (const [x, y] of [[-15, -12], [15, -12], [-15, 12], [15, 12]] as const) {
    ctx.beginPath();
    ctx.moveTo(x * 0.45, y * 0.45);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 5.5, 0, TAU);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(13, 0);
  ctx.lineTo(0, 14);
  ctx.lineTo(-13, 0);
  ctx.closePath();
  ctx.fillStyle = "#2a060b";
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = COLOR.white;
  ctx.fillRect(-7, -2, 14, 4);
  ctx.fillStyle = COLOR.danger;
  ctx.fillRect(-2, -2, 4, 4);
  return sprite;
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private glow: Record<"accent" | "gold" | "shield" | "danger", HTMLCanvasElement> | null = null;
  private botSprite: HTMLCanvasElement | null = null;
  private readonly hashes: { x: number; y: number; speed: number; text: string }[] = [];

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d", { alpha: false }) as CanvasRenderingContext2D;
    const hex = "0123456789abcdef";
    const pick = (n: number) => Array.from({ length: n }, () => hex[Math.floor(Math.random() * 16)]).join("");
    for (let i = 0; i < 16; i++) {
      this.hashes.push({ x: Math.random(), y: Math.random(), speed: 0.4 + Math.random() * 0.8, text: `0x${pick(4)}…${pick(3)}` });
    }
  }

  resize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    if (dpr !== this.dpr || !this.glow) {
      this.dpr = dpr;
      this.glow = {
        accent: makeGlow(COLOR.accent, 48, dpr),
        gold: makeGlow(COLOR.gold, 48, dpr),
        shield: makeGlow(COLOR.shield, 48, dpr),
        danger: makeGlow(COLOR.danger, 48, dpr),
      };
      this.botSprite = makeBotSprite(56, dpr);
    }
  }

  render(state: GameState, fx: Fx, view: View): void {
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = COLOR.bg;
    ctx.fillRect(0, 0, this.width, this.height);

    if (fx.shake > 0) {
      ctx.translate((Math.random() - 0.5) * 2 * fx.shake, (Math.random() - 0.5) * 2 * fx.shake);
    }

    this.drawGrid(view);
    this.drawHashes(view);
    for (const trap of state.traps) this.drawTrap(trap, view);
    for (const item of state.pickups) this.drawPickup(item, view);
    for (const bot of state.bots) this.drawBot(bot, view);
    this.drawTrail(view.trail);
    if (!view.hidePlayer) this.drawPlayer(state, view);
    this.drawFx(fx);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (fx.flash > 0) {
      ctx.fillStyle = `rgba(255, 59, 78, ${fx.flash})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }
    if (fx.banner) this.drawBanner(state, fx.banner.title, fx.banner.detail, fx.banner.age, fx.banner.max);
    if (view.resuming > 0) this.drawBanner(state, "Get ready", String(Math.ceil(view.resuming)), 0.5, 2);
  }

  private drawGrid(view: View): void {
    const { ctx, width, height } = this;
    const offset = view.reduced ? 0 : (view.flow * 26) % (GRID * 4);
    const line = (alpha: number, every: number) => {
      ctx.strokeStyle = `rgba(0, 255, 204, ${alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const step = GRID * every;
      for (let x = 0.5; x <= width; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = (offset % step) - step + 0.5; y <= height; y += step) {
        const row = Math.round(y) + 0.5;
        ctx.moveTo(0, row);
        ctx.lineTo(width, row);
      }
      ctx.stroke();
    };
    line(0.08, 1);
    line(0.13, 4);
  }

  /** Pending transactions drifting through the mempool. Texture only. */
  private drawHashes(view: View): void {
    const { ctx, width, height } = this;
    ctx.font = `400 12px ${FONT}`;
    ctx.fillStyle = "rgba(0, 255, 204, 0.13)";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (const hash of this.hashes) {
      const drift = view.reduced ? 0 : view.flow * hash.speed * 0.02;
      const y = ((hash.y + drift) % 1) * (height + 40) - 20;
      ctx.fillText(hash.text, hash.x * width, y);
    }
  }

  private stamp(sprite: HTMLCanvasElement, x: number, y: number, radius: number, alpha = 1): void {
    const { ctx } = this;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  private drawPickup(item: Pickup, view: View): void {
    const { ctx, glow } = this;
    if (!glow) return;
    const left = item.life - item.age;
    // Fading in, then blinking through the final 1.5s so an expiring pickup is visible as such.
    let alpha = Math.min(1, item.age / 0.2);
    if (left < 1.5) alpha *= view.reduced ? left / 1.5 : 0.45 + 0.55 * Math.abs(Math.sin(left * 7));
    const pulse = view.reduced ? 1 : 1 + Math.sin(view.now * 5 + item.id) * 0.08;

    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.globalAlpha = alpha;

    if (item.kind === "orb") {
      this.stamp(glow.accent, 0, 0, item.radius * 3 * pulse, alpha);
      ctx.fillStyle = COLOR.accent;
      ctx.beginPath();
      ctx.arc(0, 0, item.radius * 0.72 * pulse, 0, TAU);
      ctx.fill();
      ctx.fillStyle = COLOR.white;
      ctx.beginPath();
      ctx.arc(-1.5, -1.5, item.radius * 0.32, 0, TAU);
      ctx.fill();
    } else if (item.kind === "cheese") {
      this.stamp(glow.gold, 0, 0, item.radius * 3.2 * pulse, alpha);
      ctx.rotate(view.reduced ? 0 : Math.sin(view.now * 2 + item.id) * 0.18);
      const r = item.radius * 1.15;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.96, r * 0.72);
      ctx.lineTo(-r * 0.96, r * 0.72);
      ctx.closePath();
      ctx.fillStyle = COLOR.gold;
      ctx.fill();
      ctx.strokeStyle = COLOR.white;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.fillStyle = "#8a5a00";
      for (const [x, y, size] of [[-4, 6, 2.6], [4, 3, 2], [0, -3, 1.8]] as const) {
        ctx.beginPath();
        ctx.arc(x, y, size, 0, TAU);
        ctx.fill();
      }
    } else {
      this.stamp(glow.shield, 0, 0, item.radius * 3.2 * pulse, alpha);
      ctx.rotate(view.reduced ? 0 : view.now * 0.8);
      hexPath(ctx, item.radius * 1.1);
      ctx.fillStyle = "rgba(77, 157, 255, 0.24)";
      ctx.fill();
      ctx.strokeStyle = COLOR.shield;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      hexPath(ctx, item.radius * 0.58);
      ctx.strokeStyle = COLOR.white;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBot(bot: Bot, view: View): void {
    const { ctx, botSprite, glow } = this;
    if (!botSprite || !glow) return;

    if (bot.warn > 0) {
      // Entry marker: a chevron at the edge, pointing where the bot will fly.
      const angle = Math.atan2(bot.vy, bot.vx);
      const beat = view.reduced ? 1 : 0.5 + 0.5 * Math.abs(Math.sin(bot.warn * 12));
      ctx.save();
      ctx.translate(bot.markerX, bot.markerY);
      ctx.rotate(angle);
      ctx.globalAlpha = beat;
      ctx.strokeStyle = COLOR.danger;
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(-7, -9);
      ctx.lineTo(4, 0);
      ctx.lineTo(-7, 9);
      ctx.stroke();
      ctx.restore();
      return;
    }

    this.stamp(glow.danger, bot.x, bot.y, 38, 0.8);
    const size = 56;
    const source = botSprite.width;
    const tick = view.reduced ? 0 : Math.floor(view.now * 14);
    const slices = 5;

    for (let i = 0; i < slices; i++) {
      // A cheap repeatable noise, so each band jumps on its own beat.
      const seed = Math.sin((tick + bot.id * 7.13) * 12.9898 + i * 78.233) * 43758.5453;
      const noise = seed - Math.floor(seed);
      const burst = tick % 9 < 2 ? 9 : 2.5;
      const shift = view.reduced ? 0 : (noise - 0.5) * burst;
      const sy = (source / slices) * i;
      const dy = (size / slices) * i;
      ctx.drawImage(
        botSprite,
        0,
        sy,
        source,
        source / slices,
        bot.x - size / 2 + shift,
        bot.y - size / 2 + dy,
        size,
        size / slices,
      );
    }
  }

  private drawTrap(trap: Trap, view: View): void {
    const { ctx } = this;
    const stage = trapStage(trap);
    const label = trap.kind === "rug" ? "RUG TRAP" : "FAILED TX";

    ctx.save();
    ctx.translate(trap.x, trap.y);

    if (stage === "telegraph") {
      const progress = trap.age / trap.telegraph;
      const beat = view.reduced ? 0.8 : 0.55 + 0.45 * Math.abs(Math.sin(trap.age * 9));
      // The footprint fills as the fuse burns, so the player can read the time left.
      ctx.fillStyle = "rgba(255, 59, 78, 0.1)";
      if (trap.axis === "x") ctx.fillRect(-trap.halfW, -trap.halfH * progress, trap.halfW * 2, trap.halfH * 2 * progress);
      else if (trap.axis === "y") ctx.fillRect(-trap.halfW * progress, -trap.halfH, trap.halfW * 2 * progress, trap.halfH * 2);
      else ctx.fillRect(-trap.halfW * progress, -trap.halfH * progress, trap.halfW * 2 * progress, trap.halfH * 2 * progress);

      ctx.globalAlpha = beat;
      ctx.strokeStyle = COLOR.danger;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(-trap.halfW, -trap.halfH, trap.halfW * 2, trap.halfH * 2);
      ctx.setLineDash([]);

      ctx.globalAlpha = 1;
      ctx.font = `700 12px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = COLOR.bg;
      const textWidth = ctx.measureText(label).width + 12;
      ctx.fillRect(-textWidth / 2, -10, textWidth, 20);
      ctx.fillStyle = COLOR.danger;
      ctx.fillText(label, 0, 0.5);
      ctx.restore();
      return;
    }

    // The footprint stays marked while the grid grows, so its final reach is never a surprise.
    if (stage === "expand") {
      ctx.strokeStyle = COLOR.danger;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(-trap.halfW, -trap.halfH, trap.halfW * 2, trap.halfH * 2);
      ctx.setLineDash([]);
    }

    const { halfW, halfH } = trapExtent(trap);
    const alpha = stage === "fade" ? halfW / trap.halfW : 1;
    const fade = trap.axis === "x" ? halfH / trap.halfH : trap.axis === "y" ? halfW / trap.halfW : alpha;
    ctx.globalAlpha = stage === "fade" ? fade : 1;

    ctx.fillStyle = "rgba(255, 59, 78, 0.17)";
    ctx.fillRect(-halfW, -halfH, halfW * 2, halfH * 2);

    // The lattice grows out from the centre with the grid.
    const cell = 22;
    ctx.strokeStyle = "rgba(255, 59, 78, 0.75)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= halfW; x += cell) {
      ctx.moveTo(x, -halfH);
      ctx.lineTo(x, halfH);
      ctx.moveTo(-x, -halfH);
      ctx.lineTo(-x, halfH);
    }
    for (let y = 0; y <= halfH; y += cell) {
      ctx.moveTo(-halfW, y);
      ctx.lineTo(halfW, y);
      ctx.moveTo(-halfW, -y);
      ctx.lineTo(halfW, -y);
    }
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 59, 78, 0.3)";
    ctx.lineWidth = 7;
    ctx.strokeRect(-halfW, -halfH, halfW * 2, halfH * 2);
    ctx.strokeStyle = COLOR.white;
    ctx.lineWidth = 2;
    ctx.strokeRect(-halfW, -halfH, halfW * 2, halfH * 2);
    ctx.restore();
  }

  private drawTrail(trail: readonly Vec[]): void {
    const { ctx } = this;
    if (trail.length < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    // Butt caps: round ones overlap under additive blending and turn the trail into beads.
    ctx.lineCap = "butt";
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1] as Vec;
      const b = trail[i] as Vec;
      const t = i / trail.length;
      ctx.strokeStyle = `rgba(0, 255, 204, ${t * t * 0.85})`;
      ctx.lineWidth = 1 + t * 12;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawPlayer(state: GameState, view: View): void {
    const { ctx, glow } = this;
    if (!glow) return;
    const p = state.player;

    this.stamp(glow.accent, p.x, p.y, 44, 0.85);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.heading);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Ears.
    ctx.strokeStyle = COLOR.accent;
    ctx.fillStyle = "#06332b";
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(-3, side * 12, 7, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }

    // Whiskers.
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    for (const side of [-1, 1]) {
      ctx.moveTo(11, side * 3);
      ctx.lineTo(20, side * 10);
      ctx.moveTo(11, side * 2);
      ctx.lineTo(22, side * 4);
    }
    ctx.stroke();

    // Body: a faceted wedge with the nose along the heading.
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(6, -10);
    ctx.lineTo(-11, -10);
    ctx.lineTo(-17, 0);
    ctx.lineTo(-11, 10);
    ctx.lineTo(6, 10);
    ctx.closePath();
    ctx.fillStyle = "#0b1d1a";
    ctx.fill();
    ctx.strokeStyle = COLOR.white;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Circuit stripe, pixel eyes and nose.
    ctx.strokeStyle = COLOR.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(1, 0);
    ctx.stroke();
    ctx.fillStyle = COLOR.accent;
    ctx.fillRect(6, -6, 3.5, 3.5);
    ctx.fillRect(6, 2.5, 3.5, 3.5);
    ctx.fillStyle = COLOR.white;
    ctx.fillRect(17, -1.5, 3, 3);
    ctx.restore();

    if (state.shieldTimer > 0) {
      const left = state.shieldTimer;
      const blink = left < 1.2 && !view.reduced ? 0.4 + 0.6 * Math.abs(Math.sin(left * 10)) : 1;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalAlpha = blink;
      this.stamp(glow.shield, 0, 0, 56, 0.7 * blink);
      ctx.save();
      ctx.rotate(view.reduced ? 0 : view.now * 1.4);
      hexPath(ctx, 31);
      ctx.fillStyle = "rgba(77, 157, 255, 0.1)";
      ctx.fill();
      ctx.strokeStyle = COLOR.shield;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
      // Countdown arc: the time left, readable without looking at any number.
      ctx.strokeStyle = COLOR.white;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(0, 0, 37, -Math.PI / 2, -Math.PI / 2 + TAU * (left / SHIELD_SECONDS));
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawFx(fx: Fx): void {
    const { ctx } = this;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of fx.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    for (const ring of fx.rings) {
      const t = ring.age / ring.max;
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 2.5 * (1 - t) + 0.5;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, 8 + ring.radius * (1 - (1 - t) * (1 - t)), 0, TAU);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.font = `700 14px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const floater of fx.floaters) {
      ctx.globalAlpha = Math.min(1, (0.85 - floater.age) / 0.3);
      ctx.fillStyle = floater.color;
      ctx.fillText(floater.text, floater.x, floater.y);
    }
    ctx.restore();
  }

  /** A slim band at the top of the field. The plate stays see-through, so it never hides a hazard. */
  private drawBanner(state: GameState, title: string, detail: string, age: number, max: number): void {
    const { ctx, width } = this;
    const { y0, y1 } = state.bounds;
    const fadeIn = Math.min(1, age / 0.15);
    const fadeOut = Math.min(1, (max - age) / 0.35);
    // Monospace glyphs are 0.6em wide, so this keeps the longest rank name on screen at any width.
    const size = Math.min(28, (width - 24) / (detail.length * 0.6));
    const y = Math.min(y0 + 56, (y0 + y1) / 2);

    ctx.save();
    ctx.globalAlpha = Math.min(fadeIn, fadeOut);
    ctx.fillStyle = "rgba(8, 8, 8, 0.55)";
    ctx.fillRect(0, y - 38, width, 76);
    ctx.fillStyle = COLOR.accent;
    ctx.fillRect(0, y - 38, width, 1);
    ctx.fillRect(0, y + 37, width, 1);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 14px ${FONT}`;
    ctx.fillStyle = COLOR.accent;
    ctx.fillText(title, width / 2, y - 15);
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.fillStyle = COLOR.white;
    ctx.fillText(detail, width / 2, y + 12);
    ctx.restore();
  }
}

