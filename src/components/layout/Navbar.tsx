"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  Swords, LayoutDashboard, Trophy, History, User, Settings,
  LogOut, Menu, X, Zap,
} from "lucide-react";
import { Avatar } from "@/components/ui/index";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/play", label: "Play", icon: Swords },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/matches", label: "Matches", icon: History },
];

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const username = (session?.user as { username?: string })?.username || session?.user?.name || "";

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-40 glass border-b border-white/8"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href={session ? "/dashboard" : "/"} className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-cyan to-neon-purple flex items-center justify-center">
              <Zap size={18} className="text-dark-900" />
            </div>
            <span className="font-display font-black text-xl tracking-widest gradient-text group-hover:opacity-90 transition-opacity">
              ARENAX
            </span>
          </Link>

          {/* Desktop nav */}
          {session && (
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-display font-semibold tracking-wide uppercase transition-all duration-200 ${
                      active
                        ? "text-neon-cyan bg-neon-cyan/10 border border-neon-cyan/20"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon size={15} />
                    {label}
                  </Link>
                );
              })}
            </div>
          )}

          {/* User menu */}
          <div className="flex items-center gap-3">
            {session ? (
              <>
                <Link
                  href={`/profile/${username}`}
                  className="hidden md:flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <Avatar username={username} size="sm" />
                  <span className="text-sm font-display font-bold text-slate-300">
                    {username}
                  </span>
                </Link>
                <Link
                  href="/settings"
                  className="hidden md:flex p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all"
                  aria-label="Settings"
                >
                  <Settings size={18} />
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="hidden md:flex p-2 rounded-lg text-slate-500 hover:text-neon-pink hover:bg-neon-pink/10 transition-all"
                  aria-label="Sign out"
                >
                  <LogOut size={18} />
                </button>
                {/* Mobile menu button */}
                <button
                  onClick={() => setMobileOpen(!mobileOpen)}
                  className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white transition-colors"
                  aria-label="Toggle mobile menu"
                >
                  {mobileOpen ? <X size={22} /> : <Menu size={22} />}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-display font-semibold text-slate-300 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 text-sm font-display font-bold bg-gradient-to-r from-neon-cyan/10 to-neon-purple/10 border border-neon-cyan/40 text-neon-cyan rounded-lg hover:border-neon-cyan/70 transition-all"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && session && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-t border-white/8 overflow-hidden"
          >
            <div className="px-4 py-4 space-y-1">
              {navLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-display font-semibold uppercase transition-all ${
                    pathname.startsWith(href)
                      ? "text-neon-cyan bg-neon-cyan/10"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              ))}
              <div className="pt-2 border-t border-white/8 space-y-1">
                <Link
                  href={`/profile/${username}`}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-display font-semibold uppercase text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  <User size={18} />
                  Profile
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-display font-semibold uppercase text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  <Settings size={18} />
                  Settings
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-display font-semibold uppercase text-neon-pink hover:bg-neon-pink/10 transition-all text-left"
                >
                  <LogOut size={18} />
                  Sign Out
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
