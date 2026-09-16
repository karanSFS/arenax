"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Save, Volume2, Monitor, Gamepad2, User } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/providers/ToastProvider";

interface Settings {
  audio: { master: number; music: number; sfx: number };
  graphics: { quality: string; particles: boolean; screenShake: boolean };
  controls: { layout: string };
  gameplay: { vibration: boolean; screenShake: boolean; showDamageNumbers: boolean };
}

const SliderControl = ({
  label,
  value,
  onChange,
  color = "#00f5ff",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color?: string;
}) => (
  <div>
    <div className="flex justify-between mb-2">
      <span className="text-sm text-slate-400 font-display uppercase tracking-wide">{label}</span>
      <span className="text-sm font-bold" style={{ color }}>{value}%</span>
    </div>
    <input
      type="range"
      min={0}
      max={100}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-2 rounded-full appearance-none cursor-pointer"
      style={{ accentColor: color }}
    />
  </div>
);

const Toggle = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <div className="flex items-center justify-between">
    <span className="text-sm text-slate-400 font-display uppercase tracking-wide">{label}</span>
    <button
      onClick={() => onChange(!checked)}
      className={`w-12 h-6 rounded-full transition-all relative ${checked ? "bg-neon-cyan" : "bg-white/10"}`}
      aria-checked={checked}
      role="switch"
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${checked ? "left-7" : "left-0.5"}`}
      />
    </button>
  </div>
);

export default function SettingsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/player/settings")
      .then((r) => r.json())
      .then((d) => { if (d.success) setSettings(d.data); })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/player/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Settings saved!", "Your preferences have been updated.");
      } else {
        toast.error("Save failed", data.error?.message);
      }
    } catch {
      toast.error("Error", "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  const update = (section: keyof Settings, key: string, value: unknown) => {
    setSettings((prev) =>
      prev ? { ...prev, [section]: { ...prev[section], [key]: value } } : prev
    );
  };

  const sections = [
    {
      title: "AUDIO",
      icon: Volume2,
      content: settings && (
        <div className="space-y-5">
          <SliderControl label="Master Volume" value={settings.audio.master} onChange={(v) => update("audio", "master", v)} />
          <SliderControl label="Music" value={settings.audio.music} onChange={(v) => update("audio", "music", v)} color="#bf5fff" />
          <SliderControl label="SFX" value={settings.audio.sfx} onChange={(v) => update("audio", "sfx", v)} color="#ff6b00" />
        </div>
      ),
    },
    {
      title: "GRAPHICS",
      icon: Monitor,
      content: settings && (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-400 font-display uppercase tracking-wide mb-3">Quality</p>
            <div className="flex gap-2">
              {["low", "medium", "high"].map((q) => (
                <button
                  key={q}
                  onClick={() => update("graphics", "quality", q)}
                  className={`flex-1 py-2 rounded-lg text-xs font-display font-bold uppercase tracking-wide border transition-all ${
                    settings.graphics.quality === q
                      ? "border-neon-cyan/50 text-neon-cyan bg-neon-cyan/10"
                      : "border-white/8 text-slate-500 hover:border-white/20"
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
          <Toggle label="Particles" checked={settings.graphics.particles} onChange={(v) => update("graphics", "particles", v)} />
          <Toggle label="Screen Shake" checked={settings.graphics.screenShake} onChange={(v) => update("graphics", "screenShake", v)} />
        </div>
      ),
    },
    {
      title: "GAMEPLAY",
      icon: Gamepad2,
      content: settings && (
        <div className="space-y-4">
          <Toggle label="Show Damage Numbers" checked={settings.gameplay.showDamageNumbers} onChange={(v) => update("gameplay", "showDamageNumbers", v)} />
          <Toggle label="Screen Shake" checked={settings.gameplay.screenShake} onChange={(v) => update("gameplay", "screenShake", v)} />
          <Toggle label="Vibration" checked={settings.gameplay.vibration} onChange={(v) => update("gameplay", "vibration", v)} />
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />
      <main className="pt-20 pb-12 px-4 max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-8">
            <h1 className="font-display font-black text-3xl gradient-text tracking-widest">SETTINGS</h1>
            <Button variant="primary" size="md" loading={saving} onClick={save} leftIcon={<Save size={16} />}>
              SAVE
            </Button>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-48 rounded-2xl bg-white/5 animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-4">
              {sections.map(({ title, icon: Icon, content }) => (
                <div key={title} className="glass rounded-2xl border border-white/8 p-6">
                  <h2 className="font-display font-black text-sm text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                    <Icon size={16} className="text-neon-cyan" />
                    {title}
                  </h2>
                  {content}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
