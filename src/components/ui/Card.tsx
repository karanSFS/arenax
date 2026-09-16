"use client";

import { motion } from "framer-motion";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: "cyan" | "purple" | "pink" | "green" | "none";
  onClick?: () => void;
}

export function Card({ children, className = "", hover = true, glow = "none", onClick }: CardProps) {
  const glowMap = {
    cyan: "hover:border-neon-cyan/30 hover:shadow-neon-cyan",
    purple: "hover:border-neon-purple/30 hover:shadow-neon-purple",
    pink: "hover:border-neon-pink/30 hover:shadow-neon-pink",
    green: "hover:border-neon-green/30 hover:shadow-neon-green",
    none: "",
  };

  return (
    <motion.div
      onClick={onClick}
      whileHover={hover ? { y: -2 } : {}}
      transition={{ duration: 0.2 }}
      className={`
        glass rounded-2xl border border-white/8
        ${hover ? `cursor-pointer transition-all duration-300 ${glowMap[glow]}` : ""}
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  color = "cyan",
  sub,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: "cyan" | "purple" | "pink" | "green" | "gold";
  sub?: string;
}) {
  const colorMap = {
    cyan: "text-neon-cyan border-neon-cyan/20",
    purple: "text-neon-purple border-neon-purple/20",
    pink: "text-neon-pink border-neon-pink/20",
    green: "text-neon-green border-neon-green/20",
    gold: "text-yellow-400 border-yellow-400/20",
  };

  return (
    <Card className={`p-5 border ${colorMap[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest font-display">
            {label}
          </p>
          <p className={`text-2xl font-black font-display mt-1 ${colorMap[color].split(" ")[0]}`}>
            {value}
          </p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        {icon && (
          <div className={`opacity-60 ${colorMap[color].split(" ")[0]}`}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

interface SkeletonProps {
  className?: string;
}
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div className={`shimmer rounded-lg bg-white/5 ${className}`} />
  );
}
