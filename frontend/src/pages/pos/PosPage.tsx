import { useCallback, useEffect, useMemo, useState } from "react";
import { getProducts, type Product } from "../../api/product.api";
import { API_BASE_URL } from "../../api/api-base";
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
import {
  fetchShifts,
  setShiftOpeningCash,
  type Shift,
} from "../../api/shifts.api";
import PaymentConfirmModal from "../../components/pos/PaymentConfirmModal";
import ProductCard from "../../components/pos/ProductCard";
import QrPaymentModal from "../../components/pos/QrPaymentModal";
import ReceiptModal from "../../components/pos/ReceiptModal";
import AdminLayout, { Icon } from "../../layouts/AdminLayout";
import { useAppNotifications } from "../../components/common/AppNotificationsContext";
import Pagination from "../../components/common/Pagination";
import {
  deleteCartDraft,
  getCartDraft,
  listOutboxOrders,
  loadPosSnapshot,
  saveCartDraft,
  savePosSnapshot,
  saveProductsSnapshot,
  subscribeOfflineChanges,
} from "../../offline/db";
import { submitOfflineCashOrder } from "../../offline/offlineOrderService";
import { calculateOfflinePromotionPreview } from "../../offline/promotion";
import { syncOutbox } from "../../offline/syncOutbox";
import type { OutboxOrder } from "../../offline/types";

type CartItem = {
  product: Product;
  quantity: number;
};

type PosSortMode = "default" | "name_asc" | "price_asc" | "price_desc";
type PosViewMode = "grid" | "list";

const productsPerPage = 20;

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

function getActiveShiftFromSnapshot(shifts: Shift[]) {
  const { currentUserId, roleName } = getStoredPosUser();
  if (roleName === "admin" || roleName === "manager") {
    return { id: "admin_bypass", status: "OPEN" } as unknown as Shift;
  }

  return (
    shifts.find(
      (shift) => shift.status === "OPEN" && shift.userId === currentUserId
    ) ?? null
  );
}

