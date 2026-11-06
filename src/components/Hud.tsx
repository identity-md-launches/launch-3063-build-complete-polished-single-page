import { forwardRef } from "react";
import { RANKS, type RankTier } from "../game/config";
import type { HudSnapshot } from "../game/runtime";
import { formatAura } from "../game/share";
import { PauseIcon } from "./Icons";

interface HudProps {
  hud: HudSnapshot;
  highScore: number;
  playing: boolean;
  onPause: () => void;
}

export const Hud = forwardRef<HTMLElement, HudProps>(function Hud({ hud, highScore, playing, onPause }, ref) {
  const rank = RANKS[hud.rankIndex] as RankTier;
  const next = RANKS[hud.rankIndex + 1];
  return (
    <section className="hud" aria-label="Run stats" ref={ref}>
      <dl className="hud-stats">
        <div className="hud-stat">
          <dt>Aura Score</dt>
          <dd data-hud="score">{formatAura(hud.score)}</dd>
        </div>
        <div className="hud-stat">
          <dt>High Score</dt>
          <dd data-hud="high">{formatAura(highScore)}</dd>
        </div>
        <div className="hud-stat">
          <dt>Multiplier</dt>
          <dd data-hud="multiplier">{hud.multiplier}x</dd>
          <span className="meter" aria-hidden="true">
            <span className="meter-fill" style={{ transform: `scaleX(${hud.multiplierLeft})` }} />
          </span>
        </div>
        <div className="hud-stat hud-rank">
          <dt>Rank</dt>
          <dd className="hud-rank-row">
            {/* The key restarts the one-shot highlight each time the rank changes. */}
            <span className="rank-badge" data-hud="rank" key={rank.name}>
              {rank.name}
            </span>
            <span className="hud-rank-next">{next ? `Next ${formatAura(next.min)}` : "Top rank"}</span>
          </dd>
          <span className="meter" aria-hidden="true">
            <span className="meter-fill" style={{ transform: `scaleX(${hud.rankProgress})` }} />
          </span>
        </div>
      </dl>
      <button
        type="button"
        className="icon-button hud-pause"
        onClick={onPause}
        aria-label="Pause game"
        title="Pause game (P)"
        style={{ visibility: playing ? "visible" : "hidden" }}
      >
        <PauseIcon />
      </button>
    </section>
  );
});
