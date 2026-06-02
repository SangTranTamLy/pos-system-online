import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type MenuItem = {
  label: string;
  icon: string;
  path: string;
  active?: boolean;
  group?: "main" | "system";
};

type QuickAction = {
  label: string;
  icon: string;
  iconBg: string;
  iconText: string;
  iconHoverBg: string;
};

type StatsCardData = {
  label: string;
  value: string;
  icon: string;
  iconBg: string;
  iconText: string;
  badge: string;
  badgeBg: string;
  badgeText: string;
};

type RevenueBar = {
  label: string;
  value: string;
  height: number;
  highlight?: boolean;
};

type TopProduct = {
  name: string;
  sold: string;
  width: string;
};

type RecentOrder = {
  code: string;
  customer: string;
  type: string;
  total: string;
  status: string;
  typeClassName: string;
  statusClassName: string;
};

type StockAlert = {
  product: string;
  remain: string;
  minimum: string;
  remainClassName: string;
};

type AuthUser = {
  fullName?: string;
  roleName?: string;
  avatarUrl?: string;
};

const menuItems: MenuItem[] = [
  { label: "Dashboard", icon: "dashboard", path: "/dashboard", active: true, group: "main" },
  { label: "Bán hàng tại quầy", icon: "point_of_sale",path: "/#", group: "main" },
  { label: "Đơn pickup", icon: "shopping_bag",path: "/#", group: "main" },
  { label: "Sản phẩm", icon: "inventory_2", path: "/#",group: "main" },
  { label: "Danh mục", icon: "category", path: "/categories",group: "main" },
  { label: "Kho hàng", icon: "warehouse", path: "/#",group: "main" },
  { label: "Khách hàng", icon: "group",path: "/#", group: "main" },
  { label: "Hóa đơn", icon: "receipt_long",path: "/#", group: "main" },
  { label: "Khuyến mãi", icon: "redeem", path: "/#",group: "main" },
  { label: "Tài khoản", icon: "person", path: "/#",group: "system" },
  { label: "Phân quyền", icon: "security", path: "/#",group: "system" },
  { label: "Báo cáo", icon: "analytics", path: "/#",group: "system" },
  { label: "Cấu hình hệ thống", icon: "settings", path: "/#",group: "system" },
];

const quickActions: QuickAction[] = [
  {
    label: "Mở POS",
    icon: "point_of_sale",
    iconBg: "bg-orange-100",
    iconText: "text-[#f97316]",
    iconHoverBg: "group-hover:bg-[#f97316]",
  },
  {
    label: "Xử lý đơn pickup",
    icon: "shopping_bag",
    iconBg: "bg-blue-100",
    iconText: "text-blue-600",
    iconHoverBg: "group-hover:bg-blue-600",
  },
  {
    label: "Thêm sản phẩm",
    icon: "add_box",
    iconBg: "bg-green-100",
    iconText: "text-green-600",
    iconHoverBg: "group-hover:bg-green-600",
  },
  {
    label: "Nhập kho",
    icon: "archive",
    iconBg: "bg-violet-100",
    iconText: "text-violet-600",
    iconHoverBg: "group-hover:bg-violet-600",
  },
  {
    label: "Tạo khuyến mãi",
    icon: "celebration",
    iconBg: "bg-pink-100",
    iconText: "text-pink-600",
    iconHoverBg: "group-hover:bg-pink-600",
  },
  {
    label: "Xem báo cáo",
    icon: "description",
    iconBg: "bg-slate-100",
    iconText: "text-slate-600",
    iconHoverBg: "group-hover:bg-slate-600",
  },
];

