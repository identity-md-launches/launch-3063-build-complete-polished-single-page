// Small inline icons. The entity icons repeat the in-game shapes, so the legend teaches what to look for.

interface IconProps {
  className?: string;
}

const entity = { width: 28, height: 28, viewBox: "0 0 28 28", fill: "none", "aria-hidden": true } as const;

export function OrbIcon() {
  return (
    <svg {...entity}>
      <circle cx="14" cy="14" r="12" fill="#00ffcc" opacity="0.18" />
      <circle cx="14" cy="14" r="7.5" fill="#00ffcc" />
      <circle cx="12" cy="12" r="2.5" fill="#fff" />
    </svg>
  );
}

export function CheeseIcon() {
  return (
    <svg {...entity}>
      <path d="M14 4 25 23H3Z" fill="#ffc940" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="10.5" cy="18.5" r="2.4" fill="#8a5a00" />
      <circle cx="17" cy="16.5" r="1.9" fill="#8a5a00" />
      <circle cx="13.5" cy="11.5" r="1.6" fill="#8a5a00" />
    </svg>
  );
}

export function ShieldIcon() {
  return (
    <svg {...entity}>
      <path d="M14 2.5 24 8.25v11.5L14 25.5 4 19.75V8.25Z" fill="#4d9dff" fillOpacity="0.24" stroke="#4d9dff" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M14 8.5 19 11.25v5.5L14 19.5 9 16.75v-5.5Z" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function BotIcon() {
  return (
    <svg {...entity}>
      <g stroke="#ff3b4e" strokeWidth="1.75">
        <path d="m9 9-3-3M19 9l3-3M9 19l-3 3M19 19l3 3" />
        <circle cx="5.5" cy="5.5" r="3.5" />
        <circle cx="22.5" cy="5.5" r="3.5" />
        <circle cx="5.5" cy="22.5" r="3.5" />
        <circle cx="22.5" cy="22.5" r="3.5" />
        <path d="M14 5 23 14 14 23 5 14Z" fill="#2a060b" strokeLinejoin="round" />
      </g>
      <path d="M9 12.5h10v3H9Z" fill="#fff" />
      <path d="M12.5 12.5h3v3h-3Z" fill="#ff3b4e" />
    </svg>
  );
}

export function RugIcon() {
  return (
    <svg {...entity}>
      <rect x="3" y="3" width="22" height="22" fill="#ff3b4e" fillOpacity="0.17" stroke="#fff" strokeWidth="2" />
      <path d="M10.3 3v22M17.6 3v22M3 10.3h22M3 17.6h22" stroke="#ff3b4e" strokeWidth="1.25" />
    </svg>
  );
}

export function FailedTxIcon() {
  return (
    <svg {...entity}>
      <path d="M1 3h26M1 25h26" stroke="#ff3b4e" strokeWidth="1.5" strokeDasharray="5 3.5" />
      <rect x="-1" y="9" width="30" height="10" fill="#ff3b4e" fillOpacity="0.17" />
      <path d="M0 9h28M0 19h28" stroke="#fff" strokeWidth="2" />
      <path d="M7 9v10M14 9v10M21 9v10M0 14h28" stroke="#ff3b4e" strokeWidth="1.25" />
    </svg>
  );
}

const ui = {
  width: 20,
  height: 20,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export function SoundOnIcon({ className }: IconProps) {
  return (
    <svg {...ui} className={className}>
      <path d="M3 7.5v5h3l4.5 3.5v-12L6 7.5Z" />
      <path d="M13.5 7.5a3.5 3.5 0 0 1 0 5M15.5 5a7 7 0 0 1 0 10" />
    </svg>
  );
}

export function SoundOffIcon({ className }: IconProps) {
  return (
    <svg {...ui} className={className}>
      <path d="M3 7.5v5h3l4.5 3.5v-12L6 7.5Z" />
      <path d="m13.5 8 4 4M17.5 8l-4 4" />
    </svg>
  );
}

export function PauseIcon({ className }: IconProps) {
  return (
    <svg {...ui} className={className}>
      <path d="M7 4.5v11M13 4.5v11" strokeWidth="2.5" />
    </svg>
  );
}

export function ExternalIcon({ className }: IconProps) {
  return (
    <svg {...ui} width={14} height={14} className={className}>
      <path d="M6 4h10v10M16 4 4 16" />
    </svg>
  );
}
