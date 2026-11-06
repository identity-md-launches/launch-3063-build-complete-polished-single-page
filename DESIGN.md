# DESIGN: SQUEEK RUNNER: AURA PROTOCOL

This documents the implemented design, taken from the final source. Use it to add a screen or an entity that belongs to the same product.

## Overview

A single-page arcade game for people in the Squeekchain Genesis community. The character is a dark terminal: a pitch-black grid, crisp white monospace type and one neon accent, with colour otherwise reserved for what the player must react to.

The page is one fixed frame with no page scroll. A top nav sits above a stage; the canvas fills the stage edge to edge, and the HUD and screens float above it. Density is high but flat: no decorative chrome, 4px corners and hairline borders.

Rules that hold across the system:

- The game is always on screen. Screens are panels over the running canvas, never separate pages.
- Colour carries meaning (see Colors). Every state also has a non-colour cue: a label, a shape or a countdown.
- The brief's product strings keep their capitals: `SQUEEK RUNNER: AURA PROTOCOL`, `SQUEEKCHAIN // AURA RUNNER`, `GENESIS BUILD`, `PLAY LIVE`, `PLAY AGAIN`, `SHARE SCORE ON X`. Other copy is sentence case, and HUD labels use the brief's Title Case terms.

## Colors

The hex notation is canonical. Interface tokens live in `:root` in `src/styles.css`. The canvas cannot read CSS variables each frame, so `src/game/palette.ts` mirrors the colours it needs, and the SVG icons in `src/components/Icons.tsx` repeat those hex values. Change all three together.

| Token | Value | Job |
| --- | --- | --- |
| `--color-bg` | `#080808` | Page, nav and canvas background |
| `--color-surface` | `rgba(8, 8, 8, 0.97)` | Screen panels |
| `--color-hud` | `rgba(8, 8, 8, 0.8)` | HUD strip over the canvas |
| `--color-text` | `#ffffff` | Primary text |
| `--color-text-muted` | `#b6c4bf` | Labels, hints, secondary text |
| `--color-accent` | `#00ffcc` | Primary action fill, badge, rank, meters, Aura values |
| `--color-accent-hover` | `#5fffe0` | Primary action hover |
| `--color-accent-wash` | `rgba(0, 255, 204, 0.14)` | Secondary and icon button hover |
| `--color-accent-glow` | `rgba(0, 255, 204, 0.32)` | Primary action glow |
| `--color-on-accent` | `#080808` | Text on accent fills |
| `--color-line` | `rgba(0, 255, 204, 0.34)` | Hairline borders on the nav, panels and icon buttons |
| `--color-track` | `rgba(255, 255, 255, 0.16)` | Empty meter track |
| `--color-focus` | `#ffffff` | Focus ring |

Game colours appear on the canvas and in legend icons only. Keep each to its one meaning:

| Constant (`src/game/palette.ts`) | Value | Meaning |
| --- | --- | --- |
| `COLOR.accent` | `#00ffcc` | Aura: orbs, trail, the Cyber-Mouse |
| `COLOR.gold` | `#ffc940` | Genesis Cheese |
| `COLOR.shield` | `#4d9dff` | Smart Contract Shield |
| `COLOR.danger` | `#ff3b4e` | Everything that ends a run |
| `COLOR.white` | `#ffffff` | Bright edges and highlights |

Contrast values for these pairs are in `docs/validation.md`.

## Typography

One family: JetBrains Mono, self-hosted through `@fontsource/jetbrains-mono` (latin subset, imported in `src/main.tsx`), with the fallback stack `ui-monospace, Menlo, Consolas, monospace`. Two weights are loaded and used: 400 and 700. The canvas uses the same family through `FONT` in `src/game/palette.ts`.

| Token | Size | Used for |
| --- | --- | --- |
| `--text-xs` | 12px | HUD labels, hints, legend, badge, nav link |
| `--text-sm` | 14px | Body default, nav title, rank name |
| `--text-md` | 16px | Buttons; HUD values on the narrowest phones |
| `--text-lg` | 20px | HUD values |
| `--text-xl` | 28px | Screen headings, final score |
| `--text-display` | 28px, 44px from `45rem` wide | Start screen title |

Line height is 1.5 for body text, 1.25 for HUD and legend text and 1.1 for headings. Display tracking is `-0.03em` and heading tracking `-0.02em`; everything else is natural. Numbers use `font-variant-numeric: tabular-nums`. Interface copy stays in short lines, because the brief asks for monospace throughout and monospace reads poorly as long prose. `.lede` and `.hint` use `text-wrap: pretty`.

## Layout

Spacing tokens are `--space-1` to `--space-8`: 4, 8, 12, 16, 24 and 32px. `--control` is the 44px control size. `--inset-start` and `--inset-end` give the page margin, at least 16px and never less than the safe-area inset.

Structure, all in `src/styles.css`:

- `.app`: two grid rows, `auto` and `minmax(0, 1fr)`, at `100dvh` with a `100vh` fallback.
- `.stage`: two grid rows, HUD and overlay, with the absolutely positioned canvas filling it behind them. The stage clips; the page never scrolls.
- `.overlay`: positions a panel in the second row, so a panel can never cover the HUD.

The engine needs the layout as well. `src/App.tsx` measures the HUD and passes its height to the runtime, which keeps the mouse and pickups below it. On the start screen it also passes the largest open area beside the panel, which is where the mouse roams.

