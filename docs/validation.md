# Validation record: SQUEEK RUNNER: AURA PROTOCOL

This is the worker's own report on the final source and `dist/` export. It is not an independent certification.

## 1. Scope and assumptions

Reviewed: the single page in all its states: start, playing, paused, crash, Game Over and Play Again. The export was served under a nested path (`/ipfs/game/`), so broken relative asset URLs would show up.

Choices the brief left open:

- **One hit ends a run.** The HUD the brief lists has no lives, and the shield is the protection it names.
- **The multiplier applies to orbs and cheese.** A step lasts 14 seconds, then slips back one step. New cheese refills it. Without this, 5x would be permanent after four cheeses.
- **Bots and traps warn before they hit.** Bots show an edge chevron for 0.6s, and traps a footprint for 0.72 to 1.05s.
- **Pause was added**, with auto-pause when the window loses focus. A run should not continue unattended, and the Squeekchain and X links open new tabs.
- **Rug Traps and Failed TXs are distinct forms** of the requested expanding laser grid: a local square and a full-span beam.
- **Touch drags relatively**, so the finger does not cover the Cyber-Mouse.
- **Share link:** the post links to the hosted page on https, otherwise to squeekchain.com.

Brief words that override probe or guide defaults: "white monospace typography" (monospace everywhere, so copy lines stay short) and the capitalised product strings. The nav also keeps the title, badge and button the brief asks for, rather than the corner-title convention for games.

Not applicable: forms and validation, dark and light themes (the brief sets one), localisation and RTL (English only), data tables, loading and empty data states (nothing is fetched at run time), wallets.

## 2. Coverage

| Domain | Status | Inspected | Not performed |
| --- | --- | --- | --- |
| Accessibility | Checked | Keyboard-only start to finish; Tab order; focus ring computed and viewed in screenshots; focus moves to Resume, Play Again and the canvas; names and states of the mute and pause buttons; `role="status"` text; reduced motion; forced colors in Chromium; layout at 640x360 as a 200% zoom equivalent | Screen reader session; native browser zoom; automated accessibility audit |
| Layout | Checked | 320x700, 390x844, 568x320, 640x360, 768x1024, 844x390, 1024x700 and 1440x900; no horizontal scroll at 320, 390, 568, 640 and 1440; start panels fit without scrolling at 320, 390, 768, 844 and 1440; longest rank name in the HUD at 320, 390, 568 and 640, and on Game Over at 320 and 390; a resize during a run | RTL mirror (not applicable) |
| Writing | Checked | Every label against its action; verb-first buttons; one term per object; calm end-of-run copy; all six high score comparison outcomes | None |
| Typography | Checked | Rendered sizes and weights at 390 and 1440 through the probe; wrapping at real lengths on screenshots; loaded font confirmed with `document.fonts.check` | None |
| Colors | Checked | Probe measurement of DOM text, plus computed worst-case pairs for text over the canvas (below) | Pixel measurement of every moment of live play |
| UI | Checked | Default, focus and paused states in the browser; hover and press rules read from source; named transition properties; no border and shadow together; icon names and stroke | Hover and press viewed in the browser; motion replayed at 10% speed |

Computed contrast, from token values. HUD and panel rows assume a pure white entity directly under the plate, the worst case.

| Pair | Ratio |
| --- | --- |
| Text on page | 20.03:1 |
| Muted on page | 11.10:1 |
| Accent on page | 15.43:1 |
| On-accent on accent (buttons, badge) | 15.43:1 |
| On-accent on accent hover | 16.09:1 |
| HUD text, worst case | 11.48:1 |
| HUD muted, worst case | 6.36:1 |
| HUD accent, worst case | 8.84:1 |
| Panel muted, worst case | 10.59:1 |
| Panel accent, worst case | 14.72:1 |
| Canvas trap label on its plate | 5.71:1 |
| Floating gold text on page | 13.05:1 |
| Floating blue text on page | 7.23:1 |

The focus ring is white, 2px, offset 2px. It measures 1.30:1 against the accent button's fill, but the offset places it on the page background at 20.03:1.

## 3. Findings and fixes

Locations are the fix's current position.

