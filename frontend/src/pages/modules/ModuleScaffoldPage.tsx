import { useMemo, useState } from "react";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";
import { createAuditLog } from "../../api/audit-log.api";

type ModuleKey =
  | "stock"
  | "customers"
  | "invoices"
  | "promotions"
  | "employees"
  | "shifts"
  | "auditLogs"
  | "reports"
  | "settings";

type StatCard = {
  label: string;
  value: string;
  icon: string;
  tone: string;
};

type TableRow = {
  id: string;
  title: string;
  subtitle: string;
  value: string;
  status: string;
  statusClassName: string;
};

type ModuleConfig = {
  title: string;
  subtitle: string;
  eyebrow: string;
  heroTitle: string;
  heroDescription: string;
  primaryAction: string;
  searchPlaceholder: string;
  emptyText: string;
  stats: StatCard[];
  rows: TableRow[];
  nextSteps: string[];
};

const moduleConfigs: Record<ModuleKey, ModuleConfig> = {
  stock: {
    title: "Kho hàng",
    subtitle: "Theo dõi nhập, xuất và điều chỉnh tồn kho.",
    eyebrow: "Quản lý tồn kho",
    heroTitle: "Luồng kho hàng",
    heroDescription:
      "Chuẩn bị giao diện để sau này nối giao dịch nhập kho, xuất kho khi bán hàng và cảnh báo sắp hết.",
    primaryAction: "Tạo phiếu nhập",
    searchPlaceholder: "Tìm sản phẩm hoặc mã giao dịch...",
    emptyText: "Chưa có giao dịch kho phù hợp.",
    stats: [
      { label: "Sản phẩm tồn kho", value: "12", icon: "inventory_2", tone: "bg-orange-50 text-[#9d4300]" },
      { label: "Sắp hết hàng", value: "0", icon: "warning", tone: "bg-red-50 text-red-600" },
      { label: "Phiếu nhập hôm nay", value: "0", icon: "assignment_returned", tone: "bg-green-50 text-green-600" },
      { label: "Điều chỉnh", value: "0", icon: "tune", tone: "bg-slate-50 text-slate-600" },
    ],
    rows: [
      { id: "stock-1", title: "Trà sữa Ô long", subtitle: "Tồn hiện tại: 18", value: "+10", status: "Nhập kho", statusClassName: "bg-green-50 text-green-600" },
      { id: "stock-2", title: "Trà đào cam sả", subtitle: "Tồn hiện tại: 9", value: "-4", status: "Bán POS", statusClassName: "bg-orange-50 text-[#9d4300]" },
    ],
    nextSteps: ["Tạo API stock-transactions", "Nối bảng products.stock_quantity", "Thêm phiếu nhập/xuất kho"],
  },
  customers: {
    title: "Khách hàng",
    subtitle: "Quản lý thông tin khách hàng và lịch sử mua hàng.",
    eyebrow: "Chăm sóc khách hàng",
    heroTitle: "Hồ sơ khách hàng",
    heroDescription:
      "Chuẩn bị màn hình khách hàng để sau này kết nối bảng customers và orders.",
    primaryAction: "Thêm khách hàng",
    searchPlaceholder: "Tìm tên, số điện thoại hoặc email...",
    emptyText: "Chưa có khách hàng phù hợp.",
    stats: [
      { label: "Tổng khách", value: "0", icon: "group", tone: "bg-green-50 text-green-600" },
      { label: "Khách mới", value: "0", icon: "person_add", tone: "bg-orange-50 text-[#9d4300]" },
      { label: "Hóa đơn", value: "0", icon: "receipt_long", tone: "bg-amber-50 text-amber-600" },
      { label: "Doanh thu khách", value: "0 đ", icon: "payments", tone: "bg-slate-50 text-slate-600" },
    ],
    rows: [
      { id: "cus-1", title: "Khách lẻ", subtitle: "Chưa lưu số điện thoại", value: "0 đ", status: "Mặc định", statusClassName: "bg-slate-100 text-slate-600" },
    ],
    nextSteps: ["CRUD customers", "Liên kết orders", "Tra cứu lịch sử mua hàng"],
  },
  invoices: {
    title: "Hóa đơn",
    subtitle: "Tra cứu hóa đơn, trạng thái thanh toán và chi tiết món đã bán.",
    eyebrow: "Lịch sử bán hàng",
    heroTitle: "Danh sách hóa đơn",
    heroDescription:
      "Giao diện hóa đơn sẽ dùng dữ liệu orders, order_details và payments khi triển khai backend.",
    primaryAction: "Lọc hóa đơn",
    searchPlaceholder: "Tìm mã hóa đơn hoặc khách hàng...",
    emptyText: "Chưa có hóa đơn phù hợp.",
    stats: [
      { label: "Hóa đơn hôm nay", value: "5", icon: "receipt_long", tone: "bg-orange-50 text-[#9d4300]" },
      { label: "Đã thanh toán", value: "5", icon: "paid", tone: "bg-green-50 text-green-600" },
      { label: "Đã hủy", value: "0", icon: "cancel", tone: "bg-red-50 text-red-600" },
      { label: "Doanh thu", value: "385.000 đ", icon: "payments", tone: "bg-slate-50 text-slate-600" },
    ],
    rows: [
      { id: "inv-1", title: "#HD mới nhất", subtitle: "Khách lẻ · POS", value: "35.000 đ", status: "Hoàn tất", statusClassName: "bg-green-50 text-green-600" },
      { id: "inv-2", title: "#HD trong ngày", subtitle: "Thanh toán tiền mặt", value: "245.000 đ", status: "Hoàn tất", statusClassName: "bg-green-50 text-green-600" },
    ],
    nextSteps: ["API danh sách orders", "Modal chi tiết hóa đơn", "Hủy/hoàn tiền có ghi audit log"],
  },
  promotions: {
    title: "Khuyến mãi",
    subtitle: "Tạo mã giảm giá và chương trình ưu đãi tại quầy.",
    eyebrow: "Ưu đãi bán hàng",
    heroTitle: "Chương trình khuyến mãi",
    heroDescription:
      "Chuẩn bị frontend cho bảng promotions, áp mã giảm giá và kiểm tra thời gian hiệu lực.",
    primaryAction: "Tạo khuyến mãi",
    searchPlaceholder: "Tìm mã hoặc tên khuyến mãi...",
    emptyText: "Chưa có khuyến mãi phù hợp.",
    stats: [
      { label: "Đang hoạt động", value: "0", icon: "redeem", tone: "bg-orange-50 text-[#9d4300]" },
      { label: "Sắp hết hạn", value: "0", icon: "schedule", tone: "bg-amber-50 text-amber-600" },
      { label: "Đã dùng", value: "0", icon: "local_activity", tone: "bg-green-50 text-green-600" },
      { label: "Giảm giá", value: "0 đ", icon: "sell", tone: "bg-slate-50 text-slate-600" },
    ],
    rows: [
      { id: "pro-1", title: "WELCOME10", subtitle: "Giảm 10% cho khách mới", value: "10%", status: "Bản nháp", statusClassName: "bg-slate-100 text-slate-600" },
    ],
    nextSteps: ["CRUD promotions", "Validate code khi thanh toán", "Tính discount_amount trong orders"],
  },
  employees: {
    title: "Nhân viên",
    subtitle: "Quản lý tài khoản nhân viên và phân quyền theo vai trò.",
    eyebrow: "Nhân sự cửa hàng",
    heroTitle: "Danh sách nhân viên",
    heroDescription:
      "Màn hình này sẽ nối bảng users và roles để quản lý đăng nhập, trạng thái tài khoản.",
    primaryAction: "Thêm nhân viên",
    searchPlaceholder: "Tìm tên, email hoặc vai trò...",
    emptyText: "Chưa có nhân viên phù hợp.",
    stats: [
      { label: "Tài khoản", value: "1", icon: "badge", tone: "bg-orange-50 text-[#9d4300]" },
      { label: "Đang hoạt động", value: "1", icon: "verified_user", tone: "bg-green-50 text-green-600" },
      { label: "Bị khóa", value: "0", icon: "lock", tone: "bg-red-50 text-red-600" },
      { label: "Vai trò", value: "1", icon: "admin_panel_settings", tone: "bg-slate-50 text-slate-600" },
    ],
    rows: [
      { id: "emp-1", title: "Quản trị viên", subtitle: "admin@example.com", value: "ADMIN", status: "Hoạt động", statusClassName: "bg-green-50 text-green-600" },
    ],
    nextSteps: ["CRUD users", "Reset mật khẩu", "Phân quyền theo roles"],
  },
  shifts: {
    title: "Ca làm",
    subtitle: "Theo dõi ca trực, mở ca, đóng ca và bàn giao tiền mặt.",
    eyebrow: "Vận hành ca bán",
    heroTitle: "Lịch ca làm",
    heroDescription:
      "Chuẩn bị giao diện ca làm để sau này tạo bảng shifts và liên kết doanh thu theo nhân viên.",
    primaryAction: "Mở ca mới",
    searchPlaceholder: "Tìm nhân viên hoặc mã ca...",
    emptyText: "Chưa có ca làm phù hợp.",
    stats: [
      { label: "Ca đang mở", value: "0", icon: "work_history", tone: "bg-orange-50 text-[#9d4300]" },
      { label: "Doanh thu ca", value: "0 đ", icon: "payments", tone: "bg-green-50 text-green-600" },
      { label: "Tiền mặt", value: "0 đ", icon: "account_balance_wallet", tone: "bg-amber-50 text-amber-600" },
      { label: "Đã đóng", value: "0", icon: "task_alt", tone: "bg-slate-50 text-slate-600" },
    ],
    rows: [
      { id: "shift-1", title: "Ca sáng", subtitle: "06:00 - 12:00", value: "Chưa mở", status: "Bản nháp", statusClassName: "bg-slate-100 text-slate-600" },
    ],
    nextSteps: ["Thiết kế bảng shifts", "Mở/đóng ca", "Báo cáo tiền mặt cuối ca"],
  },
  auditLogs: {
    title: "Nhật ký hệ thống",
    subtitle: "Theo dõi lịch sử thao tác quan trọng trong hệ thống.",
    eyebrow: "Nhật ký hệ thống",
    heroTitle: "Lịch sử thao tác",
    heroDescription:
      "Giao diện đọc audit_logs để truy vết thay đổi sản phẩm, hóa đơn, kho và tài khoản.",
    primaryAction: "Xuất log",
    searchPlaceholder: "Tìm hành động, người dùng hoặc đối tượng...",
    emptyText: "Chưa có log phù hợp.",
    stats: [
      { label: "Log hôm nay", value: "0", icon: "history", tone: "bg-orange-50 text-[#9d4300]" },
      { label: "Thao tác kho", value: "0", icon: "inventory", tone: "bg-green-50 text-green-600" },
      { label: "Bảo mật", value: "0", icon: "security", tone: "bg-red-50 text-red-600" },
      { label: "Người dùng", value: "0", icon: "person", tone: "bg-slate-50 text-slate-600" },
    ],
    rows: [
      { id: "log-1", title: "Đăng nhập hệ thống", subtitle: "", value: "Vừa xong", status: "Info", statusClassName: "bg-slate-100 text-slate-600" },
    ],
    nextSteps: ["Ghi log trong service", "API phân trang audit_logs", "Bộ lọc theo entity/action"],
  },
  reports: {
    title: "Báo cáo",
    subtitle: "Tổng hợp doanh thu, món bán chạy, tồn kho và hiệu quả vận hành.",
    eyebrow: "Phân tích kinh doanh",
    heroTitle: "Báo cáo cửa hàng",
    heroDescription:
      "Chuẩn bị dashboard báo cáo nâng cao từ orders, payments, products và stock_transactions.",
    primaryAction: "Xuất báo cáo",
    searchPlaceholder: "Tìm báo cáo hoặc chỉ số...",
    emptyText: "Chưa có báo cáo phù hợp.",
    stats: [
      { label: "Doanh thu tháng", value: "385.000 đ", icon: "monitoring", tone: "bg-orange-50 text-[#9d4300]" },
      { label: "Hóa đơn", value: "5", icon: "receipt_long", tone: "bg-green-50 text-green-600" },
      { label: "Món bán chạy", value: "2", icon: "restaurant", tone: "bg-amber-50 text-amber-600" },
      { label: "Tồn thấp", value: "0", icon: "warning", tone: "bg-red-50 text-red-600" },
    ],
    rows: [
      { id: "report-1", title: "Doanh thu theo tháng", subtitle: "Tổng hợp từ orders.completed", value: "385.000 đ", status: "Sẵn sàng", statusClassName: "bg-green-50 text-green-600" },
    ],
    nextSteps: ["API reports/revenue", "Xuất CSV/PDF", "Biểu đồ lợi nhuận và tồn kho"],
  },
  settings: {
    title: "Cấu hình hệ thống",
    subtitle: "Thiết lập thông tin cửa hàng, thanh toán và vận hành POS.",
    eyebrow: "Thiết lập POS",
    heroTitle: "Cấu hình cửa hàng",
    heroDescription:
      "Chuẩn bị giao diện cấu hình để sau này lưu thông tin cửa hàng, thuế, phương thức thanh toán.",
    primaryAction: "Lưu cấu hình",
    searchPlaceholder: "Tìm thiết lập...",
    emptyText: "Chưa có thiết lập phù hợp.",
    stats: [
      { label: "Cửa hàng", value: "1", icon: "store", tone: "bg-orange-50 text-[#9d4300]" },
      { label: "Thanh toán", value: "3", icon: "credit_card", tone: "bg-green-50 text-green-600" },
      { label: "Thuế", value: "0%", icon: "request_quote", tone: "bg-amber-50 text-amber-600" },
      { label: "Bảo mật", value: "JWT", icon: "shield", tone: "bg-slate-50 text-slate-600" },
    ],
    rows: [
      { id: "setting-1", title: "Tên cửa hàng", subtitle: "QuickServe POS", value: "Đang dùng", status: "Hoạt động", statusClassName: "bg-green-50 text-green-600" },
    ],
    nextSteps: ["Bảng app_settings", "Form cấu hình cửa hàng", "Sao lưu/khôi phục dữ liệu"],
  },
};

