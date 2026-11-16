import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Toast } from "./Toast";
import { motion, AnimatePresence } from "framer-motion";

interface ToastMessage {
  id: string;
  type: "success" | "error" | "warning" | "info" | "loading";
  title?: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContainerProps {
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "bottom-center";
  maxToasts?: number;
}

export function ToastContainer({ 
  position = "top-right",
  maxToasts = 3 
}: ToastContainerProps) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Function to add toast (can be called from anywhere)
  const addToast = (toast: Omit<ToastMessage, "id">) => {
    const id = Math.random().toString(36).substring(7);
    const newToast = { ...toast, id };
    
    setToasts(prev => {
      const updated = [newToast, ...prev];
      return updated.slice(0, maxToasts);
    });

    // Auto-remove after duration
    if (toast.duration !== 0) {
      setTimeout(() => {
        removeToast(id);
      }, toast.duration || 4000);
    }
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Position classes
  const positionClasses = {
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "top-center": "top-4 left-1/2 transform -translate-x-1/2",
    "bottom-center": "bottom-4 left-1/2 transform -translate-x-1/2",
  };

  return createPortal(
    <div className={`fixed z-50 ${positionClasses[position]} space-y-3`}>
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: position.includes("right") ? 50 : -50, y: 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: position.includes("right") ? 50 : -50, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Toast
              variant={toast.type}
              title={toast.title}
              message={toast.message}
              onClose={() => removeToast(toast.id)}
              action={toast.action}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}

// Global toast function
export const toast = {
  success: (message: string, options?: Partial<ToastMessage>) => {
    if (typeof window !== "undefined") {
      // We'll use event dispatch for simplicity
      window.dispatchEvent(new CustomEvent("show-toast", {
        detail: { type: "success", message, ...options }
      }));
    }
  },
  error: (message: string, options?: Partial<ToastMessage>) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("show-toast", {
        detail: { type: "error", message, ...options }
      }));
    }
  },
  warning: (message: string, options?: Partial<ToastMessage>) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("show-toast", {
        detail: { type: "warning", message, ...options }
      }));
    }
  },
  info: (message: string, options?: Partial<ToastMessage>) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("show-toast", {
        detail: { type: "info", message, ...options }
      }));
    }
  },
  loading: (message: string, options?: Partial<ToastMessage>) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("show-toast", {
        detail: { type: "loading", message, ...options }
      }));
    }
  },
};