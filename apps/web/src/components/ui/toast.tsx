"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, AlertCircle, CheckCircle2, X } from "lucide-react";

export type ToastType = "info" | "success" | "error";

export interface ToastMessage {
  id: string;
  message: string;
  type?: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  errorToast: (message?: string) => void;
  successToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
      setTimeout(() => {
        removeToast(id);
      }, 4000);
    },
    [removeToast]
  );

  const errorToast = useCallback(
    (message = "The tide took that one. Try again?") => {
      toast(message, "error");
    },
    [toast]
  );

  const successToast = useCallback(
    (message: string) => {
      toast(message, "success");
    },
    [toast]
  );

  return (
    <ToastContext.Provider value={{ toast, errorToast, successToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-xl border border-hairline bg-surface-raised/95 backdrop-blur-md shadow-lantern text-xs font-sans text-text"
              role="alert"
            >
              <div className="flex items-center gap-2.5">
                {t.type === "error" ? (
                  <AlertCircle className="w-4 h-4 text-dusk-rose shrink-0" />
                ) : t.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                ) : (
                  <Sparkles className="w-4 h-4 text-accent shrink-0" />
                )}
                <span className="leading-snug">{t.message}</span>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="p-1 rounded text-text-subtle hover:text-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      toast: (msg: string) => console.log("[Toast]", msg),
      errorToast: (msg = "The tide took that one. Try again?") => console.error("[Toast Error]", msg),
      successToast: (msg: string) => console.log("[Toast Success]", msg),
    };
  }
  return context;
}
