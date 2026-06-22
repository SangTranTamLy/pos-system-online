import type { Product } from "../../api/product.api";
import { Icon } from "../../layouts/AdminLayout";

type ProductCardProps = {
  product: Product;
  onAdd: (product: Product) => void;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ProductCard({ product, onAdd }: ProductCardProps) {
  const isUnavailable =
    product.status === "out_of_stock" ||
    !product.isAvailable ||
    (product.isTrackedStock && product.stockQuantity !== null && product.stockQuantity <= 0);

  return (
    <article
      className={[
        "relative flex min-h-66.25 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm",
        isUnavailable ? "opacity-60" : "",
      ].join(" ")}
    >
      <div className="flex h-37.5 items-center justify-center bg-white px-4 pt-4">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className={[
              "h-full max-h-33.75 w-full object-contain",
              isUnavailable ? "grayscale" : "",
            ].join(" ")}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-xl bg-orange-50 text-[#9d4300]">
            <Icon name="restaurant" className="text-5xl" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-[15px] font-extrabold leading-snug text-[#2a1b14]">
              {product.name}
            </h3>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              SKU: {product.sku}
            </p>
          </div>

          <span
            className={[
              "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold",
              isUnavailable
                ? "bg-slate-100 text-slate-500"
                : "bg-orange-50 text-[#9d4300]",
            ].join(" ")}
          >
            {isUnavailable
              ? "Hết hàng"
              : product.isTrackedStock
                ? `Còn ${product.stockQuantity}`
                : "Đang bán"}
          </span>
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <p className="text-xl font-extrabold text-[#9d4300]">
            {formatCurrency(product.salePrice)}
          </p>

          <button
            type="button"
            onClick={() => {
              if (!isUnavailable) onAdd(product);
            }}
            disabled={isUnavailable}
            className={[
              "flex h-10 w-10 items-center justify-center rounded-xl text-xl font-bold shadow-sm",
              isUnavailable
                ? "cursor-not-allowed bg-slate-100 text-slate-400"
                : "cursor-pointer bg-orange-50 text-[#9d4300]",
            ].join(" ")}
            aria-label={`Thêm ${product.name} vào giỏ`}
          >
            <Icon name="add" />
          </button>
        </div>
      </div>
    </article>
  );
}
