// Owns the frame loop and joins the engine to the renderer, effects, audio and the React shell.

import { Synth } from "./audio";
import { RANKS, SCORE, rankProgress, type RankTier } from "./config";
import { createState, drainEvents, resizeState, step } from "./engine";
import { CRASH_COLORS, Fx } from "./fx";
import { Input } from "./input";
import { COLOR } from "./palette";
import { Renderer } from "./renderer";
import { createRng, type Rng } from "./rng";
import type { GameEvent, GameState, HitCause, Rect, Steering, Vec } from "./types";

/** The simulation never advances more than this per slice, so fast hazards cannot skip past the mouse. */
const MAX_SLICE = 1 / 120;
/** A frame longer than this (a stalled tab) is cut short rather than simulated. */
const MAX_FRAME = 0.05;
const TRAIL_LENGTH = 30;
const RESUME_HOLD = 1;

export interface HudSnapshot {
  score: number;
  multiplier: number;
  /** Share of the current multiplier step left, 0 to 1. */
  multiplierLeft: number;
  rankIndex: number;
  rankProgress: number;
}

export interface RunResult {
  score: number;
  rank: RankTier;
  cause: HitCause;
}

export interface RuntimeEvents {
  onHud: (hud: HudSnapshot) => void;
  onRankUp: (rank: RankTier) => void;
  onGameOver: (result: RunResult) => void;
}

export const EMPTY_HUD: HudSnapshot = {
  score: 0,
  multiplier: 1,
  multiplierLeft: 0,
  rankIndex: 0,
  rankProgress: 0,
};

