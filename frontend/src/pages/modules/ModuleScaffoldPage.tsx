import { useMemo, useState, useEffect, useRef } from "react";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";
import { createAuditLog } from "../../api/audit-log.api";
import { useAppNotifications } from "../../components/common/AppNotificationsContext";
import {
  getSettings,
  updateSettings,
  uploadLogo,
  downloadBackup,
  restoreDatabase,
} from "../../api/settings.api";

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
      { label: "Sản phẩm tồn kho", value: "12", icon: "inventory_2", tone: "bg-orange-50 text-[#f97316]" },
      { label: "Sắp hết hàng", value: "0", icon: "warning", tone: "bg-red-50 text-red-600" },
      { label: "Phiếu nhập hôm nay", value: "0", icon: "assignment_returned", tone: "bg-green-50 text-green-600" },
      { label: "Điều chỉnh", value: "0", icon: "tune", tone: "bg-slate-50 text-slate-600" },
    ],
    rows: [
      { id: "stock-1", title: "Trà sữa Ô long", subtitle: "Tồn hiện tại: 18", value: "+10", status: "Nhập kho", statusClassName: "bg-green-50 text-green-600" },
      { id: "stock-2", title: "Trà đào cam sả", subtitle: "Tồn hiện tại: 9", value: "-4", status: "Bán POS", statusClassName: "bg-orange-50 text-[#f97316]" },
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
      { label: "Khách mới", value: "0", icon: "person_add", tone: "bg-orange-50 text-[#f97316]" },
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
      { label: "Hóa đơn hôm nay", value: "5", icon: "receipt_long", tone: "bg-orange-50 text-[#f97316]" },
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
      { label: "Đang hoạt động", value: "0", icon: "redeem", tone: "bg-orange-50 text-[#f97316]" },
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
      { label: "Tài khoản", value: "1", icon: "badge", tone: "bg-orange-50 text-[#f97316]" },
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
      { label: "Ca đang mở", value: "0", icon: "work_history", tone: "bg-orange-50 text-[#f97316]" },
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
      { label: "Log hôm nay", value: "0", icon: "history", tone: "bg-orange-50 text-[#f97316]" },
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
      { label: "Doanh thu tháng", value: "385.000 đ", icon: "monitoring", tone: "bg-orange-50 text-[#f97316]" },
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
    title: "Cài đặt",
    subtitle: "Thiết lập thông tin cửa hàng, thanh toán và vận hành POS.",
    eyebrow: "Thiết lập POS",
    heroTitle: "Cấu hình cửa hàng",
    heroDescription:
      "Chuẩn bị giao diện cấu hình để sau này lưu thông tin cửa hàng, thuế, phương thức thanh toán.",
    primaryAction: "Lưu cấu hình",
    searchPlaceholder: "Tìm thiết lập...",
    emptyText: "Chưa có thiết lập phù hợp.",
    stats: [
      { label: "Cửa hàng", value: "1", icon: "store", tone: "bg-orange-50 text-[#f97316]" },
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
      <h3 className="mt-1 text-2xl font-extrabold text-[#0b1c30]">{stat.value}</h3>
    </article>
  );
}

