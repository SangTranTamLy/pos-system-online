import { Router } from "express";
import { getDashboardSummaryController } from "../controllers/dashboard.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import { db } from "../config/database";
import type { RowDataPacket } from "mysql2";

const dashboardRouter = Router();

// Temporary debug route — no auth required
dashboardRouter.get("/debug-tz", asyncHandler(async (_req, res) => {
  const [tzRows] = await db.execute<RowDataPacket[]>(
    `SELECT NOW() as now_server, CURDATE() as curdate_server,
            @@global.time_zone as global_tz, @@session.time_zone as session_tz`
  );
  const [orderRows] = await db.execute<RowDataPacket[]>(
    `SELECT id, created_at, DATE(created_at) as date_only, status
     FROM orders ORDER BY created_at DESC LIMIT 5`
  );
  const [todayRows] = await db.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as today_count, COALESCE(SUM(final_amount),0) as today_revenue
     FROM orders WHERE status='completed' AND DATE(created_at) = CURDATE()`
  );
  return res.json({ tz: tzRows[0], recentOrders: orderRows, today: todayRows[0] });
}));

dashboardRouter.use(authMiddleware);
dashboardRouter.get("/summary", asyncHandler(getDashboardSummaryController));

export default dashboardRouter;