import { Router, Request, Response } from "express";
import { db } from "../db";
import { expenses, users } from "../../shared/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { asyncHandler } from "../error-handler";

const router = Router();

// Get budget alerts for the current month
router.get("/budget", asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const familyId = req.user?.familyId;
  
  if (!userId || !familyId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Get current month expenses
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const currentMonthExpenses = await db
    .select({
      amount: expenses.amount,
      category: expenses.category,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.familyId, familyId),
        gte(expenses.createdAt, startOfMonth),
        lte(expenses.createdAt, endOfMonth)
      )
    );

  const totalSpent = currentMonthExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
  
  // Default budget: 25M VND per month
  const monthlyBudget = 25000000;
  const percentageUsed = (totalSpent / monthlyBudget) * 100;
  
  const alerts = [];
  
  // Budget warnings
  if (percentageUsed >= 90) {
    alerts.push({
      type: 'critical',
      title: 'Cảnh báo: Gần hết ngân sách!',
      message: `Bạn đã chi tiêu ${percentageUsed.toFixed(1)}% ngân sách tháng này. Còn lại ${(monthlyBudget - totalSpent).toLocaleString('vi-VN')} VNĐ.`,
      remaining: monthlyBudget - totalSpent,
    });
  } else if (percentageUsed >= 75) {
    alerts.push({
      type: 'warning',
      title: 'Cảnh báo: Ngân sách sắp hết',
      message: `Bạn đã chi tiêu ${percentageUsed.toFixed(1)}% ngân sách tháng này.`,
      remaining: monthlyBudget - totalSpent,
    });
  }

  // Category over-spending alerts
  const categoryTotals: Record<string, number> = {};
  currentMonthExpenses.forEach(exp => {
    if (exp.category) {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + parseFloat(exp.amount);
    }
  });

  // Average category budget (25M / 9 categories ≈ 2.7M per category)
  const avgCategoryBudget = monthlyBudget / 9;
  Object.entries(categoryTotals).forEach(([category, amount]) => {
    if (amount > avgCategoryBudget * 2) {
      alerts.push({
        type: 'info',
        title: `Chi tiêu cao: ${category}`,
        message: `Chi tiêu ${category} tháng này là ${amount.toLocaleString('vi-VN')} VNĐ, cao hơn mức trung bình.`,
        category,
        amount,
      });
    }
  });

  res.json({
    alerts,
    summary: {
      totalSpent,
      monthlyBudget,
      percentageUsed: percentageUsed.toFixed(1),
      remaining: monthlyBudget - totalSpent,
      daysRemaining: Math.ceil((endOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    },
  });
}));

// Get expense reminders (e.g., recurring expenses)
router.get("/reminders", asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const familyId = req.user?.familyId;
  
  if (!userId || !familyId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const reminders = [];
  const now = new Date();
  
  // Check for monthly recurring patterns
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get expenses from last month to detect patterns
  const lastMonthExpenses = await db
    .select({
      description: expenses.description,
      amount: expenses.amount,
      category: expenses.category,
      createdAt: expenses.createdAt,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.familyId, familyId),
        gte(expenses.createdAt, lastMonth),
        lte(expenses.createdAt, thisMonth)
      )
    );

  // Get current month expenses to see if recurring expenses were paid
  const currentMonthExpenses = await db
    .select({
      description: expenses.description,
      category: expenses.category,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.familyId, familyId),
        gte(expenses.createdAt, thisMonth)
      )
    );

  // Detect recurring expenses (same category/description pattern)
  const recurringPatterns: Record<string, { count: number; amount: number; lastDate: Date }> = {};
  
  lastMonthExpenses.forEach(exp => {
    const key = `${exp.category || 'Khác'}`;
    if (!recurringPatterns[key]) {
      recurringPatterns[key] = { count: 0, amount: 0, lastDate: new Date(exp.createdAt || now) };
    }
    recurringPatterns[key].count++;
    recurringPatterns[key].amount += parseFloat(exp.amount);
  });

  // Check if recurring expenses haven't been paid this month
  Object.entries(recurringPatterns).forEach(([category, pattern]) => {
    const hasBeenPaid = currentMonthExpenses.some(exp => exp.category === category);
    if (!hasBeenPaid && pattern.count >= 2) {
      reminders.push({
        type: 'reminder',
        title: `Nhắc nhở: Chi tiêu ${category}`,
        message: `Bạn thường chi tiêu khoảng ${(pattern.amount / pattern.count).toLocaleString('vi-VN')} VNĐ cho ${category} mỗi tháng.`,
        category,
        estimatedAmount: Math.round(pattern.amount / pattern.count),
      });
    }
  });

  // Day-of-month based reminders (e.g., rent on day 1)
  const dayOfMonth = now.getDate();
  if (dayOfMonth >= 28) {
    reminders.push({
      type: 'info',
      title: 'Cuối tháng',
      message: 'Hãy kiểm tra lại các khoản chi tiêu tháng này và lên kế hoạch cho tháng sau.',
    });
  }

  res.json({ reminders });
}));

export default router;

