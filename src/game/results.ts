import type { HitCause } from "./types";
import { formatAura } from "./share";

/** What ended the run, in the same terms the start screen uses. */
export const CAUSE_TEXT: Record<HitCause, string> = {
  bot: "A Sybil Bot caught the Cyber-Mouse.",
  rug: "A Rug Trap closed on the Cyber-Mouse.",
  failedTx: "A Failed TX beam hit the Cyber-Mouse.",
};

/** The High Score comparison on the Game Over screen. */
export function compareToHigh(score: number, previousHigh: number): string {
  if (score === 0) return previousHigh > 0 ? `${formatAura(previousHigh)} Aura to beat.` : "Collect an orb to set a high score.";
  if (previousHigh === 0) return "First high score set.";
  if (score > previousHigh) return `New high score, up ${formatAura(score - previousHigh)} Aura.`;
  if (score === previousHigh) return "You matched your high score.";
  return `${formatAura(previousHigh - score)} Aura short of your high score.`;
}
