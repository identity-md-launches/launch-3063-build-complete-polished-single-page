// The rules of the game, with no canvas, audio or DOM in them, so they can be tested directly.
// The runtime calls step() with small time slices and drains state.events for sound and effects.

import {
  BOT,
  DEATH_SECONDS,
  DEATH_TIME_SCALE,
  GRACE_SECONDS,
  PICKUP,
  PLAYER,
  SCORE,
  SHIELD_SECONDS,
  TRAP,
  difficulty,
  rankIndexFor,
} from "./config";
import { between, type Rng } from "./rng";
import type { Bot, GameState, HitCause, Pickup, PickupKind, Rect, Steering, Trap, TrapKind, TrapStage } from "./types";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Shrinks hazards on small stages and spreads them on large ones. */
export function stageScale(state: GameState): number {
  return clamp(Math.sqrt(state.stage.width * state.stage.height) / 800, 0.62, 1.25);
}

export function createState(width: number, height: number, bounds: Rect, phase: GameState["phase"] = "attract"): GameState {
  return {
    phase,
    time: 0,
    score: 0,
    multiplier: 1,
    multiplierTimer: 0,
    shieldTimer: 0,
    rankIndex: 0,
    combo: 0,
    comboTimer: 0,
    cause: null,
    deathTimer: 0,
    player: {
      x: (bounds.x0 + bounds.x1) / 2,
      y: (bounds.y0 + bounds.y1) / 2,
      vx: 0,
      vy: 0,
      heading: -Math.PI / 2,
      radius: PLAYER.radius,
    },
    bounds,
    stage: { width, height },
    pickups: [],
    bots: [],
    traps: [],
    timers: {
      orb: 0.2,
      cheese: PICKUP.cheese.interval * 0.6,
      shield: PICKUP.shield.interval * 0.8,
      bot: GRACE_SECONDS,
      trap: GRACE_SECONDS + 3.5,
    },
    nextId: 1,
    events: [],
  };
}

/** Keeps a live run valid when the window resizes. */
export function resizeState(state: GameState, width: number, height: number, bounds: Rect): void {
  state.stage = { width, height };
  state.bounds = bounds;
  const p = state.player;
  p.x = clamp(p.x, bounds.x0 + p.radius, bounds.x1 - p.radius);
  p.y = clamp(p.y, bounds.y0 + p.radius, bounds.y1 - p.radius);
  for (const item of state.pickups) {
    item.x = clamp(item.x, bounds.x0 + item.radius, bounds.x1 - item.radius);
    item.y = clamp(item.y, bounds.y0 + item.radius, bounds.y1 - item.radius);
  }
}

export function trapStage(trap: Trap): TrapStage {
  let t = trap.age - trap.telegraph;
  if (t < 0) return "telegraph";
  if ((t -= TRAP.expand) < 0) return "expand";
  if ((t -= TRAP.hold) < 0) return "hold";
  if ((t -= TRAP.fade) < 0) return "fade";
  return "done";
}

/** The rectangle a trap covers right now. Empty while it is only a warning. */
export function trapExtent(trap: Trap): { halfW: number; halfH: number } {
  const stage = trapStage(trap);
  if (stage === "telegraph" || stage === "done") return { halfW: 0, halfH: 0 };
  let grow = 1;
  if (stage === "expand") {
    const t = (trap.age - trap.telegraph) / TRAP.expand;
    grow = 1 - (1 - t) * (1 - t);
  } else if (stage === "fade") {
    grow = 1 - (trap.age - trap.telegraph - TRAP.expand - TRAP.hold) / TRAP.fade;
  }
  if (trap.axis === "x") return { halfW: trap.halfW, halfH: trap.halfH * grow };
  if (trap.axis === "y") return { halfW: trap.halfW * grow, halfH: trap.halfH };
  return { halfW: trap.halfW * grow, halfH: trap.halfH * grow };
}

