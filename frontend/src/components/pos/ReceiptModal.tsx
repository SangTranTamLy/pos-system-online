import type { PosOrderResult, PosPaymentMethod } from "../../api/pos.api";
import { Icon } from "../../layouts/AdminLayout";
import cashImage from "../../assets/tien.jpg";
import qrImage from "../../assets/qr.png";

type ReceiptModalProps = {
  order: PosOrderResult;
  onClose: () => void;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function getPaymentMethodLabel(method: PosPaymentMethod) {
  if (method === "qr") {
    return "Chuyển khoản";
  }

  return "Tiền mặt";
}

function getPaymentMethodImage(method: PosPaymentMethod) {
  if (method === "qr") {
    return qrImage;
  }

  return cashImage;
}

function getCurrentEmployeeName() {
  try {
    const storedUser = localStorage.getItem("auth_user");

    if (!storedUser) {
      return "Nhân viên";
    }

    const user = JSON.parse(storedUser) as { fullName?: string };
    return user.fullName?.trim() || "Nhân viên";
  } catch {
    return "Nhân viên";
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getPromotionDisplayName(order: PosOrderResult) {
  if (!order.appliedPromotion) return "Khuyến mãi";

  return `${order.appliedPromotion.name}${
    order.appliedPromotion.code ? ` (${order.appliedPromotion.code})` : ""
  }`;
}

function buildReceiptHtml(order: PosOrderResult, employeeName: string) {
  const orderCode = `#HD${order.id.slice(0, 10)}`;
  const createdAt = new Date().toLocaleString("vi-VN", { hour12: false });
  const paymentLabel = getPaymentMethodLabel(order.payment.paymentMethod);
  const promotionDisplayName = getPromotionDisplayName(order);
  const detailRows = order.details
    .map(
      (detail) => `
        <tr>
          <td>${escapeHtml(detail.productName)}</td>
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
        <title>${orderCode}</title>
        <style>
          @page {
            size: A5 portrait;
            margin: 8mm;
          }

          * {
            box-sizing: border-box;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #0b1c30;
            font-family: Inter, Arial, sans-serif;
          }

          .receipt {
            width: 96mm;
            max-width: 100%;
            margin: 0 auto;
            padding: 0;
            background: #ffffff;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .brand {
            text-align: center;
            padding-bottom: 16px;
          }

          .logo {
            width: 42px;
            height: 42px;
            margin: 0 auto 10px;
            border-radius: 999px;
            background: #f97316;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: 800;
          }

          h1 {
            margin: 0;
            font-size: 17px;
            letter-spacing: 0.04em;
          }

          p {
            margin: 0;
          }

          .muted {
            color: #64748b;
          }

          .section {
            border-top: 1px dashed #cbd5e1;
            padding: 14px 0;
          }

          .row {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 9px;
            font-size: 13px;
          }

          .row:last-child {
            margin-bottom: 0;
          }

          .label {
            color: #64748b;
            font-weight: 700;
          }

          .value {
            text-align: right;
            font-weight: 800;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }

          th {
            padding: 10px 0;
            border-bottom: 1px dashed #cbd5e1;
            color: #64748b;
            font-size: 11px;
            text-transform: uppercase;
            text-align: left;
          }

          td {
            padding: 11px 0;
            border-bottom: 1px solid #e2e8f0;
            font-weight: 700;
          }

          .center {
            text-align: center;
          }

          .right {
            text-align: right;
          }

          .total {
            font-size: 19px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .primary {
            color: #f97316;
          }

          .thanks {
            border-top: 1px dashed #cbd5e1;
            padding-top: 18px;
            text-align: center;
            font-weight: 800;
          }

          .footer {
            margin-top: 8px;
            text-align: center;
            color: #94a3b8;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <main class="receipt">
          <section class="brand">
            <div class="logo">⚡</div>
            <h1>POS STORE</h1>
            <p class="muted">Hotline: 1900 8888</p>
          </section>

          <section class="section">
            <div class="row">
              <span class="label">Số HĐ:</span>
              <span class="value">${orderCode}</span>
            </div>
            <div class="row">
              <span class="label">Ngày:</span>
              <span class="value">${createdAt}</span>
            </div>
            <div class="row">
              <span class="label">Nhân viên:</span>
              <span class="value">${escapeHtml(employeeName)}</span>
            </div>
            <div class="row">
              <span class="label">Khách hàng:</span>
              <span class="value">Khách lẻ</span>
            </div>
          </section>

          <section>
            <table>
              <thead>
                <tr>
                  <th>Mô tả</th>
                  <th class="center">SL</th>
                  <th class="right">Thành tiền</th>
                </tr>
              </thead>
              <tbody>${detailRows}</tbody>
            </table>
          </section>

          <section class="section">
            <div class="row">
              <span class="muted">Tạm tính:</span>
              <span class="value">${formatCurrency(order.totalAmount)}</span>
            </div>
            ${
              order.discountAmount > 0
                ? `<div class="row">
                    <span class="muted">${escapeHtml(promotionDisplayName)}:</span>
                    <span class="value">-${formatCurrency(order.discountAmount)}</span>
                  </div>`
                : ""
            }
            <div class="row total">
              <span>Tổng cộng:</span>
              <span class="primary">${formatCurrency(order.finalAmount)}</span>
            </div>
          </section>

          <section class="section">
            <div class="row">
              <span class="label primary">Phương thức:</span>
              <span class="value">${paymentLabel}</span>
            </div>
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

function printReceipt(order: PosOrderResult, employeeName: string) {
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
  iframeDocument.write(buildReceiptHtml(order, employeeName));
  iframeDocument.close();

  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();

    window.setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  };
}

function ReceiptPreview({ order, employeeName }: { order: PosOrderResult; employeeName: string }) {
  const promotionDisplayName = getPromotionDisplayName(order);

  return (
    <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f97316] text-white">
          <Icon name="bolt" filled className="text-3xl" />
        </div>
        <p className="font-['Outfit',sans-serif] text-lg font-extrabold tracking-wide text-[#0b1c30]">
          QuickServe POS  
        </p>
        <p className="mt-1 text-sm text-slate-500">Hotline: 1900 8888</p>
      </div>

      <div className="space-y-3 border-t border-dashed border-slate-300 pt-5 text-sm">
        <div className="flex justify-between gap-4">
          <span className="font-semibold text-slate-500">Số HĐ:</span>
          <span className="font-extrabold text-[#0b1c30]">#HD{order.id.slice(0, 10)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="font-semibold text-slate-500">Ngày:</span>
          <span className="font-semibold text-[#0b1c30]">
            {new Date().toLocaleString("vi-VN", { hour12: false })}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="font-semibold text-slate-500">Nhân viên:</span>
          <span className="font-semibold text-[#0b1c30]">{employeeName}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="font-semibold text-slate-500">Khách hàng:</span>
          <span className="font-semibold text-[#0b1c30]">Khách lẻ</span>
        </div>
      </div>

      <table className="mt-6 w-full text-sm">
        <thead className="border-b border-dashed border-slate-300 text-xs font-extrabold uppercase text-slate-500">
          <tr>
            <th className="py-3 text-left">Mô tả</th>
            <th className="py-3 text-center">SL</th>
            <th className="py-3 text-right">Thành tiền</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {order.details.map((detail) => (
            <tr key={detail.id}>
              <td className="py-4 font-semibold text-[#0b1c30]">{detail.productName}</td>
              <td className="py-4 text-center font-semibold text-slate-500">
                {detail.quantity}
              </td>
              <td className="py-4 text-right font-semibold text-[#0b1c30]">
                {formatCurrency(detail.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-3 border-t border-dashed border-slate-300 py-5 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Tạm tính:</span>
          <span className="font-semibold text-[#0b1c30]">{formatCurrency(order.totalAmount)}</span>
        </div>
        {order.discountAmount > 0 ? (
          <div className="flex justify-between gap-4">
            <span className="min-w-0 truncate text-slate-500">
              {promotionDisplayName}
            </span>
            <span className="font-semibold text-emerald-600">
              -{formatCurrency(order.discountAmount)}
            </span>
          </div>
        ) : null}
        <div className="flex justify-between text-xl font-extrabold">
          <span className="uppercase text-[#0b1c30]">Tổng cộng:</span>
          <span className="text-[#f97316]">{formatCurrency(order.finalAmount)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between border-y border-dashed border-slate-300 py-4 text-sm">
        <span className="font-extrabold uppercase text-[#f97316]">Phương thức:</span>
        <span className="flex items-center gap-2 font-semibold text-[#0b1c30]">
          <img
            src={getPaymentMethodImage(order.payment.paymentMethod)}
            alt={getPaymentMethodLabel(order.payment.paymentMethod)}
            className="h-7 w-7 rounded-md object-cover"
          />
          {getPaymentMethodLabel(order.payment.paymentMethod)}
        </span>
      </div>

      <div className="mt-6 text-center">
        <p className="font-['Outfit',sans-serif] font-extrabold text-[#0b1c30]">
          Cảm ơn Quý khách!
        </p>
        <p className="mt-2 text-sm text-slate-500">Hẹn gặp lại quý khách lần sau</p>
        <p className="mt-5 text-xs text-slate-300">Powered by POS System</p>
      </div>
    </div>
  );
}

function ReceiptModal({ order, onClose }: ReceiptModalProps) {
  const employeeName = getCurrentEmployeeName();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[rgba(11,28,48,0.72)] p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex h-20 items-center justify-between border-b border-slate-200 px-8">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100"
              aria-label="Quay lại"
            >
              <Icon name="arrow_back" className="text-xl" />
            </button>
            <h3 className="font-['Outfit',sans-serif] text-2xl font-extrabold text-[#0b1c30]">
              Thanh toán thành công
            </h3>
          </div>

          <div className="flex items-center gap-4">
            <span className="rounded-xl bg-green-50 px-4 py-2 text-sm font-extrabold text-green-600">
              Bill đã tạo
            </span>
            <button
              type="button"
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100"
              aria-label="Chia sẻ hóa đơn"
            >
              <Icon name="share" />
            </button>
          </div>
        </header>

        <div className="grid bg-[#f8f9ff] lg:grid-cols-[1fr_260px]">
          <section className="flex justify-center p-6 lg:p-8">
            <ReceiptPreview order={order} employeeName={employeeName} />
          </section>

          <aside className="flex flex-col justify-between border-t border-slate-200 bg-white p-6 lg:border-t-0 lg:border-l">
            <div>
              <p className="mb-4 text-xs font-extrabold uppercase tracking-widest text-slate-500">
                Thao tác
              </p>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => printReceipt(order, employeeName)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#f97316] px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-orange-100 transition-colors hover:bg-orange-600"
                >
                  <Icon name="print" className="text-lg" />
                  In hóa đơn
                </button>
                <button
                  type="button"
                  onClick={() => printReceipt(order, employeeName)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-[#0b1c30] shadow-sm transition-colors hover:bg-slate-50"
                >
                  <Icon name="picture_as_pdf" className="text-lg" />
                  Tải PDF
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="text-xs font-semibold text-slate-500">Mã đơn</p>
              <p className="mt-1 font-extrabold text-[#0b1c30]">#HD{order.id.slice(0, 10)}</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default ReceiptModal;
