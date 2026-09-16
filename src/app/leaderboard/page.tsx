"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, TrendingUp, Skull, Star } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Avatar, Badge, Skeleton } from "@/components/ui/index";
import { formatNumber } from "@/lib/utils/progression";

interface LeaderboardEntry {
  userId: string;
  username: string;
  displayName: string;
  rating: number;
  wins: number;
  kills: number;
  level: number;
  weeklyRating: number;
  rank: number;
}

type Tab = "global" | "weekly";

const rankIcons = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("global");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?tab=${tab}&page=${page}&limit=20`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setEntries(d.data.entries);
          setTotalPages(d.data.pagination.pages);
        }
      })
      .finally(() => setLoading(false));
  }, [tab, page]);

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />

      <main className="pt-20 pb-12 px-4 max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="font-display font-black text-4xl sm:text-5xl gradient-text tracking-widest mb-2">
            GLOBAL LEADERBOARD
          </h1>
          <p className="text-slate-500">Top players ranked by rating</p>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(["global", "weekly"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setPage(1); }}
              className={`px-6 py-2.5 rounded-xl font-display font-bold text-sm uppercase tracking-widest transition-all ${
                tab === t
                  ? "bg-neon-cyan/10 border border-neon-cyan/40 text-neon-cyan"
                  : "bg-white/3 border border-white/8 text-slate-400 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="glass rounded-2xl border border-white/8 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/8 text-xs font-display font-bold text-slate-500 uppercase tracking-widest">
            <div className="col-span-1">#</div>
            <div className="col-span-4">PLAYER</div>
            <div className="col-span-2 text-center">LVL</div>
            <div className="col-span-2 text-center">RATING</div>
            <div className="col-span-1 text-center">WINS</div>
            <div className="col-span-2 text-center">KILLS</div>
          </div>

          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-20">
              <Trophy size={40} className="text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 font-display">No players yet</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {entries.map((entry, i) => {
                const rank = (page - 1) * 20 + i + 1;
                const isTop3 = rank <= 3;
                return (
                  <motion.div
                    key={entry.userId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`grid grid-cols-12 gap-4 px-6 py-4 items-center transition-colors hover:bg-white/3 ${
                      isTop3 ? "bg-yellow-400/3" : ""
                    }`}
                  >
                    {/* Rank */}
                    <div className="col-span-1">
                      {isTop3 ? (
                        <span className="text-xl">{rankIcons[rank - 1]}</span>
                      ) : (
                        <span className="text-sm font-display font-bold text-slate-500">
                          {rank}
                        </span>
                      )}
                    </div>

                    {/* Player */}
                    <div className="col-span-4 flex items-center gap-3">
                      <Avatar username={entry.username} size="sm" />
                      <div>
                        <p className="font-bold text-sm text-white">{entry.username}</p>
                        <p className="text-xs text-slate-500">{entry.displayName}</p>
                      </div>
                    </div>

                    {/* Level */}
                    <div className="col-span-2 text-center">
                      <Badge variant="purple">LV {entry.level}</Badge>
                    </div>

                    {/* Rating */}
                    <div className="col-span-2 text-center">
                      <span className={`font-display font-black text-sm ${isTop3 ? "text-yellow-400" : "text-neon-cyan"}`}>
                        {tab === "weekly" ? entry.weeklyRating : entry.rating}
                      </span>
                    </div>

                    {/* Wins */}
                    <div className="col-span-1 text-center">
                      <span className="text-sm font-bold text-neon-green">{entry.wins}</span>
                    </div>

                    {/* Kills */}
                    <div className="col-span-2 text-center">
                      <span className="text-sm text-slate-400">{formatNumber(entry.kills)}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-lg glass border border-white/8 text-sm font-display disabled:opacity-30"
            >
              ← PREV
            </button>
            <span className="px-4 py-2 text-sm text-slate-400 font-display">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-lg glass border border-white/8 text-sm font-display disabled:opacity-30"
            >
              NEXT →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