/** Only an expanding or holding grid can hit; a fading one is already harmless. */
export function trapIsLethal(trap: Trap): boolean {
  const stage = trapStage(trap);
  return stage === "expand" || stage === "hold";
}

function circleInRect(cx: number, cy: number, r: number, x: number, y: number, halfW: number, halfH: number): boolean {
  const dx = Math.max(Math.abs(cx - x) - halfW, 0);
  const dy = Math.max(Math.abs(cy - y) - halfH, 0);
  return dx * dx + dy * dy < r * r;
}

function addPickup(state: GameState, kind: PickupKind, rng: Rng): void {
  const spec = PICKUP[kind];
  const { x0, y0, x1, y1 } = state.bounds;
  const margin = spec.radius + 14;
  if (x1 - x0 <= margin * 2 || y1 - y0 <= margin * 2) return;
  // A few tries to land clear of the mouse, so nothing is collected the moment it appears.
  let x = 0;
  let y = 0;
  for (let attempt = 0; attempt < 6; attempt++) {
    x = between(rng, x0 + margin, x1 - margin);
    y = between(rng, y0 + margin, y1 - margin);
    if (Math.hypot(x - state.player.x, y - state.player.y) > 70) break;
  }
  const pickup: Pickup = { id: state.nextId++, kind, x, y, radius: spec.radius, age: 0, life: spec.life };
  state.pickups.push(pickup);
}

function spawnBots(state: GameState, rng: Rng): void {
  const { width, height } = state.stage;
  const { player, bounds } = state;
  const d = difficulty(state.score);
  const scale = stageScale(state);
  const off = BOT.radius + 16;

  // Enter from the edge farthest from a mouse hugging a wall, otherwise any edge.
  const edges = [0, 1, 2, 3].filter((edge) => {
    if (edge === 0) return player.y - bounds.y0 > 110;
    if (edge === 1) return bounds.x1 - player.x > 110;
    if (edge === 2) return bounds.y1 - player.y > 110;
    return player.x - bounds.x0 > 110;
  });
  const edge = edges[Math.floor(rng() * edges.length)] ?? 1;
  let x = 0;
  let y = 0;
  if (edge === 0) [x, y] = [between(rng, 0, width), -off];
  else if (edge === 1) [x, y] = [width + off, between(rng, bounds.y0, height)];
  else if (edge === 2) [x, y] = [between(rng, 0, width), height + off];
  else [x, y] = [-off, between(rng, bounds.y0, height)];

  // Aim near the mouse, not at it: the player reads a lane and steps out of it.
  const spread = 90 * scale;
  const aimX = player.x + between(rng, -spread, spread);
  const aimY = player.y + between(rng, -spread, spread);
  const length = Math.hypot(aimX - x, aimY - y) || 1;
  const dirX = (aimX - x) / length;
  const dirY = (aimY - y) / length;
  const speed = BOT.baseSpeed * d.speed * scale * between(rng, 0.9, 1.2);

  // Sybil attack: one operator, several identical clones flying in formation.
  const clones = 1 + Math.floor(rng() * d.maxClones);
  for (let i = 0; i < clones; i++) {
    const offset = (i - (clones - 1) / 2) * BOT.cloneGap;
    const bx = x - dirY * offset;
    const by = y + dirX * offset;
    const bot: Bot = {
      id: state.nextId++,
      x: bx,
      y: by,
      vx: dirX * speed,
      vy: dirY * speed,
      radius: BOT.radius,
      age: 0,
      warn: BOT.warning,
      wobble: rng() < 0.35 ? between(rng, 14, 34) : 0,
      phase: rng() * Math.PI * 2,
      markerX: clamp(bx, bounds.x0 + 14, bounds.x1 - 14),
      markerY: clamp(by, bounds.y0 + 14, bounds.y1 - 14),
    };
    state.bots.push(bot);
  }
}