function ModuleStatCard({ stat }: { stat: StatCard }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className={`rounded-xl p-3 ${stat.tone}`}>
          <Icon name={stat.icon} />
        </div>
      </div>
      <p className="text-xs font-bold uppercase tracking-tight text-slate-500">{stat.label}</p>
      <h3 className="mt-1 text-2xl font-extrabold text-[#2a1b14]">{stat.value}</h3>
    </article>
  );
}

function ModuleScaffoldPage({ moduleKey }: { moduleKey: ModuleKey }) {
  const config = moduleConfigs[moduleKey];
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return config.rows;
    }

    return config.rows.filter((row) =>
      [row.title, row.subtitle, row.value, row.status]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [config.rows, search]);

  const handlePrimaryAction = async () => {
    if (moduleKey === "settings") {
      try {
        await createAuditLog({
          actionType: "SUA_CAU_HINH",
          targetObject: "Cấu hình hệ thống",
          description: "Thay đổi cấu hình hệ thống",
        });
        alert("Đã lưu cấu hình hệ thống và ghi nhận vào nhật ký hoạt động!");
      } catch (err) {
        console.error("Lỗi lưu cấu hình:", err);
        alert(err instanceof Error ? err.message : "Không thể lưu cấu hình");
      }
    }
  };

  return (
    <AdminLayout title={config.title} subtitle={config.subtitle}>
      <section className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#9d4300]">
            {config.eyebrow}
          </p>
          <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-3xl font-extrabold text-[#2a1b14]">
            {config.heroTitle}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">{config.heroDescription}</p>
        </div>
        <button
          type="button"
          onClick={handlePrimaryAction}
          className="inline-flex h-10 items-center justify-center gap-2 bg-[#9d4300] px-4 text-sm font-bold text-white transition-colors hover:bg-[#803600]"
        >
          <Icon name="add" />
          {config.primaryAction}
        </button>
      </section>

      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {config.stats.map((stat) => (
          <ModuleStatCard key={stat.label} stat={stat} />
        ))}
      </section>

      <section className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <div className="relative">
              <Icon name="search" className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={config.searchPlaceholder}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-4 pl-10 text-sm outline-none transition-all focus:border-[#9d4300] focus:bg-white focus:ring-2 focus:ring-orange-100"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 font-semibold text-slate-500">
                <tr>
                  <th className="px-6 py-4">Thông tin</th>
                  <th className="px-6 py-4 text-right">Giá trị</th>
                  <th className="px-6 py-4 text-center">Trạng thái</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredRows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <p className="font-bold text-[#2a1b14]">{row.title}</p>
                      <p className="mt-1 text-xs text-slate-400">{row.subtitle}</p>
                    </td>
                    <td className="px-6 py-4 text-right font-extrabold text-[#2a1b14]">{row.value}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${row.statusClassName}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button type="button" className="rounded-lg p-2 text-[#9d4300] hover:bg-orange-50">
                        <Icon name="visibility" className="text-xl" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredRows.length === 0 ? (
            <div className="p-8 text-center text-sm font-semibold text-slate-400">{config.emptyText}</div>
          ) : null}
        </div>

        <aside className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-orange-50 p-3 text-[#9d4300]">
              <Icon name="schema" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#9d4300]">Bước tiếp theo</p>
              <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-lg font-extrabold text-[#2a1b14]">
                Backend & Database
              </h3>
            </div>
          </div>
          <div className="space-y-3">
            {config.nextSteps.map((step, index) => (
              <div key={step} className="flex gap-3 rounded-2xl bg-slate-50 p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#9d4300] text-xs font-extrabold text-white">
                  {index + 1}
                </span>
                <p className="text-sm font-semibold text-slate-600">{step}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </AdminLayout>
  );
}

export function StockPage() {
  return <ModuleScaffoldPage moduleKey="stock" />;
}

export function CustomersPage() {
  return <ModuleScaffoldPage moduleKey="customers" />;
}

export function InvoicesPage() {
  return <ModuleScaffoldPage moduleKey="invoices" />;
}

export function EmployeesPage() {
  return <ModuleScaffoldPage moduleKey="employees" />;
}

export function ShiftsPage() {
  return <ModuleScaffoldPage moduleKey="shifts" />;
}

export function AuditLogsPage() {
  return <ModuleScaffoldPage moduleKey="auditLogs" />;
}

export function ReportsPage() {
  return <ModuleScaffoldPage moduleKey="reports" />;
}

export function SettingsPage() {
  return <ModuleScaffoldPage moduleKey="settings" />;
}
