import type { EmployeeRevenue } from "../../types/report";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  })
    .format(value)
    .replace("₫", "đ");
}

export default function EmployeeRevenueTable({ data }: { data: EmployeeRevenue[] }) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 p-4">
        <h3 className="font-['Plus_Jakarta_Sans',sans-serif] font-bold text-[#0b1c30]">
          Doanh thu theo nhân viên
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 font-semibold text-slate-500">
            <tr>
              <th className="w-16 px-6 py-3 text-center">STT</th>
              <th className="px-6 py-3">Tên nhân viên</th>
              <th className="px-6 py-3 text-center">Số đơn hàng</th>
              <th className="px-6 py-3 text-right">Tổng doanh thu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {data.length > 0 ? (
              data.map((item, index) => (
                <tr key={item.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-6 py-4 text-center font-bold text-slate-400">{index + 1}</td>
                  <td className="px-6 py-4 font-semibold text-[#0b1c30]">{item.full_name}</td>
                  <td className="px-6 py-4 text-center">{item.total_orders}</td>
                  <td className="px-6 py-4 text-right font-extrabold text-[#f97316]">
                    {formatCurrency(item.total_revenue)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-6 py-6 text-center text-sm text-slate-400">
                  Chưa có dữ liệu
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
