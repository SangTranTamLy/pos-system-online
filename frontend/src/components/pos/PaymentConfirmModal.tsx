import { Icon } from "../../layouts/AdminLayout";

type PosPaymentMethod = "cash" | "qr";

type CartItem = {
  product: {
    id: string;
    name: string;
    salePrice: number;
  };
  quantity: number;
};

type PaymentConfirmModalProps = {
  cartItems: CartItem[];
  subtotal: number;
  discountAmount: number;
  finalAmount: number;
  paymentMethod: PosPaymentMethod;
  isProcessing: boolean;
  onConfirm: () => void;
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
  if (method === "qr") return "Chuyển khoản";
  return "Tiền mặt";
}

export default function PaymentConfirmModal({
  cartItems,
  subtotal,
  discountAmount,
  finalAmount,
  paymentMethod,
  isProcessing,
  onConfirm,
  onClose,
}: PaymentConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b p-5">
          <div>
            <p className="text-xs font-black uppercase text-[#f97316]">
              Đơn hàng mới
            </p>
            <h3 className="text-xl font-black text-[#0b1c30]">
              Xác nhận thanh toán
            </h3>
          </div>
          <button type="button" onClick={onClose} disabled={isProcessing}>
            <Icon name="close" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <p className="mb-4 text-sm font-semibold text-slate-600">
            Đơn hàng sẽ được ghi nhận vào hệ thống.
          </p>
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="mb-4 flex items-center gap-3 text-lg font-extrabold text-[#0b1c30]">
              <Icon name="receipt_long" />
              <span>Chi tiết đơn hàng</span>
            </div>
            <div className="divide-y divide-slate-200/80">
              {cartItems.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="font-extrabold text-[#0b1c30]">{item.product.name}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {item.quantity} x {formatCurrency(item.product.salePrice)}
                    </p>
                  </div>
                  <p className="shrink-0 font-extrabold text-[#0b1c30]">
                    {formatCurrency(item.product.salePrice * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="space-y-3">
              <div className="flex justify-between gap-4 text-sm text-slate-600">
                <span>Tam tinh</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between gap-4 text-sm text-slate-600">
                <span>Giam gia</span>
                <span>{formatCurrency(discountAmount)}</span>
              </div>
              <div className="flex justify-between gap-4 text-sm text-slate-600">
                <span>VAT 0%</span>
                <span>{formatCurrency(0)}</span>
              </div>
              <div className="flex justify-between gap-4 text-xl font-extrabold text-[#0b1c30]">
                <span>Tổng thanh toán</span>
                <span className="text-[#f97316]">{formatCurrency(finalAmount)}</span>
              </div>
              <div className="flex justify-between gap-4 text-sm text-slate-600">
                <span>Hình thức thanh toán</span>
                <span className="font-extrabold text-[#0b1c30]">
                  {getPaymentMethodLabel(paymentMethod)}
                </span>
              </div>
            </div>
          </section>

          <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4 text-sm font-semibold text-[#92400e]">
            <p>Nhấn "Xác nhận" để ghi nhận thanh toán và tạo hóa đơn bán hàng.</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="rounded-lg border px-5 py-2 font-bold text-slate-700"
          >
            Kiểm tra lại
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className="flex items-center gap-2 rounded-lg bg-[#f97316] px-5 py-2 font-bold text-white disabled:opacity-50"
          >
            {isProcessing && <Icon name="progress_activity" className="animate-spin text-base" />}
            {paymentMethod === "qr"
              ? "Tiếp tục chuyển khoản"
              : isProcessing
                ? "Đang xác nhận..."
                : "Xác nhận thanh toán"}
          </button>
        </div>
      </div>
    </div>
  );
}
