// Browser storage, guarded: private modes and blocked storage must never break the game.

const HIGH_SCORE_KEY = "squeek-runner.high-score";
const MUTED_KEY = "squeek-runner.muted";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the value simply lasts until the page closes.
  }
}

export function readHighScore(): number {
  const value = Number(read(HIGH_SCORE_KEY));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function writeHighScore(score: number): void {
  write(HIGH_SCORE_KEY, String(score));
}

export function readMuted(): boolean {
  return read(MUTED_KEY) === "1";
}

export function writeMuted(muted: boolean): void {
  write(MUTED_KEY, muted ? "1" : "0");
}
