interface PauseScreenProps {
  onResume: () => void;
  onRestart: () => void;
}

export function PauseScreen({ onResume, onRestart }: PauseScreenProps) {
  return (
    <section className="panel panel-compact panel-enter" aria-labelledby="pause-title">
      <h1 className="heading" id="pause-title">
        Paused
      </h1>
      <p className="lede">Your run is safe. A short countdown starts when you resume.</p>
      <div className="panel-buttons">
        <button type="button" className="button button-primary" onClick={onResume} autoFocus>
          RESUME
        </button>
        <button type="button" className="button" onClick={onRestart}>
          RESTART RUN
        </button>
      </div>
    </section>
  );
}
