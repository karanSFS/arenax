"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Swords, Trophy, TrendingUp, Skull, Shield, Target,
  ChevronRight, Clock, Zap, Star, Users,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { StatCard, Skeleton, ProgressBar } from "@/components/ui/index";
import { Button } from "@/components/ui/Button";
import { xpProgress, formatNumber, formatDuration } from "@/lib/utils/progression";

interface ProfileData {
  displayName: string;
  level: number;
  xp: number;
  coins: number;
  rating: number;
  rank: string;
}

interface StatsData {
  matchesPlayed: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  winRate: number;
  kdRatio: number;
}

interface RecentMatch {
  result: "WIN" | "LOSS" | "DRAW";
  kills: number;
  deaths: number;
  score: number;
  xpEarned: number;
  coinsEarned: number;
  createdAt: string;
  character: { name: string; color: string } | null;
  match: { arena: string; duration: number } | null;
}

const arenaLabels: Record<string, string> = {
  cyber_grid: "Cyber Grid",
  void_core: "Void Core",
  industrial_zone: "Industrial Zone",
};

export default function DashboardPage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [loading, setLoading] = useState(true);

  const username = (session?.user as { username?: string })?.username || session?.user?.name || "Player";

  useEffect(() => {
    async function load() {
      try {
        const [profileRes, matchesRes] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/matches?limit=5"),
        ]);

        const profileData = await profileRes.json();
        const matchesData = await matchesRes.json();

        if (profileData.success) {
          setProfile(profileData.data.profile);
          setStats(profileData.data.stats);
        }
        if (matchesData.success) {
          setRecentMatches(matchesData.data.history);
        }
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const xpInfo = profile ? xpProgress(profile.xp) : null;

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />

      <main className="pt-20 pb-12 px-4 max-w-7xl mx-auto">
        {/* Welcome Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-slate-500 text-sm font-display tracking-widest uppercase">
                Welcome back
              </p>
              <h1 className="text-3xl sm:text-4xl font-black font-display mt-1">
                <span className="gradient-text">{username}</span>
              </h1>
              {profile && (
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-sm font-display font-bold text-neon-purple">
                    {profile.rank}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-sm text-slate-400">
                    Level {profile?.level}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-sm text-yellow-400">
                    {formatNumber(profile?.coins ?? 0)} coins
                  </span>
                </div>
              )}
            </div>

            <Link href="/play">
              <Button variant="neon" size="lg" rightIcon={<Swords size={18} />}>
                PLAY NOW
              </Button>
            </Link>
          </div>

          {/* XP Progress */}
          {xpInfo && (
            <div className="mt-4 max-w-sm">
              <ProgressBar
                value={xpInfo.current}
                max={xpInfo.required}
                color="purple"
                label={`Level ${xpInfo.level} → ${xpInfo.level + 1}`}
                showValue={false}
              />
              <p className="text-xs text-slate-500 mt-1">
                {formatNumber(xpInfo.current)} / {formatNumber(xpInfo.required)} XP ({xpInfo.percentage}%)
              </p>
            </div>
          )}
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))
          ) : (
            <>
              <StatCard label="Rating" value={stats?.kdRatio !== undefined ? profile?.rating ?? 1000 : "—"} icon={<Trophy size={20} />} color="gold" />
              <StatCard label="Wins" value={stats?.wins ?? 0} icon={<Star size={20} />} color="cyan" />
              <StatCard label="Losses" value={stats?.losses ?? 0} icon={<Shield size={20} />} color="purple" />
              <StatCard label="Kills" value={formatNumber(stats?.kills ?? 0)} icon={<Skull size={20} />} color="pink" />
              <StatCard label="Win Rate" value={`${stats?.winRate ?? 0}%`} icon={<TrendingUp size={20} />} color="green" />
              <StatCard label="K/D" value={stats?.kdRatio?.toFixed(2) ?? "0.00"} icon={<Target size={20} />} color="gold" />
            </>
          )}
        </div>

        {/* Quick Play & Recent Matches */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Play Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-2xl border border-white/8 p-6"
          >
            <h2 className="font-display font-black text-lg text-white mb-4 tracking-widest">QUICK PLAY</h2>

            <div className="space-y-3">
              <Link href="/play?mode=QUICK_MATCH" className="block">
                <motion.div
                  whileHover={{ x: 4 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-neon-cyan/5 border border-neon-cyan/20 group"
                >
                  <div className="w-10 h-10 rounded-lg bg-neon-cyan/10 flex items-center justify-center">
                    <Zap size={20} className="text-neon-cyan" />
                  </div>
                  <div>
                    <p className="font-display font-bold text-sm text-neon-cyan">QUICK MATCH</p>
                    <p className="text-xs text-slate-500">Jump into battle instantly</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-600 ml-auto group-hover:text-neon-cyan transition-colors" />
                </motion.div>
              </Link>

              <Link href="/play?mode=PRIVATE_ROOM" className="block">
                <motion.div
                  whileHover={{ x: 4 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-neon-purple/5 border border-neon-purple/20 group"
                >
                  <div className="w-10 h-10 rounded-lg bg-neon-purple/10 flex items-center justify-center">
                    <Users size={20} className="text-neon-purple" />
                  </div>
                  <div>
                    <p className="font-display font-bold text-sm text-neon-purple">PRIVATE ROOM</p>
                    <p className="text-xs text-slate-500">Play with friends</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-600 ml-auto group-hover:text-neon-purple transition-colors" />
                </motion.div>
              </Link>

              <Link href="/play?mode=PRACTICE" className="block">
                <motion.div
                  whileHover={{ x: 4 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-neon-green/5 border border-neon-green/20 group"
                >
                  <div className="w-10 h-10 rounded-lg bg-neon-green/10 flex items-center justify-center">
                    <Shield size={20} className="text-neon-green" />
                  </div>
                  <div>
                    <p className="font-display font-bold text-sm text-neon-green">PRACTICE</p>
                    <p className="text-xs text-slate-500">Train vs AI bots</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-600 ml-auto group-hover:text-neon-green transition-colors" />
                </motion.div>
              </Link>
            </div>
          </motion.div>

          {/* Recent Matches */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2 glass rounded-2xl border border-white/8 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-black text-lg text-white tracking-widest">
                RECENT MATCHES
              </h2>
              <Link href="/matches" className="text-xs text-neon-cyan hover:text-white transition-colors font-display">
                VIEW ALL →
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : recentMatches.length === 0 ? (
              <div className="text-center py-12">
                <Swords size={40} className="text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 font-display">No matches yet</p>
                <p className="text-slate-600 text-sm mt-1">Play your first match!</p>
                <Link href="/play" className="inline-block mt-4">
                  <Button variant="primary" size="sm">PLAY NOW</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentMatches.map((match, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-4 p-4 rounded-xl bg-white/3 border border-white/5"
                  >
                    {/* Result */}
                    <div
                      className={`w-14 h-10 rounded-lg flex items-center justify-center font-display font-black text-xs ${
                        match.result === "WIN"
                          ? "bg-neon-green/15 text-neon-green border border-neon-green/30"
                          : "bg-neon-pink/15 text-neon-pink border border-neon-pink/30"
                      }`}
                    >
                      {match.result}
                    </div>

                    {/* Character */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black"
                      style={{
                        background: `${match.character?.color ?? "#888"}22`,
                        border: `1px solid ${match.character?.color ?? "#888"}44`,
                        color: match.character?.color ?? "#888",
                      }}
                    >
                      {match.character?.name?.[0] ?? "?"}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">
                        {match.character?.name ?? "Unknown"} — {arenaLabels[match.match?.arena ?? ""] || match.match?.arena}
                      </p>
                      <div className="flex gap-4 mt-0.5 text-xs text-slate-500">
                        <span>{match.kills}K / {match.deaths}D</span>
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {match.match?.duration ? formatDuration(match.match.duration) : "—"}
                        </span>
                      </div>
                    </div>

                    {/* Rewards */}
                    <div className="text-right">
                      <p className="text-xs text-neon-purple font-bold">+{match.xpEarned} XP</p>
                      <p className="text-xs text-yellow-400">+{match.coinsEarned} 🪙</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