| Condition | Change |
| --- | --- |
| Default (phones) | Nav on two rows. HUD on two rows: three stats, then rank. Panels at the bottom, within thumb reach. |
| `max-width: 22.4rem` | Link loses "Back to". HUD values drop to `--text-md`. |
| `max-width: 22.4rem` or `max-height: 44rem` | Tighter panel, 20px legend icons. |
| `min-width: 45rem` | Nav and HUD on one row. Panels centred; start panel at the leading edge so the scene stays open. Display title 44px. Screen buttons side by side. |
| `max-height: 30rem` and `min-width: 35rem` | Short landscape: one-row nav and HUD, 44px buttons, and the start panel splits into two columns with the legend on the right. |
| Same, and `max-width: 45rem` | Nav title and rank name drop to `--text-xs`; the link lead word and "Next" value are hidden. |

Checked in the browser at 320x700, 390x844, 568x320, 640x360, 768x1024, 844x390, 1024x700 and 1440x900.

## Elevation & Depth

The interface is flat. There are three layers: canvas, HUD and panels; there are no z-index tokens, and DOM order sets the stacking. Panels use a hairline border and no shadow. The only shadow in the interface is the primary button's glow, on a borderless fill. A surface never has both a border and a shadow.

Depth inside the canvas comes from additive glow sprites (`makeGlow` in `src/game/renderer.ts`), stamped with the `lighter` composite mode. These are pre-rendered once rather than drawn with `shadowBlur`, which is too slow for 60FPS.

## Shapes

One radius, `--radius` at 4px, on panels, buttons, the badge and icon buttons. Borders are 1px. Corners stay under 6px so nothing reads as a soft card. Meters are 2px square bars. Game geometry is hard-edged: a faceted mouse, a triangle, hexagons, square grids and pixel-square particles. Orbs are the one round shape, which is why they read as energy.

## Components

Each component lives in `src/components/`, with styles in `src/styles.css`.

- **TopNav** (`TopNav.tsx`): title, `.badge`, link back to squeekchain.com in a new tab, and the mute toggle in the top-right corner. Its `aria-label` switches between "Mute sound" and "Unmute sound", and the icon changes too. M also toggles it.
- **Hud** (`Hud.tsx`): `dl` of Aura Score, High Score, Multiplier and Rank, plus the pause button. The strip ignores pointer events so steering passes through it; only the pause button takes them. The pause button is hidden with `visibility`, so the layout does not move between states.
- **`.meter`**: a 2px bar scaled with `transform`. Under Multiplier it shows time left on the current step; under Rank it shows progress to the next rank.
- **`.panel`**: the screen surface. `.panel-start` is the start screen, `.panel-compact` the narrower pause and Game Over screens, and `.panel-enter` a single 220ms entrance.
- **StartScreen, PauseScreen, GameOverScreen**: each has one `h1`, and its primary button takes focus when it opens. On touch-first devices the start button skips focus, because a ring has no use there.
- **`.button`**: 52px tall with an accent outline. Add `.button-primary` for the filled action, one per screen. `.button-small` is the 36px nav size. It can be a `button` or an `a`. Hover is gated by `@media (hover: hover)`. Press is `scale(0.96)` over 150ms with `cubic-bezier(0.2, 0, 0, 1)`, only when motion is allowed.
- **`.icon-button`**: a 44px square with a hairline border. It always has an `aria-label`.
- **Legend** (`StartScreen.tsx`): two lists, Collect and Dodge. Icons repeat the in-game shapes, so the legend teaches what to look for.
- **Canvas entities** (`src/game/renderer.ts`): `drawPlayer`, `drawPickup`, `drawBot`, `drawTrap`. Danger is always announced first: bots show a chevron at the edge for 0.6s, and traps show a dashed footprint, labelled during the warning, that stays marked until the grid is full size.

Keyboard behaviour: arrows and WASD steer, P or Escape pauses and resumes, and M mutes. Keys are ignored with Cmd, Ctrl or Alt held, so browser shortcuts still work. Rank-ups and game over are announced through the `role="status"` region at the end of `.app`.

Under `prefers-reduced-motion`, `src/game/fx.ts` replaces screen shake with a single red flash and cuts particle counts to a third. The renderer stops the grid scroll, the bot glitch and pickup pulses, and the start-screen mouse waits for input.

## Do's and Don'ts

- Do start a new screen from `.overlay` and `.panel`, with one `h1` and one `.button-primary`.
- Do add new gameplay numbers to `src/game/config.ts`, and run `npm test`. `balance.test.ts` plays whole runs and fails if the game turns unfair.
- Do keep rules in `src/game/engine.ts`, free of canvas, audio and DOM. Send effects through `state.events`.
- Do warn before any new hazard hits, and give it a label or shape as well as red.
- Do keep the HUD's text on `--color-hud`; its contrast depends on that plate over a bright entity.
- Don't use red, gold or blue in the interface chrome. They mean game objects.
- Don't add a shadow to a bordered surface, or a card inside a panel.
- Don't add a size outside the type scale, a third weight or a second family.
- Don't use `transition: all` or an endless CSS animation. Canvas motion must respect the `reduced` flag.
- Don't imply scores are shared. High scores live in one browser, and the Game Over screen says so.

To add a hazard: add its numbers to `config.ts`, its type and spawn and hit logic to `engine.ts`, an entry to `CAUSE_TEXT` in `results.ts`, a draw method to `renderer.ts`, an icon to `Icons.tsx` and a row to `DODGE` in `StartScreen.tsx`.
