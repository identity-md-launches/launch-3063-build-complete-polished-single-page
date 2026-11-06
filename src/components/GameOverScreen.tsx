import { CAUSE_TEXT, compareToHigh } from "../game/results";
import type { RunResult } from "../game/runtime";
import { formatAura, shareUrl } from "../game/share";

interface GameOverScreenProps {
  result: RunResult;
  previousHigh: number;
  highScore: number;
  onPlayAgain: () => void;
}

export function GameOverScreen({ result, previousHigh, highScore, onPlayAgain }: GameOverScreenProps) {
  return (
    <section className="panel panel-compact panel-enter" aria-labelledby="over-title">
      <h1 className="heading" id="over-title">
        Game over
      </h1>
      <p className="lede" data-result="cause">
        {CAUSE_TEXT[result.cause]}
      </p>
      <dl className="result">
        <div className="result-row">
          <dt>Aura farmed</dt>
          <dd className="result-score" data-result="score">
            {formatAura(result.score)}
          </dd>
        </div>
        <div className="result-row">
          <dt>Rank achieved</dt>
          <dd data-result="rank">{result.rank.name}</dd>
        </div>
        <div className="result-row">
          <dt>High Score</dt>
          <dd data-result="high">{formatAura(highScore)}</dd>
        </div>
      </dl>
      <p className="hint" data-result="compare">
        {compareToHigh(result.score, previousHigh)} Saved in this browser only.
      </p>
      <div className="panel-buttons">
        <button type="button" className="button button-primary" onClick={onPlayAgain} autoFocus>
          PLAY AGAIN
        </button>
        <a
          className="button"
          href={shareUrl(result.score, result.rank.name, window.location)}
          target="_blank"
          rel="noopener noreferrer"
        >
          SHARE SCORE ON X
        </a>
      </div>
    </section>
  );
}
