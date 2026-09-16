"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeMap = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({ isOpen, onClose, title, children, size = "md" }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          {/* Panel */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 400 }}
            className={`relative w-full ${sizeMap[size]} glass-medium rounded-2xl border border-white/10 shadow-2xl`}
          >
            {title && (
              <div className="flex items-center justify-between p-6 border-b border-white/8">
                <h2 className="text-lg font-black font-display tracking-widest uppercase text-white">
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
                  aria-label="Close modal"
                >
                  <X size={20} />
                </button>
              </div>
            )}
            {!title && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10 z-10"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            )}
            <div className="p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ─── Badge ─────────────────────────────────────────────────────────────────────
type BadgeVariant = "cyan" | "purple" | "pink" | "green" | "gold" | "gray";

const badgeColors: Record<BadgeVariant, string> = {
  cyan: "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30",
  purple: "bg-neon-purple/10 text-neon-purple border-neon-purple/30",
  pink: "bg-neon-pink/10 text-neon-pink border-neon-pink/30",
  green: "bg-neon-green/10 text-neon-green border-neon-green/30",
  gold: "bg-yellow-400/10 text-yellow-400 border-yellow-400/30",
  gray: "bg-white/5 text-slate-400 border-white/10",
};

export function Badge({
  children,
  variant = "cyan",
  className = "",
  style,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={style}
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold font-display tracking-wide uppercase border ${badgeColors[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
export function ProgressBar({
  value,
  max = 100,
  color = "cyan",
  label,
  showValue = true,
  className = "",
}: {
  value: number;
  max?: number;
  color?: "cyan" | "purple" | "pink" | "green" | "gold";
  label?: string;
  showValue?: boolean;
  className?: string;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const colorMap = {
    cyan: "from-neon-cyan to-neon-purple",
    purple: "from-neon-purple to-neon-pink",
    pink: "from-neon-pink to-neon-orange",
    green: "from-neon-green to-neon-cyan",
    gold: "from-yellow-400 to-neon-orange",
  };

  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="flex justify-between mb-1.5 text-xs text-slate-400">
          {label && <span>{label}</span>}
          {showValue && <span>{value} / {max}</span>}
        </div>
      )}
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full bg-gradient-to-r ${colorMap[color]}`}
        />
      </div>
    </div>
  );
}

// ─── Avatar ────────────────────────────────────────────────────────────────────
export function Avatar({
  username,
  size = "md",
  className = "",
}: {
  username: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizeMap = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-16 h-16 text-xl",
    xl: "w-24 h-24 text-3xl",
  };

  const initial = username?.[0]?.toUpperCase() ?? "?";
  const hue = username
    ? username.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360
    : 180;

  return (
    <div
      className={`${sizeMap[size]} rounded-full flex items-center justify-center font-black font-display border-2 ${className}`}
      style={{
        background: `hsl(${hue}, 70%, 20%)`,
        borderColor: `hsl(${hue}, 70%, 50%)`,
        color: `hsl(${hue}, 90%, 65%)`,
        boxShadow: `0 0 15px hsl(${hue}, 70%, 40% / 0.3)`,
      }}
    >
      {initial}
    </div>
  );
}

// ─── Loading Spinner ──────────────────────────────────────────────────────────
export function Spinner({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`animate-spin ${className}`}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Input ─────────────────────────────────────────────────────────────────────
export function Input({
  label,
  error,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-bold tracking-widest uppercase text-slate-400 font-display">
          {label}
        </label>
      )}
      <input
        className={`w-full bg-white/5 border ${
          error ? "border-neon-pink/60" : "border-white/10"
        } rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600
        focus:outline-none focus:border-neon-cyan/60 focus:bg-white/8
        transition-all duration-200 ${className}`}
        {...props}
      />
      {error && (
        <p className="text-xs text-neon-pink">{error}</p>
      )}
    </div>
  );
}

// ─── Skeleton Loader ──────────────────────────────────────────────────────────
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl bg-white/5 animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
type StatColor = "cyan" | "purple" | "pink" | "green" | "gold";

const statColorMap: Record<StatColor, { bg: string; border: string; text: string }> = {
  cyan: { bg: "bg-neon-cyan/5", border: "border-neon-cyan/20", text: "text-neon-cyan" },
  purple: { bg: "bg-neon-purple/5", border: "border-neon-purple/20", text: "text-neon-purple" },
  pink: { bg: "bg-neon-pink/5", border: "border-neon-pink/20", text: "text-neon-pink" },
  green: { bg: "bg-neon-green/5", border: "border-neon-green/20", text: "text-neon-green" },
  gold: { bg: "bg-yellow-400/5", border: "border-yellow-400/20", text: "text-yellow-400" },
};

export function StatCard({
  label,
  value,
  icon,
  color = "cyan",
  className = "",
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: StatColor;
  className?: string;
}) {
  const c = statColorMap[color];
  return (
    <div className={`${c.bg} border ${c.border} rounded-2xl p-5 ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest font-display">{label}</p>
          <p className={`text-2xl font-black font-display mt-1 ${c.text}`}>{value}</p>
        </div>
        {icon && (
          <div className={`opacity-60 ${c.text}`}>{icon}</div>
        )}
      </div>
    </div>
  );
}
