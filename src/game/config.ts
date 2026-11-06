// Every gameplay number lives here, so balancing the game never means touching the engine.

export interface RankTier {
  /** Lowest Aura score that earns this rank. */
  min: number;
  name: string;
}

/** The Squeekchain rank ladder, lowest first. */
export const RANKS: readonly RankTier[] = [
  { min: 0, name: "Signed Up" },
  { min: 200, name: "The Tester" },
  { min: 500, name: "The Recruitooor" },
  { min: 1000, name: "The Buildooooor" },
  { min: 2500, name: "The Ringleader (Genesis WL)" },
];

export const SCORE = {
  orb: 10,
  cheese: 50,
  multiplierMax: 5,
  /** Seconds a multiplier step lasts before it slips back one step. A new cheese refills it. */
  multiplierHold: 14,
} as const;

export const SHIELD_SECONDS = 5;

export const PLAYER = {
  radius: 13,
  baseSpeed: 340,
  /** Extra speed at full difficulty, so the mouse keeps pace with the mempool. */
  speedGain: 0.35,
  steering: 14,
  /** Pointer steering: how fast the mouse closes the gap to the pointer. */
  pointerGain: 9,
  pickupReach: 8,
} as const;

export const PICKUP = {
  orb: { radius: 10, life: 8, interval: 0.75, maxOnField: 7 },
  cheese: { radius: 15, life: 6.5, interval: 9.5 },
  shield: { radius: 16, life: 6.5, interval: 17 },
} as const;

export const BOT = {
  radius: 15,
  /** A hit counts inside this share of the drawn radius, so grazes feel fair. */
  hitShare: 0.72,
  baseSpeed: 150,
  /** Seconds the entry marker shows before a bot crosses the edge. */
  warning: 0.6,
  cloneGap: 46,
} as const;

export const TRAP = {
  rugHalf: { min: 62, max: 118 },
  failedHalf: { min: 16, max: 34 },
  telegraph: { easy: 1.05, hard: 0.72 },
  expand: 0.5,
  hold: 0.4,
  fade: 0.28,
} as const;

/** Seconds of quiet at the start of a run. */
export const GRACE_SECONDS = 1.6;
/** Seconds the crash plays out before the Game Over screen appears. */
export const DEATH_SECONDS = 1;
/** The world runs at this share of real speed while the crash plays out. */
export const DEATH_TIME_SCALE = 0.3;

export interface Difficulty {
  /** 0 at the start of a run, approaching 1 as Aura grows. */
  level: number;
  /** Multiplier on obstacle movement speed. */
  speed: number;
  /** Seconds between Sybil Bot waves. */
  botInterval: number;
  /** Seconds between laser traps. */
  trapInterval: number;
  /** Most laser traps active at once. */
  maxTraps: number;
  /** Most bots in one wave of clones. */
  maxClones: number;
  /** Warning time before a laser trap goes live. */
  telegraph: number;
}

/** Aura is the only input: difficulty rises with the score, as the brief asks. */
export function difficulty(score: number): Difficulty {
  const level = 1 - Math.exp(-Math.max(0, score) / 1600);
  return {
    level,
    speed: 1 + 1.5 * level,
    botInterval: 1.5 - 1.08 * level,
    trapInterval: 5.5 - 3.5 * level,
    maxTraps: 1 + Math.floor(level * 3),
    maxClones: 1 + Math.floor(level * 4),
    telegraph: TRAP.telegraph.easy - (TRAP.telegraph.easy - TRAP.telegraph.hard) * level,
  };
}

/** Index into RANKS for a score. */
export function rankIndexFor(score: number): number {
  let index = 0;
  RANKS.forEach((rank, i) => {
    if (score >= rank.min) index = i;
  });
  return index;
}

export function rankFor(score: number): RankTier {
  return RANKS[rankIndexFor(score)] as RankTier;
}

/** Progress from the current rank to the next, 0 to 1. The top rank reads as full. */
export function rankProgress(score: number): number {
  const index = rankIndexFor(score);
  const current = RANKS[index] as RankTier;
  const next = RANKS[index + 1];
  if (!next) return 1;
  return Math.min(1, (score - current.min) / (next.min - current.min));
}