const statsCards: StatsCardData[] = [
  {
    label: "Doanh thu hôm nay",
    value: "24.500.000đ",
    icon: "payments",
    iconBg: "bg-orange-50",
    iconText: "text-[#f97316]",
    badge: "+15%",
    badgeBg: "bg-green-50",
    badgeText: "text-green-600",
  },
  {
    label: "Đơn hàng hôm nay",
    value: "142",
    icon: "shopping_cart",
    iconBg: "bg-blue-50",
    iconText: "text-blue-600",
    badge: "+8%",
    badgeBg: "bg-green-50",
    badgeText: "text-green-600",
  },
  {
    label: "Đơn pickup chờ",
    value: "28",
    icon: "hourglass_top",
    iconBg: "bg-yellow-50",
    iconText: "text-yellow-600",
    badge: "12 mới",
    badgeBg: "bg-red-50",
    badgeText: "text-red-600",
  },
  {
    label: "Sản phẩm sắp hết",
    value: "15",
    icon: "priority_high",
    iconBg: "bg-red-50",
    iconText: "text-red-600",
    badge: "Sắp hết",
    badgeBg: "bg-red-50",
    badgeText: "text-red-600",
  },
  {
    label: "Tổng khách hàng",
    value: "1.250",
    icon: "person_add",
    iconBg: "bg-green-50",
    iconText: "text-green-600",
    badge: "Mới",
    badgeBg: "bg-green-50",
    badgeText: "text-green-600",
  },
  {
    label: "Sản phẩm kích hoạt",
    value: "458",
    icon: "inventory",
    iconBg: "bg-indigo-50",
    iconText: "text-indigo-600",
    badge: "Đang bán",
    badgeBg: "bg-slate-50",
    badgeText: "text-slate-400",
  },
];

const revenueBars: RevenueBar[] = [
  { label: "18/05", value: "14.2M", height: 65 },
  { label: "19/05", value: "9.8M", height: 45 },
  { label: "20/05", value: "18.5M", height: 85 },
  { label: "21/05", value: "15.1M", height: 70 },
  { label: "22/05", value: "12.7M", height: 60 },
  { label: "23/05", value: "20.4M", height: 95 },
  { label: "Hôm nay", value: "19.3M", height: 90, highlight: true },
];

const topProducts: TopProduct[] = [
  { name: "Cà phê sữa đá", sold: "428 ly", width: "85%" },
  { name: "Trà đào cam sả", sold: "312 ly", width: "65%" },
  { name: "Bạc xỉu", sold: "245 ly", width: "50%" },
];

const recentOrders: RecentOrder[] = [
  {
    code: "#ORD-2584",
    customer: "Nguyễn Văn An",
    type: "POS",
    total: "125.000đ",
    status: "Hoàn tất",
    typeClassName: "bg-blue-50 text-blue-600",
    statusClassName: "bg-green-50 text-green-600",
  },
  {
    code: "#ORD-2583",
    customer: "Trần Thị Hoa",
    type: "Pickup",
    total: "85.000đ",
    status: "Đang pha",
    typeClassName: "bg-orange-50 text-orange-600",
    statusClassName: "bg-yellow-50 text-yellow-600",
  },
  {
    code: "#ORD-2582",
    customer: "Khách lẻ",
    type: "POS",
    total: "45.000đ",
    status: "Hoàn tất",
    typeClassName: "bg-blue-50 text-blue-600",
    statusClassName: "bg-green-50 text-green-600",
  },
];

const stockAlerts: StockAlert[] = [
  {
    product: "Sữa đặc Vinamilk",
    remain: "2 hộp",
    minimum: "10 hộp",
    remainClassName: "text-red-600",
  },
  {
    product: "Hạt cà phê Robusta",
    remain: "3.5 kg",
    minimum: "5 kg",
    remainClassName: "text-orange-600",
  },
  {
    product: "Bột Matcha Nhật",
    remain: "0.2 kg",
    minimum: "1 kg",
    remainClassName: "text-red-600",
  },
];

function Icon({
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

function SidebarItem({ item }: { item: MenuItem }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(item.path)}
      className={[
        "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-all duration-200",
        item.active
          ? "bg-[#f97316] font-semibold text-white shadow-sm"
          : "font-medium text-slate-600 hover:bg-orange-50 hover:text-[#f97316]",
      ].join(" ")}
    >
      <Icon name={item.icon} className="text-[20px]" />
      <span>{item.label}</span>
    </button>
  );
}

function QuickActionCard({ action }: { action: QuickAction }) {
  return (
    <button
      type="button"
      className="group flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-[#f97316] hover:shadow-md"
    >
      <div
        className={[
          "mb-2 flex h-12 w-12 items-center justify-center rounded-full transition-all",
          action.iconBg,
          action.iconText,
          action.iconHoverBg,
          "group-hover:text-white",
        ].join(" ")}
      >
        <Icon name={action.icon} />
      </div>
      <span className="text-center text-sm font-semibold text-[#0b1c30]">{action.label}</span>
    </button>
  );
}