function spawnTrap(state: GameState, rng: Rng): void {
  const d = difficulty(state.score);
  const scale = stageScale(state);
  const { bounds, player } = state;
  const fieldW = bounds.x1 - bounds.x0;
  const fieldH = bounds.y1 - bounds.y0;
  const kind: TrapKind = rng() < 0.55 ? "rug" : "failedTx";
  let trap: Trap;

  if (kind === "rug") {
    // Never wider than 40% of the field, so there is always a way out.
    const limit = Math.min(fieldW, fieldH) * 0.4;
    const half = Math.min(limit, between(rng, TRAP.rugHalf.min, TRAP.rugHalf.max) * scale * (1 + d.level * 0.3));
    const reach = 150 * scale;
    trap = {
      id: state.nextId++,
      kind,
      x: clamp(player.x + between(rng, -reach, reach), bounds.x0 + half, bounds.x1 - half),
      y: clamp(player.y + between(rng, -reach, reach), bounds.y0 + half, bounds.y1 - half),
      halfW: half,
      halfH: half,
      axis: null,
      age: 0,
      telegraph: d.telegraph,
    };
  } else {
    const thickness = between(rng, TRAP.failedHalf.min, TRAP.failedHalf.max) * Math.max(scale, 0.8);
    const horizontal = rng() < 0.5;
    const reach = 130 * scale;
    trap = {
      id: state.nextId++,
      kind,
      x: horizontal
        ? (bounds.x0 + bounds.x1) / 2
        : clamp(player.x + between(rng, -reach, reach), bounds.x0 + thickness, bounds.x1 - thickness),
      y: horizontal
        ? clamp(player.y + between(rng, -reach, reach), bounds.y0 + thickness, bounds.y1 - thickness)
        : (bounds.y0 + bounds.y1) / 2,
      halfW: horizontal ? fieldW / 2 + 40 : thickness,
      halfH: horizontal ? thickness : fieldH / 2 + 40,
      axis: horizontal ? "x" : "y",
      age: 0,
      telegraph: d.telegraph,
    };
  }
  state.traps.push(trap);
  state.events.push({ type: "trapArmed", kind });
}

function steer(state: GameState, input: Steering, dt: number): void {
  const p = state.player;
  const speed = PLAYER.baseSpeed * (1 + PLAYER.speedGain * difficulty(state.score).level) * Math.max(0.85, stageScale(state));
  let wantX = 0;
  let wantY = 0;

  if (input.axisX !== 0 || input.axisY !== 0) {
    const length = Math.hypot(input.axisX, input.axisY);
    wantX = (input.axisX / length) * speed;
    wantY = (input.axisY / length) * speed;
  } else if (input.target) {
    const dx = input.target.x - p.x;
    const dy = input.target.y - p.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 1) {
      const pace = Math.min(speed, distance * PLAYER.pointerGain);
      wantX = (dx / distance) * pace;
      wantY = (dy / distance) * pace;
    }
  }

  const blend = Math.min(1, dt * PLAYER.steering);
  p.vx += (wantX - p.vx) * blend;
  p.vy += (wantY - p.vy) * blend;
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  const { x0, y0, x1, y1 } = state.bounds;
  if (p.x < x0 + p.radius) [p.x, p.vx] = [x0 + p.radius, 0];
  if (p.x > x1 - p.radius) [p.x, p.vx] = [x1 - p.radius, 0];
  if (p.y < y0 + p.radius) [p.y, p.vy] = [y0 + p.radius, 0];
  if (p.y > y1 - p.radius) [p.y, p.vy] = [y1 - p.radius, 0];

  if (Math.hypot(p.vx, p.vy) > 18) p.heading = Math.atan2(p.vy, p.vx);
}

function award(state: GameState, points: number): void {
  state.score += points;
  const rankIndex = rankIndexFor(state.score);
  if (rankIndex > state.rankIndex) {
    state.rankIndex = rankIndex;
    state.events.push({ type: "rankUp", rankIndex });
  }
}

