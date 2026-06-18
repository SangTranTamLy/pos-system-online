import { useCallback, useEffect, useMemo, useState } from "react";
import { getProducts, type Product } from "../../api/product.api";
import { searchCustomers, type Customer } from "../../api/customers.api";
import {
  createPosOrder,
  previewPosPromotion,
  type PosOrderResult,
  type PosPaymentMethod,
  type PosPromotionPreview,
} from "../../api/pos.api";
import { fetchPromotions, type Promotion } from "../../api/promotions.api";
import { fetchShifts, type Shift } from "../../api/shifts.api";
import PaymentConfirmModal from "../../components/pos/PaymentConfirmModal";
import ProductCard from "../../components/pos/ProductCard";
import QrPaymentModal from "../../components/pos/QrPaymentModal";
import ReceiptModal from "../../components/pos/ReceiptModal";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";

type CartItem = {
  product: Product;
  quantity: number;
};

function toPromotionPreviewItems(cartItems: CartItem[]) {
  return cartItems.map((item) => ({
    productId: item.product.id,
    quantity: item.quantity,
    unitPrice: item.product.salePrice,
  }));
}

const paymentMethods: Array<{
  value: PosPaymentMethod;
  label: string;
  icon: string;
}> = [
    { value: "cash", label: "Tiền mặt", icon: "payments" },
    { value: "qr", label: "QR", icon: "qr_code" },
    { value: "card", label: "The", icon: "credit_card" },
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

function PosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promotionFilterTime, setPromotionFilterTime] = useState(() =>
    Date.now()
  );
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [completedOrder, setCompletedOrder] = useState<PosOrderResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [promotionCode, setPromotionCode] = useState("");
  const [promotionPreview, setPromotionPreview] =
    useState<PosPromotionPreview | null>(null);
  const [isPromotionError, setIsPromotionError] = useState(false);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [promoMessage, setPromoMessage] = useState("");
  const [cashPaid, setCashPaid] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [matchedCustomer, setMatchedCustomer] = useState<Customer | null>(null);
  const [customerLookupMessage, setCustomerLookupMessage] = useState("");
  const [showPaymentConfirmModal, setShowPaymentConfirmModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      setErrorMessage("");
      const response = await getProducts();
      setProducts(response.data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Không tải được sản phẩm. Vui lòng thử lại."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const validatePromotion = useCallback(async (code: string) => {
    const previewItems = toPromotionPreviewItems(cartItems);

    if (previewItems.length === 0) {
      setPromoMessage("Vui lòng chọn sản phẩm trước khi áp dụng khuyến mãi.");
      setIsPromotionError(true);
      return;
    }

    try {
      setIsValidatingPromo(true);
      setPromoMessage("");
      const response = await previewPosPromotion(previewItems, code);
      setPromotionPreview(response.data);
      setIsPromotionError(false);
      setPromoMessage(response.message);
    } catch (error) {
      setPromotionPreview(null);
      setIsPromotionError(true);
      setPromoMessage(
        error instanceof Error ? error.message : "Mã khuyến mãi không hợp lệ."
      );
    } finally {
      setIsValidatingPromo(false);
    }
  }, [cartItems]);

  useEffect(() => {
    let isMounted = true;
    const previewItems = toPromotionPreviewItems(cartItems);

    if (previewItems.length === 0) {
      Promise.resolve().then(() => {
        if (!isMounted) return;
        setPromotionPreview(null);
        setIsPromotionError(false);
        if (!promotionCode.trim()) setPromoMessage("");
      });

      return () => {
        isMounted = false;
      };
    }

    previewPosPromotion(previewItems, promotionCode.trim() || null)
      .then((response) => {
        if (!isMounted) return;
        setPromotionPreview(response.data);
        setIsPromotionError(false);
        setPromoMessage(response.data.appliedPromotion ? response.message : "");
      })
      .catch((error) => {
        if (!isMounted) return;
        setPromotionPreview(null);
        setIsPromotionError(Boolean(promotionCode.trim()));
        setPromoMessage(
          promotionCode.trim() && error instanceof Error ? error.message : ""
        );
      });

    return () => {
      isMounted = false;
    };
  }, [cartItems, promotionCode]);

  useEffect(() => {
    let isMounted = true;

    Promise.all([getProducts(), fetchPromotions(), fetchShifts()])
      .then(([productResponse, promotionData, shiftData]) => {
        if (!isMounted) return;
        setErrorMessage("");
        setProducts(productResponse.data);
        setPromotions(promotionData);
        setPromotionFilterTime(Date.now());
        
        const storedUserStr = localStorage.getItem("auth_user");
        let currentUserId = "";
        if (storedUserStr) {
          try {
             currentUserId = JSON.parse(storedUserStr).id;
          } catch (e) {}
        }
        
        const openShift = shiftData.find(
          (s) => s.status === "OPEN" && s.userId === currentUserId
        );
        setActiveShift(openShift || null);
      })
      .catch((error) => {
        if (!isMounted) return;
        setPromotions([]);
        setErrorMessage(
          error instanceof Error ? error.message : "Không tải được dữ liệu POS. Vui lòng thử lại."
        );
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const phone = customerPhone.replace(/\D/g, "");

    if (phone.length < 8) {
      setMatchedCustomer(null);
      setCustomerLookupMessage("");
      return undefined;
    }

    let isMounted = true;
    const timer = window.setTimeout(() => {
      searchCustomers(phone)
        .then((response) => {
          if (!isMounted) return;
          const customer =
            response.data.find((item) => item.phone === phone) ?? null;
          setMatchedCustomer(customer);
          setCustomerLookupMessage(
            customer
              ? `Khách quen: ${customer.fullName}`
              : "Không tìm thấy khách hàng. Hóa đơn sẽ không gắn khách."
          );
        })
        .catch(() => {
          if (!isMounted) return;
          setMatchedCustomer(null);
          setCustomerLookupMessage("Không tra cứu được khách hàng.");
        });
    }, 250);

    return () => {
      isMounted = false;
      window.clearTimeout(timer);
    };
  }, [customerPhone]);

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

  const activePromotions = useMemo(() => {
    return promotions.filter((item) => {
      const startsOk =
        !item.startAt || new Date(item.startAt).getTime() <= promotionFilterTime;
      const endsOk =
        !item.endAt || new Date(item.endAt).getTime() > promotionFilterTime;
      return item.isActive && startsOk && endsOk;
    });
  }, [promotionFilterTime, promotions]);

  const subtotal = useMemo(
    () =>
      cartItems.reduce(
        (total, item) => total + item.product.salePrice * item.quantity,
        0
      ),
    [cartItems]
  );

  const isPromotionApplicable = !isPromotionError;
  const displayedPromoMessage = promoMessage;
  const discountAmount = promotionPreview?.discountAmount ?? 0;

  const finalAmount = useMemo(
    () => Math.max(0, subtotal - discountAmount),
    [subtotal, discountAmount]
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
      ? `Thanh toán đơn hàng ${productCodes}`
      : "Thanh toán đơn hàng";
  }, [cartItems]);

  const addToCart = (product: Product) => {
    setCompletedOrder(null);
    setErrorMessage("");

    if (product.status === "out_of_stock" || product.stockQuantity <= 0) {
      setErrorMessage(`${product.name} đã hết hàng.`);
      return;
    }

    setCartItems((currentItems) => {
      const existedItem = currentItems.find((item) => item.product.id === product.id);

      if (!existedItem) {
        return [...currentItems, { product, quantity: 1 }];
      }

      if (existedItem.quantity >= product.stockQuantity) {
        setErrorMessage(`${product.name} chỉ còn ${product.stockQuantity} sản phẩm.`);
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
    setCashPaid("");
    setPromotionCode("");
    setPromoMessage("");
    setCustomerPhone("");
    setMatchedCustomer(null);
    setCustomerLookupMessage("");
  };

  const submitOrder = async () => {
    try {
      setIsProcessing(true);
      setErrorMessage("");

      const response = await createPosOrder({
        customerId: matchedCustomer?.id ?? null,
        customerPhone: customerPhone.replace(/\D/g, "") || null,
        paymentMethod,
        note:
          paymentMethod === "qr"
            ? `${note.trim() || "Bán tại quầy"} | Nội dung CK: ${qrTransferContent}`
            : note.trim() || "Ban tai quay",
        items: cartItems.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
        promotionCode: promotionCode.trim() || null,
        changeAmount,
      });

      setShowPaymentConfirmModal(false);
      setShowQrModal(false);
      setCompletedOrder(response.data);
      setPromotionPreview(null);
      setIsPromotionError(false);
      setPromotionCode("");
      clearCart();
      await loadProducts();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Chưa tạo được hóa đơn. Vui lòng thử lại."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      setErrorMessage("Vui lòng chọn ít nhất một sản phẩm.");
      return;
    }

    if (!isPromotionApplicable) {
      setErrorMessage(displayedPromoMessage);
      return;
    }

    if (paymentMethod === "cash" && finalAmount > 0 && cashPaidAmount < finalAmount) {
      setErrorMessage("Tiền khách đưa chưa đủ để thanh toán.");
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

  if (isLoading) {
    return (
      <AdminLayout title="Bán hàng" subtitle="Tải dữ liệu...">
        <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Icon
              name="sync"
              className="animate-spin text-4xl text-slate-400"
            />
            <p className="text-sm font-semibold text-slate-500">Đang tải dữ liệu POS...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!activeShift) {
    return (
      <AdminLayout title="Bán hàng">
        <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
          <div className="flex max-w-md flex-col items-center text-center gap-4 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-[#f97316]">
              <Icon name="lock" className="text-3xl" />
            </div>
            <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-xl font-extrabold text-[#0b1c30]">
              POS Đã Khóa
            </h2>
            <p className="text-sm font-medium text-slate-600 leading-relaxed">
              Bạn chưa có ca làm việc nào đang mở. Vui lòng vào mục <span className="font-bold text-[#0b1c30]">Ca làm</span> để đăng ký ca hoặc yêu cầu Quản lý mở ca.
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Bán hàng tại quầy"
      subtitle="Chọn món, thanh toán, theo dõi doanh thu và quản lý tồn kho."
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
                    : `${filteredProducts.length} sản phẩm trong thực đơn.`}
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
                  <p className="text-sm font-semibold">Không tìm thấy sản phẩm phù hợp.</p>
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
              >
                Xóa tất cả
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {cartItems.length === 0 ? (
                <div className="flex h-full min-h-56 flex-col items-center justify-center rounded-2xl bg-slate-50 text-center text-slate-400">
                  <Icon name="shopping_basket" className="mb-3 text-5xl" />
                  <p className="text-sm font-semibold">Giỏ hàng đang trong</p>
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
                    >
                      <Icon name="delete" className="text-lg" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4 border-t border-slate-200 p-5">
              <label className="block space-y-2">
                <span className="text-sm font-bold text-[#0b1c30]">
                  Số điện thoại khách
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={customerPhone}
                  onChange={(event) => {
                    const value = event.target.value.replace(/\D/g, "").slice(0, 10);
                    setCustomerPhone(value);
                  }}
                  placeholder="Nhập SĐT khách quen..."
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                />
                {customerLookupMessage ? (
                  <p
                    className={`text-xs font-semibold ${matchedCustomer ? "text-emerald-600" : "text-slate-500"
                      }`}
                  >
                    {customerLookupMessage}
                  </p>
                ) : null}
              </label>

              <select
                value={promotionCode}
                onChange={(event) => {
                  const code = event.target.value;
                  setPromotionCode(code);
                  setPromoMessage("");
                  if (code) {
                    void validatePromotion(code);
                  } else {
                    setPromotionPreview(null);
                  }
                }}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
              >
                <option value="">Chọn mã khuyến mãi</option>
                {activePromotions.map((item) => (
                  <option key={item.id} value={item.code}>
                    {item.code} - {item.productName}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  value={promotionCode}
                  onChange={(event) => {
                    setPromotionCode(event.target.value);
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

              {displayedPromoMessage ? (
                <p
                  className={`text-xs ${promotionPreview?.appliedPromotion && isPromotionApplicable
                    ? "text-green-600"
                    : "text-red-600"
                    }`}
                >
                  {displayedPromoMessage}
                </p>
              ) : null}

              <label className="block space-y-2">
                <span className="text-sm font-bold text-[#0b1c30]">Thanh toán</span>
                <div className="grid grid-cols-3 gap-2">
                  {paymentMethods.map((method) => {
                    const isSelected = paymentMethod === method.value;

                    return (
                      <button
                        key={method.value}
                        type="button"
                        onClick={() => setPaymentMethod(method.value)}
                        className={[
                          "flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border bg-white px-2 text-xs font-bold transition-all",
                          isSelected
                            ? "border-[#f97316] bg-orange-50 text-[#f97316] shadow-sm shadow-orange-100"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50",
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
                {discountAmount > 0 ? (
                  <div className="flex justify-between text-slate-500">
                    <span>
                      {promotionPreview?.appliedPromotion?.name || "Giảm giá"}
                    </span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-xl font-extrabold text-[#0b1c30]">
                  <span>Tổng cộng</span>
                  <span className="text-[#f97316]">{formatCurrency(finalAmount)}</span>
                </div>
              </div>

              {paymentMethod === "cash" && finalAmount > 0 ? (
                <label className="block space-y-2">
                  <span className="text-sm font-bold text-[#0b1c30]">Tiền khách đưa</span>
                  <input
                    type="number"
                    min={0}
                    value={cashPaid}
                    onChange={(event) => {
                      const rawValue = event.target.value;
                      if (rawValue === "") {
                        setCashPaid("");
                        return;
                      }
                      const value = Math.max(0, parseInt(rawValue) || 0);
                      setCashPaid(String(value));
                    }}
                    placeholder="Nhập số tiền khách đưa..."
                    className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                  />
                  {cashPaidAmount > 0 && cashPaidAmount < finalAmount ? (
                    <p className="text-xs text-red-600">
                      Còn thiếu:{" "}
                      <span className="font-bold">
                        {formatCurrency(finalAmount - cashPaidAmount)}
                      </span>
                    </p>
                  ) : null}
                  {changeAmount > 0 ? (
                    <p className="text-xs text-slate-600">
                      Tiền thừa:{" "}
                      <span className="font-bold text-orange-600">
                        {formatCurrency(changeAmount)}
                      </span>
                    </p>
                  ) : null}
                </label>
              ) : null}

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
                {cartItems.length} mon - {formatCurrency(finalAmount)}
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
