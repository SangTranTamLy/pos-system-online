import { Icon } from "../../layouts/AdminLayout";
import qrFallback from "../../assets/qr.png";

// ============================================================================
// THANH TOÁN QR - HƯỚNG DẪN CẤU HÌNH
//
// >>> CÁCH 1 (đang dùng) - QR TĨNH:
//   Thay ảnh mã QR nhận tiền THẬT của bạn vào file:
//
//       frontend/src/assets/qr.png   <-- THAY ẢNH QR THẬT VÀO ĐÂY
//
//   (giữ nguyên tên file qr.png rồi restart frontend).
//   Số tiền và nội dung chuyển khoản sẽ hiển thị bên dưới mã QR
//   để khách tự nhập khi quét.
//
// >>> CÁCH 2 (nâng cao) - QR ĐỘNG VietQR (tự điền sẵn số tiền + nội dung):
//   Tạo file frontend/.env (xem mẫu frontend/.env.example) và điền:
//     VITE_VIETQR_BANK_ID=mbbank          (mã ngân hàng theo vietqr.io)
//     VITE_VIETQR_ACCOUNT_NO=0123456789   (số tài khoản nhận tiền)
//     VITE_VIETQR_ACCOUNT_NAME=TRAN THANH SANG
//   Sau đó restart frontend (npm run dev). KHÔNG commit file .env.
//   Khi đã cấu hình, hệ thống tự dùng QR động thay cho ảnh tĩnh.
// ============================================================================

const VIETQR_BANK_ID = import.meta.env.VITE_VIETQR_BANK_ID as string | undefined;
const VIETQR_ACCOUNT_NO = import.meta.env.VITE_VIETQR_ACCOUNT_NO as
  | string
  | undefined;
const VIETQR_ACCOUNT_NAME = import.meta.env.VITE_VIETQR_ACCOUNT_NAME as
  | string
  | undefined;

const isDynamicQrEnabled = Boolean(VIETQR_BANK_ID && VIETQR_ACCOUNT_NO);

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildQrImageUrl(amount: number, reference: string) {
  if (!isDynamicQrEnabled) {
    return qrFallback;
  }

  const params = new URLSearchParams({
    amount: String(Math.round(amount)),
    addInfo: reference,
  });

  if (VIETQR_ACCOUNT_NAME) {
    params.set("accountName", VIETQR_ACCOUNT_NAME);
  }

  return `https://img.vietqr.io/image/${VIETQR_BANK_ID}-${VIETQR_ACCOUNT_NO}-compact2.png?${params.toString()}`;
}

type QrPaymentModalProps = {
  amount: number;
  reference: string;
  isProcessing: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

function QrPaymentModal({
  amount,
  reference,
  isProcessing,
  onConfirm,
  onClose,
}: QrPaymentModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="flex items-center gap-2 font-['Plus_Jakarta_Sans',sans-serif] text-lg font-extrabold text-[#0b1c30]">
            <Icon name="qr_code" className="text-xl" />
            Thanh toán QR
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Đóng"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="space-y-4 p-6 text-center">
          <p className="text-sm text-slate-500">
            Đưa mã cho khách quét bằng ứng dụng ngân hàng hoặc ví điện tử
          </p>

          <div className="mx-auto w-full overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <img
              src={buildQrImageUrl(amount, reference)}
              alt="Mã QR thanh toán"
              className="block h-auto w-full"
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-bold uppercase text-slate-400">
              Số tiền cần thanh toán
            </p>
            <p className="text-2xl font-extrabold text-[#f97316]">
              {formatCurrency(amount)}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase text-slate-400">
              Nội dung chuyển khoản
            </p>
            <p className="font-mono text-lg font-extrabold tracking-wider text-[#0b1c30]">
              {reference}
            </p>
          </div>

          {!isDynamicQrEnabled && (
            <p className="rounded-lg bg-orange-50 p-2 text-xs font-semibold text-[#f97316]">
              Nhắc khách nhập đúng số tiền và nội dung chuyển khoản ở trên
            </p>
          )}

          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0b1c30] px-6 py-4 font-extrabold text-white transition-all hover:bg-[#132a45] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="check_circle" />
            {isProcessing ? "Đang xác nhận..." : "Khách đã chuyển khoản"}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="w-full text-sm font-semibold text-slate-500 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
}

export default QrPaymentModal;
