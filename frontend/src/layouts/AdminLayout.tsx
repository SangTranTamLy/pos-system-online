import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchShifts } from "../api/shifts.api";
import { createAuditLog } from "../api/audit-log.api";

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
  fullName?: string;
  roleName?: string;
  avatarUrl?: string;
};

type AdminLayoutProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  headerContent?: ReactNode;
};

const menuItems: MenuItem[] = [
  { label: "Tổng quan", icon: "dashboard", path: "/dashboard", group: "main", allowedRoles: ["admin", "manager"] },
  { label: "Bán hàng (POS)", icon: "point_of_sale", path: "/pos", group: "main", allowedRoles: ["admin", "manager", "staff"] },
  { label: "Sản phẩm", icon: "package_2", path: "/products", group: "main", allowedRoles: ["admin", "manager"] },
  { label: "Danh mục", icon: "sell", path: "/categories", group: "main", allowedRoles: ["admin", "manager"] },
  { label: "Kho hàng", icon: "inventory_2", path: "/stock", group: "main", allowedRoles: ["admin", "manager"] },
  { label: "Khách hàng", icon: "group", path: "/customers", group: "main", allowedRoles: ["admin", "manager", "staff"] },
  { label: "Hóa đơn", icon: "receipt_long", path: "/invoices", group: "main", allowedRoles: ["admin", "manager", "staff"] },
  { label: "Khuyến mãi", icon: "redeem", path: "/promotions", group: "main", allowedRoles: ["admin", "manager"] },
  { label: "Nhân viên", icon: "badge", path: "/employees", group: "system", allowedRoles: ["admin", "manager"] },
  { label: "Ca làm", icon: "work_history", path: "/shifts", group: "system", allowedRoles: ["admin", "manager", "staff"] },
  { label: "Báo cáo", icon: "analytics", path: "/reports", group: "system", allowedRoles: ["admin", "manager"] },
  { label: "Nhật ký hệ thống", icon: "history", path: "/audit-logs", group: "system", allowedRoles: ["admin"] },
  { label: "Cấu hình hệ thống", icon: "settings", path: "/settings", group: "system", allowedRoles: ["admin"] },
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
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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

  useEffect(() => {
    const roleName = user.roleName?.toLowerCase() || "";
    if (roleName === "staff") {
      fetchShifts().then(shifts => {
        const storedUserStr = localStorage.getItem("auth_user");
        let currentUserId = "";
        if (storedUserStr) {
          try { currentUserId = JSON.parse(storedUserStr).id; } catch { /* ignore parse errors */ }
        }
        const openShift = shifts.find(s => s.status === "OPEN" && s.userId === currentUserId);
        setHasActiveShift(!!openShift);
      }).catch(() => setHasActiveShift(false));
    }
  }, [user.roleName]);

  const mainMenuItems = useMemo(
    () =>
      menuItems.filter(
        (item) =>
          item.group === "main" &&
          (!user.roleName || item.allowedRoles.includes(user.roleName.toLowerCase()))
      ).map(item => ({
        ...item,
        disabled: user.roleName?.toLowerCase() === "staff" && !hasActiveShift && item.path !== "/shifts" ? true : item.disabled
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
        disabled: user.roleName?.toLowerCase() === "staff" && !hasActiveShift && item.path !== "/shifts" ? true : item.disabled
      })),
    [user.roleName, hasActiveShift]
  );

  const displayName = user.fullName?.trim() || "Admin Demo";
  const displayRole = user.roleName?.trim() || "admin";

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
    <div className="min-h-screen bg-[#f8f9ff] font-['Inter',sans-serif] text-[#0b1c30]">
      <aside className="hidden h-screen w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-white px-4 py-6 shadow-sm lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:flex-col">
        <div className="mb-8 flex items-center gap-3 px-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f97316] text-white shadow-md">
            <Icon name="bolt" filled />
          </div>
          <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-extrabold tracking-tight text-[#f97316]">
            QuickServe POS
          </h1>
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
          <aside className="relative flex h-full w-[min(82vw,288px)] flex-col overflow-y-auto border-r border-slate-200 bg-white px-4 py-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between gap-3 px-2">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f97316] text-white shadow-md">
                  <Icon name="bolt" filled />
                </div>
                <h1 className="truncate font-['Plus_Jakarta_Sans',sans-serif] text-lg font-extrabold tracking-tight text-[#f97316]">
                  QuickServe POS
                </h1>
              </div>
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

      <main className="flex min-h-screen flex-1 flex-col lg:pl-72">
        <header className="sticky top-0 z-20 flex h-auto flex-col gap-4 border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6 lg:h-16 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-0">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="rounded-lg p-2 text-[#0b1c30] hover:bg-orange-50 lg:hidden"
              aria-label="Menu"
            >
              <Icon name="menu" />
            </button>
            {title ? (
              <div>
                <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-bold text-[#0b1c30]">
                  {title}
                </h2>
                {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <p className="hidden text-sm font-medium capitalize text-slate-500 sm:block">
                  {currentDateTime}
                </p>
                {headerContent}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-3 border-slate-200 sm:border-l sm:pl-6">
              <div className="text-right">
                <p className="text-sm font-bold text-[#0b1c30]">{displayName}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#f97316]">
                  {displayRole}
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
                  <span className="text-sm font-bold text-[#9d4300]">
                    {getInitials(displayName)}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <Icon name="logout" />
              <span className="text-sm font-semibold">Đăng xuất</span>
            </button>
          </div>
        </header>

        <div className="max-w-full p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

export default AdminLayout;
