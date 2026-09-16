"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Users, Swords, Crown, Clock } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/Button";
import { Avatar, Badge } from "@/components/ui/index";
import { useToast } from "@/components/providers/ToastProvider";

interface RoomPlayer {
  userId: string;
  username: string;
  characterId: string;
  isReady: boolean;
  isHost: boolean;
}

interface Room {
  _id: string;
  roomCode: string;
  hostUserId: string;
  players: RoomPlayer[];
  gameMode: string;
  arena: string;
  status: string;
  maxPlayers: number;
  matchId?: string;
}

const arenaNames: Record<string, string> = {
  cyber_grid: "Cyber Grid",
  void_core: "Void Core",
  industrial_zone: "Industrial Zone",
  outpost: "Outpost",
  catacombs: "Catacombs",
  high_tower: "High Tower",
  pyramid: "Pyramid",
  lunar_base: "Lunar Base",
};

const characterNames: Record<string, string> = {
  blaze: "BLAZE (Brawler)",
  volt: "VOLT (Marksman)",
  titan: "TITAN (Tank)",
  phantom: "PHANTOM (Assassin)",
};

function getSafeCharacterSlug(raw?: string): string {
  if (!raw) return "blaze";
  const s = raw.toLowerCase();
  if (s.includes("volt")) return "volt";
  if (s.includes("titan")) return "titan";
  if (s.includes("phantom")) return "phantom";
  if (s.includes("blaze")) return "blaze";
  return "blaze";
}

function getCharacterLabel(raw?: string): string {
  const slug = getSafeCharacterSlug(raw);
  return characterNames[slug] || "BLAZE (Brawler)";
}

