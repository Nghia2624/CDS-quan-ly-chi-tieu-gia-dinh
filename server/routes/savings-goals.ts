import { Router, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { SavingsGoalService } from "../services/savings-goal.service";
import { insertSavingsGoalSchema } from "@shared/schema";
import { asyncHandler } from "../error-handler";
import { z } from "zod";

const router = Router();

// Middleware để lấy familyId từ user
router.use((req, res, next) => {
  const user = (req as any).user;
  if (!user || !user.familyId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

// Middleware để check nếu user là child (chỉ được xem, không được sửa)
function requireWritePermission(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Child chỉ có quyền xem
  if (user.role === 'child') {
    return res.status(403).json({ error: 'Trẻ em chỉ có quyền xem, không thể thêm hoặc sửa dữ liệu' });
  }
  
  next();
}

/**
 * GET /api/savings-goals
 * Lấy danh sách mục tiêu tiết kiệm (OPTIMIZED - no AI calls)
 */
router.get("/", asyncHandler(async (req: any, res: any) => {
  const user = req.user;
  const goals = await storage.getSavingsGoals(user.familyId);

  // Tính progress cơ bản cho từng goal (không gọi AI để tăng tốc)
  const goalsWithProgress = goals.map((goal) => {
    const currentAmount = parseFloat(goal.currentAmount || '0');
    const targetAmount = parseFloat(goal.targetAmount || '0');
    const percentage = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;
    const remaining = targetAmount - currentAmount;

    // Tính số ngày còn lại
    let daysRemaining = 0;
    let monthlyRequired = 0;
    let onTrack = true;

    if (goal.targetDate) {
      const targetDate = new Date(goal.targetDate);
      const now = new Date();
      daysRemaining = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysRemaining > 0) {
        const monthsRemaining = daysRemaining / 30;
        monthlyRequired = remaining / monthsRemaining;
      }

      // Kiểm tra có đúng tiến độ không
      if (goal.createdAt) {
        const totalDays = Math.ceil((targetDate.getTime() - new Date(goal.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        const daysElapsed = Math.ceil((now.getTime() - new Date(goal.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        if (totalDays > 0 && daysElapsed > 0) {
          const expectedProgress = (daysElapsed / totalDays) * 100;
          onTrack = percentage >= expectedProgress * 0.9; // Cho phép sai số 10%
        }
      }
    }

    return {
      ...goal,
      progress: {
        percentage: Math.round(percentage * 100) / 100,
        remaining,
        daysRemaining: Math.max(0, daysRemaining),
        monthlyRequired: Math.round(monthlyRequired),
        onTrack,
      },
    };
  });

  res.json({ goals: goalsWithProgress });
}));

/**
 * POST /api/savings-goals
 * Tạo mục tiêu tiết kiệm mới
 */
router.post("/", requireWritePermission, asyncHandler(async (req: any, res: any) => {
  const user = (req as any).user;
  
  // Validate input
  const validated = insertSavingsGoalSchema.parse(req.body);
  
  const goal = await storage.createSavingsGoal({
    ...validated,
    userId: user.userId,
    familyId: user.familyId,
    targetAmount: validated.targetAmount,
    targetDate: validated.targetDate ? new Date(validated.targetDate as any) : undefined,
  });

  res.status(201).json({ message: "Tạo mục tiêu tiết kiệm thành công", goal });
}));

/**
 * GET /api/savings-goals/:id
 * Lấy chi tiết mục tiêu với progress và AI analysis
 */
router.get("/:id", asyncHandler(async (req: any, res: any) => {
  const user = req.user;
  const { id } = req.params;

  const goal = await storage.getSavingsGoalById(id);
  if (!goal || goal.familyId !== user.familyId) {
    return res.status(404).json({ error: "Mục tiêu không tồn tại" });
  }

  const service = new SavingsGoalService(user.familyId);
  const progress = await service.calculateProgress(id);

  res.json(progress);
}));

/**
 * PUT /api/savings-goals/:id
 * Cập nhật mục tiêu tiết kiệm
 */
router.put("/:id", requireWritePermission, asyncHandler(async (req: any, res: any) => {
  const user = req.user;
  const { id } = req.params;

  const goal = await storage.getSavingsGoalById(id);
  if (!goal || goal.familyId !== user.familyId) {
    return res.status(404).json({ error: "Mục tiêu không tồn tại" });
  }

  // Validate update data
  const updateSchema = insertSavingsGoalSchema.partial().extend({
    currentAmount: z.number().min(0).optional(),
    status: z.enum(["active", "completed", "paused", "cancelled"]).optional(),
  });

  const validated = updateSchema.parse(req.body);
  
  const updated = await storage.updateSavingsGoal(id, {
    ...validated,
    targetDate: validated.targetDate ? new Date(validated.targetDate as any) : undefined,
  });

  res.json({ message: "Cập nhật mục tiêu thành công", goal: updated });
}));

/**
 * DELETE /api/savings-goals/:id
 * Xóa mục tiêu tiết kiệm
 */
router.delete("/:id", requireWritePermission, asyncHandler(async (req: any, res: any) => {
  const user = req.user;
  const { id } = req.params;

  const goal = await storage.getSavingsGoalById(id);
  if (!goal || goal.familyId !== user.familyId) {
    return res.status(404).json({ error: "Mục tiêu không tồn tại" });
  }

  await storage.deleteSavingsGoal(id);
  res.json({ message: "Xóa mục tiêu thành công" });
}));

/**
 * GET /api/savings-goals/:id/progress
 * Lấy progress chi tiết với AI analysis
 */
router.get("/:id/progress", asyncHandler(async (req: any, res: any) => {
  const user = req.user;
  const { id } = req.params;

  const goal = await storage.getSavingsGoalById(id);
  if (!goal || goal.familyId !== user.familyId) {
    return res.status(404).json({ error: "Mục tiêu không tồn tại" });
  }

  const service = new SavingsGoalService(user.familyId);
  const progress = await service.calculateProgress(id);

  res.json(progress);
}));

/**
 * GET /api/savings-goals/:id/compare
 * So sánh với các mục tiêu khác
 */
router.get("/:id/compare", asyncHandler(async (req: any, res: any) => {
  const user = req.user;
  const { id } = req.params;

  const goal = await storage.getSavingsGoalById(id);
  if (!goal || goal.familyId !== user.familyId) {
    return res.status(404).json({ error: "Mục tiêu không tồn tại" });
  }

  const service = new SavingsGoalService(user.familyId);
  const comparison = await service.compareGoals(id);

  res.json(comparison);
}));

/**
 * GET /api/savings-goals/:id/suggestions
 * Gợi ý điều chỉnh chi tiêu để đạt mục tiêu
 */
router.get("/:id/suggestions", asyncHandler(async (req: any, res: any) => {
  const user = req.user;
  const { id } = req.params;

  const goal = await storage.getSavingsGoalById(id);
  if (!goal || goal.familyId !== user.familyId) {
    return res.status(404).json({ error: "Mục tiêu không tồn tại" });
  }

  const service = new SavingsGoalService(user.familyId);
  const suggestions = await service.suggestAdjustments(id);

  res.json(suggestions);
}));

/**
 * GET /api/savings-goals/:id/forecast
 * Dự báo khả năng đạt mục tiêu
 */
router.get("/:id/forecast", asyncHandler(async (req: any, res: any) => {
  const user = req.user;
  const { id } = req.params;

  const goal = await storage.getSavingsGoalById(id);
  if (!goal || goal.familyId !== user.familyId) {
    return res.status(404).json({ error: "Mục tiêu không tồn tại" });
  }

  const service = new SavingsGoalService(user.familyId);
  const forecast = await service.forecastAchievement(id);

  res.json(forecast);
}));

export default router;

