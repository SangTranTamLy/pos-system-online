import { useEffect, useState } from "react";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";
import { 
  getFinancialReport,
  getInventoryValuation,
  getEmployeePerformanceReport,
  getComparisonReport,
  getCustomerRetention
} from "../../api/report.api";
import type { 
  FinancialReport,
  InventoryValuationReport,
  EmployeePerformance,
  ComparisonReport,
  CustomerRetentionReport
} from "../../types/report";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts";

type TabKey = "financial" | "inventory" | "employee" | "comparison" | "customer";

const COLORS = ["#f97316", "#3b82f6", "#10b981", "#f59e0b", "#6366f1", "#ec4899", "#8b5cf6"];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

function exportToCSV(data: any[], headers: { key: string; label: string }[], filename: string) {
  const csvRows = [];
  csvRows.push(headers.map(h => `"${h.label.replace(/"/g, '""')}"`).join(","));
  for (const row of data) {
    const values = headers.map(h => {
      const val = row[h.key];
      const escaped = String(val === null || val === undefined ? '' : val).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(","));
  }
  const csvContent = "\uFEFF" + csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("financial");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Filters
  const [preset, setPreset] = useState("month"); // 'today', 'week', 'month', 'custom'
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Data States
  const [financialData, setFinancialData] = useState<FinancialReport | null>(null);
  const [inventoryData, setInventoryData] = useState<InventoryValuationReport | null>(null);
  const [employeeData, setEmployeeData] = useState<EmployeePerformance[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonReport | null>(null);
  const [customerData, setCustomerData] = useState<CustomerRetentionReport[]>([]);

  // Update dates when preset changes
  useEffect(() => {
    if (preset === "custom") return;
    const end = new Date();
    const start = new Date();

    if (preset === "today") {
      // Start of today
    } else if (preset === "week") {
      start.setDate(end.getDate() - 7);
    } else if (preset === "month") {
      start.setDate(end.getDate() - 30);
    } else if (preset === "last-month") {
      start.setDate(end.getDate() - 60);
    }

    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  }, [preset]);

  // Load data based on active tab and dates
  const loadReportData = async () => {
    setLoading(true);
    setError("");
    try {
      if (activeTab === "financial") {
        const res = await getFinancialReport(startDate, endDate);
        setFinancialData(res);
      } else if (activeTab === "inventory") {
        const res = await getInventoryValuation();
        setInventoryData(res);
      } else if (activeTab === "employee") {
        const res = await getEmployeePerformanceReport(startDate, endDate);
        setEmployeeData(res);
      } else if (activeTab === "comparison") {
        const res = await getComparisonReport(startDate, endDate);
        setComparisonData(res);
      } else if (activeTab === "customer") {
        const res = await getCustomerRetention(startDate, endDate);
        setCustomerData(res);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra khi tải báo cáo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReportData();
  }, [activeTab, startDate, endDate]);

  const handleExport = () => {
    if (activeTab === "financial" && financialData) {
      exportToCSV(
        financialData.trend,
        [
          { key: "label", label: "Thời gian" },
          { key: "revenue", label: "Doanh thu (VND)" },
          { key: "cogs", label: "Giá vốn hàng bán (VND)" },
          { key: "profit", label: "Lợi nhuận gộp (VND)" }
        ],
        `bao_cao_tai_chinh_${startDate}_to_${endDate}.csv`
      );
    } else if (activeTab === "inventory" && inventoryData) {
      // Export products valuation
      exportToCSV(
        [...inventoryData.products, ...inventoryData.rawMaterials],
        [
          { key: "name", label: "Tên mặt hàng" },
          { key: "sku", label: "Mã SKU" },
          { key: "category", label: "Danh mục" },
          { key: "unit", label: "Đơn vị tính" },
          { key: "stockQuantity", label: "Tồn kho" },
          { key: "importPrice", label: "Giá nhập (VND)" },
          { key: "totalValue", label: "Tổng giá trị tồn (VND)" }
        ],
        `gia_tri_kho_hang.csv`
      );
    } else if (activeTab === "employee") {
      exportToCSV(
        employeeData,
        [
          { key: "fullName", label: "Nhân viên" },
          { key: "shiftsCount", label: "Số ca làm" },
          { key: "totalOrders", label: "Số hóa đơn đã bán" },
          { key: "totalRevenue", label: "Tổng doanh số (VND)" }
        ],
        `hieu_suat_nhan_vien_${startDate}_to_${endDate}.csv`
      );
    } else if (activeTab === "comparison" && comparisonData) {
      exportToCSV(
        comparisonData.trend,
        [
          { key: "label", label: "Thời điểm" },
          { key: "currentPeriodValue", label: "Doanh số kỳ này (VND)" },
          { key: "previousPeriodValue", label: "Doanh số kỳ trước (VND)" }
        ],
        `bao_cao_so_sanh_${startDate}_to_${endDate}.csv`
      );
    } else if (activeTab === "customer") {
      exportToCSV(
        customerData,
        [
          { key: "fullName", label: "Họ và tên" },
          { key: "phone", label: "Số điện thoại" },
          { key: "totalOrders", label: "Tổng số đơn mua" },
          { key: "averageOrderValue", label: "Đơn hàng trung bình (AOV)" },
          { key: "lastOrderAt", label: "Lần mua cuối cùng" },
          { key: "totalRevenue", label: "Tổng chi tiêu (VND)" }
        ],
        `khach_hang_than_thiet_${startDate}_to_${endDate}.csv`
      );
    }
  };

  return (
    <AdminLayout title="Phân tích & Báo cáo" subtitle="Báo cáo tài chính, kho hàng, nhân sự và tăng trưởng.">
      {/* Filters Header */}
      <section className="mb-6 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "today", label: "Hôm nay" },
            { id: "week", label: "7 ngày qua" },
            { id: "month", label: "30 ngày qua" },
            { id: "custom", label: "Tùy chọn" }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
                preset === p.id 
                  ? "bg-[#f97316] text-white shadow-md shadow-orange-200" 
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {preset === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-[#0b1c30] focus:border-[#f97316] focus:bg-white focus:outline-none"
              />
              <span className="text-slate-400 text-xs font-bold">đến</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-[#0b1c30] focus:border-[#f97316] focus:bg-white focus:outline-none"
              />
            </div>
          )}

          <button
            onClick={handleExport}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl border border-[#f97316] px-4 py-2 text-xs font-black text-[#f97316] transition-all hover:bg-orange-50 disabled:opacity-50"
          >
            <Icon name="download" className="text-lg" />
            Xuất Excel/CSV
          </button>
        </div>
      </section>

      {/* Tabs */}
      <section className="mb-6 border-b border-slate-200">
        <div className="flex flex-wrap gap-1">
          {[
            { id: "financial", label: "Tài chính & Lợi nhuận", icon: "payments" },
            { id: "inventory", label: "Giá trị Kho hàng", icon: "inventory_2" },
            { id: "employee", label: "Hiệu suất Nhân viên", icon: "badge" },
            { id: "comparison", label: "So sánh Tăng trưởng", icon: "compare_arrows" },
            { id: "customer", label: "Khách hàng & Tần suất", icon: "group" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabKey)}
              className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-black transition-all ${
                activeTab === tab.id
                  ? "border-[#f97316] text-[#f97316]"
                  : "border-transparent text-slate-500 hover:text-[#0b1c30] hover:border-slate-300"
              }`}
            >
              <Icon name={tab.icon} className="text-lg" />
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-96 items-center justify-center rounded-3xl border border-slate-200 bg-white">
          <div className="flex flex-col items-center gap-3">
            <Icon name="autorenew" className="animate-spin text-4xl text-[#f97316]" />
            <p className="text-sm font-bold text-slate-500">Đang phân tích số liệu...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* TAB 1: FINANCIAL */}
          {activeTab === "financial" && financialData && (
            <>
              {/* Quick stats cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <article className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Doanh thu bán hàng</p>
                  <h3 className="mt-2 text-2xl font-black text-[#0b1c30]">{formatCurrency(financialData.summary.totalRevenue)}</h3>
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-green-600 font-bold">
                    <Icon name="arrow_upward" className="text-sm" />
                    <span>Kỳ kinh doanh hiện tại</span>
                  </div>
                </article>
                <article className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Giá vốn hàng bán (COGS)</p>
                  <h3 className="mt-2 text-2xl font-black text-slate-700">{formatCurrency(financialData.summary.totalCOGS)}</h3>
                  <p className="mt-2 text-[11px] text-slate-400 font-bold">Giá trị nguyên vật liệu tiêu thụ</p>
                </article>
                <article className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Lợi nhuận gộp</p>
                  <h3 className="mt-2 text-2xl font-black text-[#f97316]">{formatCurrency(financialData.summary.grossProfit)}</h3>
                  <p className="mt-2 text-[11px] text-slate-400 font-bold">Số dư tích lũy sau trừ vốn</p>
                </article>
                <article className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Tỷ suất lợi nhuận gộp</p>
                  <h3 className="mt-2 text-2xl font-black text-green-600">{financialData.summary.grossProfitMargin.toFixed(1)}%</h3>
                  <p className="mt-2 text-[11px] text-slate-400 font-bold">Hiệu quả quay vòng vốn hàng hóa</p>
                </article>
              </div>

              {/* Chart */}
              <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
                <h4 className="mb-4 font-['Plus_Jakarta_Sans',sans-serif] font-black text-[#0b1c30]">Xu hướng Doanh thu & Lợi nhuận gộp</h4>
                <div className="h-96 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={financialData.trend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} fontWeight="bold" />
                      <YAxis stroke="#94a3b8" fontSize={11} fontWeight="bold" tickFormatter={value => formatCurrency(value as number).replace(" ₫", "")} />
                      <Tooltip formatter={(value) => [formatCurrency(value as number), ""]} />
                      <Legend />
                      <Bar dataKey="revenue" name="Doanh thu" fill="#f97316" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="cogs" name="Giá vốn" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="profit" name="Lợi nhuận gộp" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: INVENTORY VALUATION */}
          {activeTab === "inventory" && inventoryData && (
            <>
              {/* Quick stats cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <article className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Tổng giá trị tồn kho</p>
                  <h3 className="mt-2 text-2xl font-black text-[#f97316]">{formatCurrency(inventoryData.summary.totalValue)}</h3>
                  <p className="mt-2 text-[11px] text-slate-400 font-bold">Số vốn đọng trong toàn bộ kho hàng</p>
                </article>
                <article className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Giá trị Kho Sản phẩm</p>
                  <h3 className="mt-2 text-2xl font-black text-slate-700">{formatCurrency(inventoryData.summary.totalProductsValue)}</h3>
                  <p className="mt-2 text-[11px] text-slate-400 font-bold">Giá trị đọng ở các sản phẩm pha chế/đồ lon</p>
                </article>
                <article className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Giá trị Kho Nguyên liệu</p>
                  <h3 className="mt-2 text-2xl font-black text-slate-700">{formatCurrency(inventoryData.summary.totalRawValue)}</h3>
                  <p className="mt-2 text-[11px] text-slate-400 font-bold">Giá trị nguyên vật liệu (sữa, cà phê hạt...)</p>
                </article>
              </div>

              {/* Pie chart and Table */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm lg:col-span-5">
                  <h4 className="mb-4 font-['Plus_Jakarta_Sans',sans-serif] font-black text-[#0b1c30]">Phân bổ Vốn lưu động theo Danh mục</h4>
                  <div className="flex flex-col items-center justify-center sm:flex-row gap-6">
                    <div className="h-56 w-56 relative shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={inventoryData.categories}
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={3}
                            dataKey="totalValue"
                            stroke="none"
                          >
                            {inventoryData.categories.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tổng vốn</span>
                        <span className="text-sm font-black leading-none text-[#0b1c30]">{formatCurrency(inventoryData.summary.totalValue).replace(" ₫", "")}</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-3">
                      {inventoryData.categories.map((item, index) => (
                        <div key={item.categoryName} className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                            <span className="text-xs font-bold text-slate-700 truncate max-w-28">{item.categoryName}</span>
                          </div>
                          <span className="text-xs font-black text-[#0b1c30]">{item.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-sm lg:col-span-7">
                  <div className="border-b border-slate-100 px-6 py-4">
                    <h4 className="font-['Plus_Jakarta_Sans',sans-serif] font-black text-[#0b1c30]">Nguyên vật liệu & Sản phẩm đọng vốn lớn nhất</h4>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-50 font-black text-slate-400 uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-3">Mặt hàng</th>
                          <th className="px-6 py-3">Mã SKU</th>
                          <th className="px-6 py-3 text-right">Số lượng tồn</th>
                          <th className="px-6 py-3 text-right">Vốn tồn kho</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-bold text-slate-600">
                        {[...inventoryData.products, ...inventoryData.rawMaterials]
                          .sort((a, b) => b.totalValue - a.totalValue)
                          .slice(0, 15)
                          .map(item => (
                            <tr key={item.sku} className="hover:bg-slate-50">
                              <td className="px-6 py-3 text-[#0b1c30] font-black truncate max-w-40">{item.name}</td>
                              <td className="px-6 py-3 text-slate-400 font-mono">{item.sku}</td>
                              <td className="px-6 py-3 text-right">{item.stockQuantity} {item.unit}</td>
                              <td className="px-6 py-3 text-right text-orange-600 font-black">{formatCurrency(item.totalValue)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 3: EMPLOYEE PERFORMANCE */}
          {activeTab === "employee" && (
            <>
              {/* Quick stats / Top ranking */}
              {employeeData.length > 0 && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm lg:col-span-5 flex flex-col justify-center">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
                        <Icon name="workspace_premium" className="text-3xl" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Thu ngân của kỳ</p>
                        <h4 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-black text-[#0b1c30]">{employeeData[0].fullName}</h4>
                        <p className="text-xs font-bold text-green-600 mt-1">Đạt doanh số: {formatCurrency(employeeData[0].totalRevenue)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm lg:col-span-7">
                    <h4 className="mb-4 font-['Plus_Jakarta_Sans',sans-serif] font-black text-[#0b1c30]">So sánh Doanh số đóng góp giữa các Nhân viên</h4>
                    <div className="h-60 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={employeeData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                          <XAxis type="number" stroke="#94a3b8" fontSize={10} fontWeight="bold" tickFormatter={value => formatCurrency(value as number).replace(" ₫", "")} />
                          <YAxis dataKey="fullName" type="category" stroke="#94a3b8" fontSize={11} fontWeight="bold" width={80} />
                          <Tooltip formatter={(value) => [formatCurrency(value as number), ""]} />
                          <Bar dataKey="totalRevenue" name="Doanh thu mang lại" fill="#f97316" radius={[0, 4, 4, 0]} barSize={15} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* Data Table */}
              <div className="overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-6 py-4">
                  <h4 className="font-['Plus_Jakarta_Sans',sans-serif] font-black text-[#0b1c30]">Hiệu suất làm việc & lập hóa đơn chi tiết</h4>
                </div>
                <table className="w-full text-left text-xs font-bold text-slate-600">
                  <thead className="bg-slate-50 font-black text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Nhân viên</th>
                      <th className="px-6 py-4 text-center">Số ca làm (Shift)</th>
                      <th className="px-6 py-4 text-center">Hóa đơn đã xuất</th>
                      <th className="px-6 py-4 text-right">Doanh thu đem lại</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {employeeData.length > 0 ? (
                      employeeData.map(emp => (
                        <tr key={emp.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-[#0b1c30] font-black">{emp.fullName}</td>
                          <td className="px-6 py-4 text-center text-slate-500">{emp.shiftsCount} ca</td>
                          <td className="px-6 py-4 text-center text-slate-500">{emp.totalOrders} đơn</td>
                          <td className="px-6 py-4 text-right text-[#0b1c30] font-black">{formatCurrency(emp.totalRevenue)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-slate-400 font-bold">Không có dữ liệu nhân viên trong khoảng thời gian này</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* TAB 4: GROWTH COMPARISON */}
          {activeTab === "comparison" && comparisonData && (
            <>
              {/* Comparison totals */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <article className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Doanh số kỳ này</p>
                  <h3 className="mt-2 text-2xl font-black text-[#f97316]">{formatCurrency(comparisonData.currentTotal)}</h3>
                  <p className="mt-2 text-[11px] text-slate-400 font-bold">Trong khoảng {startDate} đến {endDate}</p>
                </article>
                <article className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Doanh số kỳ trước</p>
                  <h3 className="mt-2 text-2xl font-black text-slate-700">{formatCurrency(comparisonData.previousTotal)}</h3>
                  <p className="mt-2 text-[11px] text-slate-400 font-bold">Chu kỳ trước cùng số lượng ngày</p>
                </article>
                <article className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Tỷ lệ Tăng trưởng</p>
                  <h3 className={`mt-2 text-2xl font-black ${comparisonData.growthPercentage >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {comparisonData.growthPercentage >= 0 ? "+" : ""}{comparisonData.growthPercentage}%
                  </h3>
                  <div className="mt-2 flex items-center gap-1 text-[11px] font-bold">
                    <Icon name={comparisonData.growthPercentage >= 0 ? "trending_up" : "trending_down"} className={comparisonData.growthPercentage >= 0 ? "text-green-600" : "text-red-600"} />
                    <span className={comparisonData.growthPercentage >= 0 ? "text-green-600" : "text-red-600"}>So với cùng kỳ trước</span>
                  </div>
                </article>
              </div>

              {/* Comparison Trend Chart */}
              <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
                <h4 className="mb-4 font-['Plus_Jakarta_Sans',sans-serif] font-black text-[#0b1c30]">So sánh Doanh số chu kỳ Hiện tại vs Kỳ trước</h4>
                <div className="h-96 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={comparisonData.trend}>
                      <defs>
                        <linearGradient id="colorCur" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorPrev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} fontWeight="bold" />
                      <YAxis stroke="#94a3b8" fontSize={11} fontWeight="bold" tickFormatter={value => formatCurrency(value as number).replace(" ₫", "")} />
                      <Tooltip formatter={(value) => [formatCurrency(value as number), ""]} />
                      <Legend />
                      <Area type="monotone" dataKey="currentPeriodValue" name="Kỳ này" stroke="#f97316" fillOpacity={1} fill="url(#colorCur)" strokeWidth={2.5} />
                      <Area type="monotone" dataKey="previousPeriodValue" name="Kỳ trước" stroke="#3b82f6" fillOpacity={1} fill="url(#colorPrev)" strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {/* TAB 5: CUSTOMER RETENTION */}
          {activeTab === "customer" && (
            <div className="overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-4">
                <h4 className="font-['Plus_Jakarta_Sans',sans-serif] font-black text-[#0b1c30]">Khách hàng Thân thiết & Thống kê Chi tiêu</h4>
              </div>
              <table className="w-full text-left text-xs font-bold text-slate-600">
                <thead className="bg-slate-50 font-black text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Khách hàng</th>
                    <th className="px-6 py-4">Số điện thoại</th>
                    <th className="px-6 py-4 text-center">Số hóa đơn đã mua</th>
                    <th className="px-6 py-4 text-right">Đơn hàng trung bình (AOV)</th>
                    <th className="px-6 py-4 text-center">Lần mua cuối cùng</th>
                    <th className="px-6 py-4 text-right">Tổng chi tiêu (kỳ này)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customerData.length > 0 ? (
                    customerData.map(cus => (
                      <tr key={cus.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-[#0b1c30] font-black">{cus.fullName}</td>
                        <td className="px-6 py-4 text-slate-400 font-mono">{cus.phone}</td>
                        <td className="px-6 py-4 text-center text-slate-500">{cus.totalOrders} đơn</td>
                        <td className="px-6 py-4 text-right text-slate-700">{formatCurrency(cus.averageOrderValue)}</td>
                        <td className="px-6 py-4 text-center text-slate-500 font-normal">
                          {cus.lastOrderAt ? new Date(cus.lastOrderAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : "Chưa mua"}
                        </td>
                        <td className="px-6 py-4 text-right text-[#0b1c30] font-black">{formatCurrency(cus.totalRevenue)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-400 font-bold">Không có khách hàng mua hàng trong khoảng thời gian này</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
