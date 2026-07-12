import { randomUUID } from "crypto";
import { db } from "../config/database";

type AiReportLogContext = {
  dataQuality: {
    score: number;
    confidence: string;
  };
  [key: string]: unknown;
};

type SaveAiReportLogInput = {
  startDate: string;
  endDate: string;
  context: AiReportLogContext;
  aiResult: unknown;
  isFallback: boolean;
  errorMessage?: string | null;
  createdBy?: string | null;
};

export async function saveAiReportLog(input: SaveAiReportLogInput) {
  const id = randomUUID();

  await db.execute(
    `
    INSERT INTO ai_report_logs (
      id,
      report_type,
      start_date,
      end_date,
      data_quality_score,
      confidence,
      input_context,
      ai_result,
      is_fallback,
      error_message,
      created_by
    )
    VALUES (?, 'business_report', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      input.startDate,
      input.endDate,
      input.context.dataQuality.score,
      input.context.dataQuality.confidence,
      JSON.stringify(input.context),
      JSON.stringify(input.aiResult),
      input.isFallback ? 1 : 0,
      input.errorMessage || null,
      input.createdBy || null,
    ]
  );

  return id;
}