export class GameRuntime {
  private readonly renderer: Renderer;
  private readonly fx: Fx;
  private readonly input: Input;
  private readonly synth: Synth;
  private readonly reduced: boolean;
  private rng: Rng;
  private state: GameState;
  private width = 0;
  private height = 0;
  private hudHeight = 0;
  private freeRect: Rect | null = null;
  private frameId = 0;
  private lastFrame = 0;
  private now = 0;
  private flow = 0;
  private paused = false;
  private resuming = 0;
  private trail: Vec[] = [];
  private hud: HudSnapshot = EMPTY_HUD;
  private readonly observer: ResizeObserver;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly surface: HTMLElement,
    private readonly events: RuntimeEvents,
    options: { muted: boolean; reduced: boolean; seed?: number },
  ) {
    this.reduced = options.reduced;
    this.renderer = new Renderer(canvas);
    this.fx = new Fx(options.reduced);
    this.synth = new Synth(options.muted);
    this.rng = createRng(options.seed ?? (Math.random() * 2 ** 32) >>> 0);
    this.state = createState(1, 1, { x0: 0, y0: 0, x1: 1, y1: 1 });
    this.input = new Input(surface, () => this.state.player);

    this.observer = new ResizeObserver(() => this.measure());
    this.observer.observe(surface);
    this.measure();
    this.frameId = requestAnimationFrame(this.frame);
  }

  /** Space the HUD takes at the top of the stage. The mouse and pickups stay below it. */
  setHudHeight(height: number): void {
    this.hudHeight = height;
    this.applyBounds();
  }

  /** The part of the stage the start screen leaves open, or null during a run. */
  setFreeRect(rect: Rect | null): void {
    this.freeRect = rect;
    this.applyBounds();
  }

  private fieldBounds(): Rect {
    const pad = 6;
    return { x0: pad, y0: this.hudHeight + pad, x1: this.width - pad, y1: this.height - pad };
  }

  private applyBounds(): void {
    if (this.width === 0) return;
    const field = this.fieldBounds();
    const bounds = this.state.phase === "attract" && this.freeRect ? this.freeRect : field;
    resizeState(this.state, this.width, this.height, bounds);
  }

  private measure(): void {
    const { width, height } = this.surface.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    this.width = width;
    this.height = height;
    this.renderer.resize(width, height, Math.min(window.devicePixelRatio || 1, 2));
    if (this.state.stage.width === 1) {
      this.state = createState(width, height, this.fieldBounds());
    }
    this.applyBounds();
  }

  /** Call from the click or key that starts the run, so audio is allowed to play. */
  startRun(): void {
    this.synth.unlock();
    this.freeRect = null;
    this.state = createState(this.width, this.height, this.fieldBounds(), "playing");
    this.fx.reset();
    this.input.reset();
    this.input.captureKeys = true;
    this.trail = [];
    this.paused = false;
    this.resuming = 0;
    this.publishHud();
  }

  pause(): void {
    this.paused = true;
    this.input.reset();
  }

  resume(): void {
    this.synth.unlock();
    this.paused = false;
    this.resuming = RESUME_HOLD;
  }

  setMuted(muted: boolean): void {
    this.synth.unlock();
    this.synth.setMuted(muted);
  }

  /** Read-only view for automated checks. See the #qa note in the README. */
  inspect(): { state: GameState; fx: Fx; width: number; height: number } {
    return { state: this.state, fx: this.fx, width: this.width, height: this.height };
  }

  /** Test-only score grant, reachable through #qa alone. */
  grant(points: number): void {
    this.state.score += points;
    const before = this.state.rankIndex;
    this.state.rankIndex = RANKS.reduce((index, rank, i) => (this.state.score >= rank.min ? i : index), 0);
    if (this.state.rankIndex > before) this.handle({ type: "rankUp", rankIndex: this.state.rankIndex });
    this.publishHud();
  }

  private readonly frame = (time: number) => {
    this.frameId = requestAnimationFrame(this.frame);
    const dt = this.lastFrame ? Math.min(MAX_FRAME, (time - this.lastFrame) / 1000) : 0;
    this.lastFrame = time;
    this.now = time / 1000;

    if (!this.paused) {
      this.flow += dt * this.flowRate();
      if (this.resuming > 0) {
        this.resuming = Math.max(0, this.resuming - dt);
      } else {
        this.advance(dt);
      }
      this.fx.update(dt);
      this.sampleTrail();
    }

    this.renderer.render(this.state, this.fx, {
      now: this.reduced ? 0 : this.now,
      flow: this.flow,
      trail: this.trail,
      hidePlayer: this.hidePlayer(),
      resuming: this.paused ? 0 : this.resuming,
      reduced: this.reduced,
    });
  };

  private hidePlayer(): boolean {
    const { phase, bounds } = this.state;
    if (phase === "dying" || phase === "over") return true;
    // A short landscape screen leaves no open area on the start screen, and the mouse would sit under the HUD.
    return phase === "attract" && bounds.y1 - bounds.y0 < 48;
  }

  private flowRate(): number {
    return 1 + Math.min(2, this.state.score / 1200);
  }

  private advance(dt: number): void {
    const input = this.steering();
    let left = dt;
    while (left > 0) {
      const slice = Math.min(MAX_SLICE, left);
      step(this.state, slice, input, this.rng);
      left -= slice;
    }
    for (const event of drainEvents(this.state)) this.handle(event);
    this.publishHud();
  }

  /** On the start screen the mouse chases orbs by itself until someone takes over. */
  private steering(): Steering {
    const input = this.input.read();
    const idle = performance.now() - this.input.lastActive > 2500;
    if (this.state.phase !== "attract" || !idle || this.reduced) return input;
    const { player, pickups } = this.state;
    let nearest: Vec | null = null;
    let best = Infinity;
    for (const item of pickups) {
      const distance = (item.x - player.x) ** 2 + (item.y - player.y) ** 2;
      if (distance < best) {
        best = distance;
        nearest = item;
      }
    }
    return { axisX: 0, axisY: 0, target: nearest };
  }

  private sampleTrail(): void {
    const { player, phase } = this.state;
    if (phase === "dying" || phase === "over") {
      this.trail.shift();
    } else {
      const last = this.trail[this.trail.length - 1];
      const moved = !last || Math.hypot(last.x - player.x, last.y - player.y) > 0.5;
      if (moved) this.trail.push({ x: player.x, y: player.y });
      else this.trail.shift();
      if (this.trail.length > TRAIL_LENGTH) this.trail.shift();
    }
  }

  private handle(event: GameEvent): void {
    const { fx, synth } = this;
    const live = this.state.phase !== "attract";
    switch (event.type) {
      case "orb":
        fx.burst(event.x, event.y, 16, COLOR.accent, 240, 0.5);
        fx.ring(event.x, event.y, COLOR.accent);
        if (live) {
          fx.float(event.x, event.y - 14, `+${event.points}`, COLOR.accent);
          synth.orb(event.combo);
        }
        break;
      case "cheese":
        fx.burst(event.x, event.y, 30, COLOR.gold, 300, 0.7);
        fx.ring(event.x, event.y, COLOR.gold, 60, 0.5);
        fx.float(event.x, event.y - 16, `+${event.points}  ${event.multiplier}x`, COLOR.gold);
        synth.cheese();
        break;
      case "shield":
        fx.burst(event.x, event.y, 24, COLOR.shield, 260, 0.6);
        fx.ring(event.x, event.y, COLOR.shield, 70, 0.5);
        fx.float(event.x, event.y - 16, "SHIELD 5s", COLOR.shield);
        synth.shield();
        break;
      case "shieldBlock":
        fx.burst(event.x, event.y, 26, COLOR.danger, 300, 0.5);
        fx.ring(event.x, event.y, COLOR.shield, 56);
        fx.impact(7);
        synth.shieldBlock();
        break;
      case "rankUp": {
        const rank = RANKS[event.rankIndex] as RankTier;
        const { x, y } = this.state.player;
        fx.burst(x, y, 44, COLOR.accent, 380, 0.9);
        fx.ring(x, y, COLOR.white, 130, 0.7);
        fx.announce("Rank up", rank.name);
        synth.rankUp();
        this.events.onRankUp(rank);
        break;
      }
      case "trapArmed":
        synth.trapArmed();
        break;
      case "trapLive":
        synth.trapLive();
        break;
      case "crash":
        CRASH_COLORS.forEach((color) => fx.burst(event.x, event.y, 34, color, 460, 1));
        fx.ring(event.x, event.y, COLOR.danger, 170, 0.7);
        fx.ring(event.x, event.y, COLOR.white, 100, 0.5);
        fx.impact(20);
        synth.crash();
        break;
      case "gameOver":
        this.input.captureKeys = false;
        synth.gameOver();
        this.events.onGameOver({
          score: this.state.score,
          rank: RANKS[this.state.rankIndex] as RankTier,
          cause: event.cause,
        });
        break;
      case "shieldEnd":
      case "multiplierDown":
        break;
    }
  }

  private publishHud(): void {
    const { score, multiplier, multiplierTimer, rankIndex } = this.state;
    const next: HudSnapshot = {
      score,
      multiplier,
      // Rounded to 2% steps, so the bar drains smoothly without re-rendering React every frame.
      multiplierLeft: Math.round((multiplierTimer / SCORE.multiplierHold) * 50) / 50,
      rankIndex,
      rankProgress: rankProgress(score),
    };
    const prev = this.hud;
    if (
      next.score !== prev.score ||
      next.multiplier !== prev.multiplier ||
      next.multiplierLeft !== prev.multiplierLeft ||
      next.rankIndex !== prev.rankIndex
    ) {
      this.hud = next;
      this.events.onHud(next);
    }
  }

  destroy(): void {
    cancelAnimationFrame(this.frameId);
    this.observer.disconnect();
    this.input.destroy();
    this.synth.dispose();
  }
}
