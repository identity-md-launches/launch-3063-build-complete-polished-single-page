import { ExternalIcon, SoundOffIcon, SoundOnIcon } from "./Icons";

interface TopNavProps {
  muted: boolean;
  onToggleMute: () => void;
}

export function TopNav({ muted, onToggleMute }: TopNavProps) {
  const label = muted ? "Unmute sound" : "Mute sound";
  return (
    <header className="topnav">
      <p className="topnav-title">SQUEEKCHAIN // AURA RUNNER</p>
      <p className="badge">GENESIS BUILD</p>
      <a className="button button-small topnav-link" href="https://squeekchain.com" target="_blank" rel="noopener noreferrer">
        <span className="topnav-link-lead">Back to </span>squeekchain.com
        <ExternalIcon />
      </a>
      <button type="button" className="icon-button topnav-mute" onClick={onToggleMute} aria-label={label} title={`${label} (M)`}>
        {muted ? <SoundOffIcon /> : <SoundOnIcon />}
      </button>
    </header>
  );
}
