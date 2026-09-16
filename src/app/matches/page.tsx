"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Skull, Swords, Trophy, ChevronLeft, ChevronRight } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Skeleton, Badge } from "@/components/ui/index";
import { formatDuration } from "@/lib/utils/progression";

const arenaNames: Record<string, string> = {
  cyber_grid: "Cyber Grid",
  void_core: "Void Core",
  industrial_zone: "Industrial Zone",
};

interface MatchRecord {
  _id: string;
  result: "WIN" | "LOSS" | "DRAW";
  kills: number;
  deaths: number;
  score: number;
  xpEarned: number;
  coinsEarned: number;
  damage: number;
  createdAt: string;
  character: { name: string; color: string; role: string } | null;
  match: { arena: string; duration: number; gameMode: string } | null;
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  useEffect(() => {
    setLoading(true);
    fetch(`/api/matches?page=${page}&limit=10`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setMatches(d.data.history);
          setPagination(d.data.pagination);
        }
      })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />
      <main className="pt-20 pb-12 px-4 max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="font-display font-black text-4xl gradient-text tracking-widest">MATCH HISTORY</h1>
          <p className="text-slate-500 mt-1">{pagination.total} total matches</p>
        </motion.div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-24 glass rounded-2xl border border-white/8">
            <Swords size={40} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 font-display text-lg">No matches yet</p>
            <p className="text-slate-600 text-sm mt-1">Play your first match to see history here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map((match, i) => (
              <motion.div
                key={match._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass rounded-2xl border border-white/8 p-5 hover:border-white/15 transition-all"
              >
                <div className="flex items-center gap-5">
                  {/* Result badge */}
                  <div
                    className={`w-16 h-16 rounded-xl flex items-center justify-center font-display font-black text-lg flex-shrink-0 ${
                      match.result === "WIN"
                        ? "bg-neon-green/15 text-neon-green border-2 border-neon-green/30"
                        : "bg-neon-pink/15 text-neon-pink border-2 border-neon-pink/30"
                    }`}
                  >
                    {match.result === "WIN" ? <Trophy size={24} /> : <Skull size={24} />}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span
                        className={`font-display font-black text-lg ${
                          match.result === "WIN" ? "text-neon-green" : "text-neon-pink"
                        }`}
                      >
                        {match.result}
                      </span>
                      {match.character && (
                        <Badge
                          style={{ color: match.character.color, borderColor: `${match.character.color}50`, background: `${match.character.color}15` }}
                          className="border"
                        >
                          {match.character.name}
                        </Badge>
                      )}
                      <span className="text-slate-500 text-sm">
                        {arenaNames[match.match?.arena ?? ""] || "Unknown Arena"}
                      </span>
                    </div>

                    <div className="flex items-center gap-6 mt-2 text-sm">
                      <span className="text-slate-400">
                        <span className="text-white font-bold">{match.kills}</span>K /{" "}
                        <span className="text-slate-400">{match.deaths}D</span>
                      </span>
                      <span className="text-slate-400">
                        Score: <span className="text-white font-bold">{match.score}</span>
                      </span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <Clock size={12} />
                        {match.match?.duration ? formatDuration(match.match.duration) : "—"}
                      </span>
                      <span className="text-xs text-slate-600">
                        {new Date(match.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Rewards */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-neon-purple font-bold font-display">+{match.xpEarned} XP</p>
                    <p className="text-yellow-400 font-bold font-display">+{match.coinsEarned} 🪙</p>
                    <p className="text-xs text-slate-600 mt-1">{Math.round(match.damage)} dmg</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg glass border border-white/8 disabled:opacity-30 hover:border-white/20 transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm text-slate-400 font-display">
              Page {page} of {pagination.pages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={page === pagination.pages}
              className="p-2 rounded-lg glass border border-white/8 disabled:opacity-30 hover:border-white/20 transition-all"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
