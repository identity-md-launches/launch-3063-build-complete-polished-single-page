import { forwardRef, type ReactNode } from "react";
import { BotIcon, CheeseIcon, FailedTxIcon, OrbIcon, RugIcon, ShieldIcon } from "./Icons";

interface StartScreenProps {
  onPlay: () => void;
}

interface LegendItem {
  icon: ReactNode;
  name: string;
  effect: string;
}

const COLLECT: LegendItem[] = [
  { icon: <OrbIcon />, name: "Aura Orb", effect: "+10 Aura" },
  { icon: <CheeseIcon />, name: "Genesis Cheese", effect: "+50 and +1x" },
  { icon: <ShieldIcon />, name: "Smart Contract Shield", effect: "5s invincible" },
];

const DODGE: LegendItem[] = [
  { icon: <BotIcon />, name: "Sybil Bot", effect: "Glitching drone" },
  { icon: <RugIcon />, name: "Rug Trap", effect: "Expanding grid" },
  { icon: <FailedTxIcon />, name: "Failed TX", effect: "Spreading beam" },
];

function Legend({ title, items }: { title: string; items: LegendItem[] }) {
  return (
    <div>
      <h2 className="legend-title">{title}</h2>
      <ul className="legend-list">
        {items.map((item) => (
          <li className="legend-item" key={item.name}>
            {item.icon}
            <span className="legend-text">
              <strong>{item.name}</strong>
              <span>{item.effect}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const StartScreen = forwardRef<HTMLElement, StartScreenProps>(function StartScreen({ onPlay }, ref) {
  return (
    <section className="panel panel-start" aria-labelledby="start-title" ref={ref}>
      <header>
        <h1 className="display" id="start-title">
          <span>SQUEEK RUNNER:</span> <span className="display-accent">AURA PROTOCOL</span>
        </h1>
      </header>
      <p className="lede">Steer the Cyber-Mouse through the Squeekchain mempool and farm Aura.</p>
      <div className="panel-action">
        {/* Keyboard players can start at once; a focus ring on a phone would only be noise. */}
        <button type="button" className="button button-primary" onClick={onPlay} autoFocus={window.matchMedia("(hover: hover)").matches}>
          PLAY LIVE
        </button>
        <p className="hint">Move: mouse, touch, WASD or arrows.</p>
      </div>
      <div className="legend">
        <Legend title="Collect" items={COLLECT} />
        <Legend title="Dodge" items={DODGE} />
      </div>
    </section>
  );
});
