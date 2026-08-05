import {
  getRevenueAllEmployees,
  getRevenueByEmployeeId,
  getFinancialSummary,
  getFinancialTrend,
  getRawMaterialValuation,
  getInventoryValuationByCategory,
  getEmployeePerformance,
  getRevenueByPeriod,
  getCustomerRetention,
  getAiCancelledOrders,
  getAiMaterialPurchaseSummary,
} from "../repositories/report.repository";
import { saveAiReportLog } from "../repositories/ai-report-log.repository";
import { AI_REPORT_SYSTEM_PROMPT } from "../prompts/report-ai.prompt";
import { buildAiBusinessContext, type AiBusinessContext } from "./report-ai-context.service";
import { getTopProducts } from "../repositories/dashboard.repository";
import type { ComparisonPoint } from "../types/report.types";
import { evaluateAiReportOutput } from "./report-ai-evaluation.service";

export async function getEmployeeRevenueService(
  userRole: string,
  userId: string,
  startDate?: string,
  endDate?: string
) {
  const role = userRole.trim().toUpperCase();

  if (role === "ADMIN" || role === "MANAGER") {
    return getRevenueAllEmployees(startDate, endDate);
  }

  return getRevenueByEmployeeId(userId, startDate, endDate);
}

export async function getAiInsightsContextService(startDate: string, endDate: string): Promise<AiBusinessContext> {
  return buildAiBusinessContext(startDate, endDate);
}

function extractJsonFromAiText(text: string) {
  const cleaned = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("AI không trả về JSON hợp lệ");
  }

  const jsonText = cleaned
    .slice(start, end + 1)
    .replace(/,\s*([}\]])/g, "$1");

  try {
    return JSON.parse(jsonText);
  } catch (parseError) {
    const preview = jsonText.slice(0, 900);
    throw new Error(
      `AI trả JSON sai cú pháp: ${parseError instanceof Error ? parseError.message : String(parseError)} | Preview: ${preview}`
    );
  }
}

const aiReportMetaDefaults = {
  assistant_name: "QuickServe-AI",
  role: "Trợ lý phân tích kinh doanh",
  period: {
    from: "",
    to: "",
  },
  confidence: "thap",
  score: 0,
  status: "can_cai_thien",
  data_status: "thieu_du_lieu",
  confidence_note: "",
};

const AI_REPORT_RESPONSE_SCHEMA = {
  type: "OBJECT",
  required: ["summary", "phan_tich_chuyen_sau", "action_plan"],
  properties: {
    summary: {
      type: "OBJECT",
      required: ["main_insight", "revenue_text", "orders_text", "best_selling_product", "best_shift"],
      properties: {
        main_insight: { type: "STRING" },
        revenue_text: { type: "STRING" },
        orders_text: { type: "STRING" },
        best_selling_product: { type: "STRING" },
        best_shift: { type: "STRING" },
      },
    },
    phan_tich_chuyen_sau: {
      type: "ARRAY",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "OBJECT",
        required: ["thu_tu", "loai", "tieu_de", "noi_dung", "muc_do"],
        properties: {
          thu_tu: { type: "NUMBER" },
          loai: { type: "STRING" },
          tieu_de: { type: "STRING" },
          noi_dung: { type: "STRING" },
          muc_do: { type: "STRING" },
        },
      },
    },
    action_plan: {
      type: "ARRAY",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "OBJECT",
        required: ["priority", "action", "reason", "expected_result"],
        properties: {
          priority: { type: "STRING" },
          action: { type: "STRING" },
          reason: { type: "STRING" },
          expected_result: { type: "STRING" },
        },
      },
    },
  },
} as const;

