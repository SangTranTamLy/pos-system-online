import { createContext, useContext } from "react";

export type NoticeType = "success" | "error" | "warning" | "info";

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: NoticeType;
};

export type NotifyContextValue = {
  notify: (message: string, type?: NoticeType, title?: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

export type Toast = {
  id: number;
  message: string;
  title: string;
  type: NoticeType;
};

export type ConfirmState = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

export const typeStyles: Record<
  NoticeType,
  { icon: string; badge: string; button: string; title: string }
> = {
  success: {
    icon: "check_circle",
    badge: "bg-emerald-50 text-emerald-600",
    button: "bg-emerald-600 hover:bg-emerald-700",
    title: "Thành công",
  },
  error: {
    icon: "error",
    badge: "bg-red-50 text-red-600",
    button: "bg-red-600 hover:bg-red-700",
    title: "Có lỗi xảy ra",
  },
  warning: {
    icon: "warning",
    badge: "bg-orange-50 text-[#f97316]",
    button: "bg-[#f97316] hover:bg-[#ea580c]",
    title: "Xác nhận thao tác",
  },
  info: {
    icon: "info",
    badge: "bg-blue-50 text-blue-600",
    button: "bg-[#f97316] hover:bg-[#ea580c]",
    title: "Thông báo",
  },
};

export const NotifyContext = createContext<NotifyContextValue | null>(null);

export function useAppNotifications() {
  const value = useContext(NotifyContext);
  if (!value) {
    throw new Error("useAppNotifications must be used inside AppNotificationsProvider");
  }
  return value;
}
