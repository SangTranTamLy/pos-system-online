import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchShifts } from "../api/shifts.api";
import { createAuditLog, getAuditLogs } from "../api/audit-log.api";
import { fetchMaterials, type Material } from "../api/inventory.api";
import { getProducts, type Product } from "../api/product.api";
import { getOrders, type OrderListItem } from "../api/order.api";
import { fetchPromotions, type Promotion } from "../api/promotions.api";
import type { AuditLog } from "../types/audit-log";
import { translateRole } from "../utils/role";
import systemLogo from "../assets/logo-1.png";

type MenuItem = {
  label: string;
  icon: string;
  path: string;
  group: "main" | "system";
  allowedRoles: string[];
  disabled?: boolean;
  children?: Array<{
    label: string;
    icon: string;
    path: string;
    disabled?: boolean;
  }>;
};

type AuthUser = {
  id?: string;
  fullName?: string;
  roleName?: string;
  avatarUrl?: string;
};

type AdminLayoutProps = {
  children: ReactNode;
  title?: string;
  subtitle?: ReactNode;
  headerContent?: ReactNode;
};

const menuItems: MenuItem[] = [
  { label: "Tổng quan", icon: "dashboard", path: "/dashboard", group: "main", allowedRoles: ["admin", "manager"] },
  { label: "Bán hàng (POS)", icon: "point_of_sale", path: "/pos", group: "main", allowedRoles: ["admin", "manager", "staff", "cashier"] },
  { label: "Sản phẩm", icon: "package_2", path: "/products", group: "main", allowedRoles: ["admin", "manager"] },
  { label: "Danh mục", icon: "sell", path: "/categories", group: "main", allowedRoles: ["admin", "manager"] },
  { label: "Kho hàng", icon: "inventory_2", path: "/stock", group: "main", allowedRoles: ["admin", "manager"] },
  { label: "Khách hàng", icon: "group", path: "/customers", group: "main", allowedRoles: ["admin", "manager", "staff", "cashier"] },
  { label: "Hóa đơn", icon: "receipt_long", path: "/invoices", group: "main", allowedRoles: ["admin", "manager", "staff", "cashier"] },
  { label: "Khuyến mãi", icon: "redeem", path: "/promotions", group: "main", allowedRoles: ["admin", "manager"] },
  { label: "Nhân viên", icon: "badge", path: "/employees", group: "system", allowedRoles: ["admin", "manager"] },
  { label: "Ca làm", icon: "work_history", path: "/staff-dashboard", group: "system", allowedRoles: ["staff", "cashier"] },
  { label: "Ca làm", icon: "work_history", path: "/shifts", group: "system", allowedRoles: ["admin", "manager"] },
  { label: "Báo cáo", icon: "analytics", path: "/reports", group: "system", allowedRoles: ["admin", "manager"] },
  { label: "Nhật ký hệ thống", icon: "history", path: "/audit-logs", group: "system", allowedRoles: ["admin"] },
  { label: "Cài đặt", icon: "settings", path: "/settings", group: "system", allowedRoles: ["admin"] },
];

