import { createContext, useContext, useState, useCallback } from "react";
import { X } from "lucide-react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((message, options = {}) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 8);
    const toast = { id, message, ...options };
    setToasts((prev) => [...prev, toast]);

    const duration = options.duration ?? 4000;
    if (options.autoDismiss !== false) {
      setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  const toast = {
    success: (message, options = {}) => show(message, { ...options, type: "success" }),
    error: (message, options = {}) => show(message, { ...options, type: "error" }),
    info: (message, options = {}) => show(message, { ...options, type: "info" }),
    warning: (message, options = {}) => show(message, { ...options, type: "warning" }),
    dismiss,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  const typeClasses = {
    success: "border-blue-200 bg-blue-50 text-blue-800",
    error: "border-rose-200 bg-rose-50 text-rose-800",
    info: "border-blue-200 bg-blue-50 text-blue-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
  };

  const iconBy = {
    success: "Success",
    error: "Error",
    info: "Info",
    warning: "Warning",
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-[12.5px] shadow-lg animate-in slide-in-from-bottom-2 ${
            typeClasses[t.type] || typeClasses.info
          }`}
        >
          <span className="mt-0.5 text-sm font-bold">{iconBy[t.type] ?? iconBy.info}</span>
          <span className="flex-1 leading-relaxed">{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            className="shrink-0 rounded p-0.5 text-current/60 hover:text-current"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

export default useToast;