function toNumber(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatVnd(value: unknown) {
  return `${Math.round(toNumber(value)).toLocaleString("vi-VN")}đ`;
}

function formatPercent(value: unknown) {
  const numberValue = toNumber(value);
  const prefix = numberValue > 0 ? "+" : "";
  return `${prefix}${numberValue.toFixed(1)}%`;
}

function buildWarningSignals(context: AiBusinessContext) {
  const metrics = context.businessMetrics;
  const trend = getRecordArray(context.trend).map((item) => ({
    label: String(item.label || item.date || ""),
    revenue: toNumber(item.revenue),
  }));
  const cancelledOrders = getRecordArray(context.cancelledOrders);
  const previousCancelledOrders = getRecordArray(context.previousCancelledOrders);
  const lowStockItems = getRecordArray(context.lowStockItems);
  const slowProducts = getRecordArray(context.slowProducts);
  const soldProducts = getRecordArray(context.soldProducts);
  const materialPurchases = context.materialPurchases;
  const previousMaterialPurchases = context.previousMaterialPurchases;

  let largestDailyDropPercent: number | null = null;
  let largestDailyDropFrom = "";
  let largestDailyDropTo = "";

  for (let index = 1; index < trend.length; index += 1) {
    const previous = trend[index - 1];
    const current = trend[index];
    if (previous.revenue > 0 && current.revenue < previous.revenue) {
      const dropPercent = ((previous.revenue - current.revenue) / previous.revenue) * 100;
      if (largestDailyDropPercent === null || dropPercent > largestDailyDropPercent) {
        largestDailyDropPercent = Number(dropPercent.toFixed(1));
        largestDailyDropFrom = previous.label;
        largestDailyDropTo = current.label;
      }
    }
  }

  const currentCancelRate = metrics.totalOrders > 0 ? (cancelledOrders.length / metrics.totalOrders) * 100 : 0;
  const previousCancelRate = metrics.previousTotalOrders > 0
    ? (previousCancelledOrders.length / metrics.previousTotalOrders) * 100
    : null;
  const topRevenueProduct = [...soldProducts].sort((a, b) => toNumber(b.revenue) - toNumber(a.revenue))[0];
  const topRevenueShare = metrics.totalRevenue > 0 && topRevenueProduct
    ? Number(((toNumber(topRevenueProduct.revenue) / metrics.totalRevenue) * 100).toFixed(1))
    : 0;
  const purchaseCostGrowthPercent = previousMaterialPurchases.totalPurchaseCost > 0
    ? Number((((materialPurchases.totalPurchaseCost - previousMaterialPurchases.totalPurchaseCost)
      / previousMaterialPurchases.totalPurchaseCost) * 100).toFixed(1))
    : null;

  return {
    abnormalRevenueDrop: {
      currentRevenue: metrics.totalRevenue,
      previousRevenue: metrics.previousTotalRevenue,
      revenueGrowthPercent: metrics.revenueGrowthPercent,
      largestDailyDropPercent,
      largestDailyDropFrom,
      largestDailyDropTo,
      shouldWarn: (metrics.revenueGrowthPercent !== null && metrics.revenueGrowthPercent <= -20)
        || (largestDailyDropPercent !== null && largestDailyDropPercent >= 35),
    },
    cancelledOrdersIncrease: {
      currentCount: cancelledOrders.length,
      previousCount: previousCancelledOrders.length,
      currentRate: Number(currentCancelRate.toFixed(1)),
      previousRate: previousCancelRate === null ? null : Number(previousCancelRate.toFixed(1)),
      shouldWarn: currentCancelRate >= 2 || (previousCancelledOrders.length > 0 && cancelledOrders.length > previousCancelledOrders.length),
    },
    lowStock: {
      count: lowStockItems.length,
      items: lowStockItems.slice(0, 6).map((item) => ({
        name: String(item.name || ""),
        stockQuantity: toNumber(item.stockQuantity),
        minStock: toNumber(item.minStock),
        unit: String(item.unit || ""),
      })),
      shouldWarn: lowStockItems.length > 0,
    },
    slowOrDependentProducts: {
      slowProductCount: slowProducts.length,
      slowProducts: slowProducts.slice(0, 5).map((item) => ({
        name: String(item.name || ""),
        soldQuantity: toNumber(item.soldQuantity),
        stockQuantity: item.stockQuantity === null ? null : toNumber(item.stockQuantity),
      })),
      topRevenueProduct: topRevenueProduct
        ? {
            name: String(topRevenueProduct.name || ""),
            revenue: toNumber(topRevenueProduct.revenue),
            sharePercent: topRevenueShare,
          }
        : null,
      shouldWarn: slowProducts.length > 0 || topRevenueShare >= 45,
    },
    materialPurchases: {
      totalPurchaseCost: materialPurchases.totalPurchaseCost,
      previousTotalPurchaseCost: previousMaterialPurchases.totalPurchaseCost,
      purchaseCostGrowthPercent,
      receiptsCount: materialPurchases.receiptsCount,
      averageReceiptValue: materialPurchases.averageReceiptValue,
      topMaterials: materialPurchases.topMaterials.slice(0, 6).map((item) => ({
        materialName: item.materialName,
        unit: item.unit,
        quantity: item.quantity,
        averageUnitPrice: item.averageUnitPrice,
        totalCost: item.totalCost,
      })),
      supplierCount: materialPurchases.suppliers.length,
      shouldWarn: purchaseCostGrowthPercent !== null && purchaseCostGrowthPercent >= 30,
    },
  };
}
function buildAiPromptContext(context: AiBusinessContext) {
  const soldProducts = getRecordArray(context.soldProducts);
  const topByQuantity = [...soldProducts]
    .sort((a, b) => toNumber(b.soldQuantity) - toNumber(a.soldQuantity))
    .slice(0, 10);
  const topByRevenue = [...soldProducts]
    .sort((a, b) => toNumber(b.revenue) - toNumber(a.revenue))
    .slice(0, 10);
  const relevantProducts = Array.from(
    new Map(
      [...topByQuantity, ...topByRevenue].map((item) => [String(item.productId || item.name || ""), item])
    ).values()
  ).map((item) => ({
    name: String(item.name || ""),
    soldQuantity: toNumber(item.soldQuantity),
    revenue: toNumber(item.revenue),
  }));

  const materialPurchases = {
    totalPurchaseCost: context.materialPurchases.totalPurchaseCost,
    receiptsCount: context.materialPurchases.receiptsCount,
    averageReceiptValue: context.materialPurchases.averageReceiptValue,
    topMaterials: context.materialPurchases.topMaterials.slice(0, 10).map((item) => ({
      materialName: item.materialName,
      unit: item.unit,
      quantity: item.quantity,
      averageUnitPrice: item.averageUnitPrice,
      totalCost: item.totalCost,
    })),
    supplierCount: context.materialPurchases.suppliers.length,
  };

  const previousMaterialPurchases = {
    totalPurchaseCost: context.previousMaterialPurchases.totalPurchaseCost,
    receiptsCount: context.previousMaterialPurchases.receiptsCount,
    averageReceiptValue: context.previousMaterialPurchases.averageReceiptValue,
    topMaterials: context.previousMaterialPurchases.topMaterials.slice(0, 10).map((item) => ({
      materialName: item.materialName,
      unit: item.unit,
      quantity: item.quantity,
      averageUnitPrice: item.averageUnitPrice,
      totalCost: item.totalCost,
    })),
    supplierCount: context.previousMaterialPurchases.suppliers.length,
  };

  return {
    period: context.period,
    businessMetrics: context.businessMetrics,
    dataQuality: context.dataQuality,
    revenueData: {
      daily: context.trend.map((item) => ({
        date: item.date,
        label: item.label,
        revenue: item.revenue,
        cogs: item.cogs,
        profit: item.profit,
      })),
      hourly: context.hourlyRevenue.map((item) => ({
        hour: item.hour,
        label: item.label,
        ordersCount: item.ordersCount,
        revenue: item.revenue,
      })),
    },
    productData: {
      soldProducts: relevantProducts,
      slowProducts: context.slowProducts.map((item) => ({
        name: item.name,
        soldQuantity: item.soldQuantity,
      })),
      categoryRevenue: context.categoryRevenue.map((item) => ({
        categoryName: item.categoryName,
        soldQuantity: item.soldQuantity,
        revenue: item.revenue,
        percentage: item.percentage,
      })),
    },
    operatingData: {
      paymentSummary: context.paymentSummary.map((item) => ({
        method: item.method,
        ordersCount: item.ordersCount,
        amount: item.amount,
      })),
      lowStockItems: context.lowStockItems.map((item) => ({
        name: item.name,
        type: item.type,
        stockQuantity: item.stockQuantity,
        minStock: item.minStock,
        unit: item.unit,
      })),
      materialInventory: context.materialInventory.map((item) => ({
        name: item.name,
        category: item.category,
        unit: item.unit,
        stockQuantity: item.stockQuantity,
        importPrice: item.importPrice,
        totalValue: item.totalValue,
      })),
      materialPurchases,
      previousMaterialPurchases,
    },
    warningSignals: buildWarningSignals(context),
  };
}

function getRecordArray(value: unknown) {
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}

function normalizePaymentMethod(method: unknown) {
  const value = String(method || "").trim().toLowerCase();
  if (["cash", "cash_payment", "tien_mat", "tiền mặt"].includes(value)) return "cash";
  if (["qr", "qr_code", "bank_qr"].includes(value)) return "qr";
  if (["bank", "bank_transfer", "chuyen_khoan", "chuyển khoản"].includes(value)) return "bank_transfer";
  return value || "unknown";
}

function buildWarnings(context: AiBusinessContext) {
  const metrics = context.businessMetrics;
  const signals = buildWarningSignals(context);
  const warnings: Array<{ type: string; level: "cao" | "trung_binh" | "thap"; message: string; suggestion: string }> = [];

  if (signals.abnormalRevenueDrop.shouldWarn) {
    const revenueGrowthPercent = metrics.revenueGrowthPercent;
    const hasPeriodDrop = revenueGrowthPercent !== null && revenueGrowthPercent <= -20;
    const growthText = hasPeriodDrop
      ? `giảm ${Math.abs(revenueGrowthPercent).toFixed(1)}% so với kỳ trước`
      : signals.abnormalRevenueDrop.largestDailyDropPercent !== null
        ? `giảm ${signals.abnormalRevenueDrop.largestDailyDropPercent}% giữa ${signals.abnormalRevenueDrop.largestDailyDropFrom} và ${signals.abnormalRevenueDrop.largestDailyDropTo}`
        : "biến động mạnh trong kỳ";
    warnings.push({
      type: "doanh_thu",
      level: hasPeriodDrop && revenueGrowthPercent <= -40 ? "cao" : "trung_binh",
      message: `Doanh thu có dấu hiệu bất thường: ${growthText}.`,
      suggestion: "Đối chiếu số đơn, AOV, món chủ lực và khung giờ doanh thu thấp.",
    });
  }

  if (signals.cancelledOrdersIncrease.shouldWarn) {
    warnings.push({
      type: "don_huy",
      level: signals.cancelledOrdersIncrease.currentRate >= 5 ? "cao" : "trung_binh",
      message: `${signals.cancelledOrdersIncrease.currentCount} đơn hủy, kỳ trước ${signals.cancelledOrdersIncrease.previousCount} đơn, tỷ lệ ${signals.cancelledOrdersIncrease.currentRate}%.`,
      suggestion: "Kiểm tra lý do hủy đơn và thao tác POS trong khung giờ phát sinh.",
    });
  }

  if (signals.lowStock.shouldWarn) {
    const names = signals.lowStock.items.map((item) => item.name).filter(Boolean).slice(0, 4).join(", ");
    warnings.push({
      type: "ton_kho",
      level: signals.lowStock.count >= 5 ? "cao" : "trung_binh",
      message: `${signals.lowStock.count} mặt hàng tồn thấp${names ? `: ${names}` : ""}.`,
      suggestion: "Bổ sung trước ca bán tiếp theo để tránh gián đoạn bán hàng.",
    });
  }

  if (signals.slowOrDependentProducts.shouldWarn) {
    const topProduct = signals.slowOrDependentProducts.topRevenueProduct;
    const slowProduct = signals.slowOrDependentProducts.slowProducts[0];
    warnings.push({
      type: "san_pham",
      level: topProduct && topProduct.sharePercent >= 60 ? "cao" : "trung_binh",
      message: topProduct && topProduct.sharePercent >= 45
        ? `${topProduct.name} chiếm ${topProduct.sharePercent}% doanh thu, có dấu hiệu phụ thuộc món bán chạy.`
        : `${slowProduct?.name || "Một số món"} bán chậm trong khoảng báo cáo.`,
      suggestion: "Theo dõi nhu cầu, tồn kho và thử combo với món bán tốt.",
    });
  }

  if (signals.materialPurchases.shouldWarn) {
    warnings.push({
      type: "chi_phi_nhap_kho",
      level: signals.materialPurchases.purchaseCostGrowthPercent !== null
        && signals.materialPurchases.purchaseCostGrowthPercent >= 60 ? "cao" : "trung_binh",
      message: `Chi phí nhập nguyên liệu tăng ${signals.materialPurchases.purchaseCostGrowthPercent}% so với kỳ trước, đạt ${formatVnd(signals.materialPurchases.totalPurchaseCost)}.`,
      suggestion: "Đối chiếu số lượng nhập, đơn giá và nguyên liệu chiếm chi phí cao trước lần nhập tiếp theo.",
    });
  }

  return warnings.length
    ? warnings.slice(0, 5)
    : [
        {
          type: "khac",
          level: "thap",
          message: "Chưa phát hiện cảnh báo lớn trong khoảng dữ liệu đang xem.",
          suggestion: "Tiếp tục theo dõi doanh thu, tồn kho, đơn hủy và sản phẩm bán chậm.",
        },
      ];
}

function buildMetaFromContext(context: AiBusinessContext) {
  const score = Math.max(0, Math.min(toNumber(context.dataQuality.coverageScore), 95));

  return {
    ...aiReportMetaDefaults,
    period: {
      from: context.period.startDate,
      to: context.period.endDate,
    },
    confidence: context.dataQuality.confidence,
    score,
    status: score >= 85 ? "tot" : score >= 65 ? "on_dinh" : "can_cai_thien",
    data_status: context.dataQuality.status,
    confidence_note: score < 65 ? context.dataQuality.note : "",
  };
}

function buildSystemReportData(context: AiBusinessContext) {
  const soldProducts = getRecordArray(context.soldProducts);
  const paymentSummary = getRecordArray(context.paymentSummary);
  const lowStockItems = getRecordArray(context.lowStockItems);
  const categoryRevenue = getRecordArray(context.categoryRevenue);
  const materialPurchases = context.materialPurchases;
  return {
    meta: buildMetaFromContext(context),
    warnings: buildWarnings(context),
    report_tables: {
      inventory_table: {
        title: "Bảng tồn kho cần chú ý",
        columns: ["Mặt hàng", "Loại", "Tồn hiện tại", "Ngưỡng", "Đơn vị"],
        rows: lowStockItems.map((item) => [
          String(item.name || ""),
          String(item.type || ""),
          toNumber(item.stockQuantity),
          toNumber(item.minStock),
          String(item.unit || ""),
        ]),
        validation_note: lowStockItems.length ? "Lấy từ raw_materials tồn thấp." : "Không có nguyên liệu tồn thấp.",
      },
      sales_table: {
        title: "Bảng sản phẩm bán ra",
        columns: ["Sản phẩm", "Số lượng bán", "Doanh thu"],
        rows: soldProducts.slice(0, 10).map((item) => [
          String(item.name || ""),
          toNumber(item.soldQuantity),
          toNumber(item.revenue),
        ]),
        validation_note: soldProducts.length ? "Lấy từ orders/order_details/products." : "Chưa có sản phẩm bán ra.",
      },
      categories_table: {
        title: "Bảng doanh thu theo danh mục",
        columns: ["Danh mục", "Doanh thu", "Số lượng bán", "Tỷ trọng"],
        rows: categoryRevenue.map((item) => [
          String(item.categoryName || item.name || ""),
          toNumber(item.revenue),
          toNumber(item.soldQuantity),
          `${toNumber(item.percentage)}%`,
        ]),
        validation_note: categoryRevenue.length
          ? "Lấy từ orders/order_details/products/categories."
          : "Chưa có doanh thu theo danh mục trong khoảng lọc.",
      },
      payment_table: {
        title: "Bảng phương thức thanh toán",
        columns: ["Phương thức", "Số đơn", "Số tiền"],
        rows: paymentSummary.map((item) => [
          normalizePaymentMethod(item.method || item.paymentMethod),
          toNumber(item.ordersCount),
          toNumber(item.amount),
        ]),
        validation_note: paymentSummary.length ? "Chỉ gồm phương thức có trong payments." : "Chưa có thanh toán paid.",
      },
      material_purchase_table: {
        title: "Bảng chi phí nhập nguyên liệu",
        columns: ["Nguyên liệu", "Số lượng nhập trong kỳ", "Đơn vị", "Đơn giá bình quân", "Thành tiền"],
        rows: materialPurchases.topMaterials.map((item) => [
          item.materialName,
          item.quantity,
          item.unit,
          item.averageUnitPrice,
          item.totalCost,
        ]),
        validation_note: materialPurchases.receiptsCount
          ? `Tổng ${materialPurchases.receiptsCount} phiếu nhập, giá trị ${formatVnd(materialPurchases.totalPurchaseCost)}.`
          : "Chưa có phiếu nhập nguyên liệu trong khoảng lọc.",
      },
    },
    chart_suggestions: [],
  };
}

function normalizeAdvancedAnalysis(value: any) {
  const input = Array.isArray(value) ? value : [];
  const normalized = input
    .filter((item) => item?.noi_dung)
    .slice(0, 5)
    .map((item, index) => ({
      thu_tu: index + 1,
      loai: String(item.loai || "khac"),
      tieu_de: String(item.tieu_de || "Nhận định"),
      noi_dung: String(item.noi_dung),
      muc_do: ["positive", "neutral", "warning", "critical"].includes(String(item.muc_do))
        ? item.muc_do
        : "neutral",
    }));

  if (normalized.length !== 5) {
    throw new Error(`AI phải trả đúng 5 nhận định chuyên sâu, hiện nhận được ${normalized.length}`);
  }

  return normalized;
}

function normalizeActionPlan(value: any) {
  const input = Array.isArray(value) ? value : [];
  const normalizedActions = input
    .filter((item) => item?.action)
    .slice(0, 5)
    .map((item) => ({
      priority: ["cao", "trung_binh", "thap"].includes(String(item.priority)) ? item.priority : "trung_binh",
      action: String(item.action).trim(),
      reason: String(item.reason || ""),
      expected_result: String(item.expected_result || ""),
    }));

  if (normalizedActions.length !== 5) {
    throw new Error(`AI phải trả đúng 5 chiến lược hành động, hiện nhận được ${normalizedActions.length}`);
  }

  return normalizedActions;
}

function normalizeAiReportData(rawData: any, context: AiBusinessContext) {
  const systemData = buildSystemReportData(context);
  const input = rawData && typeof rawData === "object" ? rawData : {};
  const summaryInput = input.summary && typeof input.summary === "object" ? input.summary : {};

  return {
    ...systemData,
    summary: {
      main_insight: String(summaryInput.main_insight || ""),
      revenue_text: String(summaryInput.revenue_text || ""),
      orders_text: String(summaryInput.orders_text || ""),
      best_selling_product: String(summaryInput.best_selling_product || ""),
      best_shift: String(summaryInput.best_shift || ""),
    },
    phan_tich_chuyen_sau: normalizeAdvancedAnalysis(input.phan_tich_chuyen_sau),
    action_plan: normalizeActionPlan(input.action_plan),
  };
}
async function trySaveAiReportLog(input: Parameters<typeof saveAiReportLog>[0]) {
  try {
    await saveAiReportLog(input);
  } catch (logError) {
    console.error("Lỗi lưu AI report log:", logError);
  }
}

function buildGeminiGenerateContentUrl(apiUrl: string, model: string) {
  const baseUrl = apiUrl.replace(/\/$/, "");

  if (baseUrl.includes(":generateContent")) return baseUrl;
  if (baseUrl.endsWith(`/models/${model}`)) return `${baseUrl}:generateContent`;
  if (baseUrl.endsWith("/models")) return `${baseUrl}/${model}:generateContent`;

  return `${baseUrl}/models/${model}:generateContent`;
}

function extractTextFromGeminiResult(result: any) {
  const parts = result?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "{}";
  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n") || "{}";
}
export async function getAiReportInsightsService(startDate: string, endDate: string, createdBy?: string | null) {
  const context: AiBusinessContext = await getAiInsightsContextService(startDate, endDate);
  const promptContext = buildAiPromptContext(context);
  const responseContext = { dataQuality: context.dataQuality };

  const apiKey = process.env.AI_API_KEY;
  const apiUrl = process.env.AI_API_URL || "https://generativelanguage.googleapis.com/v1beta/models";
  const model = process.env.AI_MODEL || "gemini-3.1-flash-lite";
  const configuredMaxOutputTokens = Number(process.env.AI_MAX_TOKENS || 8192);
  const maxOutputTokens = Number.isFinite(configuredMaxOutputTokens)
    ? Math.max(4096, Math.min(configuredMaxOutputTokens, 32768))
    : 8192;

  if (!apiKey || !apiUrl) {
    await trySaveAiReportLog({
      startDate,
      endDate,
      context: promptContext,
      aiResult: null,
      isFallback: false,
      errorMessage: "Chưa cấu hình API AI",
      createdBy,
    });

    return {
      success: false,
      data: null,
      message: "Chưa cấu hình API AI",
      evaluation: {
        status: "rejected" as const,
        schemaValid: false,
        groundingScore: 0,
        privacyPassed: true,
        issues: ["Chưa cấu hình API AI."],
      },
      context: responseContext,
    };
  }

  try {
    const response = await fetch(buildGeminiGenerateContentUrl(apiUrl, model), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: AI_REPORT_SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: JSON.stringify(promptContext) }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          topP: 0.8,
          maxOutputTokens,
          thinkingConfig: {
            thinkingBudget: 256,
            includeThoughts: false,
          },
          responseMimeType: "application/json",
          responseSchema: AI_REPORT_RESPONSE_SCHEMA,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const result: any = await response.json();
    const finishReason = result?.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== "STOP") {
      const usage = result?.usageMetadata || {};
      throw new Error(
        `Gemini dừng trước khi hoàn tất JSON: ${finishReason} `
        + `(prompt=${usage.promptTokenCount || 0}, output=${usage.candidatesTokenCount || 0}, `
        + `thinking=${usage.thoughtsTokenCount || 0}, total=${usage.totalTokenCount || 0})`
      );
    }

    const text = extractTextFromGeminiResult(result);
    const rawAiData = extractJsonFromAiText(text);
    const evaluation = evaluateAiReportOutput(rawAiData, promptContext);

    if (evaluation.status === "rejected") {
      await trySaveAiReportLog({
        startDate,
        endDate,
        context: promptContext,
        aiResult: { evaluation },
        isFallback: false,
        errorMessage: evaluation.issues.join(" "),
        createdBy,
      });

      return {
        success: false,
        data: null,
        message: "Kết quả AI bị từ chối vì không vượt qua kiểm tra cấu trúc, dữ liệu và quyền riêng tư.",
        evaluation,
        context: responseContext,
      };
    }

    const aiData = normalizeAiReportData(rawAiData, context);
    const verifiedAiData = { ...aiData, evaluation };

    await trySaveAiReportLog({
      startDate,
      endDate,
      context: promptContext,
      aiResult: verifiedAiData,
      isFallback: false,
      createdBy,
    });

    return {
      success: true,
      data: verifiedAiData,
      evaluation,
      context: responseContext,
    };
  } catch (error) {
    console.error("Lỗi gọi AI báo cáo:", error);

    await trySaveAiReportLog({
      startDate,
      endDate,
      context: promptContext,
      aiResult: null,
      isFallback: false,
      errorMessage: error instanceof Error ? error.message : String(error),
      createdBy,
    });

    return {
      success: false,
      data: null,
      message: "AI chưa thể hoàn tất phân tích. Vui lòng thử lại.",
      evaluation: {
        status: "rejected" as const,
        schemaValid: false,
        groundingScore: 0,
        privacyPassed: true,
        issues: [error instanceof Error ? error.message : String(error)],
      },
      context: responseContext,
    };
  }
}
// 1. Service báo cáo tài chính
function calculateGrowthPercent(current: number, previous: number) {
  return previous > 0 ? Number((((current - previous) / previous) * 100).toFixed(1)) : null;
}

function getPreviousDateRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - days + 1);
  const format = (date: Date) => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

  return { startDate: format(previousStart), endDate: format(previousEnd) };
}

export async function getFinancialReportService(startDate?: string, endDate?: string) {
  const previousRange = startDate && endDate ? getPreviousDateRange(startDate, endDate) : null;
  const [
    summary,
    trend,
    topProductsRaw,
    previousSummary,
    currentCancelledOrders,
    previousCancelledOrders,
    materialPurchases,
    previousMaterialPurchases,
  ] = await Promise.all([
    getFinancialSummary(startDate, endDate),
    getFinancialTrend(startDate, endDate),
    getTopProducts(startDate, endDate),
    previousRange ? getFinancialSummary(previousRange.startDate, previousRange.endDate) : null,
    startDate && endDate ? getAiCancelledOrders(startDate, endDate) : [],
    previousRange ? getAiCancelledOrders(previousRange.startDate, previousRange.endDate) : [],
    startDate && endDate ? getAiMaterialPurchaseSummary(startDate, endDate) : null,
    previousRange
      ? getAiMaterialPurchaseSummary(previousRange.startDate, previousRange.endDate)
      : null,
  ]);
  
  const topProducts = topProductsRaw.map((item) => ({
    name: String(item.name),
    soldQuantity: Number(item.soldQuantity ?? 0),
    revenue: Number(item.revenue ?? 0),
  }));

  return {
    summary,
    trend,
    topProducts,
    revenueGrowthPercent: previousSummary
      ? calculateGrowthPercent(summary.totalRevenue, previousSummary.totalRevenue)
      : null,
    ordersGrowthPercent: previousSummary
      ? calculateGrowthPercent(summary.totalOrders, previousSummary.totalOrders)
      : null,
    averageOrderValueGrowthPercent: previousSummary
      ? calculateGrowthPercent(summary.averageOrderValue, previousSummary.averageOrderValue)
      : null,
    cancelledOrdersGrowthPercent: previousRange
      ? calculateGrowthPercent(currentCancelledOrders.length, previousCancelledOrders.length)
      : null,
    materialPurchaseCost: materialPurchases?.totalPurchaseCost ?? 0,
    materialPurchaseCostGrowthPercent: previousMaterialPurchases
      ? calculateGrowthPercent(
          materialPurchases?.totalPurchaseCost ?? 0,
          previousMaterialPurchases.totalPurchaseCost
        )
      : null,
  };
}

