import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type MenuItem = {
  label: string;
  icon: string;
  path: string;
  group: "main" | "system";
  disabled?: boolean;
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
};

const menuItems: MenuItem[] = [
  { label: "Dashboard", icon: "dashboard", path: "/dashboard", group: "main" },
  { label: "Sản phẩm", icon: "package_2", path: "/products", group: "main" },
  { label: "Danh mục", icon: "sell", path: "/categories", group: "main" },
  { label: "Kho hàng", icon: "delivery_truck_bolt", path: "/stock", group: "main", disabled: true },
  { label: "Khách hàng", icon: "group", path: "/customers", group: "main", disabled: true },
  { label: "Hóa đơn", icon: "receipt_long", path: "/invoices", group: "main", disabled: true },
  { label: "Khuyến mãi", icon: "redeem", path: "/promotions", group: "main", disabled: true },
  { label: "Nhân viên", icon: "badge", path: "/employees", group: "system", disabled: true },
  { label: "Báo cáo", icon: "analytics", path: "/reports", group: "system", disabled: true },
  { label: "Cấu hình hệ thống", icon: "settings", path: "/settings", group: "system", disabled: true },
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

function SidebarItem({ item }: { item: MenuItem }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive =
    !item.disabled &&
    (location.pathname === item.path ||
      (item.path !== "/dashboard" && location.pathname.startsWith(item.path)));

  return (
    <button
      type="button"
      onClick={() => {
        if (!item.disabled) {
          navigate(item.path);
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

function MobileNavItem({ item }: { item: MenuItem }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive =
    !item.disabled &&
    (location.pathname === item.path ||
      (item.path !== "/dashboard" && location.pathname.startsWith(item.path)));

  return (
    <button
      type="button"
      onClick={() => {
        if (!item.disabled) {
          navigate(item.path);
        }
      }}
      disabled={item.disabled}
      title={item.disabled ? "Chức năng sẽ làm sau" : undefined}
      className={[
        "whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
        isActive
          ? "border-[#f97316] bg-[#f97316] text-white"
          : item.disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
            : "border-slate-200 bg-white text-[#584237] hover:border-orange-200 hover:bg-orange-50",
      ].join(" ")}
    >
      {item.label}
    </button>
  );
}

function AdminLayout({ children, title, subtitle }: AdminLayoutProps) {
  const navigate = useNavigate();
  const currentDateTime = useCurrentDateTime();
  const [user] = useState<AuthUser>(() => getStoredAuthUser());

  const mainMenuItems = useMemo(
    () => menuItems.filter((item) => item.group === "main"),
    []
  );
  const systemMenuItems = useMemo(
    () => menuItems.filter((item) => item.group === "system"),
    []
  );

  const displayName = user.fullName?.trim() || "Admin Demo";
  const displayRole = user.roleName?.trim() || "admin";

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    navigate("/login");
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

      <main className="flex min-h-screen flex-1 flex-col lg:pl-72">
        <header className="sticky top-0 z-20 flex h-auto flex-col gap-4 border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6 lg:h-16 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-0">
          <div className="flex items-center gap-4">
            <button
              type="button"
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
              <p className="hidden text-sm font-medium capitalize text-slate-500 sm:block">
                {currentDateTime}
              </p>
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

        <div className="border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {menuItems.map((item) => (
              <MobileNavItem key={item.label} item={item} />
            ))}
          </div>
          <p className="mt-3 text-sm font-medium capitalize text-slate-500 sm:hidden">
            {currentDateTime}
          </p>
        </div>

        <div className="max-w-full p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

export default AdminLayout;
