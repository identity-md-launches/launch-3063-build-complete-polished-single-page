import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { GameOverScreen } from "./components/GameOverScreen";
import { Hud } from "./components/Hud";
import { PauseScreen } from "./components/PauseScreen";
import { StartScreen } from "./components/StartScreen";
import { TopNav } from "./components/TopNav";
import { EMPTY_HUD, GameRuntime, type HudSnapshot, type RunResult } from "./game/runtime";
import { readHighScore, readMuted, writeHighScore, writeMuted } from "./game/storage";
import type { Rect } from "./game/types";

type Screen = "start" | "playing" | "paused" | "over";

/** The largest open area around the start panel, for the mouse to roam in. */
function openArea(stage: DOMRect, panel: DOMRect, hudHeight: number): Rect {
  const top = hudHeight + 12;
  const pad = 16;
  const left = panel.left - stage.left;
  const right = panel.right - stage.left;
  const above = panel.top - stage.top;
  const candidates: Rect[] = [
    { x0: pad, y0: top, x1: stage.width - pad, y1: above - pad },
    { x0: right + pad, y0: top, x1: stage.width - pad, y1: stage.height - pad },
    { x0: pad, y0: top, x1: left - pad, y1: stage.height - pad },
  ];
  const area = (r: Rect) => Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0);
  return candidates.reduce((best, rect) => (area(rect) > area(best) ? rect : best));
}

export function App() {
  const [screen, setScreen] = useState<Screen>("start");
  const [hud, setHud] = useState<HudSnapshot>(EMPTY_HUD);
  const [highScore, setHighScore] = useState(readHighScore);
  const [muted, setMuted] = useState(readMuted);
  const [result, setResult] = useState<RunResult | null>(null);
  const [previousHigh, setPreviousHigh] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  const stageRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLElement>(null);
  const startRef = useRef<HTMLElement>(null);
  const runtimeRef = useRef<GameRuntime | null>(null);
  const highRef = useRef(highScore);
  const screenRef = useRef(screen);
  screenRef.current = screen;

  // A layout effect, so the runtime exists before the measuring effect below first reports the layout.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    const hash = window.location.hash;
    const seed = /seed=(\d+)/.exec(hash)?.[1];
    const runtime = new GameRuntime(
      canvas,
      stage,
      {
        onHud: (next) => {
          setHud(next);
          if (next.score > highRef.current) {
            highRef.current = next.score;
            setHighScore(next.score);
            writeHighScore(next.score);
          }
        },
        onRankUp: (rank) => setAnnouncement(`Rank up: ${rank.name}.`),
        onGameOver: (run) => {
          setResult(run);
          setScreen("over");
          setAnnouncement("Game over.");
        },
      },
      {
        muted: readMuted(),
        reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        seed: seed ? Number(seed) : undefined,
      },
    );
    runtimeRef.current = runtime;

    // Automated checks only, and only when the URL asks for it. See the README.
    if (hash.includes("qa")) (window as unknown as { __auraQA: GameRuntime }).__auraQA = runtime;

    return () => {
      runtime.destroy();
      runtimeRef.current = null;
    };
  }, []);

  // Keeps the engine's play area and the start screen's roaming area in step with the layout.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    const hudElement = hudRef.current;
    if (!stage || !hudElement) return;
    const update = () => {
      const runtime = runtimeRef.current;
      if (!runtime) return;
      const hudHeight = hudElement.getBoundingClientRect().height;
      runtime.setHudHeight(hudHeight);
      const panel = startRef.current;
      if (screenRef.current === "start" && panel) {
        runtime.setFreeRect(openArea(stage.getBoundingClientRect(), panel.getBoundingClientRect(), hudHeight));
      }
    };
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    observer.observe(hudElement);
    if (startRef.current) observer.observe(startRef.current);
    update();
    return () => observer.disconnect();
  }, [screen]);

  const play = useCallback(() => {
    setPreviousHigh(highRef.current);
    setResult(null);
    setHud(EMPTY_HUD);
    setAnnouncement("");
    runtimeRef.current?.startRun();
    setScreen("playing");
  }, []);

  const pause = useCallback(() => {
    if (screenRef.current !== "playing") return;
    runtimeRef.current?.pause();
    setScreen("paused");
  }, []);

  const resume = useCallback(() => {
    if (screenRef.current !== "paused") return;
    runtimeRef.current?.resume();
    setScreen("playing");
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      writeMuted(next);
      runtimeRef.current?.setMuted(next);
      return next;
    });
  }, []);

  // The Play and Pause buttons leave the page when pressed, so focus moves to the game surface.
  useEffect(() => {
    if (screen === "playing") canvasRef.current?.focus({ preventScroll: true });
  }, [screen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (event.code === "KeyM") toggleMute();
      if (event.code === "Escape" || event.code === "KeyP") {
        if (screenRef.current === "playing") pause();
        else if (screenRef.current === "paused") resume();
      }
    };
    // A run never carries on unattended.
    const onHidden = () => {
      if (document.hidden) pause();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [pause, resume, toggleMute]);

  return (
    <div className="app">
      <TopNav muted={muted} onToggleMute={toggleMute} />
      <main className="stage" ref={stageRef}>
        <canvas
          className="stage-canvas"
          ref={canvasRef}
          tabIndex={-1}
          role="img"
          aria-label="Game field. Steer the Cyber-Mouse with the mouse, touch, WASD or arrow keys."
        />
        <Hud ref={hudRef} hud={hud} highScore={highScore} playing={screen === "playing"} onPause={pause} />
        {screen === "playing" && <h1 className="sr-only">SQUEEK RUNNER: AURA PROTOCOL, run in progress</h1>}
        {screen === "start" && (
          <div className="overlay overlay-start">
            <StartScreen ref={startRef} onPlay={play} />
          </div>
        )}
        {screen === "paused" && (
          <div className="overlay">
            <PauseScreen onResume={resume} onRestart={play} />
          </div>
        )}
        {screen === "over" && result && (
          <div className="overlay">
            <GameOverScreen result={result} previousHigh={previousHigh} highScore={highScore} onPlayAgain={play} />
          </div>
        )}
      </main>
      <p className="sr-only" role="status">
        {announcement}
      </p>
    </div>
  );
}
