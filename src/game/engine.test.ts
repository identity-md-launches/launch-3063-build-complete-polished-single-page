import { describe, expect, it } from "vitest";
import { BOT, DEATH_SECONDS, GRACE_SECONDS, RANKS, SCORE, SHIELD_SECONDS, TRAP, difficulty, rankFor, rankProgress } from "./config";
import { createState, drainEvents, step, trapExtent, trapIsLethal, trapStage } from "./engine";
import { createRng } from "./rng";
import type { GameState, Pickup, PickupKind, Steering, Trap } from "./types";

const still: Steering = { axisX: 0, axisY: 0, target: null };
const bounds = { x0: 0, y0: 80, x1: 800, y1: 700 };
const DT = 1 / 120;

function newRun(): GameState {
  return createState(800, 700, bounds, "playing");
}

function place(state: GameState, kind: PickupKind): Pickup {
  const pickup: Pickup = { id: state.nextId++, kind, x: state.player.x, y: state.player.y, radius: 10, age: 0, life: 9 };
  state.pickups.push(pickup);
  return pickup;
}

function run(state: GameState, seconds: number, input: Steering = still, seed = 1): void {
  const rng = createRng(seed);
  for (let t = 0; t < seconds; t += DT) step(state, DT, input, rng);
}

function trap(overrides: Partial<Trap> = {}): Trap {
  return { id: 99, kind: "rug", x: 400, y: 400, halfW: 80, halfH: 80, axis: null, age: 0, telegraph: 1, ...overrides };
}

describe("rank ladder", () => {
  it("matches the brief's thresholds at every boundary", () => {
    const cases: [number, string][] = [
      [0, "Signed Up"],
      [199, "Signed Up"],
      [200, "The Tester"],
      [499, "The Tester"],
      [500, "The Recruitooor"],
      [999, "The Recruitooor"],
      [1000, "The Buildooooor"],
      [2499, "The Buildooooor"],
      [2500, "The Ringleader (Genesis WL)"],
      [99999, "The Ringleader (Genesis WL)"],
    ];
    for (const [score, name] of cases) expect(rankFor(score).name).toBe(name);
  });

  it("reports progress to the next rank and full at the top", () => {
    expect(rankProgress(0)).toBe(0);
    expect(rankProgress(100)).toBe(0.5);
    expect(rankProgress(5000)).toBe(1);
  });
});

describe("scoring", () => {
  it("awards 10 Aura for an orb", () => {
    const state = newRun();
    place(state, "orb");
    step(state, DT, still, createRng(1));
    expect(state.score).toBe(10);
  });

  it("awards 50 Aura for cheese and raises the multiplier", () => {
    const state = newRun();
    place(state, "cheese");
    step(state, DT, still, createRng(1));
    expect(state.score).toBe(50);
    expect(state.multiplier).toBe(2);
  });

  it("applies the multiplier to later pickups", () => {
    const state = newRun();
    state.multiplier = 3;
    state.multiplierTimer = 5;
    place(state, "orb");
    step(state, DT, still, createRng(1));
    expect(state.score).toBe(30);
  });

  it("caps the multiplier at 5x", () => {
    const state = newRun();
    state.multiplier = 5;
    state.multiplierTimer = 5;
    place(state, "cheese");
    step(state, DT, still, createRng(1));
    expect(state.multiplier).toBe(SCORE.multiplierMax);
  });

  it("drops the multiplier one step after the hold time, never below 1x", () => {
    const state = newRun();
    state.multiplier = 2;
    state.multiplierTimer = 0.05;
    state.bots = [];
    run(state, 0.1);
    expect(state.multiplier).toBe(1);
    expect(state.multiplierTimer).toBe(0);
  });

  it("raises a rank-up event when Aura crosses a threshold", () => {
    const state = newRun();
    state.score = 195;
    place(state, "orb");
    step(state, DT, still, createRng(1));
    expect(drainEvents(state)).toContainEqual({ type: "rankUp", rankIndex: 1 });
    expect(state.rankIndex).toBe(1);
  });
});

