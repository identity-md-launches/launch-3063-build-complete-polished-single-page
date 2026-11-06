# SQUEEK RUNNER: AURA PROTOCOL

A single-page HTML5 Canvas arcade survival game for the Squeekchain Genesis ecosystem. Steer the Cyber-Mouse through the mempool, farm Aura, dodge Sybil Bots, Rug Traps and Failed TXs, and climb from Signed Up to The Ringleader (Genesis WL).

The finished static export is committed in `dist/`. It has no backend, needs no wallet and makes no external requests. All asset URLs are relative, so it works from any static host, a gateway subpath or an ENS name.

## How to play

| Control | Action |
| --- | --- |
| Mouse | The Cyber-Mouse steers to the cursor |
| Touch | Drag anywhere; the mouse moves by your finger's offset, so your finger never covers it |
| WASD or arrow keys | Move |
| P or Escape | Pause and resume |
| M | Mute and unmute |

| Object | Effect |
| --- | --- |
| Aura Orb | +10 Aura, times the multiplier |
| Genesis Cheese | +50 Aura, times the multiplier, then the multiplier rises by 1x (5x at most) |
| Smart Contract Shield | 5 seconds of invincibility; bots that touch you are destroyed |
| Sybil Bot | Red drones that cross the field, in clone formations as Aura grows |
| Rug Trap | A square laser grid that expands after a warning |
| Failed TX | A laser grid beam across the whole field, after a warning |

One hit ends the run. A multiplier step lasts 14 seconds, and new cheese refills it. Speed and spawn rates rise with your Aura.

| Rank | Aura |
| --- | --- |
| Signed Up | 0 to 199 |
| The Tester | 200 to 499 |
| The Recruitooor | 500 to 999 |
| The Buildooooor | 1,000 to 2,499 |
| The Ringleader (Genesis WL) | 2,500 and up |

Ranks are in-game titles. Reaching one does not grant anything on Squeekchain, including whitelist access. The high score and mute setting are saved in this browser's `localStorage` only; nothing is shared between players.

## Install

You need Node 20.19+ or 22.12+ (Vite 8's minimum).

```sh
npm install
```

## Preview

Serve the committed export:

```sh
npm run preview
```

Any static file server pointed at `dist/` works the same way. Opening `dist/index.html` from `file://` does not work, because browsers block module scripts there. For development with hot reload, use `npm run dev`.

## Rebuild

```sh
npm run build
```

This typechecks, then writes the static site to `dist/`. Commit `dist/` with the source, since the host serves it as is.

## Test

```sh
npm test              # unit tests and the balance simulation
npm run typecheck     # TypeScript, no output files
npm run test:e2e      # real browser checks against dist/; run npm run build first
```

`test:e2e` needs a Playwright browser once: `npx playwright install chromium`. Pass `-- webkit` to run it in WebKit.

The `#qa` URL hash (for example `index.html#qa&seed=11`) exposes the running game as `window.__auraQA` for those checks, and `seed=` makes a run repeatable. It is off in normal play. It can change the score, which matters little because the high score is local to the browser anyway.

## Project layout

```text
index.html            Page shell and share metadata
public/               Favicon and og:image, copied into dist/ as they are
src/App.tsx           Screens, focus, keyboard shortcuts, high score
src/components/       Nav, HUD, screens, icons
src/styles.css        Design tokens and all interface styles
src/game/config.ts    Every gameplay number, ranks, difficulty
src/game/engine.ts    The rules, with no canvas, audio or DOM
src/game/renderer.ts  Canvas drawing
src/game/fx.ts        Particles, floating text, shake
src/game/audio.ts     Web Audio synth, no audio files
src/game/input.ts     Mouse, touch and keyboard
src/game/runtime.ts   Frame loop joining all of the above
tests/e2e/            Browser checks
```

`DESIGN.md` documents tokens, typography, components and responsive behaviour. `docs/validation.md` has the full review record.

## Validation results

Run on the final source. Details are in `docs/validation.md`.

| Check | Command | Result |
| --- | --- | --- |
| Production build | `npm run build` | Passed |
| Typecheck | `npm run typecheck` | Passed, exit 0 |
| Unit and balance tests | `npm test` | 34 of 34 passed, in 4 files |
| Interaction checks, Chromium | `npm run test:e2e` | 99 of 99 passed |
| Interaction checks, WebKit | `npm run test:e2e -- webkit` | Did not run: the browser would not launch on the build machine (missing system libraries) |
| Design probe, taste@1 | `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` | 16 of 16 passed |

The interaction checks served the export under a nested path and covered keyboard, mouse and touch steering; start, pause, resume, crash, Game Over and Play Again; rank changes; high score persistence; the share link; mute; screen shake and particles; reduced motion; blocked storage; and layout from 320 to 1440 wide.

### Limitations

- **Safari is unverified.** WebKit could not run, so nothing was tested in Safari or on an iPhone. The source was audited for features Safari lacks, with none found, but that is not a substitute for a real run.
- **No physical device.** Touch was emulated with synthetic pointer events.
- **Sound was not heard.** The checks confirm that synthesized tones fire and that mute silences them. Whether they sound good needs a person.
- **60FPS is not proven on real hardware.** Headless Chromium with software rendering measured 53.5 to 61 frames per second at top difficulty, across runs. No phone or GPU figures exist.
- **Balance comes from a simulated player**, not human playtesting.
- **External links were not opened.** The X intent URL and squeekchain.com link were checked by their values, not by visiting them.
- **No screen reader session.** Names, roles and the live region were checked in the DOM only.
- The live squeekchain.com page exposed only its title to the build's fetch, so the theme follows the brief rather than the live site. The brief's Cyber-Mouse is kept, although that title says "Hamster-powered blockchain".

## Credits

The JetBrains Mono font is used under the SIL Open Font License 1.1, via `@fontsource/jetbrains-mono`. Design review used Better Interface (MIT) and Impeccable's documentation method (Apache-2.0).
