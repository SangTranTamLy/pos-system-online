import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  NotifyContext,
  typeStyles,
  type ConfirmOptions,
  type ConfirmState,
  type NoticeType,
  type NoticeOptions,
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

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const styles = typeStyles[toast.type];
  const isNetworkToast = toast.variant === "network";
  const networkTone =
    toast.type === "success"
      ? "border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 ring-emerald-100/80"
      : "border-amber-200 bg-gradient-to-r from-amber-50 via-white to-orange-50 ring-amber-100/80";

  return (
    <div
      className={[
        "pointer-events-auto relative flex gap-3 overflow-hidden backdrop-blur-md",
        !isNetworkToast ? (toast.placement === "center" ? "toast-animate-center" : "toast-animate-right") : "",
        isNetworkToast
          ? [
              "w-full max-w-xl rounded-[28px] border-2 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.24)] ring-4",
              networkTone,
            ].join(" ")
          : toast.placement === "center"
            ? "w-full max-w-lg rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.24)] ring-1 ring-white/70"
            : "rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.16)]",
      ].join(" ").trim()}
    >
      {isNetworkToast ? (
        <span
          className={[
            "absolute inset-x-0 top-0 h-1",
            toast.type === "success" ? "bg-emerald-400" : "bg-[#f97316]",
          ].join(" ")}
        />
      ) : null}
      <span
        className={`flex shrink-0 items-center justify-center rounded-2xl ${
          toast.placement === "center" ? "h-14 w-14" : "h-10 w-10 rounded-xl"
        } ${styles.badge}`}
      >
        <NoticeIcon
          name={toast.icon || styles.icon}
          className={toast.placement === "center" ? "text-[30px]" : "text-[22px]"}
        />
      </span>
      <div className="min-w-0 flex-1 self-center">
        {isNetworkToast ? (
          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
            Trạng thái kết nối
          </p>
        ) : null}
        <p
          className={
            isNetworkToast || toast.placement === "center"
              ? "font-['Outfit',sans-serif] text-base font-black text-slate-900"
              : "font-['Outfit',sans-serif] text-sm font-extrabold text-slate-900"
          }
        >
          {toast.title}
        </p>
        <p
          className={
            isNetworkToast || toast.placement === "center"
              ? "mt-1.5 text-sm font-semibold leading-relaxed text-slate-600"
              : "mt-1 text-sm font-medium leading-relaxed text-slate-600"
          }
        >
          {toast.message}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="self-start rounded-xl p-1.5 text-slate-400 transition hover:bg-white/80 hover:text-slate-700"
        aria-label="Đóng thông báo"
      >
        <NoticeIcon name="close" className="text-[18px]" />
      </button>
    </div>
  );
}

export function AppNotificationsProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const notify = useCallback(
    (
      message: string,
      type: NoticeType = "info",
      title?: string,
      options: NoticeOptions = {}
    ) => {
      const id = Date.now() + Math.random();
      const toast: Toast = {
        id,
        message,
        type,
        title: title || typeStyles[type].title,
        placement: options.placement || "top-right",
        variant: options.variant || "default",
        icon: options.icon,
      };

      setToasts((current) => [...current, toast].slice(-4));
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== id));
      }, Math.min(Math.max(options.durationMs ?? 3600, 2500), 9000));
    },
    []
  );

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
        {toasts
          .filter((toast) => toast.placement === "top-right")
          .map((toast) => (
            <ToastCard
              key={toast.id}
              toast={toast}
              onClose={() =>
                setToasts((current) => current.filter((item) => item.id !== toast.id))
              }
            />
          ))}
      </div>

      <div className="pointer-events-none fixed inset-x-0 top-5 z-[90] flex justify-center px-4">
        <div className="flex w-full max-w-lg flex-col gap-3">
          {toasts
            .filter((toast) => toast.placement === "center")
            .map((toast) => (
              <ToastCard
                key={toast.id}
                toast={toast}
                onClose={() =>
                  setToasts((current) => current.filter((item) => item.id !== toast.id))
                }
              />
            ))}
        </div>
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
