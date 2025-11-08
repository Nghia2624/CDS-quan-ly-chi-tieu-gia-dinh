import { Router } from "express";
import { ExpenseAnalysisService } from "../services/expense-analysis.service";
import { ExpensePredictor } from "../ai/expense-predictor";
import { asyncHandler } from "../error-handler";

const router = Router();

// Middleware để lấy familyId từ user
router.use((req, res, next) => {
  const user = (req as any).user;
  if (!user || !user.familyId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

/**
 * GET /api/analysis/period
 * Phân tích chi tiêu theo khoảng thời gian (OPTIMIZED with cache)
 * Query params: startDate, endDate, includePredictions
 */
router.get("/period", asyncHandler(async (req: any, res: any) => {
  const user = req.user;
  const { startDate, endDate, includePredictions = "false" } = req.query; // Default false để tăng tốc

  if (!startDate || !endDate) {
    return res.status(400).json({ error: "startDate and endDate are required" });
  }

  const service = new ExpenseAnalysisService(user.familyId);
  const analysis = await service.analyzeByPeriod(
    new Date(startDate as string),
    new Date(endDate as string),
    includePredictions === "true"
  );

  res.json(analysis);
}));

/**
 * GET /api/analysis/compare
 * So sánh chi tiêu giữa hai kỳ
 * Query params: type (day/week/month/quarter/year), currentStart, currentEnd, previousStart, previousEnd
 */
router.get("/compare", asyncHandler(async (req: any, res: any) => {
  const user = req.user;
  const { type, currentStart, currentEnd, previousStart, previousEnd } = req.query;

  if (!type || !currentStart || !currentEnd || !previousStart || !previousEnd) {
    return res.status(400).json({ error: "All comparison parameters are required" });
  }

  const service = new ExpenseAnalysisService(user.familyId);
  const comparison = await service.comparePeriods({
    type: type as any,
    current: {
      start: new Date(currentStart as string),
      end: new Date(currentEnd as string),
    },
    previous: {
      start: new Date(previousStart as string),
      end: new Date(previousEnd as string),
    },
  });

  res.json(comparison);
}));

/**
 * GET /api/analysis/detailed
 * Lấy dữ liệu chi tiết khi click vào biểu đồ
 * Query params: period (day/week/month/quarter/year), value (date or period string)
 */
router.get("/detailed", asyncHandler(async (req: any, res: any) => {
  const user = req.user;
  const { period, value } = req.query;

  if (!period || !value) {
    return res.status(400).json({ error: "period and value are required" });
  }

  const service = new ExpenseAnalysisService(user.familyId);
  const detailed = await service.getDetailedData(
    period as any,
    value as string
  );

  res.json(detailed);
}));

/**
 * GET /api/analysis/predictions
 * Lấy dự báo chi tiêu
 * Query params: months (số tháng muốn dự báo, mặc định 3)
 */
router.get("/predictions", asyncHandler(async (req: any, res: any) => {
  const user = req.user;
  const months = parseInt(req.query.months as string) || 3;

  const predictor = new ExpensePredictor(user.familyId);
  const predictions = await predictor.predictWithAI(months);

  // Lưu predictions vào database
  for (const pred of predictions) {
    await predictor.savePrediction(pred);
  }

  res.json({ predictions });
}));

/**
 * GET /api/analysis/anomalies
 * Phát hiện chi tiêu bất thường
 */
router.get("/anomalies", asyncHandler(async (req: any, res: any) => {
  const user = req.user;
  const { currentAmount } = req.query;

  if (!currentAmount) {
    return res.status(400).json({ error: "currentAmount is required" });
  }

  const predictor = new ExpensePredictor(user.familyId);
  const anomaly = await predictor.detectAnomalies(parseFloat(currentAmount as string));

  res.json(anomaly);
}));

/**
 * GET /api/analysis/spending-pattern
 * Phân tích pattern chi tiêu
 */
router.get("/spending-pattern", asyncHandler(async (req: any, res: any) => {
  const user = req.user;
  const months = parseInt(req.query.months as string) || 12;

  const predictor = new ExpensePredictor(user.familyId);
  const pattern = await predictor.analyzeSpendingPattern(months);

  res.json(pattern);
}));

export default router;

