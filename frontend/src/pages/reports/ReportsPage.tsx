import { useEffect, useState } from "react";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";
import { getFinancialReport } from "../../api/report.api";
import type { FinancialReport } from "../../types/report";
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

function exportToCSV<T extends object>(data: T[], headers: { key: string; label: string }[], filename: string) {
  const csvRows = [];
  csvRows.push(headers.map(h => `"${h.label.replace(/"/g, '""')}"`).join(","));
  for (const row of data) {
    const values = headers.map(h => {
      const val = (row as Record<string, unknown>)[h.key];
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

interface TooltipPayloadItem {
  name: string;
  value: number;
  stroke?: string;
  fill?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xl">
        <p className="text-[10px] font-black text-slate-400 uppercase mb-2">{label}</p>
        <div className="space-y-2">
          {payload.map((p) => (
            <div key={p.name} className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.stroke || p.fill }}></span>
                <span className="text-xs font-semibold text-slate-600">{p.name}:</span>
              </div>
              <span className="text-xs font-black text-[#0b1c30]">{formatCurrency(p.value)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);

  // Filters (Default to month / 30 days)
  const [preset, setPreset] = useState("month"); // 'week', 'month', 'quarter'
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Data State
  const [financialData, setFinancialData] = useState<FinancialReport | null>(null);

  const handlePresetSelect = (pId: string) => {
    setPreset(pId);
    setLoading(true);
    setShowPresetDropdown(false);

    const end = new Date();
    const start = new Date();

    if (pId === "week") {
      start.setDate(end.getDate() - 7);
    } else if (pId === "month") {
      start.setDate(end.getDate() - 30);
    } else if (pId === "quarter") {
      start.setDate(end.getDate() - 90);
    }

    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  };

  // Load data
  const loadReportData = (silent = false) => {
    setTimeout(async () => {
      if (!silent) {
        setLoading(true);
      }
      setError("");
      try {
        const res = await getFinancialReport(startDate, endDate);
        setFinancialData(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra khi tải báo cáo");
      } finally {
        setLoading(false);
      }
    }, 0);
  };

  // Real-time polling logic
  useEffect(() => {
    void loadReportData(false);

    // Poll every 5 seconds for real-time dashboard updates
    const interval = setInterval(() => {
      void loadReportData(true);
    }, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const handleExport = () => {
    if (financialData) {
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
    }
  };

  const getPresetButtonLabel = () => {
    if (preset === "week") return "Xem 7 ngày gần đây";
    if (preset === "month") return "Xem 30 ngày gần đây";
    if (preset === "quarter") return "Xem 90 ngày gần đây";
    return "Xem 30 ngày gần đây";
  };

  const getRankBadgeClass = (index: number) => {
    if (index === 0) return "bg-orange-50 border border-orange-200 text-[#f97316]";
    if (index === 1) return "bg-blue-50 border border-blue-200 text-[#3b82f6]";
    if (index === 2) return "bg-amber-50 border border-amber-200 text-[#f59e0b]";
    return "bg-slate-50 border border-slate-200 text-slate-500";
  };

  const getProgressBarClass = (index: number) => {
    if (index % 2 === 0) return "bg-[#f97316]"; // Orange
    return "bg-[#3b82f6]"; // Blue
  };

  return (
    <AdminLayout 
      title="Thống kê doanh thu" 
      subtitle={
        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-medium">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>Báo cáo tài chính doanh nghiệp: Doanh thu, Giá vốn hàng bán (COGS), Lợi nhuận và Lợi nhuận gộp</span>
        </div>
      }
      headerContent={
        <div className="flex items-center gap-3">
          {/* Calendar Select Preset Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowPresetDropdown(!showPresetDropdown)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-[#0b1c30] shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
            >
              <Icon name="calendar_today" className="text-sm text-slate-400" />
              <span>{getPresetButtonLabel()}</span>
              <Icon name="expand_more" className="text-sm text-slate-400" />
            </button>

            {showPresetDropdown && (
              <div className="absolute right-0 mt-2 z-30 w-56 rounded-2xl border border-slate-100 bg-white p-2 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
                {[
                  { id: "week", label: "Xem 7 ngày gần đây" },
                  { id: "month", label: "Xem 30 ngày gần đây" },
                  { id: "quarter", label: "Xem 90 ngày gần đây" }
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handlePresetSelect(p.id)}
                    className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-xs font-bold transition-all cursor-pointer ${
                      preset === p.id 
                        ? "bg-orange-50 text-[#f97316]" 
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-[#10b981] hover:bg-[#059669] text-white px-4 py-2.5 text-xs font-bold transition-all shadow-md shadow-emerald-100 cursor-pointer disabled:opacity-50"
          >
            <Icon name="download" className="text-sm" />
            <span>Xuất Excel</span>
          </button>
        </div>
      }
    >
      {error && (
        <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-600">
          {error}
        </div>
      )}

      {loading && !financialData ? (
        <div className="flex h-[450px] items-center justify-center rounded-3xl border border-slate-200 bg-white">
          <div className="flex flex-col items-center gap-3">
            <Icon name="autorenew" className="animate-spin text-4xl text-[#f97316]" />
            <p className="text-sm font-bold text-slate-500">Đang tải báo cáo hệ thống...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {financialData && (
            <>
              {/* 4 Stats Cards */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {/* 1. DOANH THU */}
                <article className="flex justify-between items-center rounded-3xl border border-slate-200/50 bg-white p-6 shadow-sm">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">DOANH THU (REVENUE)</p>
                    <h3 className="mt-2 text-2xl font-black text-[#0b1c30]">{formatCurrency(financialData.summary.totalRevenue)}</h3>
                    <div className="mt-2 flex items-center gap-0.5 text-[10px] text-emerald-600 font-bold">
                      <Icon name="trending_up" className="text-xs" />
                      <span>Doanh thu phát sinh trong {preset === "week" ? "7 ngày" : preset === "quarter" ? "90 ngày" : "30 ngày"}</span>
                    </div>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[#10b981]">
                    <Icon name="attach_money" className="text-lg" filled />
                  </div>
                </article>

                {/* 2. GIÁ VỐN HÀNG BÁN */}
                <article className="flex justify-between items-center rounded-3xl border border-slate-200/50 bg-white p-6 shadow-sm">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">GIÁ VỐN HÀNG BÁN (COGS)</p>
                    <h3 className="mt-2 text-2xl font-black text-[#0b1c30]">{formatCurrency(financialData.summary.totalCOGS)}</h3>
                    <div className="mt-2 text-[10px] text-slate-400 font-bold">
                      <span>Tổng chi phí nhập hàng đã bán</span>
                    </div>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500">
                    <Icon name="receipt_long" className="text-lg" filled />
                  </div>
                </article>

                {/* 3. LỢI NHUẬN GỘP */}
                <article className="flex justify-between items-center rounded-3xl border border-slate-200/50 bg-white p-6 shadow-sm">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">LỢI NHUẬN GỘP (PROFIT)</p>
                    <h3 className="mt-2 text-2xl font-black text-[#0b1c30]">{formatCurrency(financialData.summary.grossProfit)}</h3>
                    <div className="mt-2 flex items-center gap-0.5 text-[10px] text-emerald-600 font-bold">
                      <Icon name="trending_up" className="text-xs" />
                      <span>Tỷ suất lợi nhuận gộp: {financialData.summary.grossProfitMargin.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[#10b981]">
                    <Icon name="trending_up" className="text-lg" />
                  </div>
                </article>

                {/* 4. TỔNG SỐ ĐƠN HÀNG */}
                <article className="flex justify-between items-center rounded-3xl border border-slate-200/50 bg-white p-6 shadow-sm">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">TỔNG SỐ ĐƠN HÀNG</p>
                    <h3 className="mt-2 text-2xl font-black text-[#0b1c30]">{financialData.summary.totalOrders} đơn</h3>
                    <div className="mt-2 text-[10px] text-slate-400 font-bold">
                      <span>Giá trị TB/đơn (AOV): {formatCurrency(financialData.summary.averageOrderValue)}</span>
                    </div>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[#f97316]">
                    <Icon name="shopping_cart" className="text-lg" filled />
                  </div>
                </article>
              </div>

              {/* Lower Section Grid */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* FINANCIAL TREND CHART (Left Column - 8 Cols) */}
                <div className="rounded-3xl border border-slate-200/50 bg-white p-6 shadow-sm lg:col-span-8 flex flex-col justify-between">
                  <div>
                    <h4 className="font-['Plus_Jakarta_Sans',sans-serif] font-black text-sm text-[#0b1c30] uppercase tracking-wider">XU HƯỚNG TÀI CHÍNH DOANH NGHIỆP</h4>
                    <p className="text-[11px] text-slate-400 mt-1 mb-4">Biểu đồ so sánh trực quan giữa Doanh thu, Chi phí vốn (COGS) và Lợi nhuận ròng hàng ngày</p>
                  </div>
                  
                  {/* Legend Indicator */}
                  <div className="flex items-center gap-6 justify-center text-xs font-bold text-slate-500 mb-6">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#3b82f6]"></span>
                      <span>Doanh thu</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444] border-2 border-white"></span>
                      <span>Giá vốn (COGS)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#10b981]"></span>
                      <span>Lợi nhuận gộp</span>
                    </div>
                  </div>

                  <div className="h-80 w-full">
                    {financialData.trend.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={financialData.trend} margin={{ left: -10, right: 10 }}>
                          <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorCogs" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                          <YAxis stroke="#94a3b8" fontSize={10} fontWeight="bold" tickFormatter={value => formatCurrency(value as number).replace(" ₫", "").replace(" đ", "")} />
                          <Tooltip content={<CustomTooltip />} />
                          <Area type="monotone" dataKey="revenue" name="Doanh thu" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                          <Area type="monotone" dataKey="cogs" name="Giá vốn (COGS)" stroke="#ef4444" strokeWidth={2} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorCogs)" />
                          <Area type="monotone" dataKey="profit" name="Lợi nhuận gộp" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorProfit)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs font-bold text-slate-400">
                        Chưa có dữ liệu xu hướng doanh số
                      </div>
                    )}
                  </div>
                </div>

                {/* TOP PRODUCTS PANEL (Right Column - 4 Cols) */}
                <div className="rounded-3xl border border-slate-200/50 bg-white p-6 shadow-sm lg:col-span-4 flex flex-col justify-between">
                  <div>
                    <h4 className="font-['Plus_Jakarta_Sans',sans-serif] font-black text-sm text-[#0b1c30] uppercase tracking-wider">TOP SẢN PHẨM BÁN CHẠY</h4>
                    <p className="text-[11px] text-slate-400 mt-1 mb-5">Các sản phẩm đem lại sản lượng cao trong {preset === "week" ? "7 ngày" : preset === "quarter" ? "90 ngày" : "30 ngày"}</p>
                  </div>

                  <div className="flex-1 space-y-4 overflow-y-auto max-h-[320px] pr-1">
                    {financialData.topProducts.length > 0 ? (
                      financialData.topProducts.map((item, index) => {
                        const maxQty = Math.max(...financialData.topProducts.map(p => p.soldQuantity), 1);
                        const pct = (item.soldQuantity / maxQty) * 100;
                        
                        return (
                          <div key={item.name} className="flex gap-4 items-center bg-slate-50/50 hover:bg-slate-50 p-3 rounded-2xl border border-slate-100 transition-all">
                            <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-black text-xs ${getRankBadgeClass(index)}`}>
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-baseline mb-1">
                                <h5 className="font-extrabold text-xs text-[#0b1c30] truncate pr-4">{item.name}</h5>
                                <span className="text-xs font-black text-[#0b1c30] shrink-0">{item.soldQuantity} món</span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-400 mb-2">Doanh thu: {formatCurrency(item.revenue)}</p>
                              <div className="w-full bg-slate-200/60 rounded-full h-1.5 overflow-hidden">
                                <div className={`h-full rounded-full ${getProgressBarClass(index)}`} style={{ width: `${pct}%` }}></div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex h-full min-h-[220px] items-center justify-center text-center text-slate-400">
                        <div className="space-y-2">
                          <Icon name="sentiment_dissatisfied" className="text-4xl" />
                          <p className="text-xs font-bold">Không có dữ liệu bán hàng kỳ này</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