function ModuleScaffoldPage({ moduleKey }: { moduleKey: ModuleKey }) {
  const { notify } = useAppNotifications();
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
        notify("Đã lưu cấu hình hệ thống và ghi nhận vào nhật ký hoạt động!", "success");
      } catch (err) {
        console.error("Lỗi lưu cấu hình:", err);
        notify(err instanceof Error ? err.message : "Không thể lưu cấu hình", "error");
      }
    }
  };

  return (
    <AdminLayout title={config.title} subtitle={config.subtitle}>
      <section className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#f97316]">
            {config.eyebrow}
          </p>
          <h1 className="font-['Outfit',sans-serif] text-3xl font-extrabold text-[#0b1c30]">
            {config.heroTitle}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">{config.heroDescription}</p>
        </div>
        <button
          type="button"
          onClick={handlePrimaryAction}
          className="inline-flex h-10 items-center justify-center gap-2 bg-[#f97316] px-4 text-sm font-bold text-white transition-colors hover:bg-[#ea580c]"
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
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-4 pl-10 text-sm outline-none transition-all focus:border-[#f97316] focus:bg-white focus:ring-2 focus:ring-orange-100"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-180 text-left text-sm">
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
                      <p className="font-bold text-[#0b1c30]">{row.title}</p>
                      <p className="mt-1 text-xs text-slate-400">{row.subtitle}</p>
                    </td>
                    <td className="px-6 py-4 text-right font-extrabold text-[#0b1c30]">{row.value}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${row.statusClassName}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button type="button" className="rounded-lg p-2 text-[#f97316] hover:bg-orange-50">
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
            <div className="rounded-xl bg-orange-50 p-3 text-[#f97316]">
              <Icon name="schema" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#f97316]">Bước tiếp theo</p>
              <h3 className="font-['Outfit',sans-serif] text-lg font-extrabold text-[#0b1c30]">
                Backend & Database
              </h3>
            </div>
          </div>
          <div className="space-y-3">
            {config.nextSteps.map((step, index) => (
              <div key={step} className="flex gap-3 rounded-2xl bg-slate-50 p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f97316] text-xs font-extrabold text-white">
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

const settingInputClass =
  "h-11 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#f97316] focus:ring-2 focus:ring-orange-100";
const settingLabelClass = "mb-2 block text-sm font-bold text-slate-700";
const settingCompactInputClass =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-[#f97316] focus:ring-2 focus:ring-orange-100";
const settingCompactLabelClass = "mb-2 block text-[10px] font-extrabold uppercase text-slate-500";

function SettingsCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 rounded border-slate-300 text-[#f97316] focus:ring-[#f97316]"
      />
      <span className="text-sm font-semibold text-slate-700">{label}</span>
    </label>
  );
}

function SaveButton({ compact = false, disabled = false }: { compact?: boolean; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-lg bg-[#f97316] font-extrabold text-white shadow-sm transition hover:bg-[#ea580c] disabled:opacity-50",
        compact ? "h-9 px-5 text-xs" : "h-11 px-6 text-sm",
      ].join(" ")}
    >
      <Icon name="save" className={compact ? "text-[17px]" : "text-[19px]"} />
      Lưu{compact ? "" : " thay đổi"}
    </button>
  );
}

function SettingsOfficialPage() {
  const { notify, confirm: confirmAction } = useAppNotifications();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSettings()
      .then((res) => {
        setFormData(res.data);
      })
      .catch((err) => {
        console.error("Lỗi lấy cài đặt:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const res = await updateSettings(formData);
      setFormData(res.data);
      notify("Đã lưu cài đặt và ghi nhận nhật ký hoạt động!", "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Không thể lưu cài đặt.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const res = await uploadLogo(file);
      handleChange("store_logo", res.data.logoUrl);
      const updated = { ...formData, store_logo: res.data.logoUrl };
      const saveRes = await updateSettings(updated);
      setFormData(saveRes.data);
      notify("Đã cập nhật logo cửa hàng và lưu thiết lập!", "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Không thể tải lên logo.", "error");
    }
  };

  const handleBackup = async () => {
    try {
      const res = await downloadBackup();
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_pos_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Lỗi sao lưu dữ liệu.", "error");
    }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const confirmRestore = await confirmAction({
      title: "Khôi phục dữ liệu",
      message:
        "CẢNH BÁO: Hành động này sẽ thay thế toàn bộ dữ liệu hiện tại trong cơ sở dữ liệu bằng dữ liệu khôi phục. Bạn có chắc chắn muốn tiếp tục?",
      confirmText: "Khôi phục",
      type: "warning",
    });
    if (!confirmRestore) {
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        const res = await restoreDatabase(json);
        notify(res.message || "Khôi phục dữ liệu thành công! Trang web sẽ được tải lại.", "success");
        window.location.reload();
      } catch (err) {
        notify("Khôi phục thất bại: " + (err instanceof Error ? err.message : "Định dạng file không hợp lệ."), "error");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  if (loading) {
    return (
      <AdminLayout title="Cài đặt" subtitle="Quản lý các thiết lập cơ bản của hệ thống">
        <div className="flex h-80 items-center justify-center rounded-3xl border border-slate-200 bg-white">
          <div className="flex flex-col items-center gap-2">
            <Icon name="autorenew" className="animate-spin text-3xl text-[#f97316]" />
            <p className="text-xs font-bold text-slate-400">Đang tải cấu hình...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Cài đặt" subtitle="Quản lý các thiết lập cơ bản của hệ thống">
      <div className="min-h-full w-full space-y-8 overflow-x-hidden bg-[#f8fafc] font-['Inter',sans-serif]">
        <form
          onSubmit={handleSave}
          className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm lg:p-8"
        >
            <h2 className="mb-6 flex items-center gap-3 text-lg font-extrabold text-slate-800">
              <svg
                stroke="currentColor"
                fill="none"
                strokeWidth="2"
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-5 w-5 text-[#f97316]"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              Thông tin cửa hàng
            </h2>
            <div className="grid gap-8 xl:grid-cols-[260px_1fr]">
              <div>
                <p className="mb-4 text-sm font-bold text-slate-700">Logo cửa hàng</p>
                <div className="mb-4 flex aspect-square w-full max-w-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 overflow-hidden">
                  {formData.store_logo ? (
                    <img
                      src={formData.store_logo}
                      alt="Store Logo"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <>
                      <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-lg bg-[#f97316] text-white">
                        <Icon name="bolt" filled className="text-[32px]" />
                      </div>
                      <p className="text-center font-['Outfit',sans-serif] text-xl font-extrabold leading-tight text-[#f97316]">
                        QuickServe
                        <br />
                        <span className="text-sm">POS</span>
                      </p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  ref={logoInputRef}
                  onChange={handleLogoChange}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="h-10 w-full max-w-48 rounded-lg bg-slate-100 px-4 text-sm font-extrabold text-slate-600 transition hover:bg-slate-200"
                >
                  Thay đổi logo
                </button>
                <p className="mt-3 text-xs font-semibold text-slate-400">JPG, PNG tối đa 2MB</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className={settingLabelClass}>
                    Tên cửa hàng <span className="text-red-500">*</span>
                  </label>
                  <input
                    className={settingInputClass}
                    value={formData.store_name || ""}
                    onChange={(e) => handleChange("store_name", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={settingLabelClass}>
                    Địa chỉ <span className="text-red-500">*</span>
                  </label>
                  <input
                    className={settingInputClass}
                    value={formData.store_address || ""}
                    onChange={(e) => handleChange("store_address", e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className={settingLabelClass}>
                      Số điện thoại <span className="text-red-500">*</span>
                    </label>
                    <input
                      className={settingInputClass}
                      value={formData.store_phone || ""}
                      onChange={(e) => handleChange("store_phone", e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className={settingLabelClass}>Email</label>
                    <input
                      className={settingInputClass}
                      value={formData.store_email || ""}
                      onChange={(e) => handleChange("store_email", e.target.value)}
                      type="email"
                    />
                  </div>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className={settingLabelClass}>Website</label>
                    <input
                      className={settingInputClass}
                      value={formData.store_website || ""}
                      onChange={(e) => handleChange("store_website", e.target.value)}
                      type="url"
                    />
                  </div>
                  <div>
                    <label className={settingLabelClass}>Múi giờ</label>
                    <select
                      className={settingInputClass}
                      value={formData.store_timezone || "GMT+7"}
                      onChange={(e) => handleChange("store_timezone", e.target.value)}
                    >
                      <option value="GMT+7">(GMT+07:00) Bangkok, Hanoi, Jakarta</option>
                      <option value="GMT+8">(GMT+08:00) Beijing, Singapore</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <SaveButton disabled={saving} />
                </div>
              </div>
            </div>
        </form>

        <section className="grid gap-5 xl:grid-cols-3">
          <form
            onSubmit={handleSave}
            className="flex min-h-71.25 flex-col rounded-xl border border-slate-100 bg-white p-5 shadow-sm"
          >
            <h2 className="mb-6 flex items-center gap-3 text-base font-extrabold text-slate-800">
              <Icon name="receipt_long" filled className="text-[20px] text-[#f97316]" />
              Cấu hình hóa đơn
            </h2>
            <div className="flex flex-1 flex-col">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={settingCompactLabelClass}>Tiền tố hóa đơn</label>
                  <input
                    className={settingCompactInputClass}
                    value={formData.invoice_prefix || ""}
                    onChange={(e) => handleChange("invoice_prefix", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={settingCompactLabelClass}>Bắt đầu từ</label>
                  <input
                    className={settingCompactInputClass}
                    value={formData.invoice_start_index || ""}
                    onChange={(e) => handleChange("invoice_start_index", e.target.value)}
                    type="number"
                    min="1"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2 pt-5">
                <SettingsCheckbox
                  label="In hóa đơn sau thanh toán"
                  checked={formData.invoice_print_after_payment === "true"}
                  onChange={(val) => handleChange("invoice_print_after_payment", val ? "true" : "false")}
                />
                <SettingsCheckbox
                  label="Hiển thị logo trên hóa đơn"
                  checked={formData.invoice_show_logo === "true"}
                  onChange={(val) => handleChange("invoice_show_logo", val ? "true" : "false")}
                />
                <SettingsCheckbox
                  label="Hiển thị địa chỉ cửa hàng"
                  checked={formData.invoice_show_address === "true"}
                  onChange={(val) => handleChange("invoice_show_address", val ? "true" : "false")}
                />
                <SettingsCheckbox
                  label="Hiển thị lời cảm ơn trên hóa đơn"
                  checked={formData.invoice_show_thank_you === "true"}
                  onChange={(val) => handleChange("invoice_show_thank_you", val ? "true" : "false")}
                />
              </div>

              <div className="mt-auto flex justify-end pt-4">
                <SaveButton compact disabled={saving} />
              </div>
            </div>
          </form>

          <form
            onSubmit={handleSave}
            className="flex min-h-71.25 flex-col rounded-xl border border-slate-100 bg-white p-5 shadow-sm"
          >
            <h2 className="mb-6 flex items-center gap-3 text-base font-extrabold text-slate-800">
              <Icon name="inventory_2" filled className="text-[20px] text-[#f97316]" />
              Cấu hình kho
            </h2>
            <div className="flex flex-1 flex-col">
              <div className="space-y-4">
                <div>
                  <label className={settingCompactLabelClass}>Cảnh báo tồn kho tối thiểu</label>
                  <input
                    className={settingCompactInputClass}
                    value={formData.inventory_min_warning || ""}
                    onChange={(e) => handleChange("inventory_min_warning", e.target.value)}
                    type="number"
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label className={settingCompactLabelClass}>Đơn vị mặc định</label>
                  <select
                    className={settingCompactInputClass}
                    value={formData.inventory_default_unit || "kg"}
                    onChange={(e) => handleChange("inventory_default_unit", e.target.value)}
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="lit">lít</option>
                    <option value="unit">đơn vị</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-5">
                <SettingsCheckbox
                  label="Cho phép nhập hạn sử dụng"
                  checked={formData.inventory_allow_expiry === "true"}
                  onChange={(val) => handleChange("inventory_allow_expiry", val ? "true" : "false")}
                />
                <SettingsCheckbox
                  label="Tự động trừ kho khi bán"
                  checked={formData.inventory_auto_deduct === "true"}
                  onChange={(val) => handleChange("inventory_auto_deduct", val ? "true" : "false")}
                />
              </div>

              <div className="mt-auto flex justify-end pt-4">
                <SaveButton compact disabled={saving} />
              </div>
            </div>
          </form>

          <form
            onSubmit={handleSave}
            className="flex min-h-71.25 flex-col rounded-xl border border-slate-100 bg-white p-5 shadow-sm"
          >
            <h2 className="mb-6 flex items-center gap-3 text-base font-extrabold text-slate-800">
              <Icon name="schedule" filled className="text-[20px] text-[#f97316]" />
              Cấu hình ca làm
            </h2>
            <div className="flex flex-1 flex-col">
              <div className="space-y-2">
                <SettingsCheckbox
                  label="Bắt buộc mở ca trước bán hàng"
                  checked={formData.shift_require_open_before_sale === "true"}
                  onChange={(val) => handleChange("shift_require_open_before_sale", val ? "true" : "false")}
                />
                <SettingsCheckbox
                  label="Bắt buộc đóng ca cuối ngày"
                  checked={formData.shift_require_close_end_of_day === "true"}
                  onChange={(val) => handleChange("shift_require_close_end_of_day", val ? "true" : "false")}
                />
              </div>
              
              <div className="pt-5">
                <label className={settingCompactLabelClass}>Tiền mặt đầu ca</label>
                <div className="relative">
                  <input
                    className={`${settingCompactInputClass} pr-8 text-right font-extrabold`}
                    value={formData.shift_default_opening_cash || ""}
                    onChange={(e) => handleChange("shift_default_opening_cash", e.target.value)}
                    type="number"
                    min="0"
                    required
                  />
                  <span className="absolute inset-y-0 right-3 flex items-center text-xs font-extrabold text-slate-400">
                    đ
                  </span>
                </div>
              </div>

              <div className="mt-auto flex justify-end pt-4">
                <SaveButton compact disabled={saving} />
              </div>
            </div>
          </form>
        </section>

        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm lg:p-8">
            <h2 className="mb-6 text-lg font-extrabold text-slate-800">Sao lưu & Khôi phục dữ liệu</h2>
            
            <div className="grid gap-8 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-[#f97316]">
                    <Icon name="cloud_download" className="text-xl" />
                  </span>
                  <h3 className="text-base font-extrabold text-[#0b1c30]">Sao lưu dữ liệu</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Tải xuống toàn bộ dữ liệu hiện có trong cơ sở dữ liệu bao gồm: thông tin cửa hàng, tài khoản nhân viên, danh mục sản phẩm, lịch sử hóa đơn, ca làm việc và nhật ký hoạt động. Bản sao lưu được lưu trữ dưới dạng tệp tin `.json` an toàn.
                </p>
                <button
                  type="button"
                  onClick={handleBackup}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#f97316] px-4 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#ea580c]"
                >
                  <Icon name="download" />
                  Tải bản sao lưu (.json)
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                    <Icon name="settings_backup_restore" className="text-xl" />
                  </span>
                  <h3 className="text-base font-extrabold text-[#0b1c30]">Khôi phục dữ liệu</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Chọn tệp tin sao lưu `.json` của hệ thống để khôi phục lại dữ liệu.
                  <strong className="text-red-500"> Lưu ý: Hành động này sẽ ghi đè và thay thế tất cả dữ liệu hiện tại trong hệ thống.</strong> Hãy chắc chắn bạn đã sao lưu dữ liệu quan trọng trước khi chạy.
                </p>
                <div className="flex items-center gap-3">
                  <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 text-xs font-extrabold text-slate-600 transition hover:bg-slate-200">
                    <Icon name="upload" />
                    Chọn tệp sao lưu
                    <input
                      type="file"
                      onChange={handleRestore}
                      accept=".json"
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
        </div>
      </div>
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
  return <SettingsOfficialPage />;
}