export default function LobbyPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();

  const roomCode = (params.roomCode as string).toUpperCase();
  const [room, setRoom] = useState<Room | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const userId = (session?.user as { id?: string })?.id || "";

  // Poll room state every 1 second for fast synchronization
  useEffect(() => {
    let active = true;

    const fetchRoom = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomCode}`);
        const data = await res.json();
        if (data.success && active) {
          setRoom(data.data);
          if (data.data.status === "IN_PROGRESS") {
            const me = data.data.players.find((p: RoomPlayer) => p.userId === userId);
            const characterSlug = getSafeCharacterSlug(me?.characterId);
            const matchId = data.data.matchId || roomCode;
            router.push(
              `/play/game?mode=PRIVATE_ROOM&roomCode=${roomCode}&character=${characterSlug}&arena=${data.data.arena}&matchId=${matchId}`
            );
          }
        }
      } catch {
        // ignore polling errors
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchRoom();
    const interval = setInterval(fetchRoom, 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [roomCode, userId, router]);

  function copyCode() {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied!", "Room code copied to clipboard.");
  }

  async function startGame() {
    if (!room) return;
    setStarting(true);

    try {
      const res = await fetch(`/api/rooms/${roomCode}/start`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.success) {
        toast.error("Failed to start match", data.error?.message || "Please try again.");
        setStarting(false);
        return;
      }

      const me = room.players.find((p) => p.userId === userId);
      const characterSlug = getSafeCharacterSlug(me?.characterId);
      const matchId = data.data?.matchId || room.matchId || roomCode;

      router.push(
        `/play/game?mode=PRIVATE_ROOM&roomCode=${roomCode}&character=${characterSlug}&arena=${room.arena}&matchId=${matchId}`
      );
    } catch {
      toast.error("Error", "Could not start match.");
      setStarting(false);
    }
  }

  const isHost = room?.hostUserId === userId;

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />

      <main className="pt-20 pb-12 px-4 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Room header */}
          <div className="text-center">
            <p className="text-slate-500 text-sm font-display uppercase tracking-widest mb-2">
              Private Room
            </p>
            <div className="flex items-center justify-center gap-4">
              <h1 className="font-display font-black text-4xl sm:text-5xl gradient-text tracking-widest">
                {roomCode}
              </h1>
              <button
                onClick={copyCode}
                title="Copy Room Code"
                className="p-2.5 rounded-xl glass border border-white/10 text-slate-400 hover:text-neon-cyan hover:border-neon-cyan/40 transition-colors"
              >
                {copied ? <Check size={20} className="text-neon-green" /> : <Copy size={20} />}
              </button>
            </div>
            <p className="text-slate-500 text-sm mt-2">
              Share this code with up to <span className="text-white font-bold">{room?.maxPlayers || 20}</span> players to join!
            </p>
          </div>

          {/* Room metadata card */}
          {room && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="glass rounded-xl p-3.5 border border-white/8 text-center">
                <p className="text-xs text-slate-500 font-display uppercase tracking-wider">Arena</p>
                <p className="font-display font-bold text-white mt-1">
                  {arenaNames[room.arena] || room.arena}
                </p>
              </div>
              <div className="glass rounded-xl p-3.5 border border-white/8 text-center">
                <p className="text-xs text-slate-500 font-display uppercase tracking-wider">Players</p>
                <p className="font-display font-bold text-neon-cyan mt-1">
                  {room.players.length} / {room.maxPlayers}
                </p>
              </div>
              <div className="glass rounded-xl p-3.5 border border-white/8 text-center col-span-2 sm:col-span-1">
                <p className="text-xs text-slate-500 font-display uppercase tracking-wider">Status</p>
                <Badge variant={room.status === "READY" ? "green" : "cyan"} className="mt-1">
                  {room.status === "IN_PROGRESS" ? "STARTING..." : room.status}
                </Badge>
              </div>
            </div>
          )}

          {/* Player roster */}
          <div className="glass-medium rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-4 border-b border-white/8 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-neon-cyan" />
                <h2 className="font-display font-bold text-white text-base">
                  Connected Fighters ({room?.players.length ?? 0} / {room?.maxPlayers ?? 20})
                </h2>
              </div>
              <span className="text-xs text-slate-500">
                {isHost ? "You are Host" : "Waiting for Host to start"}
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 rounded-full border-2 border-neon-cyan border-t-transparent animate-spin mx-auto" />
              </div>
            ) : (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto">
                {room?.players.map((player) => (
                  <motion.div
                    key={player.userId}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/8"
                  >
                    <Avatar username={player.username} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm truncate">{player.username}</span>
                        {player.isHost && (
                          <Crown size={14} className="text-yellow-400 flex-shrink-0" />
                        )}
                        {player.userId === userId && (
                          <Badge variant="cyan" className="text-[10px] py-0 px-1.5 flex-shrink-0">YOU</Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-display truncate mt-0.5">
                        {getCharacterLabel(player.characterId)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse" />
                      <span className="text-[10px] font-mono font-bold text-emerald-400 tracking-wider">READY</span>
                    </div>
                  </motion.div>
                ))}

                {/* Open slot indicators */}
                {room && room.maxPlayers > room.players.length && (
                  <div className="col-span-1 sm:col-span-2 flex items-center justify-center p-3 rounded-xl border border-dashed border-white/10 text-slate-500 text-xs font-display">
                    <Clock size={14} className="mr-2 animate-pulse" />
                    {room.maxPlayers - room.players.length} open slots remaining — invite friends with code {roomCode}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            {isHost ? (
              <Button
                variant="neon"
                size="lg"
                fullWidth
                loading={starting}
                onClick={startGame}
                rightIcon={<Swords size={18} />}
              >
                START BATTLE FOR ALL PLAYERS
              </Button>
            ) : (
              <Button variant="secondary" size="lg" fullWidth disabled>
                <Clock size={16} className="mr-2" />
                Waiting for Host to start match...
              </Button>
            )}
            <Button
              variant="secondary"
              size="lg"
              onClick={() => router.push("/play")}
              className="sm:w-36"
            >
              LEAVE
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