function StatCard({ card }: { card: StatsCardData }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <div className={`rounded-lg p-2 ${card.iconBg} ${card.iconText}`}>
          <Icon name={card.icon} className="scale-90" />
        </div>
        <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${card.badgeBg} ${card.badgeText}`}>
          {card.badge}
        </span>
      </div>
      <p className="text-xs font-semibold uppercase tracking-tight text-slate-500">{card.label}</p>
      <h3 className="mt-1 text-xl font-bold text-[#0b1c30]">{card.value}</h3>
    </article>
  );
}

function RevenueChartMock({ bars }: { bars: RevenueBar[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="font-['Plus_Jakarta_Sans',sans-serif] font-bold text-[#0b1c30]">
            Doanh thu 7 ngày qua
          </h4>
          <p className="text-xs text-slate-400">Tăng trưởng ổn định ở mức 12% hàng tuần</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <span className="h-2.5 w-2.5 rounded-full bg-[#f97316]" />
          Doanh thu
        </div>
      </div>

      <div className="relative flex h-64 w-full items-end gap-3 px-2">
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between py-2">
          {[0, 1, 2, 3].map((line) => (
            <div key={line} className="border-t border-slate-50" />
          ))}
        </div>

        {bars.map((bar) => (
          <div key={bar.label} className="group relative flex flex-1 items-end">
            <div
              title={`${bar.label}: ${bar.value}`}
              className={[
                "w-full rounded-t-lg transition-all duration-200",
                bar.highlight ? "bg-[#f97316]" : "bg-[#f97316]/20 hover:bg-[#f97316]",
              ].join(" ")}
              style={{ height: `${bar.height}%` }}
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-between px-2 text-[10px] font-bold text-slate-400">
        {bars.map((bar) => (
          <span key={bar.label}>{bar.label}</span>
        ))}
      </div>
    </div>
  );
}

function TopProductsCard({ products }: { products: TopProduct[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h4 className="mb-4 font-['Plus_Jakarta_Sans',sans-serif] font-bold text-[#0b1c30]">
        Bán chạy nhất
      </h4>
      <div className="space-y-3">
        {products.map((product) => (
          <div key={product.name} className="space-y-1">
            <div className="flex justify-between text-xs font-medium text-[#0b1c30]">
              <span>{product.name}</span>
              <span className="text-slate-400">{product.sold}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-[#f97316]" style={{ width: product.width }} />
            </div>
          </div>
        ))}
      </div>
    </div>
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

function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "AD";
  }

  const initials = parts.slice(-2).map((part) => part[0]?.toUpperCase() ?? "").join("");
  return initials || "AD";
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
function DashboardPage() {
  const navigate = useNavigate();
  const [currentDateTime, setCurrentDateTime] = useState(() => formatCurrentDateTime(new Date()));
  const [user] = useState<AuthUser>(() => getStoredAuthUser());
  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentDateTime(formatCurrentDateTime(new Date()));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    navigate("/login");
  };

  const mainMenuItems = menuItems.filter((item) => item.group === "main");
  const systemMenuItems = menuItems.filter((item) => item.group === "system");
  const displayName = user.fullName?.trim() || "Admin Demo";
  const displayRole = user.roleName?.trim() || "admin";

  return (
    <div className="min-h-screen bg-[#f8f9ff] font-['Inter',sans-serif] text-[#0b1c30] lg:flex">
      <aside className="hidden h-screen w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-white px-4 py-6 shadow-sm lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:flex-col">
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

      <main className="flex min-h-screen flex-1 flex-col lg:ml-72">
        <header className="sticky top-0 z-20 flex h-auto flex-col gap-4 border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6 lg:h-16 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-0">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="rounded-lg p-2 text-[#0b1c30] hover:bg-orange-50 lg:hidden"
              aria-label="Menu"
            >
              <Icon name="menu" />
            </button>
            <div className="hidden sm:block">
              <p className="text-sm font-medium capitalize text-slate-500">{currentDateTime}</p>
            </div>
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
                  <span className="text-sm font-bold text-[#9d4300]">{getInitials(displayName)}</span>
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
              <button
                key={item.label}
                type="button"
                className={[
                  "whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                  item.active
                    ? "border-[#f97316] bg-[#f97316] text-white"
                    : "border-slate-200 bg-white text-[#584237] hover:border-orange-200 hover:bg-orange-50",
                ].join(" ")}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm font-medium capitalize text-slate-500 sm:hidden">{currentDateTime}</p>
        </div>

        <div className="max-w-full p-4 sm:p-6 lg:p-8">
          <section className="mb-8">
            <h2 className="mb-4 font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold text-[#0b1c30]">
              Thao tác nhanh
            </h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              {quickActions.map((action) => (
                <QuickActionCard key={action.label} action={action} />
              ))}
            </div>
          </section>

          <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
            {statsCards.map((card) => (
              <StatCard key={card.label} card={card} />
            ))}
          </section>

          <section className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-8">
              <RevenueChartMock bars={revenueBars} />
            </div>

            <div className="flex flex-col gap-6 xl:col-span-4">
              <div className="flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h4 className="mb-4 font-['Plus_Jakarta_Sans',sans-serif] font-bold text-[#0b1c30]">
                  Tỷ lệ POS vs Pickup
                </h4>
                <div className="flex flex-1 items-center justify-center">
                  <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-16 border-[#f97316] border-r-orange-100">
                    <div className="text-center">
                      <p className="text-lg font-bold text-[#0b1c30]">75%</p>
                      <p className="text-[10px] text-slate-400">POS</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex justify-around">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <span className="h-2 w-2 rounded-full bg-[#f97316]" />
                    Tại quầy
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <span className="h-2 w-2 rounded-full bg-orange-200" />
                    Pickup
                  </div>
                </div>
              </div>

              <TopProductsCard products={topProducts} />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 2xl:grid-cols-12">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm 2xl:col-span-7">
              <div className="flex items-center justify-between border-b border-slate-200 p-6">
                <h4 className="font-['Plus_Jakarta_Sans',sans-serif] font-bold text-[#0b1c30]">
                  Đơn hàng gần đây
                </h4>
                <button type="button" className="text-xs font-bold text-[#f97316] hover:underline">
                  Xem tất cả
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-640px text-left text-sm">
                  <thead className="bg-slate-50 font-semibold text-slate-500">
                    <tr>
                      <th className="px-6 py-3">Mã đơn</th>
                      <th className="px-6 py-3">Khách hàng</th>
                      <th className="px-6 py-3">Loại</th>
                      <th className="px-6 py-3 text-right">Tổng tiền</th>
                      <th className="px-6 py-3 text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {recentOrders.map((order) => (
                      <tr key={order.code} className="transition-colors hover:bg-slate-50">
                        <td className="px-6 py-4 font-bold text-[#f97316]">{order.code}</td>
                        <td className="px-6 py-4 text-[#0b1c30]">{order.customer}</td>
                        <td className="px-6 py-4">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${order.typeClassName}`}>
                            {order.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-[#0b1c30]">
                          {order.total}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${order.statusClassName}`}>
                            {order.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm 2xl:col-span-5">
              <div className="flex items-center justify-between border-b border-slate-200 p-6">
                <h4 className="font-['Plus_Jakarta_Sans',sans-serif] font-bold text-[#0b1c30]">
                  Cảnh báo tồn kho
                </h4>
                <button type="button" className="text-xs font-bold text-red-600 hover:underline">
                  Nhập kho ngay
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full min-w-420px text-left text-sm">
                  <thead className="bg-slate-50 font-semibold text-slate-500">
                    <tr>
                      <th className="px-6 py-3">Sản phẩm</th>
                      <th className="px-6 py-3 text-center">Còn lại</th>
                      <th className="px-6 py-3 text-center">Mức tối thiểu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {stockAlerts.map((item) => (
                      <tr key={item.product} className="transition-colors hover:bg-slate-50">
                        <td className="px-6 py-4 text-[#0b1c30]">{item.product}</td>
                        <td className="px-6 py-4 text-center font-bold">
                          <span className={item.remainClassName}>{item.remain}</span>
                        </td>
                        <td className="px-6 py-4 text-center text-slate-400">{item.minimum}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default DashboardPage;
