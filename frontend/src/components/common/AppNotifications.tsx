import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  NotifyContext,
  typeStyles,
  type ConfirmOptions,
  type ConfirmState,
  type NoticeType,
  type Toast,
} from "./AppNotificationsContext";

function NoticeIcon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined inline-flex shrink-0 align-middle ${className}`}
      style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
    >
      {name}
    </span>
  );
}

export function AppNotificationsProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const notify = useCallback((message: string, type: NoticeType = "info", title?: string) => {
    const id = Date.now() + Math.random();
    const toast: Toast = {
      id,
      message,
      type,
      title: title || typeStyles[type].title,
    };

    setToasts((current) => [...current, toast].slice(-4));
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 3600);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        ...options,
        type: options.type || "warning",
        resolve,
      });
    });
  }, []);

  const value = useMemo(() => ({ notify, confirm }), [confirm, notify]);

  const closeConfirm = (valueToResolve: boolean) => {
    if (!confirmState) return;
    confirmState.resolve(valueToResolve);
    setConfirmState(null);
  };

  return (
    <NotifyContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed right-4 top-4 z-90 flex w-[min(420px,calc(100vw-32px))] flex-col gap-3">
        {toasts.map((toast) => {
          const styles = typeStyles[toast.type];
          return (
            <div
              key={toast.id}
              className="pointer-events-auto flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.16)]"
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${styles.badge}`}>
                <NoticeIcon name={styles.icon} className="text-[22px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-['Outfit',sans-serif] text-sm font-extrabold text-slate-900">
                  {toast.title}
                </p>
                <p className="mt-1 text-sm font-medium leading-relaxed text-slate-600">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Đóng thông báo"
              >
                <NoticeIcon name="close" className="text-[18px]" />
              </button>
            </div>
          );
        })}
      </div>

      {confirmState ? (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${typeStyles[confirmState.type || "warning"].badge}`}>
                <NoticeIcon name={typeStyles[confirmState.type || "warning"].icon} className="text-[26px]" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-['Outfit',sans-serif] text-lg font-extrabold text-slate-900">
                  {confirmState.title || typeStyles[confirmState.type || "warning"].title}
                </h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
                  {confirmState.message}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => closeConfirm(false)}
                className="h-11 rounded-xl px-5 text-sm font-extrabold text-slate-500 transition hover:bg-slate-100"
              >
                {confirmState.cancelText || "Hủy"}
              </button>
              <button
                type="button"
                onClick={() => closeConfirm(true)}
                className={`h-11 rounded-xl px-5 text-sm font-extrabold text-white transition ${typeStyles[confirmState.type || "warning"].button}`}
              >
                {confirmState.confirmText || "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </NotifyContext.Provider>
  );
}
