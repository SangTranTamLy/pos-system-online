import { Icon } from "../../layouts/AdminLayout";

const WALLET_NAME = "MoMo";
const ACCOUNT_NO = "PSP2605210000000331";
const ACCOUNT_NAME = "CHAU THANH SANG";
const PAYMENT_NAME = "Vi MoMo";
const SEPAY_QR_URL =
  "https://qr.sepay.vn/img?acc=PSP2605210000000331&bank=MoMo&holder=CHAU+THANH+SANG&template=qronly&showinfo=false";

type QrPaymentModalProps = {
  amount: number;
  cartItems: Array<{
    product: {
      id: string;
      sku: string;
      name: string;
      salePrice: number;
    };
    quantity: number;
  }>;
  subtotal: number;
  discountAmount: number;
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

function buildSepayQrUrl(amount: number, description: string) {
  const qrUrl = new URL(SEPAY_QR_URL);

  qrUrl.searchParams.set("amount", String(Math.max(0, Math.round(amount))));
  qrUrl.searchParams.set("des", description.trim());

  return qrUrl.toString();
}

function QrPaymentModal({
  amount,
  cartItems,
  subtotal,
  discountAmount,
  isProcessing,
  onConfirm,
  onClose,
}: QrPaymentModalProps) {
  const copyText = (value: string) => {
    void navigator.clipboard?.writeText(value);
  };

  const productCodes = cartItems
    .map((item) => `${item.product.sku}x${item.quantity}`)
    .join(", ");

  const transferContent = productCodes
    ? `Thanh toán đơn hàng ${productCodes}`
    : "Thanh toán đơn hàng";
  const qrImageUrl = buildSepayQrUrl(amount, transferContent);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h3 className="font-['Outfit',sans-serif] text-xl font-extrabold text-[#0b1c30]">
              Thanh toán QR
            </h3>
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
          <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="mx-auto w-fit rounded-xl border border-slate-200 bg-white p-3">
                <img
                  src={qrImageUrl}
                  alt="Mã QR thanh toán"
                  className="h-80 w-80 rounded-lg object-contain"
                />
              </div>
              <div className="mx-auto mt-4 w-fit rounded-full border border-orange-100 bg-white px-4 py-1 text-xs font-extrabold uppercase text-[#f97316]">
                {WALLET_NAME}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="space-y-5">
                <div className="border-b border-slate-100 pb-4">
                  <p className="text-xs font-extrabold uppercase text-slate-400">
                    Hình thức nhận tiền
                  </p>
                  <p className="mt-2 text-lg font-extrabold text-[#0b1c30]">
                    {PAYMENT_NAME}
                  </p>
                </div>

                <div className="border-b border-slate-100 pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-extrabold uppercase text-slate-400">
                        Tài khoản nhận
                      </p>
                      <p className="mt-2 text-lg font-extrabold text-[#0b1c30]">
                        {ACCOUNT_NO}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyText(ACCOUNT_NO)}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-50 hover:text-[#f97316]"
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
                        {ACCOUNT_NAME}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyText(ACCOUNT_NAME)}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-50 hover:text-[#f97316]"
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
                    >
                      <Icon name="content_copy" />
                    </button>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-extrabold uppercase text-slate-400">
                      Nội dung chuyển khoản
                    </p>
                    <button
                      type="button"
                      onClick={() => copyText(transferContent)}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-50 hover:text-[#f97316]"
                    >
                      <Icon name="content_copy" />
                    </button>
                  </div>
                  <p className="rounded-lg border border-orange-100 bg-orange-50 px-4 py-4 font-mono text-sm font-extrabold text-[#f97316]">
                    {transferContent}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    Mã sản phẩm trong QR: {productCodes}
                  </p>
                </div>
              </div>
            </section>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="space-y-2">
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">Tam tinh</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-600">Giam gia</span>
                <span>{formatCurrency(discountAmount)}</span>
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
                <span className="text-slate-600">Phuong thuc</span>
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