// 2. Service báo cáo tồn kho và giá trị kho
export async function getInventoryValuationService() {
  const rawMaterials = await getRawMaterialValuation();
  const categories = await getInventoryValuationByCategory();

  const totalRawValue = rawMaterials.reduce((sum, r) => sum + r.totalValue, 0);

  return {
    summary: {
      totalItems: rawMaterials.length,
      totalValue: totalRawValue,
      totalProductsValue: 0,
      totalRawValue
    },
    categories,
    products: [],
    rawMaterials
  };
}

// 3. Service báo cáo hiệu suất nhân viên
export async function getEmployeePerformanceService(startDate?: string, endDate?: string) {
  return getEmployeePerformance(startDate, endDate);
}

// 4. Service báo cáo so sánh và tăng trưởng
export async function getComparisonReportService(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Số ngày thực tế

  // Tính toán thời gian chu kỳ trước đó
  const prevStartDate = new Date(start);
  prevStartDate.setDate(start.getDate() - diffDays);

  const prevEndDate = new Date(end);
  prevEndDate.setDate(end.getDate() - diffDays);

  const prevStartStr = prevStartDate.toISOString().split("T")[0];
  const prevEndStr = prevEndDate.toISOString().split("T")[0];

  // Lấy dữ liệu 2 kỳ
  const currentTrend = await getRevenueByPeriod(startDate, endDate);
  const previousTrend = await getRevenueByPeriod(prevStartStr, prevEndStr);

  const currentTotal = currentTrend.reduce((sum, item) => sum + item.revenue, 0);
  const previousTotal = previousTrend.reduce((sum, item) => sum + item.revenue, 0);

  const growthPercentage = previousTotal > 0 
    ? Number((((currentTotal - previousTotal) / previousTotal) * 100).toFixed(1)) 
    : 0;

  // Ghép ngày so sánh
  const trend: ComparisonPoint[] = [];
  for (let i = 0; i < diffDays; i++) {
    const curDate = new Date(start);
    curDate.setDate(start.getDate() + i);
    const curDateStr = curDate.toISOString().split("T")[0];

    const prevDate = new Date(prevStartDate);
    prevDate.setDate(prevStartDate.getDate() + i);
    const prevDateStr = prevDate.toISOString().split("T")[0];

    const curVal = currentTrend.find((r) => r.date === curDateStr)?.revenue || 0;
    const prevVal = previousTrend.find((r) => r.date === prevDateStr)?.revenue || 0;

    // Định dạng nhãn trục X: e.g. "Ngày 1 (20/06)" hoặc chỉ "Ngày X"
    const label = `Ngày ${i + 1}`;

    trend.push({
      label,
      currentPeriodValue: curVal,
      previousPeriodValue: prevVal
    });
  }

  return {
    currentTotal,
    previousTotal,
    growthPercentage,
    trend
  };
}

// 5. Service báo cáo khách hàng thân thiết
export async function getCustomerRetentionService(startDate?: string, endDate?: string) {
  return getCustomerRetention(startDate, endDate);
}






