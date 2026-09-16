// ═══════════════════════════════════════════
// INPUT CONTROLLER
// Dual Control: Pure Arrow Keys / WASD OR Precision Mouse Aiming
// Keyboard + Mouse + Touch/Joystick input
// ═══════════════════════════════════════════

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  attack: boolean;     // Space / Left Click / On-screen attack button
  ability1: boolean;   // Q / Skill 1 (Mobility / Dash / Shield)
  ability2: boolean;   // E / Skill 2 (Tactical blast)
  ultimate: boolean;   // R / Ultimate
  aimX: number;
  aimY: number;
  isMouseAiming: boolean; // True if mouse moved/clicked recently and not overriding with pure arrow steering
  sequence: number;
}

export class KeyboardController {
  private keys = new Set<string>();
  private mouseX = 0;
  private mouseY = 0;
  private lastMouseMoveTime = 0;
  private leftMouseDown = false;
  private rightMouseDown = false;
  private sequence = 0;
  private canvas: HTMLCanvasElement;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseUp: (e: MouseEvent) => void;
  private boundContextMenu: (e: MouseEvent) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    this.boundKeyDown = (e: KeyboardEvent) => {
      const code = e.code.toLowerCase();
      // Prevent browser scrolling on space and arrow keys
      if ([
        "space",
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
        "keyw",
        "keys",
        "keya",
        "keyd",
        "keyq",
        "keye",
        "keyr"
      ].includes(code)) {
        e.preventDefault();
      }
      this.keys.add(code);
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
      this.lastMouseMoveTime = Date.now();
    };

    this.boundMouseDown = (e: MouseEvent) => {
      this.lastMouseMoveTime = Date.now();
      if (e.button === 0) {
        this.leftMouseDown = true;
        this.keys.add("mouseleft");
      } else if (e.button === 2) {
        this.rightMouseDown = true;
      }
    };

    this.boundMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        this.leftMouseDown = false;
        this.keys.delete("mouseleft");
      } else if (e.button === 2) {
        this.rightMouseDown = false;
      }
    };

    this.boundContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener("keydown", this.boundKeyDown);
    window.addEventListener("keyup", this.boundKeyUp);
    canvas.addEventListener("mousemove", this.boundMouseMove);
    canvas.addEventListener("mousedown", this.boundMouseDown);
    canvas.addEventListener("mouseup", this.boundMouseUp);
    canvas.addEventListener("contextmenu", this.boundContextMenu);
  }

  triggerAction(action: "attack" | "ability1" | "ability2" | "ultimate", active = true) {
    const map: Record<string, string> = {
      attack: "space",
      ability1: "keyq",
      ability2: "keye",
      ultimate: "keyr",
    };
    const key = map[action];
    if (key) {
      if (active) this.keys.add(key);
      else this.keys.delete(key);
    }
  }

  getState(playerScreenPos?: { x: number; y: number }): InputState {
    // Optional mouse right-click to steer/walk
    let mouseNavX = 0;
    let mouseNavY = 0;
    if (this.rightMouseDown && playerScreenPos) {
      const rdx = this.mouseX - playerScreenPos.x;
      const rdy = this.mouseY - playerScreenPos.y;
      if (Math.hypot(rdx, rdy) > 35) {
        if (rdy < -20) mouseNavY = -1;
        if (rdy > 20) mouseNavY = 1;
        if (rdx < -20) mouseNavX = -1;
        if (rdx > 20) mouseNavX = 1;
      }
    }

    const hasArrowKeys =
      this.keys.has("arrowup") ||
      this.keys.has("arrowdown") ||
      this.keys.has("arrowleft") ||
      this.keys.has("arrowright");

    // If player uses arrow keys without holding left mouse, prioritize arrow directional aiming!
    // If mouse was actively moved recently and user is using WASD or mouse, use precision mouse aiming.
    const recentMouseMotion = Date.now() - this.lastMouseMoveTime < 1200;
    const isMouseAiming = this.leftMouseDown || (recentMouseMotion && !hasArrowKeys);

    return {
      up: this.keys.has("keyw") || this.keys.has("arrowup") || mouseNavY < 0,
      down: this.keys.has("keys") || this.keys.has("arrowdown") || mouseNavY > 0,
      left: this.keys.has("keya") || this.keys.has("arrowleft") || mouseNavX < 0,
      right: this.keys.has("keyd") || this.keys.has("arrowright") || mouseNavX > 0,
      attack: this.keys.has("space") || this.keys.has("mouseleft"),
      ability1: this.keys.has("keyq"),
      ability2: this.keys.has("keye"),
      ultimate: this.keys.has("keyr"),
      aimX: this.mouseX,
      aimY: this.mouseY,
      isMouseAiming,
      sequence: ++this.sequence,
    };
  }

  setMouseClick(down: boolean) {
    if (down) {
      this.leftMouseDown = true;
      this.keys.add("mouseleft");
      this.lastMouseMoveTime = Date.now();
    } else {
      this.leftMouseDown = false;
      this.keys.delete("mouseleft");
    }
  }

  destroy() {
    window.removeEventListener("keydown", this.boundKeyDown);
    window.removeEventListener("keyup", this.boundKeyUp);
    this.canvas.removeEventListener("mousemove", this.boundMouseMove);
    this.canvas.removeEventListener("mousedown", this.boundMouseDown);
    this.canvas.removeEventListener("mouseup", this.boundMouseUp);
    this.canvas.removeEventListener("contextmenu", this.boundContextMenu);
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
  private hasAim = false;
  private sequence = 0;

  setJoystick(dx: number, dy: number) {
    this.joystickDelta = { x: dx, y: dy };
  }

  setAttack(v: boolean) { this.attackPressed = v; }
  setAbility1(v: boolean) { this.ability1Pressed = v; }
  setAbility2(v: boolean) { this.ability2Pressed = v; }
  setUltimate(v: boolean) { this.ultimatePressed = v; }
  setAim(x: number, y: number) {
    this.aimX = x;
    this.aimY = y;
    this.hasAim = true;
  }
  clearAim() {
    this.hasAim = false;
  }

  resetAll() {
    this.joystickDelta = { x: 0, y: 0 };
    this.attackPressed = false;
    this.ability1Pressed = false;
    this.ability2Pressed = false;
    this.ultimatePressed = false;
    this.hasAim = false;
  }

  getState(): InputState {
    const threshold = 0.25;
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
      isMouseAiming: this.hasAim,
      sequence: ++this.sequence,
    };
  }
}
