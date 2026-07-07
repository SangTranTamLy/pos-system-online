import { Icon } from "../../layouts/AdminLayout";

type PosPaymentMethod = "cash" | "qr" | "card";

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
  if (method === "card") return "Thẻ ngân hàng";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h3 className="font-['Outfit',sans-serif] text-2xl font-extrabold text-[#0b1c30]">
              Xác nhận thanh toán
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Đơn hàng sẽ được ghi nhận vào hệ thống.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Đóng"
          >
            <Icon name="close" className="text-2xl" />
          </button>
        </div>

        <div className="space-y-5 p-6">
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
                <span>Phuow</span>
                <span className="font-extrabold text-[#0b1c30]">
                  {getPaymentMethodLabel(paymentMethod)}
                </span>
              </div>
            </div>
          </section>

          <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4 text-sm font-semibold text-[#92400e]">
            <p>Nhấn "Xác nhận" để ghi nhận thanh toán và tạo hóa đơn bán hàng.</p>
          </div>

          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="rounded-xl border border-slate-200 bg-white px-6 py-3 font-extrabold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Kiểm tra lại
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isProcessing}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#0b1c30] px-6 py-3 font-extrabold text-white hover:bg-[#132a45] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="check_circle" />
              {paymentMethod === "qr"
                ? "Tiếp tục chuyển khoản"
                : isProcessing
                  ? "Đang xác nhận..."
                  : "Xác nhận đã nhận thanh toán"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
