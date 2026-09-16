"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Swords, Trophy, Skull, Target, TrendingUp, Star } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Avatar, ProgressBar, Skeleton, Badge } from "@/components/ui/index";
import { formatNumber, xpProgress, getRankTier } from "@/lib/utils/progression";

const rankColors: Record<string, string> = {
  bronze: "#cd7f32",
  silver: "#c0c0c0",
  gold: "#ffd700",
  platinum: "#00f5ff",
  diamond: "#bf5fff",
};

interface ProfileData {
  userId: string;
  displayName: string;
  level: number;
  xp: number;
  coins: number;
  rating: number;
  rank: string;
  bio: string;
}

interface StatsData {
  matchesPlayed: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  winRate: number;
  kdRatio: number;
  damageDealt: number;
}

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // For own profile, use /api/profile
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setProfile(d.data.profile);
          setStats(d.data.stats);
        }
      })
      .finally(() => setLoading(false));
  }, [username]);

  const xpInfo = profile ? xpProgress(profile.xp) : null;
  const rankTier = profile ? getRankTier(profile.rating) : "bronze";
  const rankColor = rankColors[rankTier];

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />
      <main className="pt-20 pb-12 px-4 max-w-4xl mx-auto">
        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-48" />
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
            </div>
          </div>
        ) : profile ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Profile header */}
            <div className="glass rounded-2xl border border-white/8 p-8">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <Avatar username={username} size="xl" />
                <div className="flex-1 text-center sm:text-left">
                  <h1 className="font-display font-black text-3xl text-white">{username}</h1>
                  <p className="text-slate-400 mt-1">{profile.displayName}</p>
                  {profile.bio && <p className="text-slate-500 text-sm mt-2">{profile.bio}</p>}

                  <div className="flex flex-wrap items-center gap-4 mt-4 justify-center sm:justify-start">
                    <Badge
                      className="text-sm"
                      style={{ color: rankColor, borderColor: `${rankColor}50`, background: `${rankColor}15` }}
                    >
                      {profile.rank}
                    </Badge>
                    <span className="text-slate-500 text-sm font-display">
                      Level <span className="text-white font-bold">{profile.level}</span>
                    </span>
                    <span className="text-yellow-400 text-sm font-display font-bold">
                      {formatNumber(profile.coins)} coins
                    </span>
                    <span className="text-neon-cyan text-sm font-display font-bold">
                      {profile.rating} Rating
                    </span>
                  </div>

                  {/* XP bar */}
                  {xpInfo && (
                    <div className="mt-4 max-w-xs">
                      <ProgressBar
                        value={xpInfo.current}
                        max={xpInfo.required}
                        color="purple"
                        label={`LV ${xpInfo.level} → ${xpInfo.level + 1}`}
                        showValue={false}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        {formatNumber(xpInfo.current)} / {formatNumber(xpInfo.required)} XP
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stats grid */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: "Matches", value: stats.matchesPlayed, icon: Swords, color: "cyan" as const },
                  { label: "Wins", value: stats.wins, icon: Trophy, color: "gold" as const },
                  { label: "Win Rate", value: `${stats.winRate}%`, icon: TrendingUp, color: "green" as const },
                  { label: "Kills", value: formatNumber(stats.kills), icon: Skull, color: "pink" as const },
                  { label: "K/D Ratio", value: stats.kdRatio?.toFixed(2) ?? "0.00", icon: Target, color: "purple" as const },
                  { label: "Damage", value: formatNumber(stats.damageDealt), icon: Star, color: "gold" as const },
                ].map((s) => {
                  const Icon = s.icon;
                  const colorMap: Record<string, string> = {
                    cyan: "text-neon-cyan border-neon-cyan/20",
                    purple: "text-neon-purple border-neon-purple/20",
                    pink: "text-neon-pink border-neon-pink/20",
                    green: "text-neon-green border-neon-green/20",
                    gold: "text-yellow-400 border-yellow-400/20",
                  };

                  return (
                    <div key={s.label} className={`glass rounded-2xl p-5 border ${colorMap[s.color]}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-widest font-display">{s.label}</p>
                          <p className={`text-2xl font-black font-display mt-1 ${colorMap[s.color].split(" ")[0]}`}>{s.value}</p>
                        </div>
                        <Icon size={20} className={`opacity-60 mt-1 ${colorMap[s.color].split(" ")[0]}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : (
          <div className="text-center py-24">
            <p className="text-slate-500 font-display text-lg">Profile not found</p>
          </div>
        )}
      </main>
    </div>
  );
}
