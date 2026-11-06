export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Vec {
  x: number;
  y: number;
}

/** What the player is asking for this step. */
export interface Steering {
  /** Keyboard direction, each axis -1 to 1. */
  axisX: number;
  axisY: number;
  /** Pointer target in stage coordinates, or null when the pointer is not steering. */
  target: Vec | null;
}

export type PickupKind = "orb" | "cheese" | "shield";

export interface Pickup {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
  radius: number;
  age: number;
  life: number;
}

export interface Bot {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  age: number;
  /** Seconds left before the bot starts moving; its entry marker shows until then. */
  warn: number;
  wobble: number;
  phase: number;
  /** Where the entry marker sits, inside the play area. */
  markerX: number;
  markerY: number;
}

export type TrapKind = "rug" | "failedTx";
export type TrapStage = "telegraph" | "expand" | "hold" | "fade" | "done";

export interface Trap {
  id: number;
  kind: TrapKind;
  /** Centre of the trap. */
  x: number;
  y: number;
  /** Full-size half extents. */
  halfW: number;
  halfH: number;
  /** A failed TX beam spans the field along one axis. */
  axis: "x" | "y" | null;
  age: number;
  telegraph: number;
}

export type HitCause = "bot" | "rug" | "failedTx";

export type GameEvent =
  | { type: "orb"; x: number; y: number; points: number; combo: number }
  | { type: "cheese"; x: number; y: number; points: number; multiplier: number }
  | { type: "shield"; x: number; y: number }
  | { type: "shieldEnd" }
  | { type: "shieldBlock"; x: number; y: number }
  | { type: "multiplierDown"; multiplier: number }
  | { type: "rankUp"; rankIndex: number }
  | { type: "trapArmed"; kind: TrapKind }
  | { type: "trapLive"; kind: TrapKind }
  | { type: "crash"; x: number; y: number; cause: HitCause }
  | { type: "gameOver"; cause: HitCause };

export type Phase = "attract" | "playing" | "dying" | "over";

export interface GameState {
  phase: Phase;
  /** Seconds since the run began. */
  time: number;
  score: number;
  multiplier: number;
  multiplierTimer: number;
  shieldTimer: number;
  rankIndex: number;
  combo: number;
  comboTimer: number;
  cause: HitCause | null;
  deathTimer: number;
  player: { x: number; y: number; vx: number; vy: number; heading: number; radius: number };
  /** The space the mouse and pickups live in: the stage minus the HUD. */
  bounds: Rect;
  /** The full stage. Bots spawn just outside it. */
  stage: { width: number; height: number };
  pickups: Pickup[];
  bots: Bot[];
  traps: Trap[];
  timers: { orb: number; cheese: number; shield: number; bot: number; trap: number };
  nextId: number;
  events: GameEvent[];
}
