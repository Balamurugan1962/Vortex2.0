"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ToastProps {
  id: string
  title?: string
  description?: string
  variant?: "default" | "destructive" | "warning"
  duration?: number
  onClose?: () => void
}

export function Toast({
  title,
  description,
  variant = "default",
  onClose,
}: Omit<ToastProps, "id">) {
  return (
    <div
      className={cn(
        "pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg shadow-lg border",
        "transition-all duration-300 ease-in-out",
        {
          "bg-background border-border": variant === "default",
          "bg-destructive text-destructive-foreground border-destructive": variant === "destructive",
          "bg-yellow-500/10 border-yellow-500/50 text-yellow-900 dark:text-yellow-100": variant === "warning",
        }
      )}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-1">
            {title && (
              <div className="text-sm font-semibold">{title}</div>
            )}
            {description && (
              <div className="mt-1 text-sm opacity-90">{description}</div>
            )}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="ml-4 inline-flex rounded-md p-1.5 hover:bg-black/5 dark:hover:bg-white/5 focus:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export interface ToastContextValue {
  toasts: ToastProps[]
  addToast: (toast: Omit<ToastProps, "id">) => void
  removeToast: (id: string) => void
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastProps[]>([])

  const addToast = React.useCallback((toast: Omit<ToastProps, "id">) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast: ToastProps = { ...toast, id }
    
    setToasts((prev) => [...prev, newToast])

    // Auto-remove after duration
    if (toast.duration !== 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, toast.duration || 5000)
    }
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed bottom-0 right-0 z-50 flex flex-col gap-2 p-4 w-full max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            title={toast.title}
            description={toast.description}
            variant={toast.variant}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within ToastProvider")
  }
  return context
}
