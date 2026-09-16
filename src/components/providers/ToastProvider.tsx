"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

export type ToastFn = ((opts: Omit<Toast, "id">) => void) & {
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
};

interface ToastContextValue {
  toast: ToastFn;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((opts: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-3), { ...opts, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = (id: string) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  const success = useCallback((title: string, message?: string) => addToast({ type: "success", title, message }), [addToast]);
  const error = useCallback((title: string, message?: string) => addToast({ type: "error", title, message }), [addToast]);
  const warning = useCallback((title: string, message?: string) => addToast({ type: "warning", title, message }), [addToast]);
  const info = useCallback((title: string, message?: string) => addToast({ type: "info", title, message }), [addToast]);

  const toastFn = Object.assign(
    (opts: Omit<Toast, "id">) => addToast(opts),
    { success, error, warning, info }
  ) as ToastFn;

  const ctx: ToastContextValue = {
    toast: toastFn,
    success,
    error,
    warning,
    info,
  };

  const iconMap = {
    success: <CheckCircle size={18} className="text-neon-green" />,
    error: <XCircle size={18} className="text-neon-pink" />,
    warning: <AlertTriangle size={18} className="text-yellow-400" />,
    info: <Info size={18} className="text-neon-cyan" />,
  };

  const borderMap = {
    success: "border-neon-green/30",
    error: "border-neon-pink/30",
    warning: "border-yellow-400/30",
    info: "border-neon-cyan/30",
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 max-w-sm w-full">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              className={`glass rounded-xl p-4 border ${borderMap[t.type]} flex gap-3 items-start`}
            >
              <div className="mt-0.5">{iconMap[t.type]}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{t.title}</p>
                {t.message && (
                  <p className="text-xs text-slate-400 mt-0.5">{t.message}</p>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
