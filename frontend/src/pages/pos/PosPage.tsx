import { useCallback, useEffect, useMemo, useState } from "react";
import { getProducts, type Product } from "../../api/product.api";
import {
  createPosOrder,
  type PosOrderResult,
  type PosPaymentMethod,
  validatePromotionCode,
} from "../../api/pos.api";
import { searchCustomers, type Customer } from "../../api/customers.api";
import PaymentConfirmModal from "../../components/pos/PaymentConfirmModal";
import QrPaymentModal from "../../components/pos/QrPaymentModal";
import ReceiptModal from "../../components/pos/ReceiptModal";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";

type CartItem = {
  product: Product;
  quantity: number;
};

type PromotionInfo = {
  code: string;
  discountPercent?: number;
  discountFixed?: number;
};

const paymentMethods: Array<{
  value: PosPaymentMethod;
  label: string;
  icon: string;
}> = [
  { value: "cash", label: "Tiền mặt", icon: "payments" },
  { value: "qr", label: "QR", icon: "qr_code" },
  { value: "card", label: "Thẻ", icon: "credit_card" },
];

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
  const isOutOfStock =
    product.status === "out_of_stock" || product.stockQuantity <= 0;
  const isUnavailable = isOutOfStock;

  return (
    <article
        className={[
          "relative flex min-h-[265px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm",
          isUnavailable ? "opacity-60" : "",
        ].join(" ")}
    >
      <div className="flex h-[150px] items-center justify-center bg-white px-4 pt-4">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className={[
              "h-full max-h-[135px] w-full object-contain",
              isUnavailable ? "grayscale" : "",
            ].join(" ")}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-xl bg-orange-50 text-[#f97316]">
            <Icon name="restaurant" className="text-5xl" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-[15px] font-extrabold leading-snug text-[#0b1c30]">
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
                : "bg-orange-50 text-[#f97316]",
            ].join(" ")}
          >
            {isUnavailable ? "Hết hàng" : `Còn ${product.stockQuantity}`}
          </span>
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <p className="text-xl font-extrabold text-[#f97316]">
            {formatCurrency(product.salePrice)}
          </p>

          <button
            type="button"
            onClick={() => {
              if (!isUnavailable) {
                onAdd(product);
              }
            }}
            disabled={isUnavailable}
            className={[
              "flex h-10 w-10 items-center justify-center rounded-xl text-xl font-bold shadow-sm",
              isUnavailable
                ? "cursor-not-allowed bg-slate-100 text-slate-400"
                : "cursor-pointer bg-orange-50 text-[#f97316]",
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

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCustomerList, setShowCustomerList] = useState(false);

  const [promotionCode, setPromotionCode] = useState("");
  const [promotion, setPromotion] = useState<PromotionInfo | null>(null);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [promoMessage, setPromoMessage] = useState("");

  const [pointsUsed, setPointsUsed] = useState(0);
  // Tiền khách đưa: lưu dạng chuỗi để thu ngân tự nhập, không tự tăng theo giỏ hàng
  const [cashPaid, setCashPaid] = useState("");
  const [showPaymentConfirmModal, setShowPaymentConfirmModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

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

  const searchForCustomers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setCustomers([]);
      return;
    }

    try {
      const response = await searchCustomers(query);
      setCustomers(response.data);
    } catch (error) {
      console.error("Lỗi tìm kiếm khách hàng:", error);
    }
  }, []);

  const validatePromotion = useCallback(async (code: string) => {
    if (!code.trim()) {
      setPromotion(null);
      setPromoMessage("");
      return;
    }

    try {
      setIsValidatingPromo(true);
      setPromoMessage("");
      const response = await validatePromotionCode(code);
      setPromotion({
        code,
        discountPercent: response.data.discountPercent,
        discountFixed: response.data.discountFixed,
      });
      setPromoMessage(response.message);
    } catch (error) {
      setPromotion(null);
      setPromoMessage(error instanceof Error ? error.message : "Mã khuyến mãi không hợp lệ");
    } finally {
      setIsValidatingPromo(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadProducts);
  }, [loadProducts]);

  const categories = useMemo(() => {
    const names = products
      .map((product) => product.categoryName)
      .filter((name): name is string => Boolean(name));

    return Array.from(new Set(names));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = normalizeText(search);

    return products.filter((product) => {
      const matchesSearch =
        query.length === 0 ||
        normalizeText(product.name).includes(query) ||
        normalizeText(product.sku).includes(query);
      const matchesCategory =
        categoryFilter === "all" || product.categoryName === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [categoryFilter, products, search]);

  const subtotal = useMemo(
    () =>
      cartItems.reduce(
        (total, item) => total + item.product.salePrice * item.quantity,
        0
      ),
    [cartItems]
  );

  const discountAmount = useMemo(() => {
    if (!promotion) return 0;

    if (promotion.discountPercent) {
      return (subtotal * promotion.discountPercent) / 100;
    }

    return Math.min(promotion.discountFixed || 0, subtotal);
  }, [subtotal, promotion]);

  const loyaltyEligibleSubtotal = useMemo(
    () =>
      cartItems.reduce((total, item) => {
        const isEligible =
          item.product.requiresPreparation && !item.product.isStockReturnable;

        return isEligible
          ? total + item.product.salePrice * item.quantity
          : total;
      }, 0),
    [cartItems]
  );
  const maxUsablePoints = useMemo(() => {
    if (!selectedCustomer) return 0;

    const maxPointsByEligibleAmount = Math.floor(loyaltyEligibleSubtotal / 100);

    return Math.min(selectedCustomer.loyaltyPoints, maxPointsByEligibleAmount);
  }, [selectedCustomer, loyaltyEligibleSubtotal]);

  const effectivePointsUsed = Math.min(pointsUsed, maxUsablePoints);
  const pointsValue = useMemo(
    () => effectivePointsUsed * 100,
    [effectivePointsUsed]
  );

  const totalAfterDiscount = useMemo(
    () => subtotal - discountAmount,
    [subtotal, discountAmount]
  );

  const finalAmount = useMemo(
    () => Math.max(0, totalAfterDiscount - pointsValue),
    [totalAfterDiscount, pointsValue]
  );

  const cashPaidAmount = useMemo(() => Number(cashPaid) || 0, [cashPaid]);

  const changeAmount = useMemo(
    () => Math.max(0, cashPaidAmount - finalAmount),
    [cashPaidAmount, finalAmount]
  );

  const qrTransferContent = useMemo(() => {
    const productCodes = cartItems
      .map((item) => `${item.product.sku}x${item.quantity}`)
      .join(", ");

    return productCodes
      ? `Thanh toan don hang ${productCodes}`
      : "Thanh toan don hang";
  }, [cartItems]);

  const addToCart = (product: Product) => {
    setCompletedOrder(null);
    setErrorMessage("");

    if (product.status === "out_of_stock" || product.stockQuantity <= 0) {
      setErrorMessage(`${product.name} đã hết hàng`);
      return;
    }

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
    setPointsUsed(0);
    setCashPaid("");
  };

  const submitOrder = async () => {
    try {
      setIsProcessing(true);
      setErrorMessage("");

      const response = await createPosOrder({
        customerId: selectedCustomer?.id || null,
        paymentMethod,
        note:
          paymentMethod === "qr"
            ? `${note.trim() || "Bán tại quầy"} | Nội dung CK: ${qrTransferContent}`
            : note.trim() || "Bán tại quầy",
        items: cartItems.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
        promotionCode: promotion?.code || null,
        pointsUsed: effectivePointsUsed,
        changeAmount,
      });

      setShowPaymentConfirmModal(false);
      setShowQrModal(false);
      setCompletedOrder(response.data);
      setSelectedCustomer(null);
      setPromotion(null);
      setPromotionCode("");
      clearCart();
      await loadProducts();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Tạo hóa đơn thất bại");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      setErrorMessage("Vui lòng chọn ít nhất một sản phẩm");
      return;
    }

    if (paymentMethod === "cash" && finalAmount > 0 && cashPaidAmount < finalAmount) {
      setErrorMessage("Tiền khách đưa chưa đủ để thanh toán");
      return;
    }

    setErrorMessage("");
    setShowPaymentConfirmModal(true);
  };

  const handleConfirmPayment = async () => {
    if (paymentMethod === "qr" && finalAmount > 0) {
      setShowPaymentConfirmModal(false);
      setShowQrModal(true);
      return;
    }

    await submitOrder();
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
                    : `${filteredProducts.length} sản phẩm trong thực đơn`}
                </p>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pb-36 pr-1 xl:pb-0">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
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
                <div className="relative">
                  <input
                    value={
                      selectedCustomer
                        ? `${selectedCustomer.fullName} - ${selectedCustomer.phone}`
                        : customerSearch
                    }
                    onChange={(e) => {
                      if (selectedCustomer) {
                        setSelectedCustomer(null);
                        setPointsUsed(0);
                      }
                      setCustomerSearch(e.target.value);
                      void searchForCustomers(e.target.value);
                      setShowCustomerList(true);
                    }}
                    onFocus={() => {
                      if (customerSearch) setShowCustomerList(true);
                    }}
                    placeholder="Nhập SĐT hoặc tên khách hàng để tích điểm..."
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                  />
                  {selectedCustomer && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerSearch("");
                        setPointsUsed(0);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <Icon name="close" className="text-lg" />
                    </button>
                  )}
                  {showCustomerList && customers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                      {customers.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setCustomerSearch("");
                            setShowCustomerList(false);
                          }}
                          className="w-full border-b border-slate-100 px-4 py-3 text-left text-sm hover:bg-orange-50 last:border-b-0"
                        >
                          <p className="font-semibold text-[#0b1c30]">{customer.fullName}</p>
                          <p className="text-xs text-slate-500">
                            {customer.phone} • {customer.loyaltyPoints} điểm
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedCustomer && (
                  <div className="rounded-lg bg-orange-50 p-3 text-xs">
                    <p className="font-semibold text-[#f97316]">Điểm tích lũy: {selectedCustomer.loyaltyPoints}</p>
                  </div>
                )}
              </label>

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  value={promotionCode}
                  onChange={(e) => {
                    setPromotionCode(e.target.value);
                    setPromoMessage("");
                  }}
                  placeholder="Mã giảm giá"
                  className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                />
                <button
                  type="button"
                  onClick={() => {
                    void validatePromotion(promotionCode);
                  }}
                  disabled={!promotionCode.trim() || isValidatingPromo}
                  className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  {isValidatingPromo ? "..." : "Áp dụng"}
                </button>
              </div>
              {promoMessage && (
                <p
                  className={`text-xs ${
                    promotion ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {promoMessage}
                </p>
              )}

              {selectedCustomer && selectedCustomer.loyaltyPoints > 0 && (
                <label className="block space-y-2">
                  <span className="text-sm font-bold text-[#0b1c30]">Sử dụng điểm</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max={maxUsablePoints}
                      value={effectivePointsUsed}
                      disabled={maxUsablePoints === 0}
                      onChange={(e) => {
                        const value = Math.max(
                          0,
                          Math.min(
                            parseInt(e.target.value) || 0,
                            maxUsablePoints
                          )
                        );
                        setPointsUsed(value);
                      }}
                      className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                    />
                    <span className="text-sm font-semibold text-slate-600">
                      = {formatCurrency(pointsValue)}
                    </span>
                    <p className="text-xs text-slate-500">
                      Tối đa dùng {maxUsablePoints} điểm cho sản phẩm pha chế.
                    </p>
                  </div>
                </label>
              )}

              <label className="block space-y-2">
                <span className="text-sm font-bold text-[#0b1c30]">Thanh toán</span>
                <div className="grid grid-cols-3 gap-2">
                  {paymentMethods.map((method) => {
                    const isSelected = paymentMethod === method.value;

                    return (
                      <button
                        key={method.value}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(method.value);
                        }}
                        className={[
                          "flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border bg-white px-2 text-xs font-bold transition-all",
                          isSelected
                            ? "border-[#f97316] bg-orange-50 text-[#f97316] shadow-sm shadow-orange-100"
                            : "border-slate-200 text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-600",
                        ].join(" ")}
                        aria-pressed={isSelected}
                      >
                        <Icon name={method.icon} className="text-[28px]" />
                        <span>{method.label}</span>
                      </button>
                    );
                  })}
                </div>
              </label>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Tạm tính</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Giảm giá</span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                {pointsValue > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Dùng điểm</span>
                    <span>-{formatCurrency(pointsValue)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-extrabold text-[#0b1c30]">
                  <span>Tổng cộng</span>
                  <span className="text-[#f97316]">{formatCurrency(finalAmount)}</span>
                </div>
              </div>

              {paymentMethod === "cash" && finalAmount > 0 && (
                <label className="block space-y-2">
                  <span className="text-sm font-bold text-[#0b1c30]">Tiền khách đưa</span>
                  <input
                    type="number"
                    min={0}
                    value={cashPaid}
                    onChange={(e) => {
                      const rawValue = e.target.value;
                      if (rawValue === "") {
                        setCashPaid("");
                        return;
                      }
                      const value = Math.max(0, parseInt(rawValue) || 0);
                      setCashPaid(String(value));
                    }}
                    placeholder="Nháº­p sá»‘ tiá»n khÃ¡ch Ä‘Æ°a..."
                    className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                  />
                  {cashPaidAmount > 0 && cashPaidAmount < finalAmount && (
                    <p className="text-xs text-red-600">
                      Còn thiếu:{" "}
                      <span className="font-bold">
                        {formatCurrency(finalAmount - cashPaidAmount)}
                      </span>
                    </p>
                  )}
                  {changeAmount > 0 && (
                    <p className="text-xs text-slate-600">
                      Tiền thừa: <span className="font-bold text-orange-600">{formatCurrency(changeAmount)}</span>
                    </p>
                  )}
                </label>
              )}

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
                {isProcessing ? "Đang thanh toán..." : `Thanh toán ${formatCurrency(finalAmount)}`}
              </button>
            </div>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-3 bottom-3 z-30 sm:inset-x-4 sm:bottom-4 xl:hidden">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-slate-400">Giỏ hàng</p>
              <p className="font-extrabold text-[#0b1c30]">
                {cartItems.length} món · {formatCurrency(finalAmount)}
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

      {showPaymentConfirmModal ? (
        <PaymentConfirmModal
          cartItems={cartItems}
          subtotal={subtotal}
          discountAmount={discountAmount}
          pointsValue={pointsValue}
          finalAmount={finalAmount}
          paymentMethod={paymentMethod}
          isProcessing={isProcessing}
          onConfirm={() => {
            void handleConfirmPayment();
          }}
          onClose={() => {
            if (!isProcessing) setShowPaymentConfirmModal(false);
          }}
        />
      ) : null}

      {showQrModal ? (
        <QrPaymentModal
          amount={finalAmount}
          cartItems={cartItems}
          subtotal={subtotal}
          discountAmount={discountAmount}
          pointsValue={pointsValue}
          isProcessing={isProcessing}
          onConfirm={() => {
            void submitOrder();
          }}
          onClose={() => {
            if (!isProcessing) {
              setShowQrModal(false);
              setShowPaymentConfirmModal(true);
            }
          }}
        />
      ) : null}

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
