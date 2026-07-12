import { useEffect, useState } from "react";
import {
  cancelOrder,
  getOrderDetail,
  getOrders,
  type OrderDetail,
  type OrderListItem,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
} from "../../api/order.api";
import { fetchUsers, type User } from "../../api/users.api";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";
import { FilterBar } from "../../components/common/FilterBar";
import { createAuditLog } from "../../api/audit-log.api";

type StatusFilter = OrderStatus | "all";
type CancelModalState = "closed" | "open";

type StoredAuthUser = {
  id: string;
  fullName: string;
  email: string;
  roleId: string;
  roleName: string;
};

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
});

const orderStatusLabels: Record<OrderStatus, string> = {
  completed: "Hoàn tất",
  cancelled: "Đã hủy",
  refunded: "Đã hoàn tiền",
};

const orderStatusClasses: Record<OrderStatus, string> = {
  completed: "bg-green-50 text-green-600",
  cancelled: "bg-red-50 text-red-600",
  refunded: "bg-amber-50 text-amber-600",
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "Tiền mặt",
  qr: "QR",
};

const paymentStatusLabels: Record<PaymentStatus, string> = {
  pending: "Chờ thanh toán",
  paid: "Đã thanh toán",
  failed: "Thất bại",
  refunded: "Đã hoàn tiền",
};

const cancelReasonSuggestions = [
  "Khách đổi món",
  "Nhân viên nhập nhầm",
  "Lỗi thanh toán",
];

function formatCurrency(value: number) {
  return currencyFormatter.format(value).replace("₫", "đ");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function shortOrderId(id: string) {
  return `#HD-${id.slice(0, 8)}`;
}

function getCurrentUser() {
  const rawUser = localStorage.getItem("auth_user");

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser) as StoredAuthUser;
  } catch {
    return null;
  }
}

