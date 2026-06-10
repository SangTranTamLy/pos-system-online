import type { Request, Response } from "express";
import { getDashboardSummaryService } from "../services/dashboard.service";
import type { DashboardRevenuePeriod } from "../types/dashboard.types";

const allowedPeriods: DashboardRevenuePeriod[] = ["month", "year"];

function getRevenuePeriod(value: unknown): DashboardRevenuePeriod {
    if (typeof value === "string" && allowedPeriods.includes(value as DashboardRevenuePeriod)) {
        return value as DashboardRevenuePeriod;
    }

    return "month";
}

export async function getDashboardSummaryController(req: Request, res: Response) {
    const summary = await getDashboardSummaryService(getRevenuePeriod(req.query.period));

    res.json({
        success: true,
        message: "Lấy dữ liệu tổng quan dashboard thành công",
        data: summary,
    });
}