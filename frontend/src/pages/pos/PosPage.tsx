import { useCallback, useEffect, useMemo, useState } from "react";
import { getProducts, type Product } from "../../api/product.api";
import {
  createPosOrder,
  type PosOrderResult,
  type PosPaymentMethod,
} from "../../api/pos.api";
import ReceiptModal from "../../components/pos/ReceiptModal";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";

type CartItem = {
  product: Product;
  quantity: number;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function ProductCard({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: (product: Product) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onAdd(product)}
      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#f97316] hover:shadow-md"
    >
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          className="h-36 w-full object-cover"
        />
      ) : (
        <div className="flex h-36 w-full items-center justify-center bg-orange-50 text-[#f97316]">
          <Icon name="restaurant" className="text-4xl" />
        </div>
      )}

      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-bold text-[#0b1c30]">{product.name}</p>
            <p className="mt-1 text-xs font-semibold text-slate-400">{product.sku}</p>
          </div>
          <span className="rounded-full bg-orange-50 px-2 py-1 text-[10px] font-bold text-[#f97316]">
            Còn {product.stockQuantity}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-lg font-extrabold text-[#f97316]">
            {formatCurrency(product.salePrice)}
          </p>
          <span className="rounded-full bg-[#0b1c30] px-3 py-1 text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
            Thêm
          </span>
        </div>
      </div>
    </button>
  );
}

function PosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [completedOrder, setCompletedOrder] = useState<PosOrderResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadProducts = useCallback(async () => {
    try {
      setErrorMessage("");
      const response = await getProducts();
      setProducts(response.data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không tải được sản phẩm");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadProducts);
  }, [loadProducts]);

  const activeProducts = useMemo(
    () =>
      products.filter(
        (product) => product.status === "active" && product.stockQuantity > 0
      ),
    [products]
  );

  const categories = useMemo(() => {
    const names = activeProducts
      .map((product) => product.categoryName)
      .filter((name): name is string => Boolean(name));

    return Array.from(new Set(names));
  }, [activeProducts]);

  const filteredProducts = useMemo(() => {
    const query = normalizeText(search);

    return activeProducts.filter((product) => {
      const matchesSearch =
        query.length === 0 ||
        normalizeText(product.name).includes(query) ||
        normalizeText(product.sku).includes(query);
      const matchesCategory =
        categoryFilter === "all" || product.categoryName === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [activeProducts, categoryFilter, search]);

  const subtotal = useMemo(
    () =>
      cartItems.reduce(
        (total, item) => total + item.product.salePrice * item.quantity,
        0
      ),
    [cartItems]
  );

  const addToCart = (product: Product) => {
    setCompletedOrder(null);
    setErrorMessage("");
    setCartItems((currentItems) => {
      const existedItem = currentItems.find((item) => item.product.id === product.id);

      if (!existedItem) {
        return [...currentItems, { product, quantity: 1 }];
      }

      if (existedItem.quantity >= product.stockQuantity) {
        setErrorMessage(`${product.name} chỉ còn ${product.stockQuantity} sản phẩm`);
        return currentItems;
      }

      return currentItems.map((item) =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setCartItems((currentItems) =>
      currentItems
        .map((item) =>
          item.product.id === productId
            ? {
                ...item,
                quantity: Math.min(Math.max(quantity, 0), item.product.stockQuantity),
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCartItems((currentItems) =>
      currentItems.filter((item) => item.product.id !== productId)
    );
  };

  const clearCart = () => {
    setCartItems([]);
    setNote("");
    setErrorMessage("");
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      setErrorMessage("Vui lòng chọn ít nhất một sản phẩm");
      return;
    }

    try {
      setIsProcessing(true);
      setErrorMessage("");

      const response = await createPosOrder({
        customerId: null,
        paymentMethod,
        note: note.trim() || "Bán tại quầy",
        items: cartItems.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
      });

      setCompletedOrder(response.data);
      clearCart();
      await loadProducts();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Tạo hóa đơn thất bại");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AdminLayout
      title="Bán hàng tại quầy"
      subtitle="Chọn món, thanh toán và cập nhật tồn kho từ MySQL."
    >
      <div className="flex h-[calc(100vh-132px)] min-h-[720px] gap-4">
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="mb-4 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center">
            <div className="relative w-full lg:max-w-md">
              <Icon
                name="search"
                className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm sản phẩm theo tên hoặc SKU..."
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pr-4 pl-10 text-sm outline-none transition-all focus:border-[#f97316] focus:bg-white focus:ring-2 focus:ring-orange-100"
              />
            </div>

            <div className="flex flex-1 gap-2 overflow-x-auto pb-1 lg:pb-0">
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={[
                  "h-10 whitespace-nowrap rounded-full px-4 text-sm font-bold transition-colors",
                  categoryFilter === "all"
                    ? "bg-[#f97316] text-white"
                    : "bg-slate-50 text-slate-600 hover:bg-orange-50 hover:text-[#f97316]",
                ].join(" ")}
              >
                Tất cả
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setCategoryFilter(category)}
                  className={[
                    "h-10 whitespace-nowrap rounded-full px-4 text-sm font-bold transition-colors",
                    categoryFilter === category
                      ? "bg-[#f97316] text-white"
                      : "bg-slate-50 text-slate-600 hover:bg-orange-50 hover:text-[#f97316]",
                  ].join(" ")}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {errorMessage ? (
            <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-600">
              {errorMessage}
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-extrabold text-[#0b1c30]">
                  Thực đơn
                </h2>
                <p className="text-sm text-slate-500">
                  {isLoading
                    ? "Đang tải sản phẩm..."
                    : `${filteredProducts.length} sản phẩm đang bán`}
                </p>
              </div>
              <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-[#f97316]">
                POS
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} onAdd={addToCart} />
                ))}
              </div>

              {!isLoading && filteredProducts.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center text-center text-slate-400">
                  <Icon name="search_off" className="mb-2 text-4xl" />
                  <p className="text-sm font-semibold">Không tìm thấy sản phẩm phù hợp</p>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <aside className="hidden w-[400px] shrink-0 xl:block">
          <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="flex items-center gap-2 font-['Plus_Jakarta_Sans',sans-serif] text-lg font-extrabold text-[#0b1c30]">
                  <Icon name="shopping_cart" className="text-xl" />
                  Giỏ hàng
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                    {cartItems.length}
                  </span>
                </h2>
              </div>
              <button
                type="button"
                onClick={clearCart}
                disabled={cartItems.length === 0}
                className="text-sm font-semibold text-red-500 transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Xóa giỏ hàng"
              >
                Xóa tất cả
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {cartItems.length === 0 ? (
                <div className="flex h-full min-h-56 flex-col items-center justify-center rounded-2xl bg-slate-50 text-center text-slate-400">
                  <Icon name="shopping_basket" className="mb-3 text-5xl" />
                  <p className="text-sm font-semibold">Giỏ hàng đang trống</p>
                  <p className="mt-1 text-xs">Chọn sản phẩm bên trái để bán</p>
                </div>
              ) : null}

              {cartItems.map((item) => (
                <div
                  key={item.product.id}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 rounded-xl bg-slate-50 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[#0b1c30]">{item.product.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatCurrency(item.product.salePrice)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:text-[#f97316]"
                    aria-label="Giảm số lượng"
                  >
                    -
                  </button>
                  <span className="min-w-5 text-center text-sm font-bold text-[#0b1c30]">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:text-[#f97316]"
                    aria-label="Tăng số lượng"
                  >
                    +
                  </button>

                  <div className="flex items-center gap-2">
                    <p className="min-w-20 text-right text-sm font-extrabold text-[#0b1c30]">
                      {formatCurrency(item.product.salePrice * item.quantity)}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.product.id)}
                      className="rounded-lg p-1 text-red-500 hover:bg-red-50"
                      aria-label="Xóa sản phẩm khỏi giỏ"
                    >
                      <Icon name="delete" className="text-lg" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4 border-t border-slate-200 p-5">
              <label className="block space-y-2">
                <span className="text-sm font-bold text-[#0b1c30]">Khách hàng</span>
                <select
                  value="walk_in"
                  disabled
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none"
                >
                  <option value="walk_in">Khách lẻ</option>
                </select>
              </label>

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  disabled
                  placeholder="Mã giảm giá"
                  className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none disabled:bg-white disabled:text-slate-400"
                />
                <button
                  type="button"
                  disabled
                  className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-400"
                >
                  Áp dụng
                </button>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-bold text-[#0b1c30]">Thanh toán</span>
                <select
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(event.target.value as PosPaymentMethod)
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                >
                  <option value="cash">💵 Tiền mặt</option>
                  <option value="qr">📱 QR</option>
                  <option value="card">💳 Thẻ</option>
                </select>
              </label>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Tạm tính</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Giảm giá</span>
                  <span>{formatCurrency(0)}</span>
                </div>
                <div className="flex justify-between text-xl font-extrabold text-[#0b1c30]">
                  <span>Tổng cộng</span>
                  <span className="text-blue-600">{formatCurrency(subtotal)}</span>
                </div>
              </div>

              <label className="block space-y-2">
                <span className="sr-only">Ghi chú</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={2}
                  placeholder="Ghi chú đơn hàng..."
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  void handleCheckout();
                }}
                disabled={cartItems.length === 0 || isProcessing}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0b1c30] px-6 py-4 font-extrabold text-white shadow-lg shadow-slate-200 transition-all hover:bg-[#132a45] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="credit_card" />
                {isProcessing ? "Đang thanh toán..." : `Thanh toán ${formatCurrency(subtotal)}`}
              </button>
            </div>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-4 bottom-4 z-30 xl:hidden">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-slate-400">Giỏ hàng</p>
              <p className="font-extrabold text-[#0b1c30]">
                {cartItems.length} món · {formatCurrency(subtotal)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                void handleCheckout();
              }}
              disabled={cartItems.length === 0 || isProcessing}
              className="rounded-2xl bg-[#0b1c30] px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-slate-200 disabled:opacity-50"
            >
              Thanh toán
            </button>
          </div>
          <div className="flex max-h-24 gap-2 overflow-x-auto">
            {cartItems.map((item) => (
              <span
                key={item.product.id}
                className="whitespace-nowrap rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-[#f97316]"
              >
                {item.product.name} x{item.quantity}
              </span>
            ))}
          </div>
        </div>
      </div>

      {completedOrder ? (
        <ReceiptModal
          order={completedOrder}
          onClose={() => setCompletedOrder(null)}
        />
      ) : null}
    </AdminLayout>
  );
}

export default PosPage;