function collect(state: GameState, item: Pickup): void {
  if (item.kind === "orb") {
    const points = SCORE.orb * state.multiplier;
    state.combo = state.comboTimer > 0 ? state.combo + 1 : 0;
    state.comboTimer = 1.4;
    state.events.push({ type: "orb", x: item.x, y: item.y, points, combo: state.combo });
    award(state, points);
  } else if (item.kind === "cheese") {
    const points = SCORE.cheese * state.multiplier;
    state.multiplier = Math.min(SCORE.multiplierMax, state.multiplier + 1);
    state.multiplierTimer = SCORE.multiplierHold;
    state.events.push({ type: "cheese", x: item.x, y: item.y, points, multiplier: state.multiplier });
    award(state, points);
  } else {
    state.shieldTimer = SHIELD_SECONDS;
    state.events.push({ type: "shield", x: item.x, y: item.y });
  }
}

function crash(state: GameState, cause: HitCause): void {
  const { x, y } = state.player;
  state.phase = "dying";
  state.cause = cause;
  state.deathTimer = DEATH_SECONDS;
  state.events.push({ type: "crash", x, y, cause });
}

function stepPickups(state: GameState, dt: number, rng: Rng): void {
  const t = state.timers;
  t.orb -= dt;
  t.cheese -= dt;
  t.shield -= dt;

  const orbs = state.pickups.filter((item) => item.kind === "orb").length;
  if (t.orb <= 0) {
    t.orb = PICKUP.orb.interval * between(rng, 0.7, 1.3);
    if (orbs < PICKUP.orb.maxOnField) addPickup(state, "orb", rng);
  }
  if (t.cheese <= 0) {
    t.cheese = PICKUP.cheese.interval * between(rng, 0.8, 1.25);
    addPickup(state, "cheese", rng);
  }
  if (t.shield <= 0) {
    t.shield = PICKUP.shield.interval * between(rng, 0.85, 1.25);
    addPickup(state, "shield", rng);
  }

  const p = state.player;
  state.pickups = state.pickups.filter((item) => {
    item.age += dt;
    if (item.age >= item.life) return false;
    const reach = p.radius + item.radius + PLAYER.pickupReach;
    if ((item.x - p.x) ** 2 + (item.y - p.y) ** 2 < reach * reach) {
      collect(state, item);
      return false;
    }
    return true;
  });
}

function stepBots(state: GameState, dt: number): void {
  const { width, height } = state.stage;
  const margin = BOT.radius + 90;
  state.bots = state.bots.filter((bot) => {
    bot.age += dt;
    if (bot.warn > 0) {
      bot.warn -= dt;
      return true;
    }
    bot.x += bot.vx * dt;
    bot.y += bot.vy * dt;
    if (bot.wobble > 0) {
      const length = Math.hypot(bot.vx, bot.vy) || 1;
      const swing = Math.cos(bot.age * 5 + bot.phase) * bot.wobble * 5 * dt;
      bot.x += (-bot.vy / length) * swing;
      bot.y += (bot.vx / length) * swing;
    }
    return bot.x > -margin && bot.x < width + margin && bot.y > -margin && bot.y < height + margin;
  });
}

function stepTraps(state: GameState, dt: number): void {
  state.traps = state.traps.filter((trap) => {
    const before = trapStage(trap);
    trap.age += dt;
    const after = trapStage(trap);
    if (before === "telegraph" && after !== "telegraph") state.events.push({ type: "trapLive", kind: trap.kind });
    return after !== "done";
  });
}

