"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Users, Shield, Swords, Crown, Clock } from "lucide-react";
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
}

const arenaNames: Record<string, string> = {
  cyber_grid: "Cyber Grid",
  void_core: "Void Core",
  industrial_zone: "Industrial Zone",
};

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
  const username = (session?.user as { username?: string })?.username || "";

  // Poll room state every 2 seconds
  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomCode}`);
        const data = await res.json();
        if (data.success) {
          setRoom(data.data);
          if (data.data.status === "IN_PROGRESS") {
            const me = data.data.players.find((p: RoomPlayer) => p.userId === userId);
            router.push(`/play/game?mode=PRIVATE_ROOM&character=${me?.characterId || "blaze"}&arena=${data.data.arena}`);
          }
        }
      } catch {
        // ignore polling errors
      } finally {
        setLoading(false);
      }
    };

    fetchRoom();
    const interval = setInterval(fetchRoom, 2000);
    return () => clearInterval(interval);
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

    const me = room.players.find((p) => p.userId === userId);
    const characterSlug = me?.characterId || "blaze";

    // Navigate to game
    router.push(`/play/game?mode=PRIVATE_ROOM&character=${characterSlug}&arena=${room.arena}`);
  }

  const isHost = room?.hostUserId === userId;
  const allReady = room?.players.length === room?.maxPlayers;

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />

      <main className="pt-20 pb-12 px-4 max-w-3xl mx-auto">
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
              <h1 className="font-display font-black text-4xl gradient-text tracking-widest">
                {roomCode}
              </h1>
              <button
                onClick={copyCode}
                className="p-2 rounded-lg glass border border-white/10 text-slate-400 hover:text-neon-cyan transition-colors"
                aria-label="Copy room code"
              >
                {copied ? <Check size={18} className="text-neon-green" /> : <Copy size={18} />}
              </button>
            </div>
            <p className="text-slate-500 text-sm mt-2">
              Share this code with friends to invite them
            </p>
          </div>

          {/* Room info */}
          {room && (
            <div className="glass rounded-2xl p-4 border border-white/8 flex items-center gap-6 justify-center">
              <div className="text-center">
                <p className="text-xs text-slate-500 uppercase tracking-widest font-display">Arena</p>
                <p className="text-sm font-bold text-neon-cyan font-display mt-1">{arenaNames[room.arena]}</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <p className="text-xs text-slate-500 uppercase tracking-widest font-display">Players</p>
                <p className="text-sm font-bold text-white font-display mt-1">{room.players.length} / {room.maxPlayers}</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <p className="text-xs text-slate-500 uppercase tracking-widest font-display">Status</p>
                <Badge variant={room.status === "READY" ? "green" : "cyan"} className="mt-1">
                  {room.status}
                </Badge>
              </div>
            </div>
          )}

          {/* Players */}
          <div className="glass rounded-2xl border border-white/8 overflow-hidden">
            <div className="p-4 border-b border-white/8">
              <h2 className="font-display font-bold text-sm text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Users size={16} />
                PLAYERS IN LOBBY
              </h2>
            </div>

            {loading ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 rounded-full border-2 border-neon-cyan border-t-transparent animate-spin mx-auto" />
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {room?.players.map((player) => (
                  <AnimatePresence key={player.userId}>
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-4 p-4"
                    >
                      <Avatar username={player.username} size="md" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{player.username}</span>
                          {player.isHost && (
                            <Crown size={14} className="text-yellow-400" />
                          )}
                          {player.userId === userId && (
                            <Badge variant="cyan" className="text-xs">YOU</Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-display mt-0.5">
                          {player.characterId ? `Character: ${player.characterId}` : "Selecting..."}
                        </p>
                      </div>
                      <div className={`w-2.5 h-2.5 rounded-full ${player.isHost || player.isReady ? "bg-neon-green" : "bg-slate-600"}`} />
                    </motion.div>
                  </AnimatePresence>
                ))}

                {/* Empty slots */}
                {room && Array.from({ length: room.maxPlayers - room.players.length }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 opacity-30">
                    <div className="w-10 h-10 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center">
                      <Clock size={16} className="text-slate-700" />
                    </div>
                    <p className="text-sm text-slate-600 font-display">Waiting for player...</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {isHost ? (
              <Button
                variant="neon"
                size="lg"
                fullWidth
                loading={starting}
                onClick={startGame}
                rightIcon={<Swords size={18} />}
              >
                START BATTLE
              </Button>
            ) : (
              <Button variant="secondary" size="lg" fullWidth disabled>
                <Clock size={16} className="mr-2" />
                Waiting for host...
              </Button>
            )}
            <Button
              variant="danger"
              size="lg"
              onClick={() => router.push("/play")}
            >
              LEAVE
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
