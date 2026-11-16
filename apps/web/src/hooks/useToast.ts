import { toast as sonnerToast } from "sonner";

type ToastType = "success" | "error" | "warning" | "info" | "loading";

interface ToastOptions {
  title?: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  cancel?: {
    label: string;
    onClick?: () => void;
  };
}

export function useToast() {
  const toast = (type: ToastType, message: string, options?: ToastOptions) => {
    const config = {
      duration: options?.duration || 4000,
      ...options,
    };

    switch (type) {
      case "success":
        return sonnerToast.success(message, config);
      case "error":
        return sonnerToast.error(message, config);
      case "warning":
        return sonnerToast.warning(message, config);
      case "info":
        return sonnerToast.info(message, config);
      case "loading":
        return sonnerToast.loading(message, config);
      default:
        return sonnerToast(message, config);
    }
  };

  const success = (message: string, options?: ToastOptions) => 
    toast("success", message, options);

  const error = (message: string, options?: ToastOptions) => 
    toast("error", message, options);

  const warning = (message: string, options?: ToastOptions) => 
    toast("warning", message, options);

  const info = (message: string, options?: ToastOptions) => 
    toast("info", message, options);

  const loading = (message: string, options?: ToastOptions) => 
    toast("loading", message, options);

  const promise = <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    },
    options?: ToastOptions
  ) => {
    return sonnerToast.promise(promise, {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
      ...options,
    });
  };

  const dismiss = (id?: string) => sonnerToast.dismiss(id);

  return {
    toast,
    success,
    error,
    warning,
    info,
    loading,
    promise,
    dismiss,
  };
}