function checkHits(state: GameState): void {
  const p = state.player;
  const shielded = state.shieldTimer > 0;

  for (const bot of state.bots) {
    if (bot.warn > 0) continue;
    const reach = p.radius * 0.8 + bot.radius * BOT.hitShare;
    if ((bot.x - p.x) ** 2 + (bot.y - p.y) ** 2 >= reach * reach) continue;
    if (shielded) {
      state.events.push({ type: "shieldBlock", x: bot.x, y: bot.y });
      state.bots = state.bots.filter((other) => other !== bot);
      return;
    }
    crash(state, "bot");
    return;
  }

  if (shielded) return;
  for (const trap of state.traps) {
    if (!trapIsLethal(trap)) continue;
    const { halfW, halfH } = trapExtent(trap);
    if (circleInRect(p.x, p.y, p.radius * 0.7, trap.x, trap.y, halfW, halfH)) {
      crash(state, trap.kind);
      return;
    }
  }
}

function stepPlaying(state: GameState, dt: number, input: Steering, rng: Rng): void {
  state.time += dt;

  if (state.comboTimer > 0) state.comboTimer -= dt;

  if (state.multiplier > 1) {
    state.multiplierTimer -= dt;
    if (state.multiplierTimer <= 0) {
      state.multiplier -= 1;
      state.multiplierTimer = state.multiplier > 1 ? SCORE.multiplierHold : 0;
      state.events.push({ type: "multiplierDown", multiplier: state.multiplier });
    }
  }

  if (state.shieldTimer > 0) {
    state.shieldTimer -= dt;
    if (state.shieldTimer <= 0) {
      state.shieldTimer = 0;
      state.events.push({ type: "shieldEnd" });
    }
  }

  steer(state, input, dt);
  stepPickups(state, dt, rng);

  const d = difficulty(state.score);
  const t = state.timers;
  t.bot -= dt;
  t.trap -= dt;
  // Bigger stages need more traffic to feel as busy as a phone screen.
  const density = Math.min(1.1, Math.max(0.85, stageScale(state)));
  if (t.bot <= 0) {
    t.bot = (d.botInterval / density) * between(rng, 0.8, 1.2);
    spawnBots(state, rng);
  }
  if (t.trap <= 0) {
    t.trap = (d.trapInterval / density) * between(rng, 0.85, 1.15);
    if (state.traps.length < d.maxTraps) spawnTrap(state, rng);
  }

  stepBots(state, dt);
  stepTraps(state, dt);
  checkHits(state);
}

function stepDying(state: GameState, dt: number): void {
  state.deathTimer -= dt;
  const world = dt * DEATH_TIME_SCALE;
  stepBots(state, world);
  stepTraps(state, world);
  for (const item of state.pickups) item.age += world;
  if (state.deathTimer <= 0) {
    state.phase = "over";
    state.events.push({ type: "gameOver", cause: state.cause ?? "bot" });
  }
}

/** The start screen: the same mouse and pickups, with no hazards, no score and no sound. */
function stepAttract(state: GameState, dt: number, input: Steering, rng: Rng): void {
  state.time += dt;
  steer(state, input, dt);
  state.timers.orb -= dt;
  if (state.timers.orb <= 0) {
    state.timers.orb = 0.9;
    if (state.pickups.length < 6) addPickup(state, "orb", rng);
  }
  const p = state.player;
  state.pickups = state.pickups.filter((item) => {
    item.age += dt;
    if (item.age >= item.life) return false;
    const reach = p.radius + item.radius + PLAYER.pickupReach;
    if ((item.x - p.x) ** 2 + (item.y - p.y) ** 2 < reach * reach) {
      state.events.push({ type: "orb", x: item.x, y: item.y, points: 0, combo: 0 });
      return false;
    }
    return true;
  });
}

export function step(state: GameState, dt: number, input: Steering, rng: Rng): void {
  if (state.phase === "playing") stepPlaying(state, dt, input, rng);
  else if (state.phase === "dying") stepDying(state, dt);
  else if (state.phase === "attract") stepAttract(state, dt, input, rng);
}

/** Hands the waiting events to the caller and empties the queue. */
export function drainEvents(state: GameState): GameState["events"] {
  const events = state.events;
  state.events = [];
  return events;
}