export function Icon({
  name,
  filled = false,
  className = "",
}: {
  name: string;
  filled?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined inline-flex shrink-0 align-middle ${className}`}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
      }}
    >
      {name}
    </span>
  );
}

function formatCurrentDateTime(date: Date) {
  const dateLabel = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  const weekdayLabel = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
  }).format(date);
  const timeLabel = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);

  return {
    dateLabel,
    metaLabel: `${weekdayLabel} • ${timeLabel}`,
  };
}

function getStoredAuthUser(): AuthUser {
  const storedUser = localStorage.getItem("auth_user");

  if (!storedUser) {
    return {
      fullName: "Admin Demo",
      roleName: "admin",
    };
  }

  try {
    const parsedUser = JSON.parse(storedUser) as AuthUser;

    return {
      id: parsedUser.id,
      fullName: parsedUser.fullName?.trim() || "Admin Demo",
      roleName: parsedUser.roleName?.trim() || "admin",
      avatarUrl: parsedUser.avatarUrl?.trim() || undefined,
    };
  } catch {
    return {
      fullName: "Admin Demo",
      roleName: "admin",
    };
  }
}

type LayoutShift = Awaited<ReturnType<typeof fetchShifts>>[number];

function formatLocalDateInput(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatNotificationCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function getShortOrderCode(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function getStockNotificationSignature(
  items: Array<{ id: string; stockQuantity?: number | null; updatedAt?: string }>
) {
  return items
    .map((item) => `${item.id}:${Number(item.stockQuantity ?? 0)}:${item.updatedAt || ""}`)
    .sort()
    .join("|");
}

function textIncludesAny(value: string | null | undefined, keywords: string[]) {
  const normalized = (value || "").toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function formatNotificationNameList(names: string[], maxItems = 3) {
  const visibleNames = names.slice(0, maxItems);
  const remainingCount = names.length - visibleNames.length;

  if (remainingCount <= 0) {
    return visibleNames.join(", ");
  }

  return `${visibleNames.join(", ")} và ${remainingCount} mục khác`;
}

function getPromotionNotificationTitle(promotion: Promotion) {
  return `Cập nhật mã khuyến mãi: ${promotion.code}`;
}

function getPromotionNotificationDescription(promotion: Promotion) {
  const discount =
    promotion.discountType === "percent"
      ? `${promotion.discountValue}%`
      : `${promotion.discountValue.toLocaleString("vi-VN")} đ`;
  const condition =
    promotion.promotionScope === "combo"
      ? promotion.requiredItems
          .map((item) => `${item.productName} x${item.quantity}`)
          .join(" + ")
      : promotion.productName;

  return `${promotion.name} (Mã: ${promotion.code}) - giảm ${discount}. Điều kiện: ${condition}.`;
}

type NotificationItem = {
  id: string;
  title: string;
  description: string;
  icon: string;
  tone: string;
  timeLabel?: string;
  path?: string;
};

const DISMISSED_NOTIFICATION_IDS_KEY = "quickserve:dismissed-notification-ids";
const READ_NOTIFICATION_IDS_KEY = "quickserve:read-notification-ids";

function getNotificationStorageKey(baseKey: string, scopeKey: string) {
  return `${baseKey}:${scopeKey}`;
}

function readNotificationIds(storageKey: string) {
  try {
    const value = localStorage.getItem(storageKey);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeNotificationIds(storageKey: string, ids: string[]) {
  localStorage.setItem(storageKey, JSON.stringify(ids));
  window.dispatchEvent(new Event("quickserve:dismissed-notifications-change"));
}

function NotificationBell({
  items,
  scopeKey,
}: {
  items: NotificationItem[];
  scopeKey: string;
}) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dismissedStorageKey = getNotificationStorageKey(DISMISSED_NOTIFICATION_IDS_KEY, scopeKey);
  const readStorageKey = getNotificationStorageKey(READ_NOTIFICATION_IDS_KEY, scopeKey);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => readNotificationIds(dismissedStorageKey));
  const [readIds, setReadIds] = useState<string[]>(() => readNotificationIds(readStorageKey));
  const dismissedIdSet = useMemo(() => new Set(dismissedIds), [dismissedIds]);
  const readIdSet = useMemo(() => new Set(readIds), [readIds]);
  const displayItems = items.filter((item) => !dismissedIdSet.has(item.id));
  const unreadItems = displayItems.filter((item) => !readIdSet.has(item.id));
  const visibleCount = Math.min(unreadItems.length, 99);

  useEffect(() => {
    const syncNotificationState = () => {
      setDismissedIds(readNotificationIds(dismissedStorageKey));
      setReadIds(readNotificationIds(readStorageKey));
    };

    window.addEventListener("storage", syncNotificationState);
    window.addEventListener("quickserve:dismissed-notifications-change", syncNotificationState);

    return () => {
      window.removeEventListener("storage", syncNotificationState);
      window.removeEventListener("quickserve:dismissed-notifications-change", syncNotificationState);
    };
  }, [dismissedStorageKey, readStorageKey]);

  function markDisplayItemsAsRead() {
    const nextIds = Array.from(new Set([...readIds, ...displayItems.map((item) => item.id)]));
    writeNotificationIds(readStorageKey, nextIds);
    setReadIds(nextIds);
  }

  function dismissDisplayItems() {
    const nextIds = Array.from(new Set([...dismissedIds, ...displayItems.map((item) => item.id)]));
    writeNotificationIds(dismissedStorageKey, nextIds);
    setDismissedIds(nextIds);
  }

  function openNotification(item: NotificationItem) {
    const nextIds = Array.from(new Set([...readIds, item.id]));
    writeNotificationIds(readStorageKey, nextIds);
    setReadIds(nextIds);
    setIsOpen(false);

    if (item.path) {
      navigate(item.path);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="group relative flex h-9 w-9 items-center justify-center border border-slate-200 bg-white text-slate-600 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-orange-200 hover:bg-orange-50 hover:text-[#f97316] hover:shadow-md active:translate-y-0"
        aria-label="Thông báo"
      >
        <Icon name="notifications" className="text-[22px] transition-transform duration-200 ease-out group-hover:-rotate-12 group-hover:scale-110" />
        {visibleCount > 0 ? (
          <span className="absolute -right-2 -top-2 flex h-5 min-w-5 animate-pulse items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-extrabold leading-none text-white ring-2 ring-white">
            {visibleCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <>
        <style>
          {`@keyframes notificationPanel{from{opacity:0;transform:translateY(-8px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}`}
        </style>
        <div className="fixed left-4 right-4 top-20 z-50 w-auto max-w-[360px] origin-top-left animate-[notificationPanel_160ms_ease-out] overflow-hidden border border-slate-200 bg-white shadow-2xl lg:left-[272px] lg:right-auto lg:w-[360px]">
          <div className="relative border-b border-slate-100 px-4 py-4 pr-20">
            <p className="font-['Outfit',sans-serif] text-sm font-extrabold uppercase tracking-wide text-slate-900">
              Thông báo hệ thống
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Cập nhật nhanh các việc cần xử lý
            </p>
            <div className="absolute right-4 top-4 flex items-center gap-3">
              <button
                type="button"
                onClick={markDisplayItemsAsRead}
                className="rounded-md p-1 text-[#f97316] transition-all duration-200 hover:bg-orange-50 hover:text-orange-600"
                title="Đánh dấu đã đọc"
              >
                <Icon name="check" className="text-[20px]" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md p-1 text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-700"
                title="Đóng"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>
          </div>
          <div className="max-h-[448px] overflow-y-auto">
            {displayItems.length > 0 ? (
              displayItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openNotification(item)}
                  className="group flex w-full gap-3 border-b border-slate-100 px-4 py-4 text-left transition-all duration-200 last:border-b-0 hover:bg-orange-50/50 focus:bg-orange-50 focus:outline-none"
                >
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105 ${item.tone}`}>
                    <Icon name={item.icon} className="text-[19px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 break-words text-sm font-extrabold uppercase tracking-wide text-slate-900">{item.title}</p>
                      {!readIdSet.has(item.id) ? (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#f97316]" />
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-500">
                      {item.description}
                    </p>
                    <p className="mt-2 text-xs font-bold text-slate-600">{item.timeLabel || "Vừa cập nhật"}</p>
                  </div>
                  {item.path ? (
                    <Icon name="chevron_right" className="mt-1 text-[18px] text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#f97316]" />
                  ) : null}
                </button>
              ))
            ) : (
              <div className="px-4 py-10 text-center">
                <Icon name="notifications_off" className="mb-2 text-[30px] text-slate-300" />
                <p className="text-sm font-bold text-slate-600">Chưa có thông báo mới</p>
              </div>
            )}
          </div>
          {displayItems.length > 0 ? (
            <button
              type="button"
              onClick={dismissDisplayItems}
              className="flex w-full items-center justify-center gap-2 border-t border-slate-100 px-4 py-4 text-xs font-extrabold uppercase tracking-wide text-slate-500 transition hover:bg-orange-50 hover:text-[#f97316]"
            >
              <Icon name="delete" className="text-[18px]" />
              Xóa tất cả thông báo
            </button>
          ) : null}
        </div>
        </>
      ) : null}
    </div>
  );
}

