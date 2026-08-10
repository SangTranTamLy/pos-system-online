export type NetworkStatusNotification = {
  id: string;
  title: string;
  description: string;
  icon: string;
  tone: string;
  timeLabel: string;
};

const NETWORK_STATUS_STORAGE_KEY = "quickserve:network-status-notification";
const NETWORK_STATUS_CHANGE_EVENT = "quickserve:network-status-notification-change";

function emitNetworkStatusChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NETWORK_STATUS_CHANGE_EVENT));
  }
}

export function readNetworkStatusNotification(): NetworkStatusNotification | null {
  try {
    const raw = localStorage.getItem(NETWORK_STATUS_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<NetworkStatusNotification>;
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.title !== "string" ||
      typeof parsed.description !== "string" ||
      typeof parsed.icon !== "string" ||
      typeof parsed.tone !== "string" ||
      typeof parsed.timeLabel !== "string"
    ) {
      return null;
    }

    return parsed as NetworkStatusNotification;
  } catch {
    return null;
  }
}

export function saveOfflineNetworkNotification() {
  const current = readNetworkStatusNotification();
  if (current) return current;

  const notification: NetworkStatusNotification = {
    id: `network-offline-${Date.now()}`,
    title: "Mất kết nối Wi-Fi",
    description:
      "POS đang lưu đơn tiền mặt trên máy. Đơn sẽ tự đồng bộ khi Wi-Fi kết nối lại.",
    icon: "wifi_off",
    tone: "bg-amber-50 text-amber-600",
    timeLabel: new Date().toLocaleString("vi-VN", { hour12: false }),
  };

  try {
    localStorage.setItem(NETWORK_STATUS_STORAGE_KEY, JSON.stringify(notification));
  } catch {
    // The toast remains useful even if browser storage is unavailable.
  }
  emitNetworkStatusChange();
  return notification;
}

export function clearOfflineNetworkNotification() {
  try {
    localStorage.removeItem(NETWORK_STATUS_STORAGE_KEY);
  } catch {
    // Ignore storage failures; the in-memory UI still receives the event.
  }
  emitNetworkStatusChange();
}

export function subscribeNetworkStatusNotification(listener: () => void) {
  window.addEventListener(NETWORK_STATUS_CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(NETWORK_STATUS_CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
