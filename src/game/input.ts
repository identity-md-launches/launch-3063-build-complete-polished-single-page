// Turns keys, mouse and touch into one Steering value.
// A mouse steers to the cursor. A finger drags relative to where it landed, so it never hides the Cyber-Mouse.

import type { Steering, Vec } from "./types";

const AXES: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  KeyW: [0, -1],
  KeyS: [0, 1],
  KeyA: [-1, 0],
  KeyD: [1, 0],
};

export class Input {
  private readonly held = new Set<string>();
  private target: Vec | null = null;
  private touchId: number | null = null;
  private touchOffset: Vec = { x: 0, y: 0 };
  /** performance.now() of the last deliberate input, so the start screen knows when to self-steer. */
  lastActive = -Infinity;
  /** While false, keys pass through to the page, so a scrolling panel still answers the arrow keys. */
  captureKeys = true;

  constructor(
    private readonly surface: HTMLElement,
    private readonly playerPosition: () => Vec,
  ) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.clearKeys);
    surface.addEventListener("pointerdown", this.onPointerDown);
    surface.addEventListener("pointermove", this.onPointerMove);
    surface.addEventListener("pointerup", this.onPointerEnd);
    surface.addEventListener("pointercancel", this.onPointerEnd);
  }

  read(): Steering {
    let axisX = 0;
    let axisY = 0;
    for (const code of this.held) {
      const axis = AXES[code];
      if (axis) {
        axisX += axis[0];
        axisY += axis[1];
      }
    }
    return { axisX: Math.sign(axisX), axisY: Math.sign(axisY), target: this.target };
  }

  /** Drops any pointer target, so a new run starts with the mouse at rest. */
  reset(): void {
    this.target = null;
    this.touchId = null;
    this.held.clear();
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (!(event.code in AXES) || !this.captureKeys) return;
    // Never swallow a shortcut or a key meant for a focused control.
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    this.held.add(event.code);
    this.target = null;
    this.lastActive = performance.now();
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.held.delete(event.code);
  };

  private readonly clearKeys = () => {
    this.held.clear();
  };

  private local(event: PointerEvent): Vec {
    const rect = this.surface.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private readonly onPointerDown = (event: PointerEvent) => {
    // A finger on a control or a screen panel is using that, not steering.
    if ((event.target as Element).closest("a, button, .panel")) return;
    if (event.pointerType === "mouse") return;
    if (this.touchId !== null) return;
    const at = this.local(event);
    const player = this.playerPosition();
    this.touchId = event.pointerId;
    this.touchOffset = { x: player.x - at.x, y: player.y - at.y };
    this.target = { x: player.x, y: player.y };
    this.lastActive = performance.now();
    this.surface.setPointerCapture?.(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === "mouse") {
      this.target = this.local(event);
      this.lastActive = performance.now();
    } else if (event.pointerId === this.touchId) {
      const at = this.local(event);
      this.target = { x: at.x + this.touchOffset.x, y: at.y + this.touchOffset.y };
      this.lastActive = performance.now();
    }
  };

  private readonly onPointerEnd = (event: PointerEvent) => {
    if (event.pointerId !== this.touchId) return;
    this.touchId = null;
    this.target = null;
  };

  destroy(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.clearKeys);
    this.surface.removeEventListener("pointerdown", this.onPointerDown);
    this.surface.removeEventListener("pointermove", this.onPointerMove);
    this.surface.removeEventListener("pointerup", this.onPointerEnd);
    this.surface.removeEventListener("pointercancel", this.onPointerEnd);
  }
}
