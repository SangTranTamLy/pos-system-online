import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardRevenuePeriod } from "../../api/dashboard.api";

export type RevenuePoint = {
  sort: number;
  label: string;
  revenue: number;
};

type RevenueChartProps = {
  data: RevenuePoint[];
  period: DashboardRevenuePeriod;
  onPeriodChange: (period: DashboardRevenuePeriod) => void;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
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
  return period === "year" ? 0 : 2;
}

function isCurrentRevenuePoint(point: RevenuePoint, period: DashboardRevenuePeriod) {
  const now = new Date();
  const currentSort =
    period === "year" ? now.getMonth() + 1 : now.getDate();

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

export default function RevenueChart({
  data,
  period,
  onPeriodChange,
}: RevenueChartProps) {
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
            <option value="year">Nam</option>
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
