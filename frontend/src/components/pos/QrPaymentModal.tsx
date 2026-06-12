import { Icon } from "../../layouts/AdminLayout";
import qrFallback from "../../assets/qrtt.jpg";

const MOMO_WALLET_NAME = "Momo";
const MOMO_ACCOUNT_NO = "PSP2605210000000331";
const MOMO_ACCOUNT_NAME = "CHAU THANH SANG";

const MOMO_BANK_NAME = "Ví Momo";

type QrPaymentModalProps = {
  amount: number;
  cartItems: Array<{
    product: {
      id: string;
      name: string;
      salePrice: number;
    };
    quantity: number;
  }>;
  subtotal: number;
  discountAmount: number;
  pointsValue: number;
  transferReference: string;
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

function buildQrImageUrl() {
  return qrFallback;
}

function QrPaymentModal({
  amount,
  cartItems,
  subtotal,
  discountAmount,
  pointsValue,
  transferReference,
  isProcessing,
  onConfirm,
  onClose,
}: QrPaymentModalProps) {
  const copyText = (value: string) => {
    void navigator.clipboard?.writeText(value);
  };

  const transferContent = `${transferReference} | ${cartItems
    .map((item) => `${item.product.name} x${item.quantity}`)
    .join(", ")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-extrabold text-[#0b1c30]">
              Thanh toán Momo
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Sử dụng mã QR tĩnh và nội dung chuyển khoản tự động.
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

        <div className="space-y-5 px-6 pb-6">
          <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="mx-auto w-fit rounded-xl border border-slate-200 bg-white p-3">
                <img
                  src={buildQrImageUrl()}
                  alt="Mã QR thanh toán"
                  className="h-72 w-72 rounded-lg object-contain"
                />
              </div>
              <div className="mx-auto mt-4 w-fit rounded-full border border-[#26a69a] bg-white px-4 py-1 text-xs font-extrabold uppercase text-[#00796b]">
                {MOMO_WALLET_NAME}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="space-y-5">
              <div className="border-b border-slate-100 pb-4">
                <p className="text-xs font-extrabold uppercase text-slate-400">
                  Ví nhận tiền
                </p>
                <p className="mt-2 text-lg font-extrabold text-[#0b1c30]">
                  {MOMO_BANK_NAME}
                </p>
              </div>

              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-extrabold uppercase text-slate-400">
                      Số tài khoản Momo
                    </p>
                    <p className="mt-2 text-lg font-extrabold text-[#0b1c30]">
                      {MOMO_ACCOUNT_NO}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(MOMO_ACCOUNT_NO)}
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-50 hover:text-[#f97316]"
                    aria-label="Sao chép số tài khoản"
                  >
                    <Icon name="content_copy" />
                  </button>
                </div>
              </div>

              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-extrabold uppercase text-slate-400">
                      Tên người nhận
                    </p>
                    <p className="mt-2 text-lg font-extrabold text-[#0b1c30]">
                      {MOMO_ACCOUNT_NAME}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(MOMO_ACCOUNT_NAME)}
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-50 hover:text-[#f97316]"
                    aria-label="Sao chép chủ tài khoản"
                  >
                    <Icon name="content_copy" />
                  </button>
                </div>
              </div>

              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-extrabold uppercase text-slate-400">
                      Số tiền thanh toán
                    </p>
                    <p className="mt-2 text-2xl font-extrabold text-[#f97316]">
                      {formatCurrency(amount)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(String(Math.round(amount)))}
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-50 hover:text-[#f97316]"
                    aria-label="Sao chép số tiền thanh toán"
                  >
                    <Icon name="content_copy" />
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-extrabold uppercase text-slate-400">
                      Nội dung chuyển khoản
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Nội dung này sẽ tự động kèm theo sản phẩm khi quét QR.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(transferContent)}
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-50 hover:text-[#f97316]"
                    aria-label="Sao chép nội dung chuyển khoản"
                  >
                    <Icon name="content_copy" />
                  </button>
                </div>
                <p className="rounded-lg border border-orange-100 bg-orange-50 px-4 py-4 font-mono text-sm font-extrabold text-[#f97316] whitespace-pre-wrap">
                  {transferContent}
                </p>
              </div>
              </div>
            </section>
          </div>

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="mb-4 flex items-center gap-2 font-extrabold text-[#0b1c30]">
              <Icon name="receipt_long" />
              Sản phẩm trong đơn Momo
            </h4>
            <div className="divide-y divide-slate-200/80">
              {cartItems.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="font-extrabold text-[#0b1c30]">
                      {item.product.name}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Số lượng: {item.quantity} x {formatCurrency(item.product.salePrice)}
                    </p>
                  </div>
                  <p className="shrink-0 font-extrabold text-[#0b1c30]">
                    {formatCurrency(item.product.salePrice * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="space-y-2">
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">Tạm tính</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">Giảm giá</span>
                <span>{formatCurrency(discountAmount + pointsValue)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">VAT 0%</span>
                <span>{formatCurrency(0)}</span>
              </div>
              <div className="flex justify-between gap-4 text-xl font-extrabold text-[#0b1c30]">
                <span>Tổng cộng</span>
                <span className="text-[#f97316]">{formatCurrency(amount)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">Phương thức</span>
                <span className="font-extrabold text-[#0b1c30]">Chuyển khoản</span>
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="rounded-xl border border-slate-200 bg-white px-6 py-3 font-extrabold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Quay lại xác nhận
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isProcessing}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#0b1c30] px-6 py-3 font-extrabold text-white hover:bg-[#132a45] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="check_circle" />
              {isProcessing ? "Đang tạo hóa đơn..." : "Xác nhận đã nhận tiền"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QrPaymentModal;