describe("shield", () => {
  it("lasts five seconds", () => {
    const state = newRun();
    place(state, "shield");
    state.timers.bot = 99;
    state.timers.trap = 99;
    step(state, DT, still, createRng(1));
    expect(state.shieldTimer).toBeCloseTo(SHIELD_SECONDS, 1);
    run(state, SHIELD_SECONDS - 0.2);
    expect(state.shieldTimer).toBeGreaterThan(0);
    run(state, 0.3);
    expect(state.shieldTimer).toBe(0);
  });

  it("destroys a bot on contact instead of ending the run", () => {
    const state = newRun();
    state.shieldTimer = 3;
    const { x, y } = state.player;
    state.bots.push({ id: 7, x, y, vx: 0, vy: 0, radius: BOT.radius, age: 0, warn: 0, wobble: 0, phase: 0, markerX: 0, markerY: 0 });
    step(state, DT, still, createRng(1));
    expect(state.phase).toBe("playing");
    expect(state.bots).toHaveLength(0);
  });

  it("walks through a live laser grid", () => {
    const state = newRun();
    state.shieldTimer = 3;
    state.traps.push(trap({ x: state.player.x, y: state.player.y, age: 1.3 }));
    step(state, DT, still, createRng(1));
    expect(state.phase).toBe("playing");
  });
});

describe("obstacles", () => {
  it("ends the run when a bot connects, after the crash plays out", () => {
    const state = newRun();
    const { x, y } = state.player;
    state.bots.push({ id: 7, x, y, vx: 0, vy: 0, radius: BOT.radius, age: 0, warn: 0, wobble: 0, phase: 0, markerX: 0, markerY: 0 });
    step(state, DT, still, createRng(1));
    expect(state.phase).toBe("dying");
    expect(state.cause).toBe("bot");
    run(state, DEATH_SECONDS + 0.05);
    expect(state.phase).toBe("over");
  });

  it("ignores a bot that is still only an entry marker", () => {
    const state = newRun();
    const { x, y } = state.player;
    state.bots.push({ id: 7, x, y, vx: 0, vy: 0, radius: BOT.radius, age: 0, warn: 0.5, wobble: 0, phase: 0, markerX: 0, markerY: 0 });
    step(state, DT, still, createRng(1));
    expect(state.phase).toBe("playing");
  });

  it("runs a laser grid through warning, expansion, hold and fade", () => {
    const t = trap({ telegraph: 1 });
    expect(trapStage(t)).toBe("telegraph");
    expect(trapIsLethal(t)).toBe(false);
    expect(trapExtent(t).halfW).toBe(0);

    t.age = 1 + TRAP.expand / 2;
    expect(trapStage(t)).toBe("expand");
    expect(trapIsLethal(t)).toBe(true);
    const mid = trapExtent(t).halfW;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(80);

    t.age = 1 + TRAP.expand + 0.1;
    expect(trapStage(t)).toBe("hold");
    expect(trapExtent(t).halfW).toBe(80);

    t.age = 1 + TRAP.expand + TRAP.hold + 0.1;
    expect(trapStage(t)).toBe("fade");
    expect(trapIsLethal(t)).toBe(false);

    t.age = 1 + TRAP.expand + TRAP.hold + TRAP.fade + 0.1;
    expect(trapStage(t)).toBe("done");
  });

  it("keeps a failed TX beam full length while its width grows", () => {
    const t = trap({ kind: "failedTx", axis: "x", halfW: 500, halfH: 30, age: 1 + TRAP.expand / 2 });
    const extent = trapExtent(t);
    expect(extent.halfW).toBe(500);
    expect(extent.halfH).toBeLessThan(30);
  });

  it("ends the run inside a live grid but not during its warning", () => {
    const warned = newRun();
    warned.timers.bot = 99;
    warned.traps.push(trap({ x: warned.player.x, y: warned.player.y }));
    step(warned, DT, still, createRng(1));
    expect(warned.phase).toBe("playing");

    const live = newRun();
    live.traps.push(trap({ x: live.player.x, y: live.player.y, age: 1.5 }));
    step(live, DT, still, createRng(1));
    expect(live.phase).toBe("dying");
    expect(live.cause).toBe("rug");
  });

  it("spawns nothing dangerous during the opening grace period", () => {
    const state = newRun();
    run(state, GRACE_SECONDS - 0.1);
    expect(state.bots).toHaveLength(0);
    expect(state.traps).toHaveLength(0);
  });

  it("keeps a rug trap inside the field and narrower than 80% of it", () => {
    for (let seed = 1; seed < 40; seed++) {
      const state = newRun();
      state.score = 3000;
      state.timers.trap = 0;
      state.timers.bot = 99;
      const rng = createRng(seed);
      for (let i = 0; i < 3 && state.traps.length === 0; i++) step(state, DT, still, rng);
      const made = state.traps[0];
      if (!made || made.kind !== "rug") continue;
      expect(made.x - made.halfW).toBeGreaterThanOrEqual(bounds.x0);
      expect(made.x + made.halfW).toBeLessThanOrEqual(bounds.x1);
      expect(made.halfW * 2).toBeLessThanOrEqual((bounds.y1 - bounds.y0) * 0.8);
    }
  });
});

