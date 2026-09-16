"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { TouchController } from "@/game/input/InputController";
import { Crosshair, Zap, Shield, Flame, EyeOff } from "lucide-react";

interface TouchControlsOverlayProps {
  touchController: TouchController | null;
  characterSlug?: string;
  cooldowns?: {
    primary: number;
    secondary: number;
    ultimate: number;
  };
}

export const TouchControlsOverlay: React.FC<TouchControlsOverlayProps> = ({
  touchController,
  characterSlug = "volt",
  cooldowns,
}) => {
  const [isMobileOrTouch, setIsMobileOrTouch] = useState(false);
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const [joystickOrigin, setJoystickOrigin] = useState({ x: 80, y: 80 });

  const joystickTouchIdRef = useRef<number | null>(null);
  const joystickBaseRef = useRef<HTMLDivElement>(null);

  // Check if device supports touch or is a mobile viewport
  useEffect(() => {
    const checkTouch = () => {
      const hasTouch =
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        window.innerWidth <= 1024;
      setIsMobileOrTouch(hasTouch);
    };
    checkTouch();
    window.addEventListener("resize", checkTouch);
    return () => window.removeEventListener("resize", checkTouch);
  }, []);

  // Joystick touch handlers
  const handleJoystickStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (joystickTouchIdRef.current !== null) return;

    const touch = e.changedTouches[0];
    joystickTouchIdRef.current = touch.identifier;

    if (joystickBaseRef.current) {
      const rect = joystickBaseRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      setJoystickOrigin({ x: centerX, y: centerY });
    }

    setJoystickActive(true);
    setJoystickPos({ x: 0, y: 0 });
    touchController?.setJoystick(0, 0);
  }, [touchController]);

  const handleJoystickMove = useCallback((e: TouchEvent) => {
    if (joystickTouchIdRef.current === null || !touchController) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchIdRef.current) {
        const dx = touch.clientX - joystickOrigin.x;
        const dy = touch.clientY - joystickOrigin.y;
        const dist = Math.hypot(dx, dy);
        const maxDist = 48; // Max thumb travel distance

        let clampedX = dx;
        let clampedY = dy;

        if (dist > maxDist) {
          clampedX = (dx / dist) * maxDist;
          clampedY = (dy / dist) * maxDist;
        }

        setJoystickPos({ x: clampedX, y: clampedY });

        // Normalized vector between -1 and 1
        const normX = clampedX / maxDist;
        const normY = clampedY / maxDist;
        touchController.setJoystick(normX, normY);
        break;
      }
    }
  }, [joystickOrigin, touchController]);

  const handleJoystickEnd = useCallback((e: TouchEvent) => {
    if (joystickTouchIdRef.current === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchIdRef.current) {
        joystickTouchIdRef.current = null;
        setJoystickActive(false);
        setJoystickPos({ x: 0, y: 0 });
        touchController?.setJoystick(0, 0);
        break;
      }
    }
  }, [touchController]);

  useEffect(() => {
    window.addEventListener("touchmove", handleJoystickMove, { passive: false });
    window.addEventListener("touchend", handleJoystickEnd);
    window.addEventListener("touchcancel", handleJoystickEnd);

    return () => {
      window.removeEventListener("touchmove", handleJoystickMove);
      window.removeEventListener("touchend", handleJoystickEnd);
      window.removeEventListener("touchcancel", handleJoystickEnd);
    };
  }, [handleJoystickMove, handleJoystickEnd]);

  // Touch aim / drag on the right screen zone
  const aimTouchIdRef = useRef<number | null>(null);

  const handleAimAreaTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (aimTouchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    aimTouchIdRef.current = touch.identifier;
    touchController?.setAim(touch.clientX, touch.clientY);
  }, [touchController]);

  const handleAimAreaTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (aimTouchIdRef.current === null || !touchController) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === aimTouchIdRef.current) {
        touchController.setAim(touch.clientX, touch.clientY);
        break;
      }
    }
  }, [touchController]);

  const handleAimAreaTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (aimTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === aimTouchIdRef.current) {
        aimTouchIdRef.current = null;
        break;
      }
    }
  }, []);

  if (!isMobileOrTouch) {
    return null;
  }

  // Icons based on character
  const renderAbility2Icon = () => {
    if (characterSlug === "titan") return <Shield className="w-5 h-5 text-emerald-400" />;
    if (characterSlug === "phantom") return <EyeOff className="w-5 h-5 text-purple-400" />;
    if (characterSlug === "blaze") return <Flame className="w-5 h-5 text-orange-400" />;
    return <Zap className="w-5 h-5 text-cyan-400" />;
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-30 select-none overflow-hidden touch-none">
      {/* Right-half Aim Touch Capture Area */}
      <div
        className="absolute top-0 right-0 w-1/2 h-full pointer-events-auto z-10"
        onTouchStart={handleAimAreaTouchStart}
        onTouchMove={handleAimAreaTouchMove}
        onTouchEnd={handleAimAreaTouchEnd}
        onTouchCancel={handleAimAreaTouchEnd}
      />

      {/* Left Bottom: Virtual Joystick */}
      <div className="absolute left-6 bottom-8 pointer-events-auto z-20">
        <div
          ref={joystickBaseRef}
          onTouchStart={handleJoystickStart}
          className={`relative w-36 h-36 rounded-full border-2 transition-colors flex items-center justify-center ${
            joystickActive
              ? "bg-cyan-950/40 border-cyan-400 shadow-[0_0_20px_rgba(0,245,255,0.4)]"
              : "bg-slate-900/50 border-slate-700/80 backdrop-blur-sm"
          }`}
        >
          {/* Inner direction indicators */}
          <div className="absolute top-2 w-1.5 h-1.5 rounded-full bg-cyan-400/40" />
          <div className="absolute bottom-2 w-1.5 h-1.5 rounded-full bg-cyan-400/40" />
          <div className="absolute left-2 w-1.5 h-1.5 rounded-full bg-cyan-400/40" />
          <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-cyan-400/40" />

          {/* Thumb Stick */}
          <div
            style={{
              transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
              transition: joystickActive ? "none" : "transform 0.15s ease-out",
            }}
            className={`w-14 h-14 rounded-full border-2 flex items-center justify-center ${
              joystickActive
                ? "bg-cyan-500/80 border-cyan-200 shadow-[0_0_15px_#00f5ff]"
                : "bg-slate-700/80 border-slate-500"
            }`}
          >
            <div className="w-4 h-4 rounded-full bg-white/60" />
          </div>
        </div>
      </div>

      {/* Right Bottom: Combat Action Buttons */}
      <div className="absolute right-6 bottom-8 pointer-events-auto z-20 flex flex-col items-end gap-3">
        {/* Upper row: Ability 1 (Q) & Ability 2 (E) */}
        <div className="flex items-center gap-3 mr-4">
          {/* Ability 1 (Q) */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              touchController?.setAbility1(true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              touchController?.setAbility1(false);
            }}
            className="relative w-14 h-14 rounded-full bg-slate-900/80 border-2 border-cyan-500/70 active:bg-cyan-600/40 active:scale-95 transition-all flex flex-col items-center justify-center backdrop-blur-sm shadow-lg shadow-cyan-950/50"
          >
            <Zap className="w-5 h-5 text-cyan-400" />
            <span className="text-[9px] font-mono text-cyan-300/80 font-bold">Q</span>
            {cooldowns && cooldowns.primary > 0 && (
              <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center text-xs font-mono font-bold text-white">
                {cooldowns.primary.toFixed(1)}
              </div>
            )}
          </button>

          {/* Ability 2 / Dash / Shield (E) */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              touchController?.setAbility2(true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              touchController?.setAbility2(false);
            }}
            className="relative w-14 h-14 rounded-full bg-slate-900/80 border-2 border-emerald-500/70 active:bg-emerald-600/40 active:scale-95 transition-all flex flex-col items-center justify-center backdrop-blur-sm shadow-lg shadow-emerald-950/50"
          >
            {renderAbility2Icon()}
            <span className="text-[9px] font-mono text-emerald-300/80 font-bold">E</span>
            {cooldowns && cooldowns.secondary > 0 && (
              <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center text-xs font-mono font-bold text-white">
                {cooldowns.secondary.toFixed(1)}
              </div>
            )}
          </button>
        </div>

        {/* Lower row: Ultimate (R) & Primary Attack (FIRE) */}
        <div className="flex items-center gap-4">
          {/* Ultimate (R) */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              touchController?.setUltimate(true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              touchController?.setUltimate(false);
            }}
            className="relative w-15 h-15 rounded-full bg-gradient-to-br from-amber-500/20 to-pink-600/30 border-2 border-pink-500 active:scale-95 transition-all flex flex-col items-center justify-center backdrop-blur-sm shadow-[0_0_15px_rgba(255,45,120,0.4)]"
          >
            <span className="text-sm font-black text-pink-400">ULT</span>
            <span className="text-[9px] font-mono text-pink-300/90 font-bold">R</span>
            {cooldowns && cooldowns.ultimate > 0 && (
              <div className="absolute inset-0 rounded-full bg-black/75 flex items-center justify-center text-xs font-mono font-bold text-pink-300">
                {Math.ceil(cooldowns.ultimate)}
              </div>
            )}
          </button>

          {/* Primary Attack (Crosshair / FIRE) */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              touchController?.setAttack(true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              touchController?.setAttack(false);
            }}
            className="w-20 h-20 rounded-full bg-gradient-to-br from-red-600 to-rose-700 border-3 border-white/80 active:scale-95 active:bg-red-500 transition-all flex flex-col items-center justify-center shadow-[0_0_25px_rgba(239,68,68,0.7)]"
          >
            <Crosshair className="w-8 h-8 text-white" />
            <span className="text-[10px] font-mono font-black text-white tracking-wider">FIRE</span>
          </button>
        </div>
      </div>
    </div>
  );
};
