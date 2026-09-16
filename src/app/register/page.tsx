"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { Zap, Mail, Lock, User, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/index";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message || "Registration failed.");
        return;
      }

      // Auto sign in after registration
      const loginResult = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (loginResult?.ok) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  const requirements = [
    { label: "At least 8 characters", met: form.password.length >= 8 },
    { label: "Username 3-20 chars", met: form.username.length >= 3 && form.username.length <= 20 },
    { label: "Alphanumeric + underscores only", met: /^[a-zA-Z0-9_]*$/.test(form.username) },
  ];

  return (
    <main className="min-h-screen bg-dark-900 bg-grid flex items-center justify-center p-4 py-12">
      <div className="absolute inset-0 bg-gradient-radial from-neon-purple/5 via-transparent to-transparent" />

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-cyan to-neon-purple flex items-center justify-center">
              <Zap size={22} className="text-dark-900" />
            </div>
            <span className="font-display font-black text-2xl tracking-widest gradient-text">
              ARENAX
            </span>
          </Link>
          <h1 className="text-2xl font-black font-display mt-4 text-white">CREATE ACCOUNT</h1>
          <p className="text-slate-500 text-sm mt-1">Join the arena for free</p>
        </div>

        <div className="glass-medium rounded-2xl border border-white/10 p-8">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <Input
              id="email"
              type="email"
              label="Email"
              placeholder="your@email.com"
              value={form.email}
              onChange={update("email")}
              required
              autoComplete="email"
            />

            <Input
              id="username"
              type="text"
              label="Username"
              placeholder="YourCallsign"
              value={form.username}
              onChange={update("username")}
              required
              autoComplete="username"
            />

            <div>
              <Input
                id="password"
                type="password"
                label="Password"
                placeholder="••••••••"
                value={form.password}
                onChange={update("password")}
                required
                autoComplete="new-password"
              />
              {form.password.length > 0 && (
                <div className="mt-2 space-y-1">
                  {requirements.map((r) => (
                    <div key={r.label} className="flex items-center gap-2 text-xs">
                      <CheckCircle
                        size={12}
                        className={r.met ? "text-neon-green" : "text-slate-600"}
                      />
                      <span className={r.met ? "text-slate-400" : "text-slate-600"}>
                        {r.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded-xl bg-neon-pink/10 border border-neon-pink/20"
              >
                <AlertCircle size={16} className="text-neon-pink flex-shrink-0" />
                <p className="text-sm text-neon-pink">{error}</p>
              </motion.div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
            >
              JOIN THE ARENA
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-500 text-sm">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-neon-cyan hover:text-white transition-colors font-semibold"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