| # | Severity | Location | Evidence | Change | Recheck |
| --- | --- | --- | --- | --- | --- |
| 1 | High | `src/App.tsx:48` | The QA hook showed `bounds.y0` at 6: the engine never received the HUD height or the open area until the first run began. The runtime was created after the first layout report. | Create the runtime in a layout effect declared first | `bounds` x0 528, y0 74 at 1440; e2e "roams beside the panel" passes |
| 2 | High | `src/styles.css:584`, `:659` | e2e: horizontal scroll at 640x360 and 568x320 | Short layout starts at 35rem; a narrower step drops the type size and lead word | e2e passes, including the longest rank in play; viewed at 568x320 |
| 3 | High | `src/styles.css:566`, `src/components/StartScreen.tsx:14` | Probe at 320: panel needed 507px of 470px, text cut 8px | Shorter legend text and a compact panel step | Panel about 425px, no scroll; probe layout passes |
| 4 | High | `src/game/renderer.ts:350` | Simulated runs: traps caused about 90% of deaths. The footprint vanished at go-live, so a grid's final reach could not be seen. | Footprint stays marked until the grid is full size; the test bot now respects it, as a player would | Deaths spread across all three hazards |
| 5 | Medium | `src/game/renderer.ts:546`, `:550` | The rank-up banner sat mid-field on an 82% plate for 2s, able to hide a hazard | Moved to the top of the field, 55% plate, 1.5s | Viewed at 320 and 568: entry chevrons stay visible through it |
| 6 | Medium | `src/styles.css:584` | At 844x390 the legend was cut off inside a scrolling panel | Two-column start panel on short screens | Viewed; about 215px panel, no scroll |
| 7 | Medium | `src/game/engine.ts:430` | After fix 4, desktop still ran harder than phones (median 23s against 38s) because hazards spawn more densely on large stages | Spawn density capped at 1.1 | Desktop median 26s. Still the hardest stage, accepted |
| 8 | Medium | `src/components/StartScreen.tsx:59` | Probe flagged HUD labels as kickers: an 8-word 12px hint set its body size | Hint shortened to six words | Probe eyebrows passes |
| 9 | Medium | `src/game/renderer.ts:545` | By calculation, the longest rank name at 20px is 324px, wider than a 320 canvas | Banner size fits the width | Viewed at 320: the full name fits |
| 10 | Low | `src/game/input.ts:25`, `:85` | Keyboard could not steer on the start screen; touching a panel moved the mouse | Keys captured from load; panels excluded from steering | Pointer steering of the start screen passes in e2e; keyboard steering there and the panel exclusion have no dedicated check |
| 11 | Low | `src/game/renderer.ts:400` | Round caps turned the trail into beads under additive blending | Butt caps, brighter and wider | Viewed |
| 12 | Low | `src/styles.css:4` | At 320, obstacles showed through the Game Over panel | Surface opacity 0.94 to 0.97 | Computed contrast above |
| 13 | Low | `src/game/runtime.ts:198` | At 844x390 the start-screen mouse sat under the HUD, with no open area | Hidden when the open area is under 48px | Viewed at 844x390 |
| 14 | Low | `src/components/PauseScreen.tsx:12` | "one-second" broke across lines at the hyphen | Reworded | Source only; the new line was not viewed |

Open findings: none known. One note: the nav link is 36px tall, above the 24px minimum but under the 44px comfortable size, to keep the nav compact on phones.

## 4. Verification

The assignment's browser tool had no managed preview to open, and a server cannot stay running between foreground commands. Browser checks therefore ran through Playwright scripts that serve the export and drive Chromium within one foreground command, which the guide allows. Screenshots were made by those scripts and viewed. They were scratch files and are not delivered.

| Command | Result |
| --- | --- |
| `npm run build` | Passed: typecheck, then Vite build |
| `npm run typecheck` | Exit 0 |
| `npm test` | 34 passed, 4 files |
| `npm run test:e2e` (Chromium) | 99 passed, 0 failed |
| WebKit run of the same script | Did not run. The browser failed to launch because system libraries are missing, and installing them was outside the task |
| `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` | 16 of 16 passed |

Probe detail: no horizontal scroll at 320, 390 or 1440; 3 controls, 1 under the 44px comfortable size; 4 sizes in use per width, 5 with one-offs; 1 family; 2 weights; 16 words of prose on the first screen at both 390 and 1440; 56 text boxes over the canvas not measured by the probe, which section 2 covers by calculation. The 390 first screen was confirmed on the probe's screenshot: title, HUD, the Cyber-Mouse and PLAY LIVE are all visible.

Interactions exercised in Chromium: Enter to start from the focused button; all eight movement keys; mouse steering; touch drag and release at 390 and 320; a mouse autopilot collecting real pickups to the first rank; live rank badge and announcement for all four rank-ups; P to pause and Enter to resume; pause on window blur; resize during a run; mute by button and key, with persistence and silence confirmed; crash, with screen shake peaking at 15px or more and 60 or more particles; final Aura, rank and high score on Game Over; share URL and its text; Play Again; high score after reload; reduced motion; forced colors; blocked `localStorage`. No console, script or resource errors occurred in any scenario.

The long desktop run used test-only shield time to stay alive through the checks; fair survival is tested separately. Rank-ups beyond the first, and the shield and trap warning screenshots, used the `#qa` hook to reach those states.

Measured in headless Chromium with software rendering:

| Measure | Result |
| --- | --- |
| Frames per second in normal play | 60 to 61 in most runs; 37 in one earlier run, cause not established and not seen again |
| Frames per second at top difficulty | 53.5 to 61 across runs |
| Worst single frame at top difficulty | 17 to 50ms across runs |

Balance simulation, 60 runs per stage size with a bot that re-plans 15 times a second:

| Stage | Median run | Median Aura | Best | Deaths: bot, Rug Trap, Failed TX |
| --- | --- | --- | --- | --- |
| Phone | 38s | 1,400 | 3,210 | 20, 11, 29 |
| Small phone | 35s | 1,360 | 3,640 | 19, 19, 22 |
| Desktop | 26s | 540 | 2,260 | 25, 16, 19 |

Safari compatibility was audited in source only: no `roundRect`, `ctx.filter`, `oklch`, `color-mix`, `:has()` or container queries; `100vh` is declared before `100dvh`; `webkitAudioContext` is a fallback; `text-wrap: pretty` degrades harmlessly.

## 5. Completion

**Complete for the stated scope**, with these checks unperformed:

- WebKit or Safari run. The design guidance asks for one, and it could not launch here.
- Physical device, including real touch and iOS audio unlock.
- Listening to the audio.
- Frame rate on real hardware, so the brief's 60FPS is unproven outside headless Chromium.
- Human playtest of the difficulty.
- Screen reader session and native browser zoom.
- Opening the X intent and squeekchain.com links; both were checked by value.