describe("difficulty", () => {
  it("speeds up and spawns faster as Aura grows", () => {
    const scores = [0, 200, 500, 1000, 2500, 6000];
    for (let i = 1; i < scores.length; i++) {
      const before = difficulty(scores[i - 1] as number);
      const after = difficulty(scores[i] as number);
      expect(after.speed).toBeGreaterThan(before.speed);
      expect(after.botInterval).toBeLessThan(before.botInterval);
      expect(after.trapInterval).toBeLessThan(before.trapInterval);
    }
  });

  it("stays playable at any score", () => {
    const top = difficulty(1e9);
    expect(top.botInterval).toBeGreaterThan(0.3);
    expect(top.telegraph).toBeGreaterThanOrEqual(TRAP.telegraph.hard);
  });
});

describe("movement", () => {
  it("moves with the keyboard and stops at the field edge", () => {
    const state = newRun();
    state.timers.bot = 99;
    state.timers.trap = 99;
    run(state, 3, { axisX: 1, axisY: 0, target: null });
    expect(state.player.x).toBe(bounds.x1 - state.player.radius);
  });

  it("does not move faster on a diagonal", () => {
    const state = newRun();
    state.timers.bot = 99;
    state.timers.trap = 99;
    run(state, 0.5, { axisX: 1, axisY: 1, target: null });
    const diagonal = Math.hypot(state.player.vx, state.player.vy);
    const straight = newRun();
    straight.timers.bot = 99;
    straight.timers.trap = 99;
    run(straight, 0.5, { axisX: 1, axisY: 0, target: null });
    expect(diagonal).toBeCloseTo(Math.hypot(straight.player.vx, straight.player.vy), 0);
  });

  it("settles on a pointer target", () => {
    const state = newRun();
    state.timers.bot = 99;
    state.timers.trap = 99;
    run(state, 2, { axisX: 0, axisY: 0, target: { x: 200, y: 300 } });
    expect(Math.hypot(state.player.x - 200, state.player.y - 300)).toBeLessThan(2);
  });
});

describe("start screen", () => {
  it("never scores or raises hazards", () => {
    const state = createState(800, 700, bounds, "attract");
    run(state, 20, { axisX: 0, axisY: 0, target: { x: 300, y: 300 } });
    expect(state.score).toBe(0);
    expect(state.bots).toHaveLength(0);
    expect(state.traps).toHaveLength(0);
    expect(RANKS[state.rankIndex]?.name).toBe("Signed Up");
  });
});
