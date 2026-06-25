import { useCallback, useEffect, useMemo, useState } from "react";
import { getProducts, type Product } from "../../api/product.api";
import { searchCustomers, type Customer } from "../../api/customers.api";
import { createAuditLog } from "../../api/audit-log.api";
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
import { API_BASE_URL } from "../../api/api-base";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";

type CartItem = {
  product: Product;
  quantity: number;
};

type PosStockFilter = "all" | "available" | "low_stock" | "out_of_stock";
type PosSortMode = "default" | "name_asc" | "price_asc" | "price_desc";
type PosViewMode = "grid" | "list";
type PosQuickFilter = "all" | "best_seller";

function getAuthHeaders() {
  const token = localStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
}

async function setShiftOpeningCash(id: string, openingCash: number): Promise<Shift> {
  const response = await fetch(`${API_BASE_URL}/shifts/${id}/opening-cash`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ openingCash }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Khong the nhap tien dau ca");
  return data.data;
}

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

function getStoredPosUser() {
  const storedUser = localStorage.getItem("auth_user");
  let currentUserId = "";
  let roleName = "";

  if (storedUser) {
    try {
      const user = JSON.parse(storedUser);
      currentUserId = user.id || "";
      roleName = user.roleName?.toLowerCase() || "";
    } catch {
      // Ignore invalid local storage payload.
    }
  }

  return { currentUserId, roleName };
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function isProductUnavailable(product: Product) {
  return (
    product.status === "out_of_stock" ||
    !product.isAvailable ||
    (product.isTrackedStock && product.stockQuantity !== null && product.stockQuantity <= 0)
  );
}

function isLowStockProduct(product: Product) {
  return (
    product.isTrackedStock &&
    product.stockQuantity !== null &&
    product.stockQuantity > 0 &&
    product.stockQuantity <= 5
  );
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
  const [quickFilter, setQuickFilter] = useState<PosQuickFilter>("all");
  const [stockFilter, setStockFilter] = useState<PosStockFilter>("all");
  const [sortMode, setSortMode] = useState<PosSortMode>("default");
  const [viewMode, setViewMode] = useState<PosViewMode>("grid");
  const [showFilters, setShowFilters] = useState(false);
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
  const [openingCashInput, setOpeningCashInput] = useState("");
  const [isSavingOpeningCash, setIsSavingOpeningCash] = useState(false);
  const [lowStockAlerts, setLowStockAlerts] = useState<
    Array<{ name: string; stockQuantity: number; minStock: number }>
  >([]);

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
        
        const { currentUserId, roleName } = getStoredPosUser();
        
        const openShift = shiftData.find(
          (s) => s.status === "OPEN" && s.userId === currentUserId
        );
        
        if (roleName === "admin" || roleName === "manager") {
          setActiveShift({ id: "admin_bypass", status: "OPEN" } as unknown as Shift);
        } else {
          setActiveShift(openShift || null);
        }
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
      Promise.resolve().then(() => {
        setMatchedCustomer(null);
        setCustomerLookupMessage("");
      });
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

    const filtered = products.filter((product) => {
      const matchesSearch =
        query.length === 0 ||
        normalizeText(product.name).includes(query) ||
        normalizeText(product.sku).includes(query) ||
        normalizeText(product.id).includes(query);
      const matchesCategory =
        categoryFilter === "all" || product.categoryName === categoryFilter;
      const matchesQuickFilter =
        quickFilter === "all" || (quickFilter === "best_seller" && !isProductUnavailable(product));
      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "available" && !isProductUnavailable(product)) ||
        (stockFilter === "low_stock" && isLowStockProduct(product)) ||
        (stockFilter === "out_of_stock" && isProductUnavailable(product));

      return matchesSearch && matchesCategory && matchesQuickFilter && matchesStock;
    });

    return [...filtered].sort((left, right) => {
      if (quickFilter === "best_seller" && sortMode === "default") {
        return Number(right.salePrice || 0) - Number(left.salePrice || 0);
      }

      if (sortMode === "name_asc") {
        return left.name.localeCompare(right.name, "vi");
      }

      if (sortMode === "price_asc") {
        return Number(left.salePrice || 0) - Number(right.salePrice || 0);
      }

      if (sortMode === "price_desc") {
        return Number(right.salePrice || 0) - Number(left.salePrice || 0);
      }

      return 0;
    });
  }, [categoryFilter, products, quickFilter, search, sortMode, stockFilter]);

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

    if (product.status === "out_of_stock" || !product.isAvailable) {
      setErrorMessage(`${product.name} đã ngừng bán hoặc hết hàng.`);
      return;
    }

    if (product.isTrackedStock && product.stockQuantity !== null && product.stockQuantity <= 0) {
      setErrorMessage(`${product.name} đã hết hàng.`);
      return;
    }

    setCartItems((currentItems) => {
      const existedItem = currentItems.find((item) => item.product.id === product.id);

      if (!existedItem) {
        return [...currentItems, { product, quantity: 1 }];
      }

      if (product.isTrackedStock && product.stockQuantity !== null && existedItem.quantity >= product.stockQuantity) {
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
    const item = cartItems.find((i) => i.product.id === productId);
    if (item) {
      const maxQty = (item.product.isTrackedStock && item.product.stockQuantity !== null)
        ? item.product.stockQuantity
        : 9999;
      const newQty = Math.min(Math.max(quantity, 0), maxQty);
      if (newQty < item.quantity) {
        const diff = item.quantity - newQty;
        void createAuditLog({
          actionType: "HUY_MON",
          targetObject: `Món: ${item.product.name}`,
          description: `Giảm số lượng món '${item.product.name}' trong giỏ hàng (Giảm đi ${diff} phần, còn lại ${newQty} phần).`
        }).catch(console.error);
      }
    }

    setCartItems((currentItems) =>
      currentItems
        .map((item) => {
          const maxQty = (item.product.isTrackedStock && item.product.stockQuantity !== null)
            ? item.product.stockQuantity
            : 9999;
          return item.product.id === productId
            ? {
              ...item,
              quantity: Math.min(Math.max(quantity, 0), maxQty),
            }
            : item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    const item = cartItems.find((i) => i.product.id === productId);
    if (item) {
      void createAuditLog({
        actionType: "HUY_MON",
        targetObject: `Món: ${item.product.name}`,
        description: `Hủy món khỏi giỏ hàng đang chờ: ${item.product.name} (Số lượng: ${item.quantity}).`
      }).catch(console.error);
    }

    setCartItems((currentItems) =>
      currentItems.filter((item) => item.product.id !== productId)
    );
  };

  const clearCart = () => {
    if (cartItems.length > 0) {
      void createAuditLog({
        actionType: "HUY_MON",
        targetObject: `Giỏ hàng POS`,
        description: `Thu ngân xóa sạch toàn bộ giỏ hàng (Số mặt hàng đã xóa: ${cartItems.length}).`
      }).catch(console.error);
    }

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
        discountAmount,
      });

      setShowPaymentConfirmModal(false);
      setShowQrModal(false);
      setCompletedOrder(response.data);
      if (response.data.alerts && response.data.alerts.length > 0) {
        setLowStockAlerts(response.data.alerts);
      } else {
        setLowStockAlerts([]);
      }
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

  const handleSaveOpeningCash = async () => {
    if (!activeShift || activeShift.id === "admin_bypass") return;
    const openingCash = Number(openingCashInput);
    if (!Number.isFinite(openingCash) || openingCash <= 0) {
      setErrorMessage("Vui lòng nhập tiền đầu ca lớn hơn 0.");
      return;
    }

    try {
      setIsSavingOpeningCash(true);
      setErrorMessage("");
      const updatedShift = await setShiftOpeningCash(activeShift.id, openingCash);
      setActiveShift(updatedShift);
      setOpeningCashInput("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không thể nhập tiền đầu ca.");
    } finally {
      setIsSavingOpeningCash(false);
    }
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
            <h2 className="font-['Outfit',sans-serif] text-xl font-extrabold text-[#0b1c30]">
              POS Đã Khóa
            </h2>
            <p className="text-sm font-medium text-slate-600 leading-relaxed">
              Bạn chưa có ca làm việc nào đang mở. Vui lòng liên hệ Quản lý hoặc Admin để mở ca trước khi bán hàng.
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (activeShift.id !== "admin_bypass" && Number(activeShift.openingCash || 0) <= 0) {
    return (
      <AdminLayout title="Bán hàng">
        <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-6 flex items-start gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316]">
                <Icon name="payments" className="text-3xl" />
              </span>
              <div>
                <h2 className="font-['Outfit',sans-serif] text-xl font-extrabold text-[#0b1c30]">
                  Nhập tiền đầu ca
                </h2>
                <p className="mt-1 text-sm font-medium leading-relaxed text-slate-500">
                  Ca đã được mở. Vui lòng nhập tiền đầu ca để bắt đầu bán hàng trên POS.
                </p>
              </div>
            </div>

            {errorMessage ? (
              <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-600">
                {errorMessage}
              </div>
            ) : null}

            <label className="block">
              <span className="mb-2 block text-xs font-extrabold uppercase text-slate-500">
                Tiền đầu ca
              </span>
              <input
                type="number"
                min={1}
                value={openingCashInput}
                onChange={(event) => setOpeningCashInput(event.target.value)}
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 outline-none focus:border-[#f97316] focus:bg-white"
                placeholder="Ví dụ: 500000"
              />
            </label>

            <button
              type="button"
              onClick={handleSaveOpeningCash}
              disabled={isSavingOpeningCash}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#f97316] px-5 text-sm font-extrabold text-white transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icon name="storefront" className="text-[19px]" />
              {isSavingOpeningCash ? "Đang lưu..." : "Bắt đầu bán hàng"}
            </button>
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
      <div className="flex h-full min-h-0 gap-4 overflow-hidden">
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="hidden">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="relative min-w-0 flex-1">
                <Icon
                  name="search"
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-slate-400"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm món theo tên, SKU hoặc barcode..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <div className="relative flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFilters((current) => !current)}
                  className={[
                    "flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-extrabold transition",
                    showFilters || stockFilter !== "all"
                      ? "border-[#f97316] bg-orange-50 text-[#f97316]"
                      : "border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50 hover:text-[#f97316]",
                  ].join(" ")}
                  aria-expanded={showFilters}
                >
                  <Icon name="tune" className="text-[19px]" />
                  Bộ lọc
                </button>

                {showFilters ? (
                  <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                    <label className="block">
                      <span className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-slate-400">
                        Tồn kho
                      </span>
                      <select
                        value={stockFilter}
                        onChange={(event) => setStockFilter(event.target.value as PosStockFilter)}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                      >
                        <option value="all">Tất cả trạng thái</option>
                        <option value="available">Đang bán</option>
                        <option value="low_stock">Sắp hết hàng</option>
                        <option value="out_of_stock">Hết hàng</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setStockFilter("all");
                        setShowFilters(false);
                      }}
                      className="mt-3 w-full rounded-xl bg-slate-50 px-3 py-2 text-sm font-extrabold text-slate-600 transition hover:bg-orange-50 hover:text-[#f97316]"
                    >
                      Xóa bộ lọc
                    </button>
                  </div>
                ) : null}

                <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
                  <span>Sắp xếp</span>
                  <select
                    value={sortMode}
                    onChange={(event) => setSortMode(event.target.value as PosSortMode)}
                    className="h-full min-w-[7.5rem] bg-transparent text-sm font-extrabold outline-none"
                    aria-label="Sắp xếp sản phẩm"
                  >
                    <option value="default">Mặc định</option>
                    <option value="name_asc">Tên A-Z</option>
                    <option value="price_asc">Giá thấp</option>
                    <option value="price_desc">Giá cao</option>
                  </select>
                </label>

                <div className="flex h-11 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={[
                      "flex w-11 items-center justify-center transition",
                      viewMode === "grid" ? "bg-[#f97316] text-white" : "text-slate-500 hover:bg-orange-50 hover:text-[#f97316]",
                    ].join(" ")}
                    aria-label="Hiển thị dạng lưới"
                    aria-pressed={viewMode === "grid"}
                  >
                    <Icon name="grid_view" className="text-[20px]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={[
                      "flex w-11 items-center justify-center border-l border-slate-200 transition",
                      viewMode === "list" ? "bg-[#f97316] text-white" : "text-slate-500 hover:bg-orange-50 hover:text-[#f97316]",
                    ].join(" ")}
                    aria-label="Hiển thị dạng danh sách"
                    aria-pressed={viewMode === "list"}
                  >
                    <Icon name="view_list" className="text-[21px]" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter("all");
                  setQuickFilter("all");
                }}
                className={[
                  "h-10 whitespace-nowrap rounded-full px-5 text-sm font-extrabold transition-colors",
                  categoryFilter === "all" && quickFilter === "all"
                    ? "bg-[#f97316] text-white shadow-sm shadow-orange-100"
                    : "bg-slate-50 text-slate-700 hover:bg-orange-50 hover:text-[#f97316]",
                ].join(" ")}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuickFilter("best_seller");
                  setCategoryFilter("all");
                }}
                className={[
                  "flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-5 text-sm font-extrabold transition-colors",
                  quickFilter === "best_seller"
                    ? "bg-[#f97316] text-white shadow-sm shadow-orange-100"
                    : "bg-slate-50 text-slate-700 hover:bg-orange-50 hover:text-[#f97316]",
                ].join(" ")}
              >
                <Icon name="local_fire_department" className="text-[17px]" />
                Bán chạy
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(category);
                    setQuickFilter("all");
                  }}
                  className={[
                    "h-10 whitespace-nowrap rounded-full px-5 text-sm font-extrabold transition-colors",
                    categoryFilter === category && quickFilter === "all"
                      ? "bg-[#f97316] text-white shadow-sm shadow-orange-100"
                      : "bg-slate-50 text-slate-700 hover:bg-orange-50 hover:text-[#f97316]",
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
                <h2 className="font-['Outfit',sans-serif] text-xl font-extrabold text-[#0b1c30]">
                  Thực đơn
                </h2>
                <p className="text-sm text-slate-500">
                  {isLoading
                    ? "Đang tải sản phẩm..."
                    : `${filteredProducts.length} sản phẩm trong thực đơn.`}
                </p>
              </div>
            </div>

            <div className="mb-4 space-y-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <div className="relative min-w-0 flex-1">
                  <Icon
                    name="search"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-slate-400"
                  />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Tìm món theo tên, SKU hoặc barcode..."
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                  />
                </div>

                <div className="relative flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFilters((current) => !current)}
                    className={[
                      "flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-extrabold transition",
                      showFilters || stockFilter !== "all"
                        ? "border-[#f97316] bg-orange-50 text-[#f97316]"
                        : "border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50 hover:text-[#f97316]",
                    ].join(" ")}
                    aria-expanded={showFilters}
                  >
                    <Icon name="tune" className="text-[19px]" />
                    Bộ lọc
                  </button>

                  {showFilters ? (
                    <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                      <label className="block">
                        <span className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-slate-400">
                          Tồn kho
                        </span>
                        <select
                          value={stockFilter}
                          onChange={(event) => setStockFilter(event.target.value as PosStockFilter)}
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-orange-100"
                        >
                          <option value="all">Tất cả trạng thái</option>
                          <option value="available">Đang bán</option>
                          <option value="low_stock">Sắp hết hàng</option>
                          <option value="out_of_stock">Hết hàng</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setStockFilter("all");
                          setShowFilters(false);
                        }}
                        className="mt-3 w-full rounded-xl bg-slate-50 px-3 py-2 text-sm font-extrabold text-slate-600 transition hover:bg-orange-50 hover:text-[#f97316]"
                      >
                        Xóa bộ lọc
                      </button>
                    </div>
                  ) : null}

                  <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
                    <span>Sắp xếp</span>
                    <select
                      value={sortMode}
                      onChange={(event) => setSortMode(event.target.value as PosSortMode)}
                      className="h-full min-w-[7.5rem] bg-transparent text-sm font-extrabold outline-none"
                      aria-label="Sắp xếp sản phẩm"
                    >
                      <option value="default">Mặc định</option>
                      <option value="name_asc">Tên A-Z</option>
                      <option value="price_asc">Giá thấp</option>
                      <option value="price_desc">Giá cao</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter("all");
                    setQuickFilter("all");
                  }}
                  className={[
                    "h-10 whitespace-nowrap rounded-full px-5 text-sm font-extrabold transition-colors",
                    categoryFilter === "all" && quickFilter === "all"
                      ? "bg-[#f97316] text-white shadow-sm shadow-orange-100"
                      : "bg-slate-50 text-slate-700 hover:bg-orange-50 hover:text-[#f97316]",
                  ].join(" ")}
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuickFilter("best_seller");
                    setCategoryFilter("all");
                  }}
                  className={[
                    "flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-5 text-sm font-extrabold transition-colors",
                    quickFilter === "best_seller"
                      ? "bg-[#f97316] text-white shadow-sm shadow-orange-100"
                      : "bg-slate-50 text-slate-700 hover:bg-orange-50 hover:text-[#f97316]",
                  ].join(" ")}
                >
                  <Icon name="local_fire_department" className="text-[17px]" />
                  Bán chạy
                </button>
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => {
                      setCategoryFilter(category);
                      setQuickFilter("all");
                    }}
                    className={[
                      "h-10 whitespace-nowrap rounded-full px-5 text-sm font-extrabold transition-colors",
                      categoryFilter === category && quickFilter === "all"
                        ? "bg-[#f97316] text-white shadow-sm shadow-orange-100"
                        : "bg-slate-50 text-slate-700 hover:bg-orange-50 hover:text-[#f97316]",
                    ].join(" ")}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pb-36 pr-1 xl:pb-0">
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                  {filteredProducts.map((product) => (
                    <ProductCard key={product.id} product={product} onAdd={addToCart} />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredProducts.map((product) => {
                    const isUnavailable = isProductUnavailable(product);

                    return (
                      <article
                        key={product.id}
                        className={[
                          "flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-orange-100 hover:shadow-md",
                          isUnavailable ? "opacity-60" : "",
                        ].join(" ")}
                      >
                        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-orange-50 text-[#f97316]">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className={[
                                "h-full w-full object-contain p-1",
                                isUnavailable ? "grayscale" : "",
                              ].join(" ")}
                            />
                          ) : (
                            <Icon name="restaurant" className="text-[28px]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-extrabold text-[#0b1c30]">{product.name}</p>
                          <p className="mt-1 truncate text-xs font-semibold text-slate-400">
                            SKU: {product.sku} {product.categoryName ? `- ${product.categoryName}` : ""}
                          </p>
                        </div>
                        <span className="hidden rounded-full bg-slate-50 px-3 py-1 text-xs font-extrabold text-slate-500 sm:inline-flex">
                          {isUnavailable
                            ? "Hết hàng"
                            : product.isTrackedStock
                              ? `Còn ${product.stockQuantity}`
                              : "Đang bán"}
                        </span>
                        <p className="w-28 text-right text-sm font-extrabold text-[#f97316]">
                          {formatCurrency(product.salePrice)}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            if (!isUnavailable) addToCart(product);
                          }}
                          disabled={isUnavailable}
                          className={[
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition",
                            isUnavailable
                              ? "cursor-not-allowed bg-slate-100 text-slate-400"
                              : "bg-orange-50 text-[#f97316] hover:bg-[#f97316] hover:text-white",
                          ].join(" ")}
                          aria-label={`Thêm ${product.name} vào giỏ`}
                        >
                          <Icon name="add" />
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}

              {!isLoading && filteredProducts.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center text-center text-slate-400">
                  <Icon name="search_off" className="mb-2 text-4xl" />
                  <p className="text-sm font-semibold">Không tìm thấy sản phẩm phù hợp.</p>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <aside className="hidden w-100 shrink-0 xl:block">
          <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="flex items-center gap-2 font-['Outfit',sans-serif] text-lg font-extrabold text-[#0b1c30]">
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

      {lowStockAlerts.length > 0 ? (
        <div className="fixed top-6 right-6 z-[60] w-96 rounded-2xl border-2 border-red-500 bg-white/95 p-5 shadow-2xl shadow-red-100 backdrop-blur-md">
          <div className="mb-3 flex items-start justify-between">
            <div className="flex items-center gap-2 text-red-600">
              {/* Chấm tròn hiệu ứng Ping nhấp nháy liên tục */}
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <Icon name="warning" className="text-xl" />
              <h3 className="font-['Outfit',sans-serif] text-sm font-extrabold uppercase tracking-wide">
                Cảnh báo hết nguyên liệu!
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setLowStockAlerts([])}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <Icon name="close" className="text-sm font-bold" />
            </button>
          </div>
          <p className="mb-4 text-xs font-semibold text-slate-500">
            Các nguyên liệu thô sau đây đã chạm hoặc dưới ngưỡng cảnh báo an toàn. Vui lòng bổ sung kho gấp:
          </p>
          <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1">
            {lowStockAlerts.map((alert, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-xl bg-red-50 border border-red-100 p-3 text-xs"
              >
                <div className="font-bold text-[#0b1c30]">{alert.name}</div>
                <div className="text-right">
                  <span className="font-extrabold text-red-600">
                    {alert.stockQuantity}
                  </span>
                  <span className="text-slate-400 font-medium"> / {alert.minStock} (tối thiểu)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}

export default PosPage;
