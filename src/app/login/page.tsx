"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Zap, Mail, Lock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/index";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password. Please try again.");
      } else {
        window.location.href = "/dashboard";
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-dark-900 bg-grid flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-radial from-neon-cyan/5 via-transparent to-transparent" />

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-cyan to-neon-purple flex items-center justify-center">
              <Zap size={22} className="text-dark-900" />
            </div>
            <span className="font-display font-black text-2xl tracking-widest gradient-text">
              ARENAX
            </span>
          </Link>
          <h1 className="text-2xl font-black font-display mt-4 text-white">SIGN IN</h1>
          <p className="text-slate-500 text-sm mt-1">Enter your credentials to continue</p>
        </div>

        {/* Form card */}
        <div className="glass-medium rounded-2xl border border-white/10 p-8">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 mt-4" />
              <Input
                id="email"
                type="email"
                label="Email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="pl-10"
              />
            </div>

            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 mt-4" />
              <Input
                id="password"
                type="password"
                label="Password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="pl-10"
              />
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
              ENTER ARENA
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-500 text-sm">
              No account?{" "}
              <Link
                href="/register"
                className="text-neon-cyan hover:text-white transition-colors font-semibold"
              >
                Register free
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
