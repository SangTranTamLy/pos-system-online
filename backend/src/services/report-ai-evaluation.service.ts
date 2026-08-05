export type AiReportEvaluation = {
  status: "accepted" | "rejected";
  schemaValid: boolean;
  groundingScore: number;
  privacyPassed: boolean;
  issues: string[];
};

type JsonRecord = Record<string, unknown>;

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const PHONE_PATTERN = /(?:^|\D)(?:\+84|0)(?:[ .-]?\d){8,10}(?:\D|$)/;
const NUMBER_PATTERN = /[-+]?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|[-+]?\d+(?:[.,]\d+)?/g;

function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateRequiredString(
  record: JsonRecord,
  key: string,
  path: string,
  issues: string[]
) {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(`${path}.${key} phải là chuỗi không rỗng.`);
  }
}

function validateRequiredNumber(
  record: JsonRecord,
  key: string,
  path: string,
  issues: string[]
) {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push(`${path}.${key} phải là số hợp lệ.`);
  }
}

function validateSummary(value: unknown, issues: string[]) {
  if (!isJsonRecord(value)) {
    issues.push("summary phải là một đối tượng.");
    return;
  }

  [
    "main_insight",
    "revenue_text",
    "orders_text",
    "best_selling_product",
    "best_shift",
  ].forEach((key) => validateRequiredString(value, key, "summary", issues));
}

function validateAdvancedAnalysis(value: unknown, issues: string[]) {
  if (!Array.isArray(value)) {
    issues.push("phan_tich_chuyen_sau phải là một mảng.");
    return;
  }

  if (value.length !== 5) {
    issues.push("phan_tich_chuyen_sau phải có đúng 5 phần tử.");
  }

  value.forEach((item, index) => {
    const path = `phan_tich_chuyen_sau[${index}]`;
    if (!isJsonRecord(item)) {
      issues.push(`${path} phải là một đối tượng.`);
      return;
    }

    validateRequiredNumber(item, "thu_tu", path, issues);
    ["loai", "tieu_de", "noi_dung", "muc_do"].forEach((key) =>
      validateRequiredString(item, key, path, issues)
    );
  });
}

function validateActionPlan(value: unknown, issues: string[]) {
  if (!Array.isArray(value)) {
    issues.push("action_plan phải là một mảng.");
    return;
  }

  if (value.length !== 5) {
    issues.push("action_plan phải có đúng 5 phần tử.");
  }

  value.forEach((item, index) => {
    const path = `action_plan[${index}]`;
    if (!isJsonRecord(item)) {
      issues.push(`${path} phải là một đối tượng.`);
      return;
    }

    ["priority", "action", "reason", "expected_result"].forEach((key) =>
      validateRequiredString(item, key, path, issues)
    );
  });
}

export function validateAiReportSchema(aiOutput: unknown) {
  const issues: string[] = [];

  if (!isJsonRecord(aiOutput)) {
    return {
      valid: false,
      issues: ["Phản hồi AI phải là một đối tượng JSON."],
    };
  }

  validateSummary(aiOutput.summary, issues);
  validateAdvancedAnalysis(aiOutput.phan_tich_chuyen_sau, issues);
  validateActionPlan(aiOutput.action_plan, issues);

  return {
    valid: issues.length === 0,
    issues,
  };
}

function collectStrings(value: unknown, output: string[]) {
  if (typeof value === "string") {
    output.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, output));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => collectStrings(item, output));
  }
}

function parseNumberToken(token: string) {
  const unsigned = token.replace(/^\+/, "");
  const separators = unsigned.match(/[.,]/g)?.length ?? 0;
  let normalized = unsigned;

  if (separators > 1 || /[.,]\d{3}$/.test(unsigned)) {
    normalized = unsigned.replace(/[.,]/g, "");
  } else {
    normalized = unsigned.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getVietnameseNumberMultiplier(suffix: string) {
  const normalizedSuffix = suffix
    .toLocaleLowerCase("vi-VN")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .trimStart();

  if (/^(?:ty|ti)\b/.test(normalizedSuffix)) return 1_000_000_000;
  if (/^trieu\b/.test(normalizedSuffix)) return 1_000_000;
  if (/^(?:nghin|ngan)\b/.test(normalizedSuffix)) return 1_000;
  return 1;
}

function collectNumbers(value: unknown, output: number[]) {
  if (typeof value === "number" && Number.isFinite(value)) {
    output.push(value);
    return;
  }
  if (typeof value === "string") {
    for (const match of value.matchAll(NUMBER_PATTERN)) {
      const token = match[0];
      const parsed = parseNumberToken(token);
      if (parsed !== null) {
        const tokenEnd = (match.index ?? 0) + token.length;
        const multiplier = getVietnameseNumberMultiplier(
          value.slice(tokenEnd, tokenEnd + 20)
        );
        output.push(parsed * multiplier);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectNumbers(item, output));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => collectNumbers(item, output));
  }
}

function isGrounded(value: number, allowedNumbers: number[]) {
  if (Number.isInteger(value) && Math.abs(value) <= 5) return true;
  return allowedNumbers.some((allowed) => {
    // Trong văn bản tiếng Việt, chiều biến động thường được diễn đạt bằng
    // "tăng/giảm", vì vậy Gemini có thể viết 43% thay cho giá trị nguồn -43%.
    const normalizedValue = Math.abs(value);
    const normalizedAllowed = Math.abs(allowed);

    // Chấp nhận sai số làm tròn tối đa 1% khi AI rút gọn tiền theo
    // nghìn/triệu/tỷ hoặc làm tròn tỷ lệ phần trăm để trình bày.
    const tolerance = Math.max(0.05, normalizedAllowed * 0.01);
    return Math.abs(normalizedAllowed - normalizedValue) <= tolerance;
  });
}

export function evaluateAiReportOutput(
  aiOutput: unknown,
  sanitizedContext: unknown
): AiReportEvaluation {
  const schemaEvaluation = validateAiReportSchema(aiOutput);
  const schemaValid = schemaEvaluation.valid;
  const strings: string[] = [];
  collectStrings(aiOutput, strings);
  const combinedText = strings.join("\n");
  const privacyIssues: string[] = [];

  if (EMAIL_PATTERN.test(combinedText)) privacyIssues.push("Phản hồi chứa địa chỉ email.");
  if (PHONE_PATTERN.test(combinedText)) privacyIssues.push("Phản hồi chứa số điện thoại.");
  if (UUID_PATTERN.test(combinedText)) privacyIssues.push("Phản hồi chứa UUID nội bộ.");

  const allowedNumbers: number[] = [];
  const outputNumbers: number[] = [];
  collectNumbers(sanitizedContext, allowedNumbers);
  collectNumbers(aiOutput, outputNumbers);

  const unsupportedNumbers = outputNumbers.filter((value) => !isGrounded(value, allowedNumbers));
  const supportedCount = outputNumbers.length - unsupportedNumbers.length;
  const groundingScore = outputNumbers.length === 0
    ? 1
    : Number((supportedCount / outputNumbers.length).toFixed(3));
  const issues = [...schemaEvaluation.issues, ...privacyIssues];

  if (unsupportedNumbers.length > 0) {
    issues.push(
      `Phản hồi chứa số liệu không có căn cứ: ${[...new Set(unsupportedNumbers)]
        .slice(0, 8)
        .join(", ")}.`
    );
  }

  const privacyPassed = privacyIssues.length === 0;
  return {
    status: schemaValid && privacyPassed && unsupportedNumbers.length === 0
      ? "accepted"
      : "rejected",
    schemaValid,
    groundingScore,
    privacyPassed,
    issues,
  };
}
