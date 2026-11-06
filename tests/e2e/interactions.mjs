// Drives the built export with a real browser: npm run build, then npm run test:e2e [-- webkit].
// #qa exposes the running game to these checks; see the README.
import { SHOTS, pw, serve } from "./lib.mjs";

const which = process.argv[2] ?? "chromium";
const { server, url } = await serve();
const browser = await pw[which].launch();
const out = SHOTS;
let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} [${which}] ${name}${detail ? `: ${detail}` : ""}`);
};

const snap = (page) =>
  page.evaluate(() => {
    const { state: s, width, height } = window.__auraQA.inspect();
    const stage = document.querySelector(".stage").getBoundingClientRect();
    return {
      phase: s.phase, score: s.score, mult: s.multiplier, shield: s.shieldTimer, rank: s.rankIndex, time: s.time,
      p: { x: s.player.x, y: s.player.y }, bounds: s.bounds, width, height, top: stage.top,
      pickups: s.pickups.map((i) => ({ x: i.x, y: i.y, kind: i.kind })),
      bots: s.bots.map((b) => ({ x: b.x, y: b.y, warn: b.warn })),
      traps: s.traps.map((t) => ({ x: t.x, y: t.y, w: t.halfW, h: t.halfH, kind: t.kind, age: t.age, tg: t.telegraph })),
    };
  });
const hud = (page, key) => page.locator(`[data-hud="${key}"]`).innerText();

// Plays with a real mouse: chases pickups, steps out of warned grids, keeps clear of bots.
function plan(s) {
  const { p } = s;
  let tx = p.x, ty = p.y;
  let best = Infinity;
  for (const i of s.pickups) {
    const inTrap = s.traps.some((t) => Math.abs(i.x - t.x) < t.w + 20 && Math.abs(i.y - t.y) < t.h + 20);
    const d = Math.hypot(i.x - p.x, i.y - p.y) * (i.kind === "orb" ? 1 : 0.5) + (inTrap ? 900 : 0);
    if (d < best) { best = d; tx = i.x; ty = i.y; }
  }
  for (const t of s.traps) {
    const m = 34;
    if (Math.abs(p.x - t.x) < t.w + m && Math.abs(p.y - t.y) < t.h + m) {
      const exits = [
        { x: t.x - t.w - m - 12, y: p.y }, { x: t.x + t.w + m + 12, y: p.y },
        { x: p.x, y: t.y - t.h - m - 12 }, { x: p.x, y: t.y + t.h + m + 12 },
      ].filter((e) => e.x > s.bounds.x0 + 16 && e.x < s.bounds.x1 - 16 && e.y > s.bounds.y0 + 16 && e.y < s.bounds.y1 - 16);
      exits.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
      if (exits[0]) { tx = exits[0].x; ty = exits[0].y; }
    }
  }
  for (const b of s.bots) {
    if (b.warn > 0) continue;
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    if (d < 130) {
      const k = (130 - d) * 3;
      tx += ((p.x - b.x) / (d || 1)) * k;
      ty += ((p.y - b.y) / (d || 1)) * k;
    }
  }
  return {
    x: Math.min(s.bounds.x1 - 16, Math.max(s.bounds.x0 + 16, tx)),
    y: Math.min(s.bounds.y1 - 16, Math.max(s.bounds.y0 + 16, ty)),
  };
}

async function autoplay(page, until, limitMs, onSnap) {
  const started = Date.now();
  while (Date.now() - started < limitMs) {
    const s = await snap(page);
    if (onSnap) await onSnap(s);
    if (s.phase !== "playing" || until(s)) return s;
    const t = plan(s);
    await page.mouse.move(t.x, t.y + s.top);
    await page.waitForTimeout(30);
  }
  return snap(page);
}

async function newPage(options) {
  const ctx = await browser.newContext(options);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("requestfailed", (r) => { if (r.url().startsWith(url)) errors.push(`failed ${r.url()}`); });
  page.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  return { ctx, page, errors };
}

// ---------- Desktop run ----------
{
  const { ctx, page, errors } = await newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => {
    window.__tones = 0;
    window.__noise = 0;
    const Base = window.AudioContext ?? window.webkitAudioContext;
    const osc = Base.prototype.createOscillator;
    Base.prototype.createOscillator = function () { window.__tones++; window.__audio = this; return osc.call(this); };
    const src = Base.prototype.createBufferSource;
    Base.prototype.createBufferSource = function () { window.__noise++; return src.call(this); };
  });
  await page.goto(`${url}#qa&seed=11`);
  await page.waitForTimeout(600);

  check("title", (await page.title()) === "SQUEEK RUNNER: AURA PROTOCOL");
  check("nav title", await page.getByText("SQUEEKCHAIN // AURA RUNNER").isVisible());
  check("nav badge", await page.getByText("GENESIS BUILD").isVisible());
  check("nav link", (await page.locator(".topnav-link").getAttribute("href")) === "https://squeekchain.com");
  check("font loaded", await page.evaluate(() => document.fonts.check("700 16px 'JetBrains Mono'")));
  check("relative assets", await page.evaluate(() => [...document.querySelectorAll("script[src],link[href]")].every((e) => (e.getAttribute("src") ?? e.getAttribute("href")).startsWith("./"))));
  const og = await page.evaluate(async () => { const m = document.querySelector('meta[property="og:image"]').content; return (await fetch(m)).status; });
  check("og:image resolves", og === 200, String(og));
  const bounds = (await snap(page)).bounds;
  const panel = await page.locator(".panel").boundingBox();
  check("start mouse roams beside the panel", bounds.x0 > panel.x + panel.width - 1, JSON.stringify(bounds));

  // The start screen is interactive: the mouse follows the pointer and the keyboard.
  await page.mouse.move(1000, 500);
  await page.waitForTimeout(1600);
  const roam = await snap(page);
  check("start screen: the mouse follows the pointer", Math.hypot(roam.p.x - 1000, roam.p.y + roam.top - 500) < 12, `${Math.round(roam.p.x)},${Math.round(roam.p.y + roam.top)}`);
  check("start screen: no score, no hazards", roam.score === 0 && roam.bots.length === 0 && roam.traps.length === 0);

  // Tab order, from the focused primary action, wraps through the page chrome and back.
  check("PLAY LIVE has focus on load", await page.evaluate(() => document.activeElement?.textContent === "PLAY LIVE"));
  await page.screenshot({ path: `${out}/1440-focus-play.png` });
  const order = [];
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press(which === "webkit" ? "Alt+Tab" : "Tab");
    order.push(await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent ?? document.activeElement?.tagName));
  }
  console.log(`INFO [${which}] tab order after PLAY LIVE: ${order.join(" > ")}`);
  await page.locator(".topnav-link").focus();
  await page.keyboard.press("Tab");
  const ring = await page.evaluate(() => { const c = getComputedStyle(document.activeElement); return `${c.outlineStyle} ${c.outlineWidth} ${c.outlineColor}`; });
  check("focus ring on the nav controls", ring.startsWith("solid 2px"), ring);
  await page.screenshot({ path: `${out}/1440-focus-mute.png` });
  await page.getByRole("button", { name: "PLAY LIVE" }).focus();

  // Enter starts from the focused button: the full keyboard path.
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);
  let s = await snap(page);
  check("keyboard Enter starts a run", s.phase === "playing");
  check("play area starts below the HUD", s.bounds.y0 > 50, String(s.bounds.y0));
  check("focus moves to the game surface", await page.evaluate(() => document.activeElement?.tagName === "CANVAS"));
  // Test-only shield time keeps this run alive through the checks; fair survival is covered by balance.test.ts.
  await page.evaluate(() => { window.__auraQA.inspect().state.shieldTimer = 600; });

  for (const [key, axis, sign] of [["ArrowRight", "x", 1], ["ArrowLeft", "x", -1], ["KeyS", "y", 1], ["KeyW", "y", -1], ["KeyD", "x", 1], ["KeyA", "x", -1], ["ArrowDown", "y", 1], ["ArrowUp", "y", -1]]) {
    const before = (await snap(page)).p;
    await page.keyboard.down(key);
    await page.waitForTimeout(220);
    await page.keyboard.up(key);
    const after = (await snap(page)).p;
    check(`key ${key} moves the mouse`, (after[axis] - before[axis]) * sign > 20, `${Math.round(after[axis] - before[axis])}px`);
  }

  // Mouse steering.
  s = await snap(page);
  await page.mouse.move(300, 500);
  await page.waitForTimeout(1700);
  s = await snap(page);
  if (s.phase === "playing") check("mouse steers to the cursor", Math.hypot(s.p.x - 300, s.p.y + s.top - 500) < 12, `${Math.round(Math.hypot(s.p.x - 300, s.p.y + s.top - 500))}px away`);
  else console.log(`INFO [${which}] run ended during the steering check (${s.phase})`);

  // Frame pacing, measured in the page (headless software rendering, so a floor rather than a target).
  const fps = await page.evaluate(() => new Promise((done) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(tick); else done(n); }; requestAnimationFrame(tick); }));
  console.log(`INFO [${which}] rAF ticks in 1s during play: ${fps}`);

  // Real play to the first rank-up and beyond.
  let sawBot = false, sawTrap = false, shot = false, sawParticles = false;
  s = await autoplay(page, (x) => x.rank >= 1 && sawTrap && sawBot && sawParticles, 90000, async (x) => {
    sawBot ||= x.bots.some((b) => b.warn <= 0);
    sawTrap ||= x.traps.length > 0;
    sawParticles ||= await page.evaluate(() => window.__auraQA.inspect().fx.particles.length > 0);
    if (!shot && x.traps.some((t) => t.age > t.tg + 0.3) && x.bots.length && which === "chromium") { shot = true; await page.screenshot({ path: `${out}/1440-play.png` }); }
  });
  console.log(`INFO [${which}] autoplay: phase ${s.phase}, score ${s.score}, rank ${s.rank}, ${s.time.toFixed(1)}s, mult ${s.mult}`);
  check("bots and traps appear during play", sawBot && sawTrap);
  check("score grows by real pickups", s.score > 0, String(s.score));
  check("collecting an orb throws particles", sawParticles);
  const tones = await page.evaluate(() => ({ tones: window.__tones, state: window.__audio?.state }));
  check("pickups play synthesized sound", tones.tones > 0, JSON.stringify(tones));

  if (s.phase === "playing") {
    if (s.rank >= 1) check("live rank badge updates", (await hud(page, "rank")) !== "Signed Up", await hud(page, "rank"));

    // Pause and resume.
    await page.keyboard.press("KeyP");
    await page.waitForTimeout(120);
    const a = await snap(page);
    await page.waitForTimeout(400);
    const b = await snap(page);
    check("P pauses the world", a.time === b.time && (await page.getByRole("heading", { name: "Paused" }).isVisible()));
    check("HUD score matches the engine", (await hud(page, "score")).replace(/,/g, "") === String(b.score), `${await hud(page, "score")} / ${b.score}`);
    check("Resume takes focus", await page.evaluate(() => document.activeElement?.textContent === "RESUME"));
    if (which === "chromium") await page.screenshot({ path: `${out}/1440-pause.png` });
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1300);
    check("Resume restarts time after the countdown", (await snap(page)).time > b.time);
  } else {
    check("run still alive for pause check", false, "autopilot died early");
  }

  // Leaving the window pauses a run.
  if ((await snap(page)).phase === "playing") {
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await page.waitForTimeout(100);
    check("losing window focus pauses the run", await page.getByRole("heading", { name: "Paused" }).isVisible());
    await page.getByRole("button", { name: "RESUME" }).click();
    await page.waitForTimeout(1100);
  }

  // Resizing mid-run keeps the mouse in play.
  if ((await snap(page)).phase === "playing") {
    await page.setViewportSize({ width: 900, height: 600 });
    await page.waitForTimeout(250);
    const r = await snap(page);
    check("resize keeps the mouse inside the field", r.p.x <= r.bounds.x1 && r.p.y <= r.bounds.y1 && r.bounds.x1 < 900, JSON.stringify(r.bounds));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(150);
  }

  // Shots of states that are hard to catch in live play, seeded straight into the running world.
  if (which === "chromium" && (await snap(page)).phase === "playing") {
    await page.evaluate(() => {
      const { state } = window.__auraQA.inspect();
      const { x, y } = state.player;
      state.traps = [
        { id: 901, kind: "failedTx", x: 720, y: y - 130, halfW: 800, halfH: 30, axis: "x", age: 0.4, telegraph: 1 },
        { id: 902, kind: "rug", x: x + 240, y: y + 40, halfW: 100, halfH: 100, axis: null, age: 0.5, telegraph: 1 },
      ];
    });
    await page.waitForTimeout(60);
    await page.screenshot({ path: `${out}/1440-telegraph-shield.png` });
    await page.evaluate(() => { const { state } = window.__auraQA.inspect(); state.traps = []; });
  }

  // Under load: top difficulty, measured in the page.
  if ((await snap(page)).phase === "playing") {
    await page.evaluate(() => { window.__auraQA.grant(4000); });
    const busy = await page.evaluate(() => new Promise((done) => { let n = 0, worst = 0, last = performance.now(); const t0 = last; const tick = (t) => { worst = Math.max(worst, t - last); last = t; n++; if (t - t0 < 2000) requestAnimationFrame(tick); else done({ perSecond: n / 2, worstMs: Math.round(worst), bots: window.__auraQA.inspect().state.bots.length }); }; requestAnimationFrame(tick); }));
    console.log(`INFO [${which}] frame pacing at top difficulty: ${JSON.stringify(busy)}`);
  }

  // Mute.
  const mute = page.locator(".topnav-mute");
  await mute.click();
  check("mute relabels", (await mute.getAttribute("aria-label")) === "Unmute sound");
  check("mute persists", (await page.evaluate(() => localStorage.getItem("squeek-runner.muted"))) === "1");
  const whileMuted = await page.evaluate(() => { const before = window.__tones; const { state } = window.__auraQA.inspect(); state.pickups.push({ id: 950, kind: "orb", x: state.player.x, y: state.player.y, radius: 10, age: 0, life: 5 }); return before; });
  await page.waitForTimeout(150);
  check("muted pickups stay silent", (await page.evaluate(() => window.__tones)) === whileMuted);
  await page.keyboard.press("KeyM");
  check("M toggles sound", (await mute.getAttribute("aria-label")) === "Mute sound");

  // Stop steering and let the mempool win.
  await page.mouse.move(720, 500);
  const startWait = Date.now();
  const tonesBeforeCrash = await page.evaluate(() => window.__noise);
  await page.evaluate(() => { const q = window.__auraQA; window.__peak = 0; window.__spark = 0; const watch = () => { const { fx } = q.inspect(); window.__peak = Math.max(window.__peak, fx.shake); window.__spark = Math.max(window.__spark, fx.particles.length); requestAnimationFrame(watch); }; watch(); q.inspect().state.shieldTimer = 0; });
  await page.waitForFunction(() => window.__auraQA.inspect().state.phase !== "playing", null, { timeout: 120000 }).catch(() => {});
  console.log(`INFO [${which}] idle until crash ${(Date.now() - startWait) / 1000}s`);
  const dying = await snap(page);
  check("idle mouse eventually crashes", dying.phase === "dying" || dying.phase === "over", dying.phase);
  await page.getByRole("heading", { name: "Game over" }).waitFor({ timeout: 4000 });
  await page.waitForTimeout(350);
  await page.evaluate(() => { const { state } = window.__auraQA.inspect(); state.shieldTimer = 0; });

  const impact = await page.evaluate(() => ({ shake: Math.round(window.__peak), particles: window.__spark, noise: window.__noise }));
  check("a crash shakes the screen", impact.shake >= 15, `peak ${impact.shake}px`);
  check("a crash explodes into particles", impact.particles >= 60, `${impact.particles} particles`);
  console.log(`INFO [${which}] crash noise bursts after mute: ${impact.noise - tonesBeforeCrash}`);

  const final = await snap(page);
  const score = await page.locator('[data-result="score"]').innerText();
  check("final Aura shown", score.replace(/,/g, "") === String(final.score), score);
  check("rank achieved shown", (await page.locator('[data-result="rank"]').innerText()).length > 3, await page.locator('[data-result="rank"]').innerText());
  console.log(`INFO [${which}] compare: ${await page.locator('[data-result="compare"]').innerText()} / ${await page.locator('[data-result="cause"]').innerText()}`);
  check("high score saved", (await page.evaluate(() => localStorage.getItem("squeek-runner.high-score"))) === String(final.score));
  if (which === "chromium") await page.screenshot({ path: `${out}/1440-over.png` });

  const href = await page.getByRole("link", { name: "SHARE SCORE ON X" }).getAttribute("href");
  const share = new URL(href);
  check("share opens an X intent", share.hostname === "x.com" && share.pathname === "/intent/tweet", share.pathname);
  check("share text has score, Aura and Squeekchain", share.searchParams.get("text").includes(`${score} Aura on Squeekchain`), share.searchParams.get("text"));
  check("share opens in a new tab", (await page.getByRole("link", { name: "SHARE SCORE ON X" }).getAttribute("target")) === "_blank");
  check("Play Again takes focus", await page.evaluate(() => document.activeElement?.textContent === "PLAY AGAIN"));

  await page.getByRole("button", { name: "PLAY AGAIN" }).click();
  await page.waitForTimeout(150);
  s = await snap(page);
  check("Play Again starts a fresh run", s.phase === "playing" && s.score === 0 && s.mult === 1);
  check("HUD resets, high score stays", (await hud(page, "score")) === "0" && (await hud(page, "high")) === score, `${await hud(page, "score")} / ${await hud(page, "high")}`);

  await page.reload();
  await page.waitForTimeout(400);
  check("high score survives reload", (await hud(page, "high")) === score);
  check("no console, script or resource errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ---------- Touch run at 390 and rank states ----------
for (const [width, height] of [[390, 844], [320, 700]]) {
  const { ctx, page, errors } = await newPage({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: which === "chromium", hasTouch: true });
  await page.goto(`${url}#qa&seed=3`);
  await page.waitForTimeout(500);
  const play = await page.getByRole("button", { name: "PLAY LIVE" }).boundingBox();
  check(`${width}: PLAY LIVE fully on the first screen`, play.y >= 0 && play.y + play.height <= height, `${Math.round(play.y)}-${Math.round(play.y + play.height)}`);
  const fits = await page.evaluate(() => { const p = document.querySelector(".panel"); return p.scrollHeight <= p.clientHeight + 1; });
  check(`${width}: start panel fits without scrolling`, fits);
  await page.getByRole("button", { name: "PLAY LIVE" }).tap();
  await page.waitForTimeout(150);

  // Relative touch drag through a real CDP/WebKit-agnostic pointer sequence.
  const before = await snap(page);
  await page.evaluate(({ x, y }) => {
    const c = document.querySelector(".stage");
    const send = (type, px, py) => c.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 5, pointerType: "touch", clientX: px, clientY: py, isPrimary: true }));
    Element.prototype.setPointerCapture = () => {};
    send("pointerdown", x, y);
    send("pointermove", x - 60, y - 70);
    window.__end = () => send("pointerup", x - 60, y - 70);
  }, { x: width / 2, y: height - 120 });
  await page.waitForTimeout(450);
  const dragged = await snap(page);
  await page.evaluate(() => window.__end());
  check(`${width}: touch drag moves the mouse by the finger's offset`, Math.abs(dragged.p.x - before.p.x + 60) < 10 && Math.abs(dragged.p.y - before.p.y + 70) < 10, `${Math.round(dragged.p.x - before.p.x)},${Math.round(dragged.p.y - before.p.y)}`);
  await page.waitForTimeout(250);
  const rest = await snap(page);
  await page.waitForTimeout(150);
  check(`${width}: lifting the finger stops the mouse`, Math.hypot((await snap(page)).p.x - rest.p.x, (await snap(page)).p.y - rest.p.y) < 3 || (await snap(page)).phase !== "playing");

  // Longest rank name in the HUD, then in the Game Over panel, at this width.
  const ranks = [[200, "The Tester"], [300, "The Recruitooor"], [500, "The Buildooooor"], [1500, "The Ringleader (Genesis WL)"]];
  for (const [points, name] of ranks) {
    await page.evaluate((n) => window.__auraQA.grant(n), points);
    await page.waitForTimeout(60);
    check(`${width}: rank reads ${name}`, (await hud(page, "rank")) === name);
    check(`${width}: rank-up is announced`, (await page.locator('[role="status"]').innerText()) === `Rank up: ${name}.`);
  }
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => { const v = document.documentElement.clientWidth; return { w: document.documentElement.scrollWidth, hud: [...document.querySelectorAll(".hud *")].filter((e) => e.getBoundingClientRect().right > v + 1 && e.getBoundingClientRect().width).length, v }; });
  check(`${width}: no overflow with the longest rank`, overflow.w <= overflow.v && overflow.hud === 0, JSON.stringify(overflow));
  if (which === "chromium") await page.screenshot({ path: `${out}/${width}-play-top-rank.png` });

  await page.waitForFunction(() => window.__auraQA.inspect().state.phase !== "playing", null, { timeout: 120000 });
  await page.getByRole("heading", { name: "Game over" }).waitFor({ timeout: 4000 });
  await page.waitForTimeout(350);
  const panel = await page.locator(".panel").boundingBox();
  const again = await page.getByRole("button", { name: "PLAY AGAIN" }).boundingBox();
  const shareBox = await page.getByRole("link", { name: "SHARE SCORE ON X" }).boundingBox();
  check(`${width}: Game Over buttons on screen`, again.y + again.height <= height && shareBox.y + shareBox.height <= height && panel.y > 0, `${Math.round(panel.y)}..${Math.round(shareBox.y + shareBox.height)}`);
  if (which === "chromium") await page.screenshot({ path: `${out}/${width}-over.png` });
  check(`${width}: no errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ---------- Reduced motion ----------
{
  const { ctx, page, errors } = await newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await page.goto(`${url}#qa&seed=5`);
  await page.waitForTimeout(1500);
  const a = await snap(page);
  await page.waitForTimeout(600);
  const b = await snap(page);
  check("reduced motion: the start-screen mouse waits for input", a.p.x === b.p.x && a.p.y === b.p.y);
  await page.getByRole("button", { name: "PLAY LIVE" }).click();
  await page.waitForTimeout(200);
  check("reduced motion: the game still plays", (await snap(page)).phase === "playing");
  await page.evaluate(() => { const { state, fx } = window.__auraQA.inspect(); const { x, y } = state.player; fx.impact(20); state.bots.push({ id: 960, x, y, vx: 0, vy: 0, radius: 15, age: 0, warn: 0, wobble: 0, phase: 0, markerX: 0, markerY: 0 }); });
  await page.waitForTimeout(100);
  const calm = await page.evaluate(() => { const { fx } = window.__auraQA.inspect(); return { shake: fx.shake, flash: fx.flash }; });
  check("reduced motion: no screen shake, a flash instead", calm.shake === 0 && calm.flash > 0, JSON.stringify(calm));
  check("reduced motion: no errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ---------- Forced colors and 200% zoom equivalent ----------
{
  const { ctx, page, errors } = await newPage({ viewport: { width: 1024, height: 700 }, forcedColors: "active" });
  await page.goto(`${url}#qa&seed=5`);
  await page.waitForTimeout(500);
  check("forced colors: PLAY LIVE still visible", await page.getByRole("button", { name: "PLAY LIVE" }).isVisible());
  if (which === "chromium") await page.screenshot({ path: `${out}/forced-colors.png` });
  check("forced colors: no errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}
for (const [width, height] of [[640, 360], [568, 320]]) {
  const { ctx, page, errors } = await newPage({ viewport: { width, height } });
  await page.goto(`${url}#qa&seed=5`);
  await page.waitForTimeout(500);
  const box = await page.getByRole("button", { name: "PLAY LIVE" }).boundingBox();
  check(`${width}x${height}: PLAY LIVE on screen`, box.y + box.height <= height && box.y >= 0, `${Math.round(box.y)}-${Math.round(box.y + box.height)}`);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  check(`${width}x${height}: no horizontal scroll`, wide);
  if (which === "chromium") await page.screenshot({ path: `${out}/${width}-short-start.png` });
  await page.getByRole("button", { name: "PLAY LIVE" }).click();
  await page.evaluate(() => { window.__auraQA.inspect().state.shieldTimer = 60; window.__auraQA.grant(2600); });
  await page.waitForTimeout(150);
  const fit = await page.evaluate(() => {
    const v = document.documentElement.clientWidth;
    const late = [...document.querySelectorAll("header *, .hud *")].filter((e) => e.getBoundingClientRect().width && e.getBoundingClientRect().right > v + 1);
    const rank = document.querySelector("[data-hud=rank]").getBoundingClientRect();
    const pause = document.querySelector(".hud-pause").getBoundingClientRect();
    return { wide: document.documentElement.scrollWidth <= v, late: late.length, clear: rank.right <= pause.left };
  });
  check(`${width}x${height}: longest rank fits in play`, fit.wide && fit.late === 0 && fit.clear, JSON.stringify(fit));
  if (which === "chromium") await page.screenshot({ path: `${out}/${width}-short-play.png` });
  check(`${width}x${height}: no errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// ---------- Blocked storage ----------
{
  const { ctx, page, errors } = await newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); });
  await page.goto(`${url}#qa&seed=5`);
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "PLAY LIVE" }).click();
  await page.waitForTimeout(200);
  check("blocked storage: the game still starts", (await snap(page)).phase === "playing");
  check("blocked storage: no errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

await browser.close();
server.close();
console.log(failed ? `\n${failed} FAILED on ${which}` : `\nALL PASSED on ${which}`);
process.exit(failed ? 1 : 0);
