import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from "recharts";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";
import {
  getDashboardSummary,
  type DashboardRevenuePeriod,
  type DashboardSummary,
} from "../../api/dashboard.api";

type QuickAction = {
  label: string;
  icon: string;
  path?: string;
  status?: string;
  disabled?: boolean;
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

type RevenuePoint = {
  sort: number;
  label: string;
  revenue: number;
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

const quickActions: QuickAction[] = [
  {
    label: "Quản lý sản phẩm",
    icon: "package_2",
    path: "/products",
  },
  {
    label: "Quản lý danh mục",
    icon: "sell",
    path: "/categories",
  },
  {
    label: "Bán hàng tại quầy",
    icon: "point_of_sale",
    path: "/pos",
  },
];



function QuickActionCard({
  action,
  onSelect,
}: {
  action: QuickAction;
  onSelect: () => void;
}) {
  const isDisabled = action.disabled || !action.path;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isDisabled}
      className={[
        "group flex min-h-32 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-4 transition-all",
        isDisabled
          ? "cursor-not-allowed opacity-60"
          : "hover:-translate-y-0.5 hover:border-[#f97316] hover:shadow-md",
      ].join(" ")}
    >
      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-[#f97316] transition-all group-enabled:group-hover:bg-[#f97316] group-enabled:group-hover:text-white">
        <Icon name={action.icon} />
      </div>
      <span className="text-center text-sm font-semibold text-[#0b1c30]">{action.label}</span>
      {action.status ? (
        <span className="mt-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
          {action.status}
        </span>
      ) : null}
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
        <span
          className={`rounded px-2 py-0.5 text-[11px] font-bold ${card.badgeBg} ${card.badgeText}`}
        >
          {card.badge}
        </span>
      </div>
      <p className="text-xs font-semibold uppercase tracking-tight text-slate-500">{card.label}</p>
      <h3 className="mt-1 text-xl font-bold text-[#0b1c30]">{card.value}</h3>
    </article>
  );
}

function getRevenueChartTitle(period: DashboardRevenuePeriod) {
  return period === "year" ? "Doanh thu trong năm" : "Doanh thu trong tháng";
}

function getRevenueChartSubtitle(period: DashboardRevenuePeriod) {
  return period === "year"
    ? "Theo dõi doanh thu theo từng tháng trong năm hiện tại"
    : "Theo dõi doanh thu theo từng ngày trong tháng hiện tại";
}

function getXAxisInterval(period: DashboardRevenuePeriod) {
  return period === "year" ? 0 : 4;
}

function isCurrentRevenuePoint(point: RevenuePoint, period: DashboardRevenuePeriod) {
  const today = new Date();
  const currentSort = period === "year" ? today.getMonth() + 1 : today.getDate();

  return point.sort === currentSort;
}

function useChartSize() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 320 });

  useEffect(() => {
    const element = containerRef.current;

    if (!element) {
      return undefined;
    }

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);

      if (width > 0 && height > 0) {
        setSize({ width, height });
      }
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return { containerRef, size };
}

function RevenueChart({
  data,
  period,
  onPeriodChange,
}: {
  data: RevenuePoint[];
  period: DashboardRevenuePeriod;
  onPeriodChange: (period: DashboardRevenuePeriod) => void;
}) {
  const { containerRef, size } = useChartSize();
  const canRenderChart = size.width > 0 && size.height > 0;

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="font-['Plus_Jakarta_Sans',sans-serif] font-bold text-[#0b1c30]">
            {getRevenueChartTitle(period)}
          </h4>
          <p className="text-xs text-slate-400">{getRevenueChartSubtitle(period)}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(event) => onPeriodChange(event.target.value as DashboardRevenuePeriod)}
            className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-600 outline-none transition-colors hover:border-orange-200 focus:border-[#f97316]"
            aria-label="Chọn kỳ xem doanh thu"
          >
            <option value="month">Tháng</option>
            <option value="year">Năm</option>
          </select>
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f97316]" />
            Doanh thu
          </div>
        </div>
      </div>

      <div ref={containerRef} className="h-80 min-h-80 min-w-0 w-full">
        {canRenderChart ? (
          <BarChart
            width={size.width}
            height={size.height}
            data={data}
            margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid stroke="#eef2f7" vertical={false} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              interval={getXAxisInterval(period)}
              tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700 }}
              dy={12}
            />
            <YAxis hide domain={[0, "dataMax"]} />
            <Tooltip
              cursor={{ fill: "rgba(249, 115, 22, 0.08)" }}
              formatter={(value) => [formatCurrency(Number(value)), "Doanh thu"]}
              labelFormatter={(label) => String(label)}
              contentStyle={{
                border: "1px solid #fed7aa",
                borderRadius: 12,
                boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
                fontSize: 12,
                fontWeight: 700,
              }}
            />
            <Bar dataKey="revenue" fill="#fdba74" radius={[6, 6, 0, 0]} maxBarSize={34}>
              {data.map((point) => (
                <Cell
                  key={point.label}
                  fill={isCurrentRevenuePoint(point, period) ? "#f97316" : "#fdba74"}
                />
              ))}
            </Bar>
          </BarChart>
        ) : null}
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
function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}


function getOrderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    completed: "Hoàn tất",
    cancelled: "Đã hủy",
    refunded: "Hoàn tiền",
  };

  return labels[status] ?? status;
}

function getOrderStatusClassName(status: string) {
  const classNames: Record<string, string> = {
    completed: "bg-green-50 text-green-600",
    cancelled: "bg-red-50 text-red-600",
    refunded: "bg-slate-100 text-slate-500",
  };

  return classNames[status] ?? "bg-slate-100 text-slate-500";
}

function getStockRemainClassName(stockQuantity: number) {
  return stockQuantity <= 5 ? "text-red-600" : "text-orange-600";
}
function DashboardPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [revenuePeriod, setRevenuePeriod] = useState<DashboardRevenuePeriod>("month");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadDashboard(silent = false) {
      if (!silent) setIsLoading(true);
      else setIsRefreshing(true);
      try {
        const response = await getDashboardSummary(revenuePeriod);

        if (isActive) {
          setDashboard(response.data);
          setLastUpdated(new Date());
          setErrorMessage("");
        }
      } catch (error) {
        if (isActive) {
          setErrorMessage(
            error instanceof Error ? error.message : "Không tải được dữ liệu dashboard"
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    void loadDashboard();

    // Auto-refresh every 60 seconds
    const interval = window.setInterval(() => {
      void loadDashboard(true);
    }, 60_000);

    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, [revenuePeriod]);

  function handleManualRefresh() {
    setIsRefreshing(true);
    getDashboardSummary(revenuePeriod)
      .then((response) => {
        setDashboard(response.data);
        setLastUpdated(new Date());
        setErrorMessage("");
      })
      .catch((error) => {
        setErrorMessage(
          error instanceof Error ? error.message : "Không tải được dữ liệu dashboard"
        );
      })
      .finally(() => setIsRefreshing(false));
  }
  const stats = dashboard?.stats;

  const realStatsCards: StatsCardData[] = [
    {
      label: "Doanh thu hôm nay",
      value: formatCurrency(stats?.todayRevenue ?? 0),
      icon: "payments",
      iconBg: "bg-orange-50",
      iconText: "text-[#f97316]",
      badge: "Hôm nay",
      badgeBg: "bg-green-50",
      badgeText: "text-green-600",
    },
    {
      label: "Hóa đơn hôm nay",
      value: String(stats?.todayOrders ?? 0),
      icon: "receipt_long",
      iconBg: "bg-orange-50",
      iconText: "text-[#f97316]",
      badge: "POS",
      badgeBg: "bg-green-50",
      badgeText: "text-green-600",
    },
    {
      label: "Danh mục đang bán",
      value: String(stats?.activeCategories ?? 0),
      icon: "sell",
      iconBg: "bg-orange-50",
      iconText: "text-[#f97316]",
      badge: "Đang hoạt động",
      badgeBg: "bg-orange-50",
      badgeText: "text-[#f97316]",
    },
    {
      label: "Sản phẩm sắp hết",
      value: String(stats?.lowStockProducts ?? 0),
      icon: "priority_high",
      iconBg: "bg-red-50",
      iconText: "text-red-600",
      badge: "Sắp hết",
      badgeBg: "bg-red-50",
      badgeText: "text-red-600",
    },
    {
      label: "Tổng khách hàng",
      value: String(stats?.totalCustomers ?? 0),
      icon: "person_add",
      iconBg: "bg-green-50",
      iconText: "text-green-600",
      badge: "Khách hàng",
      badgeBg: "bg-green-50",
      badgeText: "text-green-600",
    },
    {
      label: "Sản phẩm đang bán",
      value: String(stats?.activeProducts ?? 0),
      icon: "inventory",
      iconBg: "bg-orange-50",
      iconText: "text-[#f97316]",
      badge: "Đang bán",
      badgeBg: "bg-slate-50",
      badgeText: "text-slate-500",
    },
  ];

  const realRevenueTrend: RevenuePoint[] = dashboard?.revenueTrend ?? [];

  const maxSoldQuantity = Math.max(
    ...(dashboard?.topProducts ?? []).map((item) => item.soldQuantity),
    0
  );
  const realTopProducts: TopProduct[] = (dashboard?.topProducts ?? []).map((item) => ({
    name: item.name,
    sold: `${item.soldQuantity} đã bán`,
    width: maxSoldQuantity > 0 ? `${Math.max((item.soldQuantity / maxSoldQuantity) * 100, 8)}%` : "8%",
  }));
  const totalTopProductSold = (dashboard?.topProducts ?? []).reduce(
    (total, item) => total + item.soldQuantity,
    0
  );
  const totalTopProductRevenue = (dashboard?.topProducts ?? []).reduce(
    (total, item) => total + item.revenue,
    0
  );

  const realRecentOrders: RecentOrder[] = (dashboard?.recentOrders ?? []).map((order) => ({
    code: `#HD-${order.id}`,
    customer: order.customerName,
    type: "POS",
    total: formatCurrency(order.finalAmount),
    status: getOrderStatusLabel(order.status),
    typeClassName: "bg-orange-50 text-[#f97316]",
    statusClassName: getOrderStatusClassName(order.status),
  }));

  const realStockAlerts: StockAlert[] = (dashboard?.stockAlerts ?? []).map((item) => ({
    product: item.productName,
    remain: String(item.stockQuantity),
    minimum: "10",
    remainClassName: getStockRemainClassName(item.stockQuantity),
  }));

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500 shadow-sm">
          Đang tải dữ liệu dashboard...
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {errorMessage ? (
        <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-600">
          {errorMessage}
        </div>
      ) : null}

      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold text-[#0b1c30]">
              Thao tác nhanh
            </h2>
            <p className="text-sm text-slate-500">
              Chỉ hiển thị các chức năng phù hợp với đề tài hiện tại.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-slate-400">
                Cập nhật: {lastUpdated.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              title="Làm mới dữ liệu"
              className="flex items-center gap-1.5 border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-[#f97316] hover:text-[#f97316] disabled:opacity-50"
            >
              <Icon name="refresh" className={`text-base ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "Đang tải..." : "Làm mới"}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {quickActions.map((action) => (
            <QuickActionCard
              key={action.label}
              action={action}
              onSelect={() => {
                if (action.path) {
                  navigate(action.path);
                }
              }}
            />
          ))}
        </div>
      </section>

      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {realStatsCards.map((card) => (
          <StatCard key={card.label} card={card} />
        ))}
      </section>

      <section className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <RevenueChart data={realRevenueTrend} period={revenuePeriod} onPeriodChange={setRevenuePeriod} />
        </div>

        <div className="flex flex-col gap-6 xl:col-span-4">
          <div className="flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h4 className="mb-4 font-['Plus_Jakarta_Sans',sans-serif] font-bold text-[#0b1c30]">
              Các món bán chạy
            </h4>
            <div className="grid flex-1 grid-cols-2 gap-3">
              <div className="rounded-xl bg-orange-50 p-4">
                <p className="text-xs font-semibold text-slate-500">Số lượng đã bán</p>
                <p className="mt-2 text-2xl font-bold text-[#0b1c30]">{totalTopProductSold}</p>
              </div>
              <div className="rounded-xl bg-green-50 p-4">
                <p className="text-xs font-semibold text-slate-500">Doanh thu top món</p>
                <p className="mt-2 text-lg font-bold text-[#0b1c30]">
                  {formatCurrency(totalTopProductRevenue)}
                </p>
              </div>
            </div>
          </div>

          <TopProductsCard products={realTopProducts} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 2xl:grid-cols-12">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm 2xl:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-200 p-6">
            <h4 className="font-['Plus_Jakarta_Sans',sans-serif] font-bold text-[#0b1c30]">
              Hóa đơn gần đây
            </h4>
            <button type="button" className="text-xs font-bold text-[#f97316] hover:underline">
              Xem tất cả
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-160 text-left text-sm">
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
                {realRecentOrders.length > 0 ? (
                  realRecentOrders.map((order) => (
                    <tr key={order.code} className="transition-colors hover:bg-slate-50">
                      <td className="px-6 py-4 font-bold text-[#f97316]">{order.code}</td>
                      <td className="px-6 py-4 text-[#0b1c30]">{order.customer}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${order.typeClassName}`}
                        >
                          {order.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-[#0b1c30]">
                        {order.total}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${order.statusClassName}`}
                        >
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-6 text-center text-sm text-slate-400">
                      Chưa có hóa đơn gần đây
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm 2xl:col-span-5">
          <div className="flex items-center justify-between border-b border-slate-200 p-6">
            <h4 className="font-['Plus_Jakarta_Sans',sans-serif] font-bold text-[#0b1c30]">
              Cảnh báo tồn kho
            </h4>
            <button
              type="button"
              onClick={() => navigate("/products")}
              className="text-xs font-bold text-[#f97316] hover:underline"
            >
              Xem sản phẩm
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-104 text-left text-sm">
              <thead className="bg-slate-50 font-semibold text-slate-500">
                <tr>
                  <th className="px-6 py-3">Sản phẩm</th>
                  <th className="px-6 py-3 text-center">Còn lại</th>
                  <th className="px-6 py-3 text-center">Mức tối thiểu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200"> 
                {realStockAlerts.length > 0 ? (
                  realStockAlerts.map((item) => (
                    <tr key={item.product} className="transition-colors hover:bg-slate-50">
                      <td className="px-6 py-4 text-[#0b1c30]">{item.product}</td>
                      <td className="px-6 py-4 text-center font-bold">
                        <span className={item.remainClassName}>{item.remain}</span>
                      </td>
                      <td className="px-6 py-4 text-center text-slate-400">{item.minimum}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-6 py-6 text-center text-sm text-slate-400">
                      Không có sản phẩm sắp hết hàng
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </AdminLayout>
  );
}

export default DashboardPage;
