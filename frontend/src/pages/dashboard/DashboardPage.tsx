import { useNavigate } from "react-router-dom";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";

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
    label: "Hóa đơn hôm nay",
    value: "142",
    icon: "receipt_long",
    iconBg: "bg-orange-50",
    iconText: "text-[#f97316]",
    badge: "+8%",
    badgeBg: "bg-green-50",
    badgeText: "text-green-600",
  },
  {
    label: "Danh mục đang bán",
    value: "11",
    icon: "sell",
    iconBg: "bg-orange-50",
    iconText: "text-[#f97316]",
    badge: "Đồ ăn & nước",
    badgeBg: "bg-orange-50",
    badgeText: "text-[#f97316]",
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
    badge: "Tích điểm",
    badgeBg: "bg-green-50",
    badgeText: "text-green-600",
  },
  {
    label: "Sản phẩm đang bán",
    value: "458",
    icon: "inventory",
    iconBg: "bg-orange-50",
    iconText: "text-[#f97316]",
    badge: "Đang bán",
    badgeBg: "bg-slate-50",
    badgeText: "text-slate-500",
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
  { name: "Bánh mì thịt", sold: "428 phần", width: "85%" },
  { name: "Cà phê sữa đá", sold: "312 ly", width: "65%" },
  { name: "Phở gà", sold: "245 tô", width: "50%" },
];

const recentOrders: RecentOrder[] = [
  {
    code: "#HD-2584",
    customer: "Nguyễn Văn An",
    type: "POS",
    total: "125.000đ",
    status: "Hoàn tất",
    typeClassName: "bg-orange-50 text-[#f97316]",
    statusClassName: "bg-green-50 text-green-600",
  },
  {
    code: "#HD-2583",
    customer: "Trần Thị Hoa",
    type: "POS",
    total: "85.000đ",
    status: "Hoàn tất",
    typeClassName: "bg-orange-50 text-[#f97316]",
    statusClassName: "bg-green-50 text-green-600",
  },
  {
    code: "#HD-2582",
    customer: "Khách lẻ",
    type: "POS",
    total: "45.000đ",
    status: "Hoàn tất",
    typeClassName: "bg-orange-50 text-[#f97316]",
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

function RevenueChartMock({ bars }: { bars: RevenueBar[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="font-['Plus_Jakarta_Sans',sans-serif] font-bold text-[#0b1c30]">
            Doanh thu 7 ngày qua
          </h4>
          <p className="text-xs text-slate-400">
            Theo dõi doanh thu bán đồ ăn sáng và nước uống
          </p>
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

function DashboardPage() {
  const navigate = useNavigate();

  return (
    <AdminLayout>
      <section className="mb-8">
        <div className="mb-4 flex flex-col gap-1">
          <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-bold text-[#0b1c30]">
            Thao tác nhanh
          </h2>
          <p className="text-sm text-slate-500">
            Chỉ hiển thị các chức năng phù hợp với đề tài hiện tại.
          </p>
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
              Cơ cấu món bán chạy
            </h4>
            <div className="flex flex-1 items-center justify-center">
              <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-16 border-[#f97316] border-r-orange-100">
                <div className="text-center">
                  <p className="text-lg font-bold text-[#0b1c30]">60%</p>
                  <p className="text-[10px] text-slate-400">Đồ ăn</p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-around">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <span className="h-2 w-2 rounded-full bg-[#f97316]" />
                Đồ ăn
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <span className="h-2 w-2 rounded-full bg-orange-200" />
                Nước uống
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
                {recentOrders.map((order) => (
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
            <button
              type="button"
              onClick={() => navigate("/products")}
              className="text-xs font-bold text-[#f97316] hover:underline"
            >
              Xem sản phẩm
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-105 text-left text-sm">
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
    </AdminLayout>
  );
}

export default DashboardPage;