function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "AD";
  }

  return parts
    .slice(-2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function useCurrentDateTime() {
  const [currentDateTime, setCurrentDateTime] = useState(() =>
    formatCurrentDateTime(new Date())
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentDateTime(formatCurrentDateTime(new Date()));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return currentDateTime;
}

function SidebarItem({
  item,
  onNavigate,
}: {
  item: MenuItem;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const hasChildren = Boolean(item.children?.length);
  const isActive =
    !item.disabled &&
    (location.pathname === item.path ||
      (item.path !== "/dashboard" && location.pathname.startsWith(item.path)));

  const [isOpen, setIsOpen] = useState(() => isActive);
  const [prevPathname, setPrevPathname] = useState(location.pathname);

  if (location.pathname !== prevPathname) {
    setPrevPathname(location.pathname);
    if (isActive) {
      setIsOpen(true);
    }
  }

  if (hasChildren) {
    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => {
            if (!item.disabled) {
              setIsOpen(!isOpen);
            }
          }}
          disabled={item.disabled}
          className={[
            "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-all duration-200",
            isActive
              ? "bg-orange-50 font-bold text-[#f97316]"
              : item.disabled
                ? "cursor-not-allowed font-medium text-slate-400 opacity-70"
                : "font-medium text-slate-600 hover:bg-orange-50 hover:text-[#f97316]",
          ].join(" ")}
        >
          <Icon name={item.icon} className="text-[20px]" />
          <span className="flex-1">{item.label}</span>
          <Icon
            name={isOpen ? "expand_less" : "expand_more"}
            className={["ml-auto transition-transform duration-200 text-slate-400", isActive ? "text-[#f97316] font-bold" : ""].join(" ")}
          />
        </button>

        {isOpen && (
          <div className="relative ml-6 pl-3.5 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[1.5px] before:bg-slate-200">
            <div className="flex flex-col gap-1">
              {item.children?.map((child) => {
                const isChildActive = location.pathname === child.path;
                return (
                  <button
                    key={child.label}
                    type="button"
                    onClick={() => {
                      if (!child.disabled) {
                        navigate(child.path);
                        onNavigate?.();
                      }
                    }}
                    disabled={child.disabled}
                    className={[
                      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] font-semibold transition-all duration-200",
                      isChildActive
                        ? "text-[#f97316] font-bold bg-orange-50/50"
                        : "text-slate-500 hover:bg-orange-50/30 hover:text-[#f97316]",
                    ].join(" ")}
                  >
                    <Icon name={child.icon} className="text-[16px]" />
                    <span>{child.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (!item.disabled) {
          navigate(item.path);
          onNavigate?.();
        }
      }}
      disabled={item.disabled}
      title={item.disabled ? "Chức năng sẽ làm sau" : undefined}
      className={[
        "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-all duration-200",
        isActive
          ? "bg-[#f97316] font-semibold text-white shadow-sm"
          : item.disabled
            ? "cursor-not-allowed font-medium text-slate-400 opacity-70"
            : "font-medium text-slate-600 hover:bg-orange-50 hover:text-[#f97316]",
      ].join(" ")}
    >
      <Icon name={item.icon} className="text-[20px]" />
      <span>{item.label}</span>
    </button>
  );
}

function AdminLayout({ children, title, subtitle, headerContent }: AdminLayoutProps) {
  const navigate = useNavigate();
  const currentDateTime = useCurrentDateTime();
  const [user] = useState<AuthUser>(() => getStoredAuthUser());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hasActiveShift, setHasActiveShift] = useState(true);
  const [, setLayoutShifts] = useState<LayoutShift[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [todayOrders, setTodayOrders] = useState<OrderListItem[]>([]);
  const [cancelledOrders, setCancelledOrders] = useState<OrderListItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [notificationRefreshKey, setNotificationRefreshKey] = useState(0);

  useEffect(() => {
    const roleName = user.roleName?.toLowerCase() || "";
    fetchShifts().then(shifts => {
      setLayoutShifts(shifts);
      if (["staff", "cashier"].includes(roleName)) {
        const currentUserId = user.id || "";
        const openShift = shifts.find(s => s.status === "OPEN" && s.userId === currentUserId);
        setHasActiveShift(!!openShift);
      }
    }).catch(() => {
      setLayoutShifts([]);
      if (["staff", "cashier"].includes(roleName)) {
        setHasActiveShift(false);
      }
    });
  }, [user.id, user.roleName]);

  useEffect(() => {
    const roleName = user.roleName?.toLowerCase() || "";
    const canSeeAdminNotifications = ["admin", "manager"].includes(roleName);
    const canSeeSharedNotifications = ["admin", "manager", "staff", "cashier"].includes(roleName);

    if (!["admin", "manager", "staff", "cashier"].includes(roleName)) {
      void Promise.resolve().then(() => {
        setMaterials([]);
        setProducts([]);
        setPromotions([]);
        setTodayOrders([]);
        setCancelledOrders([]);
        setAuditLogs([]);
      });
      return;
    }

    const today = formatLocalDateInput(new Date());

    void Promise.allSettled([
      fetchMaterials(),
      getProducts(),
      canSeeSharedNotifications ? fetchPromotions() : Promise.resolve([]),
      canSeeAdminNotifications
        ? getOrders({ dateFrom: today, dateTo: today })
        : Promise.resolve({
            success: true,
            message: "",
            data: [],
          } as Awaited<ReturnType<typeof getOrders>>),
      canSeeSharedNotifications
        ? getOrders({ status: "cancelled", dateFrom: today, dateTo: today })
        : Promise.resolve({
            success: true,
            message: "",
            data: [],
          } as Awaited<ReturnType<typeof getOrders>>),
      canSeeAdminNotifications
        ? getAuditLogs({ page: 1, limit: 50 })
        : Promise.resolve({
            logs: [],
            total: 0,
          } as Awaited<ReturnType<typeof getAuditLogs>>),
    ]).then(([materialsResult, productsResult, promotionsResult, ordersResult, cancelledResult, logsResult]) => {
      setMaterials(materialsResult.status === "fulfilled" ? materialsResult.value.data : []);
      setProducts(productsResult.status === "fulfilled" ? productsResult.value.data : []);
      setPromotions(promotionsResult.status === "fulfilled" ? promotionsResult.value : []);
      setTodayOrders(ordersResult.status === "fulfilled" ? ordersResult.value.data : []);
      setCancelledOrders(cancelledResult.status === "fulfilled" ? cancelledResult.value.data : []);
      setAuditLogs(logsResult.status === "fulfilled" ? logsResult.value.logs : []);
    });
  }, [notificationRefreshKey, user.roleName]);

  useEffect(() => {
    const refreshNotifications = () => {
      setNotificationRefreshKey((current) => current + 1);
    };

    window.addEventListener("quickserve:notifications-refresh", refreshNotifications);
    const interval = window.setInterval(refreshNotifications, 60_000);

    return () => {
      window.removeEventListener("quickserve:notifications-refresh", refreshNotifications);
      window.clearInterval(interval);
    };
  }, []);

  const mainMenuItems = useMemo(
    () =>
      menuItems.filter(
        (item) =>
          item.group === "main" &&
          (!user.roleName || item.allowedRoles.includes(user.roleName.toLowerCase()))
      ).map(item => ({
        ...item,
        disabled:
          ["staff", "cashier"].includes(user.roleName?.toLowerCase() || "") &&
          !hasActiveShift &&
          item.path !== "/staff-dashboard"
            ? true
            : item.disabled
      })),
    [user.roleName, hasActiveShift]
  );
  const systemMenuItems = useMemo(
    () =>
      menuItems.filter(
        (item) =>
          item.group === "system" &&
          (!user.roleName || item.allowedRoles.includes(user.roleName.toLowerCase()))
      ).map(item => ({
        ...item,
        disabled:
          ["staff", "cashier"].includes(user.roleName?.toLowerCase() || "") &&
          !hasActiveShift &&
          item.path !== "/staff-dashboard"
            ? true
            : item.disabled
      })),
    [user.roleName, hasActiveShift]
  );

  const displayName = user.fullName?.trim() || "Admin Demo";
  const displayRole = user.roleName?.trim() || "admin";
  const notificationScopeKey = "system-shared";
  const notificationItems = useMemo<NotificationItem[]>(() => {
    const roleName = user.roleName?.toLowerCase() || "";
    const canManageBackOffice = ["admin", "manager"].includes(roleName);
    const items: NotificationItem[] = [];

    const lowMaterials = materials.filter((material) =>
      material.isActive && Number(material.stockQuantity) > 0 && Number(material.stockQuantity) <= 5
    );
    const lowProducts = products.filter((product) =>
      product.isTrackedStock && product.status !== "out_of_stock" && Number(product.stockQuantity || 0) > 0 && Number(product.stockQuantity || 0) <= 5
    );
    const outOfStockProducts = products.filter((product) =>
      product.isTrackedStock && (product.status === "out_of_stock" || Number(product.stockQuantity || 0) <= 0)
    );

    if (lowMaterials.length + lowProducts.length > 0) {
      const lowStockNames = [
        ...lowMaterials.map((material) =>
          `${material.name} (${Number(material.stockQuantity || 0).toLocaleString("vi-VN")} ${material.unit})`
        ),
        ...lowProducts.map((product) =>
          `${product.name} (${Number(product.stockQuantity || 0).toLocaleString("vi-VN")})`
        ),
      ];
      const lowStockSignature = getStockNotificationSignature([
        ...lowMaterials.map((material) => ({
          id: `material-${material.id}`,
          stockQuantity: material.stockQuantity,
          updatedAt: material.updatedAt,
        })),
        ...lowProducts.map((product) => ({
          id: `product-${product.id}`,
          stockQuantity: product.stockQuantity,
          updatedAt: product.updatedAt,
        })),
      ]);

      items.push({
        id: `low-stock-${lowStockSignature}`,
        title: `${lowMaterials.length + lowProducts.length} mặt hàng tồn kho thấp`,
        description: `Sắp hết: ${formatNotificationNameList(lowStockNames)}. Cần kiểm tra nhập thêm.`,
        icon: "warning",
        tone: "bg-amber-50 text-amber-600",
        path: canManageBackOffice ? "/stock" : "/pos",
      });
    }

    if (outOfStockProducts.length > 0) {
      const outOfStockNames = outOfStockProducts.map((product) => product.name);
      const outOfStockSignature = getStockNotificationSignature(
        outOfStockProducts.map((product) => ({
          id: `product-${product.id}`,
          stockQuantity: product.stockQuantity,
          updatedAt: product.updatedAt,
        }))
      );

      items.push({
        id: `out-of-stock-products-${outOfStockSignature}`,
        title: `${outOfStockProducts.length} sản phẩm hết hàng`,
        description: `Hết hàng: ${formatNotificationNameList(outOfStockNames)}. Cần nhập thêm hoặc tạm ẩn khỏi POS.`,
        icon: "inventory_2",
        tone: "bg-red-50 text-red-600",
        path: canManageBackOffice ? "/products" : "/pos",
      });
    }

    cancelledOrders.slice(0, 5).forEach((order) => {
      items.push({
        id: `cancelled-invoice-${order.id}-${order.updatedAt}`,
        title: `Đã hủy hóa đơn ${getShortOrderCode(order.id)}`,
        description: `Lý do: ${order.cancelReason || "Không có lý do"}. Tổng tiền: ${formatNotificationCurrency(order.finalAmount)}`,
        icon: "receipt_long",
        tone: "bg-rose-50 text-rose-600",
        timeLabel: new Date(order.updatedAt || order.createdAt).toLocaleString("vi-VN"),
        path: "/invoices",
      });
    });

    promotions
      .filter((promotion) => promotion.isActive)
      .sort(
        (left, right) =>
          new Date(right.updatedAt || right.createdAt).getTime() -
          new Date(left.updatedAt || left.createdAt).getTime()
      )
      .slice(0, 5)
      .forEach((promotion) => {
        items.push({
          id: `promotion-${promotion.id}-${promotion.updatedAt}`,
          title: getPromotionNotificationTitle(promotion),
          description: getPromotionNotificationDescription(promotion),
          icon: "redeem",
          tone: "bg-orange-50 text-[#f97316]",
          timeLabel: new Date(promotion.updatedAt || promotion.createdAt).toLocaleString("vi-VN"),
          path: canManageBackOffice ? "/promotions" : "/pos",
        });
      });

    if (["staff", "cashier"].includes(roleName)) {
      return items;
    }

    if (!["admin", "manager"].includes(roleName)) {
      return items;
    }

    const systemErrors = auditLogs.filter((log) =>
      textIncludesAny(`${log.actionType} ${log.description}`, ["loi", "lỗi", "error", "failed", "that bai", "thất bại"])
    );
    const backupLogs = auditLogs.filter((log) =>
      textIncludesAny(`${log.actionType} ${log.description}`, ["sao_luu", "sao lưu", "backup", "restore", "khoi_phuc", "khôi phục"])
    );
    const securityLogs = auditLogs.filter((log) =>
      textIncludesAny(`${log.actionType} ${log.description}`, ["dang_nhap", "đăng nhập", "login", "bao_mat", "bảo mật", "bat thuong", "bất thường"])
    );
    if (cancelledOrders.length < 0) {
      items.push({
        id: "cancelled-invoices",
        title: `${cancelledOrders.length} hóa đơn bị hủy hôm nay`,
        description: "Kiểm tra lý do hủy và nhật ký thao tác liên quan.",
        icon: "receipt_long",
        tone: "bg-rose-50 text-rose-600",
      });
    }

    if (todayOrders.length > 0) {
      items.push({
        id: "new-orders",
        title: `${todayOrders.length} đơn hàng mới hôm nay`,
        description: "Tổng hợp đơn hàng phát sinh trong ngày hiện tại.",
        icon: "shopping_cart",
        tone: "bg-blue-50 text-blue-600",
        path: "/invoices",
      });
    }

    if (systemErrors.length > 0) {
      items.push({
        id: "system-errors",
        title: `${systemErrors.length} lỗi hệ thống gần đây`,
        description: "Có bản ghi lỗi hoặc thao tác thất bại trong nhật ký hệ thống.",
        icon: "error",
        tone: "bg-red-50 text-red-600",
        path: roleName === "admin" ? "/audit-logs" : "/reports",
      });
    }

    if (backupLogs.length > 0) {
      items.push({
        id: "backup-logs",
        title: `${backupLogs.length} hoạt động sao lưu dữ liệu`,
        description: "Có thao tác sao lưu hoặc khôi phục dữ liệu được ghi nhận.",
        icon: "cloud_upload",
        tone: "bg-orange-50 text-[#f97316]",
        path: roleName === "admin" ? "/settings" : "/reports",
      });
    }

    if (securityLogs.length > 0) {
      items.push({
        id: "security-logs",
        title: `${securityLogs.length} nhật ký bảo mật/đăng nhập`,
        description: "Có hoạt động đăng nhập hoặc bảo mật cần theo dõi.",
        icon: "shield",
        tone: "bg-purple-50 text-purple-600",
        path: roleName === "admin" ? "/audit-logs" : "/reports",
      });
    }

    return items;
  }, [auditLogs, cancelledOrders, hasActiveShift, materials, products, promotions, todayOrders, user.roleName]);
  const handleLogout = async () => {
    try {
      await createAuditLog({
        actionType: "DANG_XUAT",
        targetObject: "Hệ thống",
        description: "Nhân viên đăng xuất khỏi hệ thống."
      });
    } catch (err) {
      console.error("Lỗi khi ghi nhận log đăng xuất:", err);
    } finally {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      navigate("/login");
    }
  };

  return (
    <div className="h-screen min-h-screen w-full overflow-hidden bg-[#f8f9ff] font-['Inter',sans-serif] text-[#0b1c30]">
      <aside className="hidden h-screen w-64 shrink-0 overflow-y-auto overflow-x-hidden border-r border-slate-200 bg-white px-4 py-1 shadow-sm lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:flex-col">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 -ml-2.5">
            <div className="flex items-center gap-2.5 flex-1">
              <img
                src={systemLogo}
                alt="QuickServe POS"
                className="h-20 w-20 shrink-0 object-contain"
              />
            </div>
            <div className="-mt-2.5 -ml-2.5 flex flex-col items-start gap-0.5">
              <h1 className="text-[#f97316] font-black text-lg tracking-tight leading-5">
                QuickServe
              </h1>
              <p className="text-[11px] font-semibold leading-3 text-slate-500">
                POS System
              </p>
            </div>
          </div>
          <div className="-mt-2.5 flex items-center gap-3">
            <NotificationBell items={notificationItems} scopeKey={notificationScopeKey} />
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {mainMenuItems.map((item) => (
            <SidebarItem key={item.label} item={item} />
          ))}

          <div className="pb-2 pt-4">
            <p className="px-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Hệ thống
            </p>
          </div>

          {systemMenuItems.map((item) => (
            <SidebarItem key={item.label} item={item} />
          ))}
        </nav>
      </aside>

      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Đóng menu"
            className="absolute inset-0 bg-[#0b1c30]/45"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside className="relative flex h-full w-[min(82vw,288px)] flex-col overflow-y-auto overflow-x-hidden border-r border-slate-200 bg-white px-4 py-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between gap-3 px-2">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden bg-orange-50 shadow-md">
                  <img
                    src={systemLogo}
                    alt="QuickServe POS"
                    className="h-full w-full scale-[2.35] object-cover"
                  />
                </div>
                <h1 className="truncate font-['Outfit',sans-serif] text-lg font-extrabold tracking-tight text-[#f97316]">
                  QuickServe POS
                </h1>
              </div>
              <NotificationBell items={notificationItems} scopeKey={notificationScopeKey} />
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                aria-label="Đóng menu"
              >
                <Icon name="close" />
              </button>
            </div>

            <nav className="flex-1 space-y-1">
              {mainMenuItems.map((item) => (
                <SidebarItem
                  key={item.label}
                  item={item}
                  onNavigate={() => setIsMobileMenuOpen(false)}
                />
              ))}

              <div className="pb-2 pt-4">
                <p className="px-4 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Hệ thống
                </p>
              </div>

              {systemMenuItems.map((item) => (
                <SidebarItem
                  key={item.label}
                  item={item}
                  onNavigate={() => setIsMobileMenuOpen(false)}
                />
              ))}
            </nav>
          </aside>
        </div>
      ) : null}

      <main className="flex h-screen min-h-0 w-full flex-1 flex-col overflow-hidden lg:pl-64">
        <header className="z-20 flex h-auto shrink-0 flex-col gap-4 border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6 lg:h-16 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-0">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="rounded-lg p-2 text-[#0b1c30] hover:bg-orange-50 lg:hidden"
              aria-label="Menu"
            >
              <Icon name="menu" />
            </button>
            {title ? (
              <div className="min-w-0">
                <h2 className="truncate font-['Outfit',sans-serif] text-xl font-bold text-[#0b1c30]">
                  {title}
                </h2>
                {subtitle ? <div className="truncate text-xs text-slate-500">{subtitle}</div> : null}
              </div>
            ) : (
              <div className="flex items-center gap-4">
                {headerContent}
              </div>
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-4">
            {headerContent ? <div className="flex shrink-0 items-center gap-3">{headerContent}</div> : null}
            <div className="hidden min-w-[132px] shrink-0 text-right sm:block">
              <p className="whitespace-nowrap text-sm font-extrabold leading-4 text-[#0b1c30]">
                {currentDateTime.dateLabel}
              </p>
              <p className="mt-0.5 whitespace-nowrap text-xs font-semibold leading-4 text-slate-500">
                {currentDateTime.metaLabel}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 border-slate-200 sm:border-l sm:pl-5">
              <div className="text-right">
                <p className="text-sm font-bold text-[#0b1c30]">{displayName}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#f97316]">
                  {translateRole(displayRole)}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-bold text-[#f97316]">
                    {getInitials(displayName)}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <Icon name="logout" />
              <span className="hidden text-sm font-semibold xl:inline">Đăng xuất</span>
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-4 sm:p-5 lg:p-6">{children}</div>
      </main>
    </div>
  );
}

export default AdminLayout;