function canManageInvoices(user: StoredAuthUser | null) {
  return ["ADMIN", "MANAGER"].includes(user?.roleName?.trim().toUpperCase() || "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getPrimaryPayment(order: OrderDetail) {
  return order.payments[0] ?? null;
}

function buildInvoiceReceiptHtml(order: OrderDetail) {
  const orderCode = shortOrderId(order.id);
  const payment = getPrimaryPayment(order);
  const paymentLabel = payment ? paymentMethodLabels[payment.paymentMethod] : "Chưa có";
  const paymentStatus = payment ? paymentStatusLabels[payment.paymentStatus] : "Chưa thanh toán";
  const detailRows = order.details
    .map(
      (detail) => `
        <tr>
          <td>
            <strong>${escapeHtml(detail.productName)}</strong>
            <span>${formatCurrency(detail.unitPrice)}</span>
          </td>
          <td class="center">${detail.quantity}</td>
          <td class="right">${formatCurrency(detail.lineTotal)}</td>
        </tr>
      `
    )
    .join("");

  return `
    <!doctype html>
    <html lang="vi">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(orderCode)}</title>
        <style>
          @page { size: A5 portrait; margin: 8mm; }
          * { box-sizing: border-box; }
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #0b1c30;
            font-family: Arial, sans-serif;
          }
          .receipt {
            width: 96mm;
            max-width: 100%;
            margin: 0 auto;
            background: #ffffff;
          }
          .brand { text-align: center; padding-bottom: 14px; }
          .logo {
            margin: 0 auto 8px;
            color: #0b1c30;
            font-size: 30px;
            line-height: 1;
            font-weight: 900;
          }
          h1 { margin: 0; font-size: 18px; letter-spacing: 0.04em; }
          p { margin: 0; }
          .muted { color: #64748b; }
          .section { border-top: 1px dashed #cbd5e1; padding: 13px 0; }
          .row {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 8px;
            font-size: 13px;
          }
          .row:last-child { margin-bottom: 0; }
          .label { color: #64748b; font-weight: 700; }
          .value { text-align: right; font-weight: 800; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th {
            padding: 9px 0;
            border-bottom: 1px dashed #cbd5e1;
            color: #64748b;
            font-size: 11px;
            text-transform: uppercase;
            text-align: left;
          }
          td {
            padding: 10px 0;
            border-bottom: 1px solid #e2e8f0;
            vertical-align: top;
          }
          td strong { display: block; font-weight: 800; }
          td span { display: block; margin-top: 3px; color: #64748b; font-size: 12px; }
          .center { text-align: center; }
          .right { text-align: right; }
          .total { font-size: 18px; font-weight: 900; text-transform: uppercase; }
          .primary { color: #f97316; }
          .badge {
            display: inline-block;
            border-radius: 999px;
            background: #fff7ed;
            color: #f97316;
            padding: 5px 10px;
            font-size: 12px;
            font-weight: 800;
          }
          .thanks {
            border-top: 1px dashed #cbd5e1;
            padding-top: 16px;
            text-align: center;
            font-weight: 800;
          }
          .footer { margin-top: 8px; text-align: center; color: #94a3b8; font-size: 12px; }
        </style>
      </head>
      <body>
        <main class="receipt">
          <section class="brand">
            <div class="logo">⚡</div>
            <h1>QUICKSERVE POS</h1>
            <p class="muted">Hotline: 1900 8888</p>
          </section>

          <section class="section">
            <div class="row"><span class="label">Số HĐ:</span><span class="value">${escapeHtml(orderCode)}</span></div>
            <div class="row"><span class="label">Ngày:</span><span class="value">${escapeHtml(formatDateTime(order.createdAt))}</span></div>
            <div class="row"><span class="label">Thu ngân:</span><span class="value">${escapeHtml(order.createdByName || "Không rõ")}</span></div>
            <div class="row"><span class="label">Khách hàng:</span><span class="value">${escapeHtml(order.customerName)}</span></div>
          </section>

          <section>
            <table>
              <thead>
                <tr><th>Món</th><th class="center">SL</th><th class="right">Thành tiền</th></tr>
              </thead>
              <tbody>${detailRows}</tbody>
            </table>
          </section>

          <section class="section">
            <div class="row"><span class="muted">Tạm tính:</span><span class="value">${formatCurrency(order.totalAmount)}</span></div>
            <div class="row"><span class="muted">Giảm giá:</span><span class="value">${formatCurrency(order.discountAmount)}</span></div>
            <div class="row total"><span>Tổng cộng:</span><span class="primary">${formatCurrency(order.finalAmount)}</span></div>
          </section>

          <section class="section">
            <div class="row"><span class="label primary">Phương thức:</span><span class="value">${escapeHtml(paymentLabel)}</span></div>
            <div class="row"><span class="label">Trạng thái:</span><span class="value">${escapeHtml(paymentStatus)}</span></div>
          </section>

          <section class="thanks">
            <p>Cảm ơn Quý khách!</p>
            <p class="footer">Hẹn gặp lại quý khách lần sau</p>
            <p class="footer">Powered by POS System</p>
          </section>
        </main>
      </body>
    </html>
  `;
}

function printInvoiceReceipt(order: OrderDetail) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";

  document.body.appendChild(iframe);

  const iframeDocument = iframe.contentDocument;

  if (!iframeDocument) {
    document.body.removeChild(iframe);
    return;
  }

  iframeDocument.open();
  iframeDocument.write(buildInvoiceReceiptHtml(order));
  iframeDocument.close();

  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();

    window.setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  };
}

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${orderStatusClasses[status]}`}>
      {orderStatusLabels[status]}
    </span>
  );
}

function CancelOrderModal({
  isCancelling,
  onClose,
  onConfirm,
  reason,
  setReason,
}: {
  isCancelling: boolean;
  onClose: () => void;
  onConfirm: () => void;
  reason: string;
  setReason: (reason: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1c30]/45 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-red-600">Thao tác nguy hiểm</p>
            <h3 className="mt-1 font-['Outfit',sans-serif] text-2xl font-extrabold text-[#0b1c30]">
              Hủy hóa đơn
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Vui lòng nhập lý do hủy để quản lý dễ kiểm tra lại lịch sử thao tác.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {cancelReasonSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setReason(suggestion)}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Ví dụ: Nhân viên nhập nhầm món cho khách..."
          rows={4}
          className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none transition-all focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100"
        />

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Quay lại
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isCancelling || !reason.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-100 transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Icon name="cancel" />
            {isCancelling ? "Đang hủy..." : "Xác nhận hủy"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InvoiceDetailPanel({
  canCancel,
  isCancelling,
  onCancelClick,
  onPrint,
  order,
}: {
  canCancel: boolean;
  isCancelling: boolean;
  onCancelClick: () => void;
  onPrint: () => void;
  order: OrderDetail | null;
}) {
  if (!order) {
    return (
      <aside className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
          <Icon name="receipt_long" />
        </div>
        <h3 className="font-['Outfit',sans-serif] text-lg font-extrabold text-[#0b1c30]">
          Chọn một hóa đơn
        </h3>
        <p className="mt-2 text-sm text-slate-500">Chi tiết món bán và thanh toán sẽ hiển thị tại đây.</p>
      </aside>
    );
  }

  return (
    <aside className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#f97316]">Chi tiết hóa đơn</p>
            <h3 className="mt-1 font-['Outfit',sans-serif] text-xl font-extrabold text-[#0b1c30]">
              {shortOrderId(order.id)}
            </h3>
            <p className="mt-1 text-xs text-slate-400">{formatDateTime(order.createdAt)}</p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>

        <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <Icon name="person" className="text-[18px]" />
            <span>Thu ngân: </span>
            <strong className="text-[#0b1c30]">{order.createdByName || "Không rõ"}</strong>
          </div>
          <div className="mt-2 flex items-center gap-2 text-slate-500">
            <Icon name="group" className="text-[18px]" />
            <span>Khách hàng: </span>
            <strong className="text-[#0b1c30]">{order.customerName}</strong>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-[#0b1c30] transition-colors hover:bg-slate-50"
          >
            <Icon name="print" />
            In lại hóa đơn
          </button>
          <button
            type="button"
            onClick={onCancelClick}
            disabled={!canCancel || isCancelling}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="cancel" />
            Hủy hóa đơn
          </button>
        </div>
      </div>

      <div className="p-6">
        <h4 className="mb-3 text-sm font-extrabold text-[#0b1c30]">Món đã bán</h4>
        <div className="space-y-3">
          {order.details.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4">
              <div>
                <p className="font-bold text-[#0b1c30]">{item.productName}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {item.quantity} x {formatCurrency(item.unitPrice)}
                </p>
              </div>
              <p className="font-extrabold text-[#0b1c30]">{formatCurrency(item.lineTotal)}</p>
            </div>
          ))}
        </div>

        <h4 className="mt-6 mb-3 text-sm font-extrabold text-[#0b1c30]">Thanh toán</h4>
        <div className="space-y-3">
          {order.payments.map((payment) => (
            <div key={payment.id} className="rounded-2xl bg-green-50 p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold text-green-700">{paymentMethodLabels[payment.paymentMethod]}</p>
                <p className="font-extrabold text-green-700">{formatCurrency(payment.amount)}</p>
              </div>
              <p className="mt-1 text-xs font-semibold text-green-600">
                {paymentStatusLabels[payment.paymentStatus]}
                {payment.paidAt ? ` · ${formatDateTime(payment.paidAt)}` : ""}
              </p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function InvoicePage() {
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelModal, setCancelModal] = useState<CancelModalState>("closed");
  const [cancelReason, setCancelReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [createdBy, setCreatedBy] = useState<string>("all");
  const currentUser = getCurrentUser();
  const canManageInvoiceActions = canManageInvoices(currentUser);
  const canCancelSelectedOrder = canManageInvoiceActions && selectedOrder?.status === "completed";

  useEffect(() => {
    let isMounted = true;

    async function loadOrders() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await getOrders({
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          search,
          status: status === "all" ? undefined : status,
          createdBy: createdBy === "all" ? undefined : createdBy,
        });

        if (!isMounted) {
          return;
        }

        setOrders(response.data);
        setSelectedOrderId((currentId) => {
          if (currentId && response.data.some((order) => order.id === currentId)) {
            return currentId;
          }

          return response.data[0]?.id ?? null;
        });
      } catch (requestError) {
        if (!isMounted) {
          return;
        }

        setError(requestError instanceof Error ? requestError.message : "Không tải được danh sách hóa đơn");
        setOrders([]);
        setSelectedOrder(null);
        setSelectedOrderId(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    const timeoutId = window.setTimeout(loadOrders, 250);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [dateFrom, dateTo, search, status, createdBy]);

  useEffect(() => {
    let isMounted = true;
    if (canManageInvoiceActions) {
      fetchUsers()
        .then((data) => {
          if (isMounted) setUsers(data);
        })
        .catch(() => {
          // ignore error
        });
    }
    return () => {
      isMounted = false;
    };
  }, [canManageInvoiceActions]);

  useEffect(() => {
    let isMounted = true;

    async function loadOrderDetail() {
      if (!selectedOrderId) {
        setSelectedOrder(null);
        return;
      }

      setIsDetailLoading(true);

      try {
        const response = await getOrderDetail(selectedOrderId);

        if (isMounted) {
          setSelectedOrder(response.data);
        }
      } catch (requestError) {
        if (isMounted) {
          setError(requestError instanceof Error ? requestError.message : "Không tải được chi tiết hóa đơn");
          setSelectedOrder(null);
        }
      } finally {
        if (isMounted) {
          setIsDetailLoading(false);
        }
      }
    }

    void loadOrderDetail();

    return () => {
      isMounted = false;
    };
  }, [selectedOrderId]);

  function openCancelModal() {
    if (!canCancelSelectedOrder) {
      return;
    }

    setCancelReason("");
    setCancelModal("open");
  }

  async function handleCancelOrder() {
    if (!selectedOrder || !canCancelSelectedOrder || !cancelReason.trim()) {
      return;
    }

    setIsCancelling(true);
    setError(null);

    try {
      const response = await cancelOrder(selectedOrder.id, {
        reason: cancelReason.trim(),
      });
      setSelectedOrder(response.data);
      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === response.data.id
            ? {
                ...order,
                status: response.data.status,
                paymentStatus: response.data.paymentStatus,
                updatedAt: response.data.updatedAt,
              }
            : order
        )
      );
      setCancelModal("closed");
      setCancelReason("");
      window.dispatchEvent(new Event("quickserve:notifications-refresh"));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không hủy được hóa đơn");
    } finally {
      setIsCancelling(false);
    }
  }

  async function handlePrintOrder(orderId?: string) {
    const targetOrderId = orderId ?? selectedOrder?.id;

    if (!targetOrderId) {
      return;
    }

    setError(null);

    try {
      const orderToPrint =
        selectedOrder?.id === targetOrderId
          ? selectedOrder
          : (await getOrderDetail(targetOrderId)).data;

      setSelectedOrderId(orderToPrint.id);
      setSelectedOrder(orderToPrint);
      printInvoiceReceipt(orderToPrint);

      // Log IN_LAI_BILL action
      void createAuditLog({
        actionType: "IN_LAI_BILL",
        targetObject: shortOrderId(orderToPrint.id),
        description: `In lại hóa đơn Đơn ${shortOrderId(orderToPrint.id)}`,
      }).catch((err) => console.error("Lỗi ghi log in lại hóa đơn:", err));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không in được hóa đơn");
    }
  }

  return (
    <AdminLayout title="Hóa đơn" subtitle="Quản lý hóa đơn, lọc giao dịch và xử lý hủy theo quyền.">
      <section className="grid grid-cols-1 gap-6 2xl:grid-cols-[1fr_430px]">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <FilterBar
            search={search}
            onSearchChange={(val) => setSearch(val)}
            searchPlaceholder="Tìm theo mã HD, SĐT khách, nhân viên..."
            onClear={() => {
              setDateFrom("");
              setDateTo("");
              setSearch("");
              setStatus("all");
              setCreatedBy("all");
            }}
            className={`grid gap-3 border-b border-slate-200 p-4 lg:items-center ${
              canManageInvoiceActions
                ? "lg:grid-cols-[1fr_150px_150px_160px_170px_auto]"
                : "lg:grid-cols-[1fr_150px_150px_170px_auto]"
            }`}
          >
            <div className="relative">
              <span className="pointer-events-none absolute -top-2 left-3 bg-white px-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Từ ngày
              </span>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="w-full h-[46px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-[#0b1c30] outline-none transition-all focus:border-[#f97316] focus:bg-white focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute -top-2 left-3 bg-white px-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Đến ngày
              </span>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="w-full h-[46px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-[#0b1c30] outline-none transition-all focus:border-[#f97316] focus:bg-white focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
              className="h-[46px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-[#0b1c30] outline-none transition-all focus:border-[#f97316] focus:bg-white focus:ring-2 focus:ring-orange-100"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="completed">Hoàn tất</option>
              <option value="cancelled">Đã hủy</option>
              <option value="refunded">Đã hoàn tiền</option>
            </select>
            {canManageInvoiceActions && (
              <select
                value={createdBy}
                onChange={(event) => setCreatedBy(event.target.value)}
                className="h-[46px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-[#0b1c30] outline-none transition-all focus:border-[#f97316] focus:bg-white focus:ring-2 focus:ring-orange-100"
              >
                <option value="all">Tất cả nhân viên</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </select>
            )}
          </FilterBar>

          {error ? (
            <div className="border-b border-red-100 bg-red-50 px-6 py-3 text-sm font-semibold text-red-600">{error}</div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 font-semibold text-slate-500">
                <tr>
                  <th className="px-6 py-4">Mã hóa đơn</th>
                  <th className="px-6 py-4 text-right">Tổng tiền</th>
                  <th className="px-6 py-4">Thời gian</th>
                  <th className="px-6 py-4 text-center">Trạng thái</th>
                  <th className="px-6 py-4 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`cursor-pointer transition-colors hover:bg-orange-50/50 ${
                      selectedOrderId === order.id ? "bg-orange-50/70" : "bg-white"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <p className="font-extrabold text-[#f97316]">{shortOrderId(order.id)}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">{order.customerName}</p>
                    </td>
                    <td className="px-6 py-4 text-right font-extrabold text-[#0b1c30]">
                      {formatCurrency(order.finalAmount)}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-500">
                      {formatDateTime(order.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrderId(order.id);
                            void handlePrintOrder(order.id);
                          }}
                          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#0b1c30]"
                          title="In lại bill"
                        >
                          <Icon name="print" className="text-[20px]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrderId(order.id);
                            if (order.status === "completed" && canManageInvoiceActions) {
                              setCancelReason("");
                              setCancelModal("open");
                            }
                          }}
                          disabled={order.status !== "completed" || !canManageInvoiceActions}
                          className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
                          title="Hủy đơn"
                        >
                          <Icon name="delete" className="text-[20px]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!isLoading && orders.length === 0 ? (
            <div className="p-10 text-center text-sm font-semibold text-slate-400">Chưa có hóa đơn phù hợp.</div>
          ) : null}

          {isLoading ? (
            <div className="p-10 text-center text-sm font-semibold text-slate-400">Đang tải danh sách hóa đơn...</div>
          ) : null}
        </div>

        <div className="relative">
          {isDetailLoading ? (
            <div className="absolute inset-x-0 top-4 z-10 mx-auto w-fit rounded-full bg-white px-4 py-2 text-xs font-bold text-[#f97316] shadow">
              Đang tải chi tiết...
            </div>
          ) : null}
          <InvoiceDetailPanel
            canCancel={Boolean(canCancelSelectedOrder)}
            isCancelling={isCancelling}
            onCancelClick={openCancelModal}
            onPrint={() => void handlePrintOrder()}
            order={selectedOrder}
          />
        </div>
      </section>

      {cancelModal === "open" ? (
        <CancelOrderModal
          isCancelling={isCancelling}
          onClose={() => {
            if (!isCancelling) {
              setCancelModal("closed");
            }
          }}
          onConfirm={handleCancelOrder}
          reason={cancelReason}
          setReason={setCancelReason}
        />
      ) : null}
    </AdminLayout>
  );
}

export default InvoicePage;
