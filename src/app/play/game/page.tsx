"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Skull, Trophy, Clock, ChevronRight, Volume2, VolumeX, LogOut } from "lucide-react";
import type { GameEngine, HUDData, MatchStats } from "@/game/engine/GameEngine";
import type { TouchController } from "@/game/input/InputController";
import { TouchControlsOverlay } from "@/components/game/TouchControlsOverlay";
import { soundManager } from "@/game/audio/SoundManager";
import { formatDuration } from "@/lib/utils/progression";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/providers/ToastProvider";

// ─── HUD Overlay ──────────────────────────────────────────────────────────────
function HUD({
  data,
  characterColor,
  isMuted,
  onToggleMute,
  onTriggerAbility,
  onLeaveMatch,
}: {
  data: HUDData;
  characterColor: string;
  isMuted: boolean;
  onToggleMute: () => void;
  onTriggerAbility?: (action: "attack" | "ability1" | "ability2" | "ultimate") => void;
  onLeaveMatch?: () => void;
}) {
  const { localPlayer, timeRemaining, killFeed } = data;
  const hpPct = (localPlayer.health / localPlayer.maxHealth) * 100;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ fontFamily: "'Orbitron', monospace" }}>
      {/* Top HUD */}
      <div className="absolute top-4 left-4 right-4 flex items-start justify-between gap-2">
        {/* Player HP */}
        <div className="glass rounded-xl px-4 py-3 border border-white/10 min-w-[180px] sm:min-w-[200px]">
          <div className="flex items-center gap-2 mb-2">
            <Heart size={14} className={hpPct > 50 ? "text-neon-green" : hpPct > 25 ? "text-yellow-400" : "text-neon-pink"} />
            <span className="text-xs text-slate-400 uppercase tracking-widest">HP</span>
            <span className="text-xs font-bold ml-auto" style={{ color: characterColor }}>
              {localPlayer.health} / {localPlayer.maxHealth}
            </span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              animate={{ width: `${hpPct}%` }}
              transition={{ duration: 0.2 }}
              className="h-full rounded-full"
              style={{
                background: hpPct > 50 ? "#39ff14" : hpPct > 25 ? "#ffd700" : "#ff2d78",
              }}
            />
          </div>
        </div>

        {/* Center: Timer & Audio Toggle */}
        <div className="flex items-center gap-2">
          <div className="glass rounded-xl px-5 py-3 border border-white/10 text-center">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-slate-400" />
              <span className="text-xl font-black text-white font-mono">
                {formatDuration(timeRemaining)}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">
              {data.phase === "countdown" ? "STARTING IN" : "MATCH TIME"}
            </p>
          </div>

          <button
            type="button"
            onClick={onToggleMute}
            className="glass rounded-xl p-3 border border-white/10 hover:border-white/30 transition-all pointer-events-auto text-slate-400 hover:text-white"
            title={isMuted ? "Unmute Audio" : "Mute Audio"}
            aria-label={isMuted ? "Unmute Audio" : "Mute Audio"}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} className="text-neon-cyan" />}
          </button>

          {/* Leave / Exit Arena Button */}
          <button
            type="button"
            onClick={onLeaveMatch}
            className="glass rounded-xl px-3 py-3 border border-red-500/40 hover:border-red-500 hover:bg-red-500/15 transition-all pointer-events-auto text-red-400 hover:text-red-300 flex items-center gap-1.5 active:scale-95 shadow-lg group"
            title="Leave Match"
            aria-label="Leave Match"
          >
            <LogOut size={18} className="transition-transform group-hover:-translate-x-0.5" />
            <span className="text-xs font-bold font-display uppercase tracking-wider hidden sm:inline">EXIT</span>
          </button>
        </div>

        {/* Score & Stats */}
        <div className="glass rounded-xl px-4 py-3 border border-white/10 text-right">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest">SCORE</p>
          <p className="text-xl font-black" style={{ color: characterColor }}>
            {localPlayer.score}
          </p>
          <div className="flex items-center gap-3 mt-1 text-xs">
            <span className="text-neon-green flex items-center gap-1">
              <Skull size={10} /> {localPlayer.kills}K
            </span>
            <span className="text-slate-500">{localPlayer.deaths}D</span>
          </div>
        </div>
      </div>

      {/* Kill feed */}
      <div className="absolute top-24 right-4 space-y-1">
        <AnimatePresence>
          {killFeed.slice(0, 4).map((kf, i) => (
            <motion.div
              key={`${kf.killer}-${kf.timestamp}`}
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              className="glass rounded-lg px-3 py-1.5 border border-white/8 text-xs flex items-center gap-2"
            >
              <span className="text-neon-green font-bold">{kf.killer}</span>
              <span className="text-slate-500">eliminated</span>
              <span className="text-neon-pink font-bold">{kf.victim}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Bottom Action / Ability Buttons */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto">
        <div className="glass rounded-2xl px-5 py-3 border border-white/10 flex items-center gap-3 sm:gap-4 shadow-2xl backdrop-blur-md">
          {[
            {
              key: "SPACE",
              label: "ATTACK",
              name: data.localPlayer.abilities.primary.name || "FIRE",
              cd: data.localPlayer.abilities.primary,
              action: "attack" as const,
              isUlt: false,
            },
            {
              key: "Q",
              label: "SKILL 1",
              name: data.localPlayer.abilities.secondary.name || "DASH",
              cd: data.localPlayer.abilities.secondary,
              action: "ability1" as const,
              isUlt: false,
            },
            {
              key: "E",
              label: "SKILL 2",
              name: data.localPlayer.abilities.tactical?.name || "BURST",
              cd: data.localPlayer.abilities.tactical || { cooldown: 0, max: 5 },
              action: "ability2" as const,
              isUlt: false,
            },
            {
              key: "R",
              label: "ULTIMATE",
              name: data.localPlayer.abilities.ultimate.name || "ULTIMATE",
              cd: data.localPlayer.abilities.ultimate,
              action: "ultimate" as const,
              isUlt: true,
            },
          ].map(({ key, label, name, cd, action, isUlt }) => {
            const onCD = cd.cooldown > 0;
            const pct = onCD && cd.max > 0 ? ((cd.max - cd.cooldown) / cd.max) * 100 : 100;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onTriggerAbility?.(action)}
                title={`${name} [${key}] - Click or press ${key} to activate`}
                className="text-center group focus:outline-none transition-transform active:scale-90"
              >
                <div
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 flex flex-col items-center justify-center font-display relative overflow-hidden transition-all shadow-lg ${
                    onCD
                      ? "border-white/10 text-slate-500 bg-white/[0.02]"
                      : isUlt
                      ? "border-pink-500/80 text-pink-300 shadow-[0_0_15px_rgba(255,45,120,0.35)] animate-pulse"
                      : "border-neon-cyan/60 text-neon-cyan hover:border-neon-cyan hover:shadow-[0_0_12px_rgba(0,245,255,0.4)]"
                  }`}
                  style={{
                    background: onCD
                      ? "rgba(255,255,255,0.02)"
                      : isUlt
                      ? "rgba(255,45,120,0.12)"
                      : `${characterColor}18`,
                  }}
                >
                  {/* Cooldown sweep overlay */}
                  {onCD && (
                    <div className="absolute inset-0 bg-black/60 pointer-events-none" />
                  )}
                  {onCD && (
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-white/10 pointer-events-none"
                      style={{ height: `${pct}%` }}
                    />
                  )}

                  {/* Key badge */}
                  <span className={`relative z-10 font-black tracking-wider ${key === "SPACE" ? "text-xs font-mono" : "text-base"}`}>
                    {key}
                  </span>

                  {/* Cooldown text or Name */}
                  {onCD ? (
                    <span className="relative z-10 text-[9px] font-mono font-bold text-amber-300">
                      {cd.cooldown.toFixed(1)}s
                    </span>
                  ) : (
                    <span className="relative z-10 text-[8px] font-mono tracking-tight text-white/70 truncate max-w-[54px]">
                      {name}
                    </span>
                  )}
                </div>
                <p className="text-[9px] text-slate-400 mt-1 uppercase font-bold tracking-wider group-hover:text-white transition-colors">
                  {label}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Controls hint (bottom left) */}
      <div className="absolute bottom-6 left-4 pointer-events-none">
        <div className="glass rounded-xl px-3 py-2 border border-white/8 text-xs text-slate-400 font-display">
          <p>Arrow Keys or WASD: Move & Auto-Aim · Space / Left-Click: Attack · Q/E: Skills · R: Ultimate</p>
        </div>
      </div>
    </div>
  );
}

// ─── Match Result Screen ───────────────────────────────────────────────────────
function MatchResultScreen({
  stats,
  userId,
  onPlayAgain,
}: {
  stats: MatchStats;
  userId: string;
  onPlayAgain: () => void;
}) {
  const router = useRouter();
  const isWinner = stats.winnerId === userId;
  const localPlayerStats = stats.players.find((p) => p.userId === userId);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className="glass-medium rounded-3xl border border-white/10 p-8 max-w-lg w-full mx-4 text-center"
      >
        {/* Result */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {isWinner ? (
            <>
              <Trophy size={64} className="text-yellow-400 mx-auto mb-4" />
              <h2 className="font-display font-black text-4xl text-yellow-400 mb-1">VICTORY!</h2>
              <p className="text-slate-400">Outstanding performance, {stats.winnerUsername}!</p>
            </>
          ) : (
            <>
              <Skull size={64} className="text-neon-pink mx-auto mb-4" />
              <h2 className="font-display font-black text-4xl text-neon-pink mb-1">DEFEATED</h2>
              <p className="text-slate-400">{stats.winnerUsername} wins this round.</p>
            </>
          )}
        </motion.div>

        {/* Stats */}
        {localPlayerStats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-3 gap-4 my-8"
          >
            {[
              { label: "KILLS", value: localPlayerStats.kills, color: "#00f5ff" },
              { label: "DEATHS", value: localPlayerStats.deaths, color: "#ff2d78" },
              { label: "SCORE", value: localPlayerStats.score, color: "#ffd700" },
            ].map((s) => (
              <div key={s.label} className="glass rounded-xl p-4">
                <p className="text-2xl font-black font-display" style={{ color: s.color }}>
                  {s.value}
                </p>
                <p className="text-xs text-slate-500 font-display tracking-widest mt-1">{s.label}</p>
              </div>
            ))}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex gap-3"
        >
          <Button variant="primary" fullWidth onClick={onPlayAgain}>
            PLAY AGAIN
          </Button>
          <Button variant="secondary" fullWidth onClick={() => router.push("/dashboard")}>
            DASHBOARD
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Game Component ───────────────────────────────────────────────────────
function GamePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();

  const mode = searchParams.get("mode") || "PRACTICE";
  const characterSlug = searchParams.get("character") || "blaze";
  const arenaId = searchParams.get("arena") || "cyber_grid";
  const matchId = searchParams.get("matchId");
  const roomCode = searchParams.get("roomCode");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [hud, setHud] = useState<HUDData | null>(null);
  const [matchStats, setMatchStats] = useState<MatchStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [characterColor, setCharacterColor] = useState("#00f5ff");
  const [touchController, setTouchController] = useState<TouchController | null>(null);
  const [isMuted, setIsMuted] = useState(soundManager.getMuted());

  const cleanCharacterSlug = (() => {
    const s = (characterSlug || "blaze").toLowerCase();
    if (s.includes("volt")) return "volt";
    if (s.includes("titan")) return "titan";
    if (s.includes("phantom")) return "phantom";
    return "blaze";
  })();

  const userId = (session?.user as { id?: string })?.id || "player-1";
  const username = (session?.user as { username?: string })?.username || session?.user?.name || "Player";

  const handleToggleMute = useCallback(() => {
    const next = soundManager.toggleMute();
    setIsMuted(next);
  }, []);

  const handleMatchEnd = useCallback(async (winner: { userId: string; username: string }, stats: MatchStats) => {
    setMatchStats(stats);

    // Submit match results to server
    try {
      const targetMatchId = matchId || `practice-${Date.now()}`;
      await fetch("/api/matches/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: targetMatchId,
          winnerId: winner.userId,
          players: stats.players.map((p) => ({
            userId: p.userId,
            characterId: p.characterId,
            kills: p.kills,
            deaths: p.deaths,
            damage: p.damage,
            score: p.score,
          })),
          duration: stats.duration,
          arena: arenaId,
          gameMode: mode,
        }),
      });
    } catch (err) {
      console.error("Failed to submit match result:", err);
    }
  }, [matchId, arenaId, mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Resize canvas to window
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      engineRef.current?.resize(canvas.width, canvas.height);
    };

    resize();
    window.addEventListener("resize", resize);

    let engine: GameEngine;
    let syncInterval: NodeJS.Timeout | null = null;

    // Dynamic import to avoid SSR issues
    import("@/game/engine/GameEngine").then(({ GameEngine }) => {
      engine = new GameEngine(canvas, arenaId, {
        onHUDUpdate: setHud,
        onMatchEnd: handleMatchEnd,
      });

      engineRef.current = engine;
      setTouchController(engine.getTouchController());

      // Distinct spawn point based on user hash
      const spawnIdx = Math.abs(
        userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
      ) % 20;

      // Setup local player
      engine.setupLocalPlayer(userId, username, cleanCharacterSlug, spawnIdx);

      // Get character color for HUD
      import("@/game/characters/CharacterConfig").then(({ CHARACTER_DATA }) => {
        const char = CHARACTER_DATA.find((c) => c.slug === cleanCharacterSlug);
        if (char) setCharacterColor(char.color);
      });

      if (mode === "PRIVATE_ROOM" && roomCode) {
        // High-frequency multiplayer state sync — pure in-memory, ~50ms round-trip
        let isSyncing = false;
        syncInterval = setInterval(async () => {
          if (isSyncing) return;
          isSyncing = true;
          try {
            const localState = engine.getLocalPlayerState();
            if (!localState) return;

            const projectiles = engine.getAndClearPendingProjectiles();

            const res = await fetch(`/api/rooms/${roomCode}/sync`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                playerId: userId,
                state: {
                  ...localState,
                  userId,
                  username,
                  characterSlug: cleanCharacterSlug,
                },
                projectiles,
              }),
            });

            if (res.ok) {
              const data = await res.json();

              // Spawn incoming projectiles fired by other players in real-time!
              const incomingProj = data.incomingProjectiles || data.data?.incomingProjectiles;
              if (Array.isArray(incomingProj) && incomingProj.length > 0) {
                engine.spawnRemoteProjectiles(incomingProj);
              }

              // Update positions and stats of remote fighters (health synced via state)
              const playersList = data.players || data.data?.players;
              if (Array.isArray(playersList)) {
                for (const p of playersList) {
                  const pid = p.userId || p.id;
                  if (!pid || pid === userId) continue;
                  engine.updateRemotePlayer(pid, p);
                }
              }

              // Remove players who have been inactive for 15s (explicit server signal)
              const disconnected = data.disconnectedPlayers || data.data?.disconnectedPlayers;
              if (Array.isArray(disconnected)) {
                for (const pid of disconnected) {
                  if (pid !== userId) engine.removeRemotePlayer(pid);
                }
              }
            }
          } catch {
            // Silently handle momentary network drops during real-time sync
          } finally {
            isSyncing = false;
          }
        }, 50);

      } else {
        // Add AI bot for practice/quick match only
        import("@/game/ai/BotAI").then(() => {
          const botChars = ["volt", "titan", "phantom", "blaze"].filter((s) => s !== cleanCharacterSlug);
          engine.addBot(botChars[0], mode === "PRACTICE" ? "normal" : "hard");
        });
      }

      engine.start();
      setIsLoading(false);
    });

    return () => {
      if (syncInterval) clearInterval(syncInterval);
      engine?.destroy();
      window.removeEventListener("resize", resize);
    };
  }, [userId, username, cleanCharacterSlug, arenaId, mode, roomCode, handleMatchEnd]);

  const handleLeaveMatch = useCallback(() => {
    engineRef.current?.destroy();
    router.push("/play");
  }, [router]);

  function handlePlayAgain() {
    router.push("/play");
  }

  return (
    <div className="fixed inset-0 bg-dark-900 flex items-center justify-center overflow-hidden">
      {/* Loading Screen */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-dark-900 z-50 flex flex-col items-center justify-center"
          >
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-neon-cyan to-neon-purple flex items-center justify-center mx-auto mb-6">
                <span className="font-display font-black text-2xl text-dark-900">AX</span>
              </div>
              <h1 className="font-display font-black text-2xl gradient-text mb-4 tracking-widest">
                ARENAX
              </h1>
              <p className="text-slate-500 text-sm mb-6 uppercase tracking-widest font-display">
                INITIALIZING ARENA...
              </p>
              <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden mx-auto">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 2, ease: "easeInOut" }}
                  className="h-full bg-gradient-to-r from-neon-cyan to-neon-purple rounded-full"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        id="game-canvas"
        className="w-full h-full block"
        style={{ touchAction: "none" }}
        aria-label="Game arena"
      />

      {/* Mobile Touch Controls */}
      <TouchControlsOverlay
        touchController={touchController}
        characterSlug={characterSlug}
        cooldowns={
          hud
            ? {
                primary: hud.localPlayer.abilities.primary.cooldown,
                secondary: hud.localPlayer.abilities.secondary.cooldown,
                ultimate: hud.localPlayer.abilities.ultimate.cooldown,
              }
            : undefined
        }
      />

      {/* HUD */}
      {hud && !matchStats && (
        <HUD
          data={hud}
          characterColor={characterColor}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onTriggerAbility={(action) => engineRef.current?.triggerAbility(action)}
          onLeaveMatch={handleLeaveMatch}
        />
      )}

      {/* Match Result */}
      {matchStats && (
        <MatchResultScreen
          stats={matchStats}
          userId={userId}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense>
      <GamePageContent />
    </Suspense>
  );
}
