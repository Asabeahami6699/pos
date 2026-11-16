import React from "react";
import { CheckCircle, XCircle, AlertCircle, Info, Loader2, X } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const toastVariants = cva(
  "flex items-center gap-3 p-4 rounded-xl shadow-lg border max-w-md animate-in slide-in-from-right-5 fade-in-20",
  {
    variants: {
      variant: {
        default: "bg-card border-border",
        success: "bg-emerald-500/10 border-emerald-500/20",
        error: "bg-red-500/10 border-red-500/20",
        warning: "bg-amber-500/10 border-amber-500/20",
        info: "bg-blue-500/10 border-blue-500/20",
        loading: "bg-secondary/60 border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const iconVariants = cva("flex-shrink-0", {
  variants: {
    variant: {
      default: "text-muted-foreground",
      success: "text-green-600",
      error: "text-red-600",
      warning: "text-amber-600",
      info: "text-blue-600",
      loading: "text-muted-foreground",
    },
  },
});

interface ToastProps extends VariantProps<typeof toastVariants> {
  title?: string;
  message: string;
  onClose?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
  showCloseButton?: boolean;
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
  loading: Loader2,
  default: Info,
};

export function Toast({
  variant = "default",
  title,
  message,
  onClose,
  action,
  showCloseButton = true,
}: ToastProps) {
  const Icon = icons[variant || "default"];

  return (
    <div className={cn(toastVariants({ variant }))}>
      <Icon className={cn("h-5 w-5", iconVariants({ variant }))} />
      
      <div className="flex-1">
        {title && (
          <h4 className={cn(
            "font-semibold text-sm",
            variant === "success" && "text-green-800",
            variant === "error" && "text-red-800",
            variant === "warning" && "text-amber-800",
            variant === "info" && "text-blue-800",
            variant === "loading" && "text-foreground",
            !variant && "text-foreground"
          )}>
            {title}
          </h4>
        )}
        <p className={cn(
          "text-sm",
          title ? "mt-1" : "",
          variant === "success" && "text-green-700",
          variant === "error" && "text-red-700",
          variant === "warning" && "text-amber-700",
          variant === "info" && "text-blue-700",
          variant === "loading" && "text-foreground",
          !variant && "text-foreground"
        )}>
          {message}
        </p>
        
        {action && (
          <button
            onClick={action.onClick}
            className={cn(
              "mt-2 text-sm font-medium hover:underline",
              variant === "success" && "text-green-800 hover:text-green-900",
              variant === "error" && "text-red-800 hover:text-red-900",
              variant === "warning" && "text-amber-800 hover:text-amber-900",
              variant === "info" && "text-blue-800 hover:text-blue-900",
              variant === "loading" && "text-foreground hover:text-foreground",
              !variant && "text-foreground hover:text-foreground"
            )}
          >
            {action.label}
          </button>
        )}
      </div>
      
      {showCloseButton && onClose && (
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-muted-foreground transition-colors ml-2"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}