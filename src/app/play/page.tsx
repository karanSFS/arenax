"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Shield, Target, Swords, Users, ChevronRight, Lock } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/Button";
import { Modal, Input } from "@/components/ui/index";
import { useToast } from "@/components/providers/ToastProvider";
import { CHARACTER_DATA } from "@/game/characters/CharacterConfig";

interface Character {
  _id: string;
  name: string;
  slug: string;
  description: string;
  role: string;
  stats: { health: number; speed: number; attack: number; defense: number };
  abilities: {
    primary: { name: string; description: string };
    secondary: { name: string; description: string };
    ultimate: { name: string; description: string };
  };
  color: string;
  accentColor: string;
}

const roleColors: Record<string, string> = {
  melee: "#ff6b00",
  ranged: "#00f5ff",
  tank: "#39ff14",
  assassin: "#bf5fff",
};

const roleIcons: Record<string, React.ReactNode> = {
  melee: <Swords size={14} />,
  ranged: <Target size={14} />,
  tank: <Shield size={14} />,
  assassin: <Zap size={14} />,
};

function StatBar({ label, value, max = 25, color }: { label: string; value: number; max?: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400 font-display uppercase tracking-wider">{label}</span>
        <span style={{ color }} className="font-bold">{value}</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(value / max) * 100}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
    </div>
  );
}

function PlayPageContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const preselectedMode = searchParams.get("mode") as "QUICK_MATCH" | "PRIVATE_ROOM" | "PRACTICE" | null;

  const [characters, setCharacters] = useState<Character[]>(CHARACTER_DATA as any);
  const [selectedChar, setSelectedChar] = useState<Character | null>((CHARACTER_DATA[0] as any) || null);
  const [hoveredChar, setHoveredChar] = useState<Character | null>(null);
  const [gameMode, setGameMode] = useState<"QUICK_MATCH" | "PRIVATE_ROOM" | "PRACTICE">((preselectedMode as any) || "QUICK_MATCH");
  const [arena, setArena] = useState("cyber_grid");
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [loading, setLoading] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [charLoading, setCharLoading] = useState(false);

  useEffect(() => {
    fetch("/api/characters")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data && d.data.length > 0) {
          setCharacters(d.data);
          setSelectedChar((prev) => (prev ? (d.data.find((c: any) => c.slug === prev.slug) || d.data[0]) : d.data[0]));
        }
      })
      .catch((err) => {
        console.warn("Using local character data fallback:", err);
      })
      .finally(() => setCharLoading(false));
  }, []);

  const displayChar = hoveredChar || selectedChar;

  async function handlePlay() {
    if (!selectedChar || !gameMode) {
      toast.error("Missing selection", "Please select a character and game mode.");
      return;
    }

    setLoading(true);

    try {
      if (gameMode === "PRACTICE") {
        // Go directly to practice game
        router.push(`/play/game?mode=PRACTICE&character=${selectedChar.slug}&arena=${arena}`);
        return;
      }

      if (gameMode === "PRIVATE_ROOM") {
        // Create a private room
        const res = await fetch("/api/rooms/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameMode: "PRIVATE_ROOM",
            arena,
            maxPlayers,
            characterId: selectedChar.slug || "blaze",
          }),
        });
        const data = await res.json();
        if (!data.success) {
          toast.error("Failed to create room", data.error?.message);
          return;
        }
        router.push(`/play/lobby/${data.data.room.roomCode}`);
        return;
      }

      // Quick match
      const res = await fetch("/api/rooms/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameMode: "QUICK_MATCH",
          arena,
          characterId: selectedChar.slug || "blaze",
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error("Matchmaking failed", data.error?.message);
        return;
      }
      // For quick match, go straight to game with bot for now
      router.push(`/play/game?mode=QUICK_MATCH&character=${selectedChar.slug}&arena=${arena}&matchId=${data.data.matchId}`);
    } catch (err) {
      toast.error("Error", "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinRoom() {
    if (!selectedChar || !joinCode) return;
    setLoading(true);
    try {
      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: joinCode.toUpperCase(),
          characterId: selectedChar.slug || "blaze",
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error("Join failed", data.error?.message);
        return;
      }
      setJoinModalOpen(false);
      router.push(`/play/lobby/${data.data.room.roomCode}`);
    } catch {
      toast.error("Error", "Could not join room.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />

      <main className="pt-20 pb-12 px-4 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="font-display font-black text-4xl sm:text-5xl gradient-text tracking-widest mb-2">
            SELECT YOUR FIGHTER
          </h1>
          <p className="text-slate-500">Choose wisely — every character demands a different strategy</p>
        </motion.div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Character Grid */}
          <div className="xl:col-span-2">
            {charLoading ? (
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-48 rounded-2xl bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {characters.map((char, i) => {
                  const isSelected = selectedChar?.slug === char.slug;
                  return (
                    <motion.div
                      key={char._id || char.slug}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.1 }}
                      onClick={() => setSelectedChar(char)}
                      onMouseEnter={() => setHoveredChar(char)}
                      onMouseLeave={() => setHoveredChar(null)}
                      whileHover={{ scale: 1.02, y: -4 }}
                      whileTap={{ scale: 0.98 }}
                      className={`relative rounded-2xl p-5 cursor-pointer transition-all duration-300 border-2 ${
                        isSelected
                          ? "border-opacity-100"
                          : "border-white/8 hover:border-opacity-50"
                      }`}
                      style={{
                        background: isSelected
                          ? `linear-gradient(135deg, ${char.color}15, ${char.accentColor}10)`
                          : "rgba(255,255,255,0.03)",
                        borderColor: isSelected ? char.color : undefined,
                        boxShadow: isSelected
                          ? `0 0 20px ${char.color}30, 0 0 60px ${char.color}10`
                          : undefined,
                      }}
                    >
                      {/* Selection indicator */}
                      {isSelected && (
                        <div
                          className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ background: char.color }}
                        >
                          <span className="text-dark-900 text-xs font-black">✓</span>
                        </div>
                      )}

                      {/* Character avatar */}
                      <div
                        className="w-16 h-16 rounded-xl flex items-center justify-center mb-4 text-3xl"
                        style={{
                          background: `${char.color}20`,
                          border: `2px solid ${char.color}40`,
                        }}
                      >
                        <div
                          className="w-10 h-10 rounded-full"
                          style={{
                            background: `radial-gradient(circle at 40% 40%, ${char.color}, ${char.accentColor})`,
                            boxShadow: `0 0 20px ${char.color}60`,
                          }}
                        />
                      </div>

                      <h3
                        className="font-display font-black text-xl mb-1"
                        style={{ color: char.color }}
                      >
                        {char.name}
                      </h3>

                      {/* Role badge */}
                      <div
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold font-display mb-3"
                        style={{
                          background: `${roleColors[char.role]}15`,
                          border: `1px solid ${roleColors[char.role]}40`,
                          color: roleColors[char.role],
                        }}
                      >
                        {roleIcons[char.role]}
                        {char.role.toUpperCase()}
                      </div>

                      {/* Mini stats */}
                      <div className="space-y-1.5">
                        <StatBar label="HP" value={char.stats.health} max={160} color={char.color} />
                        <StatBar label="SPD" value={char.stats.speed} max={12} color={char.color} />
                        <StatBar label="ATK" value={char.stats.attack} max={30} color={char.color} />
                        <StatBar label="DEF" value={char.stats.defense} max={15} color={char.color} />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right panel: character detail + mode selection */}
          <div className="space-y-5">
            {/* Character detail */}
            <AnimatePresence mode="wait">
              {displayChar && (
                <motion.div
                  key={displayChar._id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="glass rounded-2xl p-6 border"
                  style={{ borderColor: `${displayChar.color}30` }}
                >
                  <h2
                    className="font-display font-black text-2xl mb-1"
                    style={{ color: displayChar.color }}
                  >
                    {displayChar.name}
                  </h2>
                  <div
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-display mb-3"
                    style={{ background: `${roleColors[displayChar.role]}15`, border: `1px solid ${roleColors[displayChar.role]}40`, color: roleColors[displayChar.role] }}
                  >
                    {roleIcons[displayChar.role]}
                    {displayChar.role.toUpperCase()}
                  </div>
                  <p className="text-slate-400 text-sm mb-4 leading-relaxed">{displayChar.description}</p>

                  {/* Abilities */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-display font-bold text-slate-500 uppercase tracking-widest">Abilities</h4>
                    {[
                      { key: "Q", ability: displayChar.abilities.primary, label: "PRIMARY" },
                      { key: "E", ability: displayChar.abilities.secondary, label: "SECONDARY" },
                      { key: "R", ability: displayChar.abilities.ultimate, label: "ULTIMATE" },
                    ].map(({ key, ability, label }) => (
                      <div
                        key={key}
                        className="flex gap-3 p-3 rounded-xl"
                        style={{ background: `${displayChar.color}08` }}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black font-display flex-shrink-0"
                          style={{ background: `${displayChar.color}20`, color: displayChar.color }}
                        >
                          {key}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{ability.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{ability.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Game Mode */}
            <div className="glass rounded-2xl p-5 border border-white/8">
              <h3 className="font-display font-black text-sm text-slate-400 uppercase tracking-widest mb-3">
                GAME MODE
              </h3>
              <div className="space-y-2">
                {[
                  { mode: "QUICK_MATCH" as const, label: "Quick Match", color: "#00f5ff", icon: Zap },
                  { mode: "PRIVATE_ROOM" as const, label: "Private Room", color: "#bf5fff", icon: Users },
                  { mode: "PRACTICE" as const, label: "Practice vs AI", color: "#39ff14", icon: Shield },
                ].map(({ mode, label, color, icon: Icon }) => (
                  <div
                    key={mode}
                    onClick={() => setGameMode(mode)}
                    className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border"
                    style={{
                      background: gameMode === mode ? `${color}12` : "rgba(255,255,255,0.02)",
                      borderColor: gameMode === mode ? `${color}40` : "rgba(255,255,255,0.05)",
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: `${color}15` }}
                    >
                      <Icon size={16} style={{ color }} />
                    </div>
                    <span
                      className="font-display font-bold text-sm"
                      style={{ color: gameMode === mode ? color : "#94a3b8" }}
                    >
                      {label}
                    </span>
                    {gameMode === mode && (
                      <div className="ml-auto w-2 h-2 rounded-full" style={{ background: color }} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Room Capacity (Private Room only) */}
            {gameMode === "PRIVATE_ROOM" && (
              <div className="glass rounded-2xl p-5 border border-white/8">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-black text-sm text-slate-400 uppercase tracking-widest">
                    MAX PLAYERS
                  </h3>
                  <span className="text-neon-cyan text-xs font-bold font-display">
                    Up to 20 Fighters
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[4, 8, 12, 16, 20].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setMaxPlayers(num)}
                      className="py-2.5 rounded-xl text-center font-display font-bold text-sm transition-all border"
                      style={{
                        background: maxPlayers === num ? "#bf5fff20" : "rgba(255,255,255,0.02)",
                        borderColor: maxPlayers === num ? "#bf5fff" : "rgba(255,255,255,0.08)",
                        color: maxPlayers === num ? "#bf5fff" : "#94a3b8",
                      }}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Arena (for practice/private) */}
            {(gameMode === "PRACTICE" || gameMode === "PRIVATE_ROOM") && (
              <div className="glass rounded-2xl p-5 border border-white/8">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-black text-sm text-slate-400 uppercase tracking-widest">
                    ARENA MAP
                  </h3>
                  <span className="text-slate-500 text-xs font-display">
                    Mini Militia Inspired
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "outpost", label: "Outpost", color: "#22c55e", tag: "Jungle" },
                    { id: "catacombs", label: "Catacombs", color: "#f97316", tag: "Cavern" },
                    { id: "high_tower", label: "High Tower", color: "#38bdf8", tag: "Vertical" },
                    { id: "pyramid", label: "Pyramid", color: "#eab308", tag: "Desert" },
                    { id: "lunar_base", label: "Lunar Base", color: "#a855f7", tag: "Space" },
                    { id: "cyber_grid", label: "Cyber Grid", color: "#00f5ff", tag: "Neon" },
                    { id: "void_core", label: "Void Core", color: "#bf5fff", tag: "Rift" },
                    { id: "industrial_zone", label: "Industrial", color: "#39ff14", tag: "Heavy" },
                  ].map((a) => (
                    <div
                      key={a.id}
                      onClick={() => setArena(a.id)}
                      className="p-2.5 rounded-xl cursor-pointer text-center transition-all border flex flex-col items-center justify-center gap-0.5"
                      style={{
                        background: arena === a.id ? `${a.color}18` : "rgba(255,255,255,0.02)",
                        borderColor: arena === a.id ? `${a.color}50` : "rgba(255,255,255,0.06)",
                      }}
                    >
                      <span
                        className="font-display font-bold text-xs"
                        style={{ color: arena === a.id ? a.color : "#e2e8f0" }}
                      >
                        {a.label}
                      </span>
                      <span className="text-[10px] text-slate-500 font-display uppercase tracking-wider">
                        {a.tag}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                variant="neon"
                size="lg"
                fullWidth
                loading={loading}
                disabled={!selectedChar || !gameMode}
                onClick={handlePlay}
                rightIcon={<ChevronRight size={18} />}
              >
                {gameMode === "PRACTICE"
                  ? "START PRACTICE"
                  : gameMode === "PRIVATE_ROOM"
                  ? "CREATE ROOM"
                  : "FIND MATCH"}
              </Button>

              {(gameMode === "PRIVATE_ROOM" || !gameMode) && (
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onClick={() => setJoinModalOpen(true)}
                  leftIcon={<Lock size={16} />}
                >
                  JOIN WITH CODE
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Join Room Modal */}
      <Modal isOpen={joinModalOpen} onClose={() => setJoinModalOpen(false)} title="JOIN ROOM">
        <div className="space-y-4">
          <p className="text-slate-400 text-sm">Enter the room code to join a private match.</p>
          <Input
            label="Room Code"
            placeholder="AX-XXXX"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={7}
            className="font-display tracking-widest uppercase text-center text-xl"
          />
          <Button variant="primary" fullWidth loading={loading} onClick={handleJoinRoom}>
            JOIN ROOM
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense>
      <PlayPageContent />
    </Suspense>
  );
}
