"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useRef, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Swords, Shield, Zap, Trophy, Users, Star, ChevronRight,
  Globe, Cpu, Flame
} from "lucide-react";
import { Button } from "@/components/ui/Button";

// Animated particle background
function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const particles: Array<{ x: number; y: number; vx: number; vy: number; r: number; color: string; alpha: number }> = [];
    const colors = ["#00f5ff", "#bf5fff", "#ff2d78", "#39ff14"];

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -0.2 - Math.random() * 0.5,
        r: 1 + Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 0.3 + Math.random() * 0.5,
      });
    }

    let raf = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -5) p.y = canvas.height + 5;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;

        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 6;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
}

const features = [
  {
    icon: Globe,
    title: "Real-Time Multiplayer",
    desc: "Battle players worldwide with near-zero latency synchronization and client-side prediction.",
    color: "cyan",
  },
  {
    icon: Cpu,
    title: "4 Unique Fighters",
    desc: "Choose Blaze, Volt, Titan, or Phantom — each with distinct abilities and playstyles.",
    color: "purple",
  },
  {
    icon: Flame,
    title: "3 Epic Arenas",
    desc: "Fight across Cyber Grid, Void Core, and Industrial Zone with full collision systems.",
    color: "pink",
  },
  {
    icon: Trophy,
    title: "Ranked Progression",
    desc: "Earn XP, level up, and climb from Bronze to Diamond on the global leaderboard.",
    color: "gold",
  },
  {
    icon: Shield,
    title: "Private Rooms",
    desc: "Create custom matches with unique room codes and invite friends to battle.",
    color: "green",
  },
  {
    icon: Star,
    title: "Achievements",
    desc: "Unlock achievements, earn bonus rewards, and showcase your combat mastery.",
    color: "cyan",
  },
];

const gameModes = [
  { name: "QUICK MATCH", desc: "Jump straight into battle", icon: Swords, color: "#00f5ff" },
  { name: "PRIVATE ROOM", desc: "Play with friends via room code", icon: Users, color: "#bf5fff" },
  { name: "PRACTICE", desc: "Train against AI bots", icon: Shield, color: "#39ff14" },
];

export default function LandingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  useEffect(() => {
    if (session) router.replace("/dashboard");
  }, [session, router]);

  return (
    <main className="min-h-screen bg-dark-900 overflow-x-hidden">
      {/* ─── Hero Section ─── */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
      >
        <ParticleBackground />

        {/* Grid overlay */}
        <div className="absolute inset-0 bg-grid opacity-40" />

        {/* Radial gradient */}
        <div className="absolute inset-0 bg-gradient-radial from-neon-cyan/5 via-transparent to-transparent" />

        {/* Hero content */}
        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 text-center px-4 max-w-5xl mx-auto"
        >
          {/* Logo badge */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, type: "spring" }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-neon-cyan/20 mb-8"
          >
            <Zap size={14} className="text-neon-cyan" />
            <span className="text-xs font-display font-bold tracking-widest text-neon-cyan">
              REAL-TIME MULTIPLAYER ARENA
            </span>
          </motion.div>

          {/* Main title */}
          <motion.h1
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display font-black text-7xl sm:text-8xl md:text-[10rem] tracking-[0.15em] mb-4 leading-none"
          >
            <span className="gradient-text">ARENA</span>
            <span className="text-white">X</span>
          </motion.h1>

          {/* Tagline */}
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-xl sm:text-2xl text-slate-400 mb-4 font-light tracking-wide"
          >
            ENTER THE ARENA.{" "}
            <span className="text-white font-semibold">OUTPLAY EVERYONE.</span>
          </motion.p>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-slate-500 mb-12 max-w-xl mx-auto"
          >
            A real-time 2D multiplayer browser battle game with ranked progression,
            unique fighters, and cinematic combat.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link href="/register">
              <Button variant="neon" size="xl" rightIcon={<ChevronRight size={20} />}>
                PLAY NOW — FREE
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary" size="xl">
                SIGN IN
              </Button>
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex justify-center gap-12 mt-16 text-center"
          >
            {[
              { label: "FIGHTERS", value: "4" },
              { label: "ARENAS", value: "3" },
              { label: "GAME MODES", value: "3" },
              { label: "ACHIEVEMENTS", value: "10+" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-3xl font-black font-display gradient-text">{stat.value}</div>
                <div className="text-xs text-slate-500 font-display tracking-widest mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-slate-600"
        >
          <ChevronRight size={24} className="rotate-90" />
        </motion.div>
      </section>

      {/* ─── Game Modes ─── */}
      <section className="py-24 px-4 relative">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display font-black text-4xl md:text-5xl gradient-text mb-4">
              GAME MODES
            </h2>
            <p className="text-slate-500">Three ways to battle</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {gameModes.map((mode, i) => {
              const Icon = mode.icon;
              return (
                <motion.div
                  key={mode.name}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -4 }}
                  className="glass rounded-2xl p-8 border border-white/8 text-center group cursor-pointer"
                  style={{ borderColor: `${mode.color}22` }}
                >
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                    style={{ background: `${mode.color}15`, border: `1px solid ${mode.color}40` }}
                  >
                    <Icon size={28} style={{ color: mode.color }} />
                  </div>
                  <h3
                    className="font-display font-black text-xl mb-2 tracking-widest"
                    style={{ color: mode.color }}
                  >
                    {mode.name}
                  </h3>
                  <p className="text-slate-400 text-sm">{mode.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="py-24 px-4 bg-dark-800/50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display font-black text-4xl md:text-5xl gradient-text mb-4">
              BUILT FOR BATTLE
            </h2>
            <p className="text-slate-500">Production-quality multiplayer gaming</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => {
              const Icon = f.icon;
              const colorMap: Record<string, string> = {
                cyan: "#00f5ff", purple: "#bf5fff", pink: "#ff2d78",
                green: "#39ff14", gold: "#ffd700",
              };
              const c = colorMap[f.color];
              return (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="glass rounded-2xl p-6 border border-white/8"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: `${c}15` }}
                  >
                    <Icon size={22} style={{ color: c }} />
                  </div>
                  <h3 className="font-display font-bold text-base mb-2 text-white">{f.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="py-32 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-radial from-neon-purple/10 via-transparent to-transparent" />
        <div className="relative max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="font-display font-black text-5xl md:text-6xl mb-6">
              <span className="gradient-text">READY TO</span>{" "}
              <span className="text-white">FIGHT?</span>
            </h2>
            <p className="text-slate-400 mb-10 text-lg">
              Create your account in seconds and enter the arena.
            </p>
            <Link href="/register">
              <Button variant="neon" size="xl" rightIcon={<Swords size={20} />}>
                ENTER THE ARENA
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/8 text-center">
        <p className="text-slate-600 text-sm font-display">
          ARENAX — REAL-TIME MULTIPLAYER ARENA BATTLE
        </p>
      </footer>
    </main>
  );
}
