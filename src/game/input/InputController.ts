// ═══════════════════════════════════════════
// INPUT CONTROLLER
// Keyboard + Touch/Joystick input
// ═══════════════════════════════════════════

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  attack: boolean;
  ability1: boolean; // Q
  ability2: boolean; // E
  ultimate: boolean; // R
  aimX: number;
  aimY: number;
  sequence: number;
}

export class KeyboardController {
  private keys = new Set<string>();
  private mouseX = 0;
  private mouseY = 0;
  private sequence = 0;
  private canvas: HTMLCanvasElement;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    this.boundKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      this.keys.add(e.code.toLowerCase());
    };
    this.boundKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code.toLowerCase());
    };
    this.boundMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      this.mouseX = (e.clientX - rect.left) * scaleX;
      this.mouseY = (e.clientY - rect.top) * scaleY;
    };

    window.addEventListener("keydown", this.boundKeyDown);
    window.addEventListener("keyup", this.boundKeyUp);
    canvas.addEventListener("mousemove", this.boundMouseMove);
  }

  getState(): InputState {
    return {
      up: this.keys.has("keyw") || this.keys.has("arrowup"),
      down: this.keys.has("keys") || this.keys.has("arrowdown"),
      left: this.keys.has("keya") || this.keys.has("arrowleft"),
      right: this.keys.has("keyd") || this.keys.has("arrowright"),
      attack: this.keys.has("space") || this.keys.has("mouseleft"),
      ability1: this.keys.has("keyq"),
      ability2: this.keys.has("keye"),
      ultimate: this.keys.has("keyr"),
      aimX: this.mouseX,
      aimY: this.mouseY,
      sequence: ++this.sequence,
    };
  }

  setMouseClick(down: boolean) {
    if (down) {
      this.keys.add("mouseleft");
    } else {
      this.keys.delete("mouseleft");
    }
  }

  destroy() {
    window.removeEventListener("keydown", this.boundKeyDown);
    window.removeEventListener("keyup", this.boundKeyUp);
    this.canvas.removeEventListener("mousemove", this.boundMouseMove);
  }
}

// ─── Touch / Virtual Joystick ─────────────────────────────────────────────────
export class TouchController {
  private joystickDelta = { x: 0, y: 0 };
  private attackPressed = false;
  private ability1Pressed = false;
  private ability2Pressed = false;
  private ultimatePressed = false;
  private aimX = 0;
  private aimY = 0;
  private sequence = 0;

  setJoystick(dx: number, dy: number) {
    this.joystickDelta = { x: dx, y: dy };
  }

  setAttack(v: boolean) { this.attackPressed = v; }
  setAbility1(v: boolean) { this.ability1Pressed = v; }
  setAbility2(v: boolean) { this.ability2Pressed = v; }
  setUltimate(v: boolean) { this.ultimatePressed = v; }
  setAim(x: number, y: number) { this.aimX = x; this.aimY = y; }

  getState(): InputState {
    const threshold = 0.3;
    return {
      up: this.joystickDelta.y < -threshold,
      down: this.joystickDelta.y > threshold,
      left: this.joystickDelta.x < -threshold,
      right: this.joystickDelta.x > threshold,
      attack: this.attackPressed,
      ability1: this.ability1Pressed,
      ability2: this.ability2Pressed,
      ultimate: this.ultimatePressed,
      aimX: this.aimX,
      aimY: this.aimY,
      sequence: ++this.sequence,
    };
  }
}