async function probeBackend() {
  if (!navigator.onLine) return false;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      cache: "no-store",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function isProductUnavailable(product: Product) {
  return (
    product.status === "out_of_stock" ||
    !product.isAvailable ||
    (product.isTrackedStock && product.stockQuantity != null && product.stockQuantity <= 0)
  );
}

function hydrateCartProducts(items: CartItem[], products: Product[]) {
  const productsById = new Map(products.map((product) => [product.id, product]));
  return items.map((item) => ({
    ...item,
    product: productsById.get(item.product.id) ?? item.product,
  }));
}

function getCartQuantity(
  cartItems: CartItem[],
  productId: string | null,
  productName?: string | null
) {
  const normalizedName = String(productName ?? "").trim().toLocaleLowerCase("vi-VN");
  return cartItems
    .filter((item) => {
      if (productId && item.product.id === productId) return true;
      if (!normalizedName) return false;
      return item.product.name.toLocaleLowerCase("vi-VN").includes(normalizedName);
    })
    .reduce((total, item) => total + item.quantity, 0);
}

function isPromotionEligibleForCart(promotion: Promotion, cartItems: CartItem[]) {
  if (cartItems.length === 0) return false;

  if (promotion.promotionScope === "product") {
    return getCartQuantity(cartItems, promotion.productId, promotion.productName) > 0;
  }

  return promotion.requiredItems.every(
    (item) =>
      getCartQuantity(cartItems, item.productId, item.productName) >=
      item.quantity
  );
}

function getPromotionConditionLabel(promotion: Promotion) {
  if (promotion.promotionScope === "product") {
    return promotion.productName;
  }

  return promotion.requiredItems
    .map((item) => `${item.productName} x${item.quantity}`)
    .join(" + ");
}

function getPromotionDiscountLabel(promotion: Promotion) {
  return promotion.discountType === "percent"
    ? `-${promotion.discountValue}%`
    : `-${formatCurrency(promotion.discountValue)}`;
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
  const [sortMode, setSortMode] = useState<PosSortMode>("default");
  const [viewMode, setViewMode] = useState<PosViewMode>("grid");
  const [productPage, setProductPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [completedOrder, setCompletedOrder] = useState<PosOrderResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const { notify } = useAppNotifications();
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
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [outboxOrders, setOutboxOrders] = useState<OutboxOrder[]>([]);
  const [offlineReady, setOfflineReady] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      const response = await getProducts();
      setProducts(response.data);
      setProductPage(1);
      try {
        await saveProductsSnapshot(response.data);
      } catch (snapshotError) {
        console.error("Không cập nhật được snapshot sản phẩm:", snapshotError);
      }
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Không tải được sản phẩm. Vui lòng thử lại.",
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  }, [notify]);

  const refreshOfflineState = useCallback(async () => {
    const orders = await listOutboxOrders();
    setOutboxOrders(orders);
  }, []);

  const displayedCompletedOrder = useMemo(() => {
    if (!completedOrder) return null;

    const currentOutboxOrder = outboxOrders.find(
      (order) =>
        order.localOrderId === completedOrder.localOrderId ||
        order.operationId === completedOrder.operationId
    );

    return currentOutboxOrder?.receipt ?? completedOrder;
  }, [completedOrder, outboxOrders]);

  const runOutboxSync = useCallback(async () => {
    if (!navigator.onLine) {
      setIsOnline(false);
      return;
    }

    try {
      setIsOnline(true);
      const backendAvailable = await probeBackend();
      if (!backendAvailable) {
        return;
      }
      const summary = await syncOutbox();
      await refreshOfflineState();
      if (summary.networkUnavailable) {
        return;
      }
      if (summary.synced > 0) {
        await loadProducts();
        notify(
          `Đã đồng bộ ${summary.synced} đơn offline lên hệ thống.`,
          "success"
        );
      }
      if (summary.rejected > 0) {
        notify(
          `${summary.rejected} đơn offline cần kiểm tra trước khi ghi nhận.`,
          "error"
        );
      }
    } catch (error) {
      console.error("Không chạy được POS outbox sync:", error);
      notify("Không đọc hoặc cập nhật được hàng đợi offline.", "error");
    }
  }, [loadProducts, notify, refreshOfflineState]);

  function handleProductSearchChange(value: string) {
    setSearch(value);
    setProductPage(1);
  }

  function handleProductCategoryFilterChange(value: string) {
    setCategoryFilter(value);
    setProductPage(1);
  }

  function handleProductSortModeChange(value: PosSortMode) {
    setSortMode(value);
    setProductPage(1);
  }

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
      if (!isOnline) {
        const offlinePreview = calculateOfflinePromotionPreview(
          cartItems,
          promotions,
          code
        );
        if (!offlinePreview.appliedPromotion) {
          throw new Error("Mã khuyến mãi không có trong snapshot offline.");
        }
        setPromotionPreview(offlinePreview);
        setIsPromotionError(false);
        setPromoMessage("Đã áp dụng theo snapshot offline gần nhất.");
        return;
      }

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
  }, [cartItems, isOnline, promotions]);

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

    if (!isOnline) {
      Promise.resolve().then(() => {
        if (!isMounted) return;
        try {
          const preview = calculateOfflinePromotionPreview(
            cartItems,
            promotions,
            promotionCode.trim() || null
          );
          if (promotionCode.trim() && !preview.appliedPromotion) {
            throw new Error("Mã khuyến mãi không có trong snapshot offline.");
          }
          setPromotionPreview(preview);
          setIsPromotionError(false);
          setPromoMessage(
            preview.appliedPromotion
              ? "Đã áp dụng theo snapshot offline gần nhất."
              : ""
          );
        } catch (error) {
          setPromotionPreview(null);
          setIsPromotionError(Boolean(promotionCode.trim()));
          setPromoMessage(
            error instanceof Error ? error.message : "Mã khuyến mãi không hợp lệ."
          );
        }
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
  }, [cartItems, isOnline, promotionCode, promotions]);

  useEffect(() => {
    let isMounted = true;

    async function initializePos() {
      let cachedProducts: Product[] = [];
      let cachedPromotions: Promotion[] = [];
      let cachedShifts: Shift[] = [];

      try {
        const { currentUserId } = getStoredPosUser();
        const [snapshot, draft, orders] = await Promise.all([
          loadPosSnapshot(),
          getCartDraft(currentUserId || "anonymous"),
          listOutboxOrders(),
        ]);
        if (!isMounted) return;

        cachedProducts = snapshot.products;
        cachedPromotions = snapshot.promotions;
        cachedShifts = snapshot.shifts;
        setProducts(snapshot.products);
        setPromotions(snapshot.promotions);
        setActiveShift(getActiveShiftFromSnapshot(snapshot.shifts));
        setOutboxOrders(orders);

        if (draft && draft.userId === currentUserId) {
          setCartItems(hydrateCartProducts(draft.items, snapshot.products));
          setPaymentMethod(
            navigator.onLine && draft.paymentMethod === "qr" ? "qr" : "cash"
          );
          setNote(draft.note);
          setPromotionCode(draft.promotionCode);
          setCashPaid(draft.cashPaid);
          setCustomerPhone(draft.customerPhone);
        }

        setDraftHydrated(true);
        setOfflineReady(true);
        if (snapshot.products.length > 0) setIsLoading(false);
      } catch (error) {
        if (!isMounted) return;
        setDraftHydrated(true);
        setOfflineReady(true);
        console.error("Không đọc được dữ liệu POS offline:", error);
      }

      if (!navigator.onLine) {
        if (!isMounted) return;
        setIsOnline(false);
        setIsLoading(false);
        return;
      }
      setIsOnline(true);

      const backendAvailable = await probeBackend();
      if (!isMounted) return;
      if (!backendAvailable) {
        setIsLoading(false);
        notify(
          "Wi-Fi đang kết nối nhưng máy chủ chưa truy cập được. POS sẽ không lưu đơn dự phòng trong trường hợp này.",
          "error"
        );
        return;
      }

      const [productResult, promotionResult, shiftResult] =
        await Promise.allSettled([
          getProducts(),
          fetchPromotions(),
          fetchShifts(),
        ]);
      if (!isMounted) return;

      const nextProducts =
        productResult.status === "fulfilled"
          ? productResult.value.data
          : cachedProducts;
      const nextPromotions =
        promotionResult.status === "fulfilled"
          ? promotionResult.value
          : cachedPromotions;
      const nextShifts =
        shiftResult.status === "fulfilled" ? shiftResult.value : cachedShifts;
      const hasRemoteData =
        productResult.status === "fulfilled" ||
        promotionResult.status === "fulfilled" ||
        shiftResult.status === "fulfilled";

      setProducts(nextProducts);
      setCartItems((currentItems) =>
        hydrateCartProducts(currentItems, nextProducts)
      );
      setPromotions(nextPromotions);
      setPromotionFilterTime(Date.now());
      setActiveShift(getActiveShiftFromSnapshot(nextShifts));
      setIsOnline(true);

      if (hasRemoteData) {
        try {
          await savePosSnapshot(nextProducts, nextPromotions, nextShifts);
        } catch (error) {
          console.error("Không lưu được snapshot POS:", error);
        }
      } else if (cachedProducts.length > 0) {
        notify(
          "Wi-Fi đang kết nối nhưng máy chủ chưa truy cập được. POS sẽ không lưu đơn dự phòng trong trường hợp này.",
          "error"
        );
      }

      if (isMounted) setIsLoading(false);
    }

    void initializePos();
    return () => {
      isMounted = false;
    };
  }, [notify]);

  useEffect(() => {
    if (!draftHydrated) return undefined;

    const { currentUserId } = getStoredPosUser();
    const draftId = currentUserId || "anonymous";
    const timer = window.setTimeout(() => {
      const hasDraft =
        cartItems.length > 0 ||
        note.trim().length > 0 ||
        promotionCode.trim().length > 0 ||
        cashPaid.length > 0 ||
        customerPhone.length > 0;

      const operation = hasDraft
        ? saveCartDraft({
            id: draftId,
            userId: currentUserId,
            items: cartItems,
            paymentMethod,
            note,
            promotionCode,
            cashPaid,
            customerPhone,
            savedAt: new Date().toISOString(),
          })
        : deleteCartDraft(draftId);
      void operation.catch((error) => {
        console.error("Không lưu được giỏ hàng offline:", error);
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    cartItems,
    cashPaid,
    customerPhone,
    draftHydrated,
    note,
    paymentMethod,
    promotionCode,
  ]);

  useEffect(() => subscribeOfflineChanges(() => void refreshOfflineState()), [
    refreshOfflineState,
  ]);

  useEffect(() => {
    const applyOfflineState = () => {
      setIsOnline(false);
      setPaymentMethod("cash");
      setShowQrModal(false);
    };
    const handleOffline = applyOfflineState;
    const handleOnline = () => {
      setIsOnline(true);
      void runOutboxSync();
    };
    if (!navigator.onLine) {
      applyOfflineState();
    }
    const interval = window.setInterval(() => {
      if (!navigator.onLine) {
        applyOfflineState();
        return;
      }
      void runOutboxSync();
    }, 45_000);

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      window.clearInterval(interval);
    };
  }, [runOutboxSync]);

  useEffect(() => {
    if (!offlineReady || !isOnline) return undefined;
    const timer = window.setTimeout(() => void runOutboxSync(), 0);
    return () => window.clearTimeout(timer);
  }, [isOnline, offlineReady, runOutboxSync]);

  useEffect(() => {
    const phone = customerPhone.replace(/\D/g, "");

    if (phone.length < 8) {
      Promise.resolve().then(() => {
        setMatchedCustomer(null);
        setCustomerLookupMessage("");
      });
      return undefined;
    }

    if (!isOnline) {
      Promise.resolve().then(() => {
        setMatchedCustomer(null);
        setCustomerLookupMessage(
          "Đang offline: hóa đơn sẽ lưu số điện thoại và đối chiếu khi đồng bộ."
        );
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
  }, [customerPhone, isOnline]);

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
      return matchesSearch && matchesCategory;
    });

    return [...filtered].sort((left, right) => {
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
  }, [categoryFilter, products, search, sortMode]);

  const totalProductPages = Math.max(1, Math.ceil(filteredProducts.length / productsPerPage));
  const currentProductPage = Math.min(productPage, totalProductPages);
  const paginatedProducts = filteredProducts.slice(
    (currentProductPage - 1) * productsPerPage,
    currentProductPage * productsPerPage
  );

  const activePromotions = useMemo(() => {
    return promotions.filter((item) => {
      const startsOk =
        !item.startAt || new Date(item.startAt).getTime() <= promotionFilterTime;
      const endsOk =
        !item.endAt || new Date(item.endAt).getTime() > promotionFilterTime;
      return item.isActive && startsOk && endsOk;
    });
  }, [promotionFilterTime, promotions]);

  const promotionOptions = useMemo(() => {
    return activePromotions.map((promotion) => ({
      promotion,
      isEligible: isPromotionEligibleForCart(promotion, cartItems),
      conditionLabel: getPromotionConditionLabel(promotion),
      discountLabel: getPromotionDiscountLabel(promotion),
    }));
  }, [activePromotions, cartItems]);

  const eligiblePromotionOptions = useMemo(
    () => promotionOptions.filter((item) => item.isEligible),
    [promotionOptions]
  );

  const ineligiblePromotionOptions = useMemo(
    () => promotionOptions.filter((item) => !item.isEligible),
    [promotionOptions]
  );

  const selectedPromotion = useMemo(
    () =>
      activePromotions.find(
        (promotion) => promotion.code === promotionCode.trim().toUpperCase()
      ) ?? null,
    [activePromotions, promotionCode]
  );

  const handlePromotionSelect = (code: string) => {
    const normalizedCode = code.trim().toUpperCase();
    setPromotionCode(normalizedCode);
    setPromoMessage("");
    if (normalizedCode) {
      void validatePromotion(normalizedCode);
    } else {
      setPromotionPreview(null);
      setIsPromotionError(false);
    }
  };

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
  const promotionDiscountLabel = selectedPromotion
    ? getPromotionDiscountLabel(selectedPromotion)
    : "";
  const promotionTotalLabel = promotionPreview?.appliedPromotion
    ? [
        promotionPreview.appliedPromotion.name,
        promotionPreview.appliedPromotion.code
          ? `(${promotionPreview.appliedPromotion.code})`
          : "",
        promotionDiscountLabel,
      ]
        .filter(Boolean)
        .join(" ")
    : "Giảm giá";

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
    
    if (product.status === "out_of_stock" || !product.isAvailable) {
      notify(
`${product.name} đã ngừng bán hoặc hết hàng.`,
"error"
);
      return;
    }

    if (product.isTrackedStock && product.stockQuantity != null && product.stockQuantity <= 0) {
      notify(
`${product.name} đã hết hàng.`,
"error"
);
      return;
    }

    setCartItems((currentItems) => {
      const existedItem = currentItems.find((item) => item.product.id === product.id);

      if (!existedItem) {
        return [...currentItems, { product, quantity: 1 }];
      }

      if (product.isTrackedStock && product.stockQuantity != null && existedItem.quantity >= product.stockQuantity) {
        notify(
`${product.name} chỉ còn ${product.stockQuantity} sản phẩm.`,
"error"
);
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
      const maxQty = (item.product.isTrackedStock && item.product.stockQuantity != null)
        ? (item.product.stockQuantity as number)
        : 9999;
      const newQty = Math.min(Math.max(quantity, 0), maxQty);
      if (isOnline && newQty < item.quantity) {
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
          const maxQty = (item.product.isTrackedStock && item.product.stockQuantity != null)
            ? (item.product.stockQuantity as number)
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
    if (item && isOnline) {
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
    if (cartItems.length > 0 && isOnline) {
      void createAuditLog({
        actionType: "HUY_MON",
        targetObject: `Giỏ hàng POS`,
        description: `Thu ngân xóa sạch toàn bộ giỏ hàng (Số mặt hàng đã xóa: ${cartItems.length}).`
      }).catch(console.error);
    }

    resetCartState();
  };

  const resetCartState = () => {
    setCartItems([]);
    setNote("");
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

      if (paymentMethod === "cash" && !navigator.onLine) {
        const { currentUserId } = getStoredPosUser();
        const result = await submitOfflineCashOrder({
          items: cartItems,
          userId: currentUserId,
          shiftId:
            activeShift?.id && activeShift.id !== "admin_bypass"
              ? activeShift.id
              : null,
          customerId: matchedCustomer?.id ?? null,
          customerPhone: customerPhone.replace(/\D/g, "") || null,
          note: note.trim() || "Bán tại quầy",
          promotionCode: promotionCode.trim() || null,
          promotionPreview,
          cashPaid: cashPaidAmount,
        });

        setShowPaymentConfirmModal(false);
        setShowQrModal(false);
        setCompletedOrder(result.order);
        setProducts(result.products);
        setPromotionPreview(null);
        setIsPromotionError(false);
        resetCartState();
        await refreshOfflineState();

        notify(
          "Đã lưu hóa đơn trên máy POS do mất Wi-Fi. Đơn sẽ tự đồng bộ khi có kết nối lại.",
          "success"
        );
        return;
      }

      if (!navigator.onLine) {
        throw new Error("Thanh toán QR cần kết nối backend.");
      }

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
      setPromotionPreview(null);
      setIsPromotionError(false);
      setPromotionCode("");
      resetCartState();
      await loadProducts();
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Chưa tạo được hóa đơn. Vui lòng thử lại.",
        "error"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      notify(
"Vui lòng chọn ít nhất một sản phẩm.",
"error"
);
      return;
    }

    if (!isPromotionApplicable) {
      notify(
displayedPromoMessage,
"error"
);
      return;
    }

    if (paymentMethod === "qr" && (!isOnline || !navigator.onLine)) {
      notify("Thanh toán QR không khả dụng khi offline.", "error");
      setPaymentMethod("cash");
      return;
    }

    if (paymentMethod === "cash" && finalAmount > 0 && cashPaidAmount < finalAmount) {
      notify(
"Tiền khách đưa chưa đủ để thanh toán.",
"error"
);
      return;
    }

        setShowPaymentConfirmModal(true);
  };

  const handleConfirmPayment = async () => {
    if (paymentMethod === "qr" && finalAmount > 0) {
      if (!isOnline || !navigator.onLine) {
        notify("Thanh toán QR không khả dụng khi offline.", "error");
        setPaymentMethod("cash");
        setShowPaymentConfirmModal(false);
        return;
      }
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
      notify(
"Vui lòng nhập tiền đầu ca lớn hơn 0.",
"error"
);
      return;
    }

    try {
      setIsSavingOpeningCash(true);
            const updatedShift = await setShiftOpeningCash(activeShift.id, openingCash);
      setActiveShift(updatedShift);
      setOpeningCashInput("");
    } catch (error) {
      notify(
error instanceof Error ? error.message : "Không thể nhập tiền đầu ca.",
"error"
);
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
                  onChange={(event) => handleProductSearchChange(event.target.value)}
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
                    showFilters || categoryFilter !== "all"
                      ? "border-[#f97316] bg-orange-50 text-[#f97316]"
                      : "border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50 hover:text-[#f97316]",
                  ].join(" ")}
                  aria-expanded={showFilters}
                >
                  <Icon name="tune" className="text-[19px]" />
                  Bộ lọc
                </button>

                {showFilters ? (
                  <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.14)]">
                    <label className="block">
                      <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                        Danh mục sản phẩm
                      </span>
                      <select
                        value={categoryFilter}
                        onChange={(event) => handleProductCategoryFilterChange(event.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100"
                      >
                        <option value="all">Tất cả danh mục</option>
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        handleProductCategoryFilterChange("all");
                        setShowFilters(false);
                      }}
                      className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-extrabold text-slate-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#f97316]"
                    >
                      Xóa bộ lọc
                    </button>
                  </div>
                ) : null}

                <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
                  <span>Sắp xếp</span>
                  <select
                    value={sortMode}
                    onChange={(event) => handleProductSortModeChange(event.target.value as PosSortMode)}
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

          </div>

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
                    onChange={(event) => handleProductSearchChange(event.target.value)}
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
                      showFilters || categoryFilter !== "all"
                        ? "border-[#f97316] bg-orange-50 text-[#f97316]"
                        : "border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50 hover:text-[#f97316]",
                    ].join(" ")}
                    aria-expanded={showFilters}
                  >
                    <Icon name="tune" className="text-[19px]" />
                    Bộ lọc
                  </button>

                  {showFilters ? (
                    <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.14)]">
                      <label className="block">
                        <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                          Danh mục sản phẩm
                        </span>
                        <select
                          value={categoryFilter}
                          onChange={(event) => handleProductCategoryFilterChange(event.target.value)}
                          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-[#f97316] focus:bg-white focus:ring-4 focus:ring-orange-100"
                        >
                          <option value="all">Tất cả danh mục</option>
                          {categories.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          handleProductCategoryFilterChange("all");
                          setShowFilters(false);
                        }}
                        className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-extrabold text-slate-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#f97316]"
                      >
                        Xóa bộ lọc
                      </button>
                    </div>
                  ) : null}

                  <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
                    <span>Sắp xếp</span>
                    <select
                      value={sortMode}
                      onChange={(event) => handleProductSortModeChange(event.target.value as PosSortMode)}
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

            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pb-36 pr-1 xl:pb-0">
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                  {paginatedProducts.map((product) => (
                    <ProductCard key={product.id} product={product} onAdd={addToCart} />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedProducts.map((product) => {
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
                            {product.sku} {product.categoryName ? `- ${product.categoryName}` : ""}
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

            <div className="border-t border-slate-200 pt-3">
              <Pagination
                currentPage={currentProductPage}
                totalPages={totalProductPages}
                totalItems={filteredProducts.length}
                pageSize={productsPerPage}
                onPageChange={setProductPage}
                itemName="món"
              />
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

            <div className="min-h-32 flex-1 space-y-3 overflow-y-auto p-4">
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
                  className="rounded-xl bg-slate-50 p-2.5"
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm font-bold leading-5 text-[#0b1c30]">
                      {item.product.name}
                    </p>
                    <div className="mt-0.5 flex items-center justify-between gap-3 text-xs text-slate-500">
                      <span className="min-w-0 truncate">{item.product.sku}</span>
                      <span className="shrink-0 font-semibold text-[#0b1c30]">
                        {formatCurrency(item.product.salePrice)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-200/70 pt-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 shadow-sm hover:text-[#f97316]"
                        aria-label={`Giảm số lượng ${item.product.name}`}
                      >
                        −
                      </button>
                      <span className="min-w-6 text-center text-xs font-bold text-[#0b1c30]">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 shadow-sm hover:text-[#f97316]"
                        aria-label={`Tăng số lượng ${item.product.name}`}
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFromCart(item.product.id)}
                      className="rounded-lg p-1 text-red-500 hover:bg-red-50"
                      aria-label={`Xóa ${item.product.name} khỏi giỏ hàng`}
                    >
                      <Icon name="delete" className="text-[18px]" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="max-h-[64%] shrink-0 space-y-3 overflow-y-auto border-t border-slate-200 p-4">
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

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-[#0b1c30]">
                    Khuyến mãi
                  </span>
                  {promotionCode ? (
                    <button
                      type="button"
                      onClick={() => handlePromotionSelect("")}
                      className="text-xs font-bold text-red-500 hover:text-red-600"
                    >
                      Bỏ mã
                    </button>
                  ) : null}
                </div>

                {eligiblePromotionOptions.length > 0 ? (
                  <div className="max-h-24 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5">
                    {eligiblePromotionOptions.map(({ promotion, discountLabel, conditionLabel }) => {
                      const isSelected = promotionCode.trim().toUpperCase() === promotion.code;

                      return (
                        <button
                          key={promotion.id}
                          type="button"
                          onClick={() => handlePromotionSelect(promotion.code)}
                          className={[
                            "w-full rounded-lg border px-3 py-1.5 text-left transition",
                            isSelected
                              ? "border-[#f97316] bg-orange-50 text-[#9a3412]"
                              : "border-slate-100 bg-slate-50 text-slate-700 hover:border-orange-200 hover:bg-orange-50",
                          ].join(" ")}
                          aria-pressed={isSelected}
                        >
                          <span className="flex items-center justify-between gap-2 text-xs font-extrabold">
                            <span className="truncate">{promotion.code}</span>
                            <span className="shrink-0 text-[#f97316]">
                              {discountLabel}
                            </span>
                          </span>
                          <span className="mt-1 block truncate text-[11px] font-semibold text-slate-500">
                            {promotion.name} - {conditionLabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-500">
                    Chưa có mã phù hợp với giỏ hàng hiện tại.
                  </div>
                )}

                {ineligiblePromotionOptions.length > 0 ? (
                  <details className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-bold text-slate-500">
                      Mã chưa đủ điều kiện ({ineligiblePromotionOptions.length})
                    </summary>
                    <div className="mt-2 max-h-20 space-y-1 overflow-y-auto">
                      {ineligiblePromotionOptions.map(({ promotion, discountLabel, conditionLabel }) => (
                        <div
                          key={promotion.id}
                          className="rounded-lg bg-white px-3 py-1.5 text-xs text-slate-400"
                        >
                          <div className="flex items-center justify-between gap-2 font-bold">
                            <span className="truncate">{promotion.code}</span>
                            <span className="shrink-0">{discountLabel}</span>
                          </div>
                          <p className="mt-1 truncate">Cần {conditionLabel}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>

              {selectedPromotion ? (
                <div className="rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-xs font-semibold text-[#9a3412]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate">
                      {selectedPromotion.name} ({selectedPromotion.code})
                    </span>
                    <span className="shrink-0 font-extrabold">
                      {getPromotionDiscountLabel(selectedPromotion)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#c2410c]">
                    Điều kiện: {getPromotionConditionLabel(selectedPromotion)}
                  </p>
                </div>
              ) : null}

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  value={promotionCode}
                  onChange={(event) => {
                    setPromotionCode(event.target.value.toUpperCase());
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
                <div className="grid grid-cols-2 gap-2">
                  {paymentMethods.map((method) => {
                    const isSelected = paymentMethod === method.value;
                    const isDisabled = method.value === "qr" && !isOnline;

                    return (
                      <button
                        key={method.value}
                        type="button"
                        onClick={() => {
                          if (!isDisabled) setPaymentMethod(method.value);
                        }}
                        disabled={isDisabled}
                        title={
                          isDisabled
                            ? "Thanh toán QR cần kết nối backend"
                            : undefined
                        }
                        className={[
                          "flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border bg-white px-2 text-xs font-bold transition-all",
                          isSelected
                            ? "border-[#f97316] bg-orange-50 text-[#f97316] shadow-sm shadow-orange-100"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50",
                          isDisabled ? "cursor-not-allowed opacity-40" : "",
                        ].join(" ")}
                        aria-pressed={isSelected}
                      >
                        <Icon name={method.icon} className="text-[28px]" />
                        <span>
                          {method.label}
                          {isDisabled ? " (cần mạng)" : ""}
                        </span>
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
                    <span className="min-w-0 truncate">{promotionTotalLabel}</span>
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

      {displayedCompletedOrder ? (
        <ReceiptModal
          order={displayedCompletedOrder}
          onClose={() => setCompletedOrder(null)}
        />
      ) : null}

    </AdminLayout>
  );
}

export default PosPage;
