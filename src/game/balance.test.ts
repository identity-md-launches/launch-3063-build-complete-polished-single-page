// Plays many whole runs with a simple steering bot, to catch a balance change that makes the game
// unfair (dead within seconds) or toothless (never ending). It reacts about as well as a casual player.

import { describe, expect, it } from "vitest";
import { RANKS, difficulty } from "./config";
import { createState, step, trapExtent, trapStage } from "./engine";
import { createRng } from "./rng";
import type { GameState, Steering } from "./types";

function steerBot(state: GameState): Steering {
  const { player: p, bounds } = state;
  let x = p.x;
  let y = p.y;
  let best = Infinity;
  for (const item of state.pickups) {
    const distance = Math.hypot(item.x - p.x, item.y - p.y) * (item.kind === "orb" ? 1 : 0.5);
    if (distance < best) [best, x, y] = [distance, item.x, item.y];
  }
  for (const trap of state.traps) {
    const margin = 30;
    // The marked footprint is the danger until the grid fades, exactly as a player sees it.
    const fading = trapStage(trap) === "fade";
    const halfW = fading ? trapExtent(trap).halfW : trap.halfW;
    const halfH = fading ? trapExtent(trap).halfH : trap.halfH;
    if (Math.abs(p.x - trap.x) < halfW + margin && Math.abs(p.y - trap.y) < halfH + margin) {
      const exits = [
        { x: trap.x - halfW - margin - 12, y: p.y },
        { x: trap.x + halfW + margin + 12, y: p.y },
        { x: p.x, y: trap.y - halfH - margin - 12 },
        { x: p.x, y: trap.y + halfH + margin + 12 },
      ]
        .filter((e) => e.x > bounds.x0 + 16 && e.x < bounds.x1 - 16 && e.y > bounds.y0 + 16 && e.y < bounds.y1 - 16)
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
      if (exits[0]) [x, y] = [exits[0].x, exits[0].y];
    }
  }
  for (const bot of state.bots) {
    if (bot.warn > 0) continue;
    const distance = Math.hypot(bot.x - p.x, bot.y - p.y);
    if (distance < 120) {
      const push = (120 - distance) * 3;
      x += ((p.x - bot.x) / (distance || 1)) * push;
      y += ((p.y - bot.y) / (distance || 1)) * push;
    }
  }
  return { axisX: 0, axisY: 0, target: { x, y } };
}

function play(width: number, height: number, top: number, seed: number) {
  const state = createState(width, height, { x0: 6, y0: top, x1: width - 6, y1: height - 6 }, "playing");
  const rng = createRng(seed);
  const dt = 1 / 120;
  let input = steerBot(state);
  let tick = 0;
  // The bot re-plans 15 times a second: a human-ish reaction, not a frame-perfect one.
  while (state.phase === "playing" && state.time < 600) {
    if (tick++ % 8 === 0) input = steerBot(state);
    step(state, dt, input, rng);
    state.events.length = 0;
  }
  return { time: state.time, score: state.score, cause: state.cause };
}

function median(values: number[]): number {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] as number;
}

const STAGES = [
  ["phone", 390, 747, 118],
  ["small phone", 320, 603, 113],
  ["desktop", 1440, 839, 68],
] as const;

describe("balance", () => {
  for (const [name, width, height, top] of STAGES) {
    it(`gives a fair run on a ${name} stage`, () => {
      const runs = Array.from({ length: 60 }, (_, i) => play(width, height, top, i + 1));
      const times = runs.map((run) => run.time);
      const scores = runs.map((run) => run.score);
      const causes: Record<string, number> = {};
      for (const run of runs) causes[run.cause ?? "none"] = (causes[run.cause ?? "none"] ?? 0) + 1;
      const report = { medianSeconds: median(times), medianScore: median(scores), best: Math.max(...scores), causes };
      console.log(`${name}: ${JSON.stringify(report)}`);

      // Nobody is dead before the first obstacles have had a fair crossing.
      expect(Math.min(...times)).toBeGreaterThan(3);
      // A casual run lasts long enough to matter and reaches the first rank.
      expect(report.medianSeconds).toBeGreaterThan(12);
      expect(report.medianScore).toBeGreaterThanOrEqual(RANKS[1]?.min ?? 0);
      // Pressure wins in the end: survival is not guaranteed.
      expect(report.medianSeconds).toBeLessThan(400);
    });
  }

  it("rises steadily rather than in one step", () => {
    const start = difficulty(0).speed;
    const quarter = difficulty(500).speed;
    const late = difficulty(2500).speed;
    expect(quarter - start).toBeGreaterThan(0.2);
    expect(late - quarter).toBeGreaterThan(0.2);
  });
});
