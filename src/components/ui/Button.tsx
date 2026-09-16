"use client";

import { forwardRef } from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "neon";
type ButtonSize = "sm" | "md" | "lg" | "xl";

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-neon-cyan/10 to-neon-purple/10 border border-neon-cyan/40 text-neon-cyan hover:from-neon-cyan/20 hover:to-neon-purple/20 hover:border-neon-cyan/70 hover:shadow-neon-cyan",
  secondary:
    "bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20 hover:text-white",
  danger:
    "bg-neon-pink/10 border border-neon-pink/40 text-neon-pink hover:bg-neon-pink/20 hover:border-neon-pink/70 hover:shadow-neon-pink",
  ghost:
    "bg-transparent border border-transparent text-slate-400 hover:text-white hover:bg-white/5",
  neon:
    "bg-gradient-to-r from-neon-cyan to-neon-purple text-dark-900 font-black hover:opacity-90 hover:shadow-neon-cyan border-0",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-5 py-2.5 text-sm gap-2",
  lg: "px-8 py-3 text-base gap-2",
  xl: "px-10 py-4 text-lg gap-3",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      children,
      className = "",
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center
          font-display font-semibold tracking-wide uppercase rounded-lg
          transition-all duration-200
          focus-visible:outline-neon-cyan focus-visible:outline-2
          disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${fullWidth ? "w-full" : ""}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </motion.button>
    );
  }
);

Button.displayName = "Button";
