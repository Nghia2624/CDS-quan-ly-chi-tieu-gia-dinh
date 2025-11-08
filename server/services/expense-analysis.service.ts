import { storage } from "../storage";
import { ExpensePredictor } from "../ai/expense-predictor";
import { generateFinancialInsights, generateExpenseSuggestions } from "../gemini";

export interface ExpenseAnalysis {
  totalAmount: number;
  period: {
    from: Date;
    to: Date;
  };
  comparison?: {
    previousPeriod: {
      totalAmount: number;
      change: number;
      changePercentage: number;
    };
  };
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
    count: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  dailyStats: Array<{
    date: string;
    amount: number;
    count: number;
  }>;
  weeklyStats: Array<{
    week: string;
    amount: number;
    count: number;
  }>;
  monthlyStats: Array<{
    month: string;
    amount: number;
    count: number;
  }>;
  predictions?: {
    nextMonth: number;
    confidence: number;
    algorithm: string;
  };
  anomalies?: Array<{
    date: string;
    amount: number;
    reason: string;
  }>;
  aiInsights: string;
  recommendations: string[];
}

export interface ComparisonPeriod {
  type: 'day' | 'week' | 'month' | 'quarter' | 'year';
  current: { start: Date; end: Date };
  previous: { start: Date; end: Date };
}

export class ExpenseAnalysisService {
  private familyId: string;
  private predictor: ExpensePredictor;

  constructor(familyId: string) {
    this.familyId = familyId;
    this.predictor = new ExpensePredictor(familyId);
  }

  /**
   * Phân tích chi tiêu theo khoảng thời gian
   */
  async analyzeByPeriod(
    startDate: Date,
    endDate: Date,
    includePredictions: boolean = true
  ): Promise<ExpenseAnalysis> {
    const expenses = await storage.getExpenses(this.familyId, 10000);
    
    // Lọc theo khoảng thời gian
    const filteredExpenses = expenses.filter((exp) => {
      if (!exp.createdAt) return false;
      const expDate = new Date(exp.createdAt);
      return expDate >= startDate && expDate <= endDate;
    });

    const totalAmount = filteredExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount || '0'), 0);

    // Phân tích theo danh mục
    const categoryMap = new Map<string, { amount: number; count: number }>();
    filteredExpenses.forEach((exp) => {
      const category = exp.category || 'Khác';
      const current = categoryMap.get(category) || { amount: 0, count: 0 };
      current.amount += parseFloat(exp.amount || '0');
      current.count += 1;
      categoryMap.set(category, current);
    });

    const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      amount: data.amount,
      percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0,
      count: data.count,
      trend: 'stable' as const, // Có thể tính toán dựa trên so sánh với kỳ trước
    })).sort((a, b) => b.amount - a.amount);

    // Thống kê theo ngày
    const dailyMap = new Map<string, { amount: number; count: number }>();
    filteredExpenses.forEach((exp) => {
      if (exp.createdAt) {
        const dateKey = new Date(exp.createdAt).toISOString().split('T')[0];
        const current = dailyMap.get(dateKey) || { amount: 0, count: 0 };
        current.amount += parseFloat(exp.amount || '0');
        current.count += 1;
        dailyMap.set(dateKey, current);
      }
    });

    const dailyStats = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Thống kê theo tuần (ISO week)
    const weeklyMap = new Map<string, { amount: number; count: number }>();
    filteredExpenses.forEach((exp) => {
      if (exp.createdAt) {
        const date = new Date(exp.createdAt);
        const weekKey = this.getISOWeek(date);
        const current = weeklyMap.get(weekKey) || { amount: 0, count: 0 };
        current.amount += parseFloat(exp.amount || '0');
        current.count += 1;
        weeklyMap.set(weekKey, current);
      }
    });

    const weeklyStats = Array.from(weeklyMap.entries())
      .map(([week, data]) => ({ week, ...data }))
      .sort((a, b) => a.week.localeCompare(b.week));

    // Thống kê theo tháng
    const monthlyMap = new Map<string, { amount: number; count: number }>();
    filteredExpenses.forEach((exp) => {
      if (exp.createdAt) {
        const date = new Date(exp.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const current = monthlyMap.get(monthKey) || { amount: 0, count: 0 };
        current.amount += parseFloat(exp.amount || '0');
        current.count += 1;
        monthlyMap.set(monthKey, current);
      }
    });

    const monthlyStats = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Dự báo
    let predictions: ExpenseAnalysis['predictions'];
    if (includePredictions) {
      const nextMonthPred = await this.predictor.predictNextMonthLinear();
      predictions = {
        nextMonth: nextMonthPred.predictedAmount,
        confidence: nextMonthPred.confidence,
        algorithm: nextMonthPred.algorithm,
      };
    }

    // Phát hiện anomalies
    const anomalies: ExpenseAnalysis['anomalies'] = [];
    const pattern = await this.predictor.analyzeSpendingPattern(6);
    const dailyAverages = dailyStats.map(d => d.amount);
    const avgDaily = dailyAverages.reduce((a, b) => a + b, 0) / dailyAverages.length || 0;
    
    dailyStats.forEach((day) => {
      if (day.amount > avgDaily * 2) {
        anomalies.push({
          date: day.date,
          amount: day.amount,
          reason: 'Chi tiêu cao bất thường trong ngày',
        });
      }
    });

    // AI Insights
    const expenseData = {
      totalAmount,
      categoryStats: categoryBreakdown.map(c => ({
        category: c.category,
        amount: c.amount,
        count: c.count,
      })),
      monthlyStats: monthlyStats.map(m => ({
        month: m.month,
        amount: m.amount,
      })),
    };

    let aiInsights = '';
    let recommendations: string[] = [];
    
    try {
      aiInsights = await generateFinancialInsights(expenseData);
      
      // Gợi ý dựa trên ngân sách (nếu có)
      // Lấy user đầu tiên của family để lấy monthlyBudget (có thể cải thiện sau)
      const familyMembers = await storage.getFamilyMembers(this.familyId);
      const user = familyMembers[0];
      if (user && user.monthlyBudget) {
        const suggestions = await generateExpenseSuggestions(
          expenseData,
          parseFloat(user.monthlyBudget || '0')
        );
        recommendations = [suggestions];
      }
    } catch (error) {
      console.error('Error generating AI insights:', error);
      aiInsights = 'Không thể tạo phân tích AI lúc này.';
    }

    return {
      totalAmount,
      period: {
        from: startDate,
        to: endDate,
      },
      categoryBreakdown,
      dailyStats,
      weeklyStats,
      monthlyStats,
      predictions,
      anomalies,
      aiInsights,
      recommendations,
    };
  }

  /**
   * So sánh chi tiêu giữa hai kỳ
   */
  async comparePeriods(comparison: ComparisonPeriod): Promise<{
    current: ExpenseAnalysis;
    previous: ExpenseAnalysis;
    comparison: {
      totalAmount: {
        current: number;
        previous: number;
        change: number;
        changePercentage: number;
      };
      categoryChanges: Array<{
        category: string;
        current: number;
        previous: number;
        change: number;
        changePercentage: number;
      }>;
    };
  }> {
    const current = await this.analyzeByPeriod(comparison.current.start, comparison.current.end, false);
    const previous = await this.analyzeByPeriod(comparison.previous.start, comparison.previous.end, false);

    // So sánh tổng số tiền
    const totalChange = current.totalAmount - previous.totalAmount;
    const totalChangePercentage = previous.totalAmount > 0 
      ? (totalChange / previous.totalAmount) * 100 
      : 0;

    // So sánh theo danh mục
    const categoryMap = new Map<string, { current: number; previous: number }>();
    
    current.categoryBreakdown.forEach((cat) => {
      categoryMap.set(cat.category, { current: cat.amount, previous: 0 });
    });
    
    previous.categoryBreakdown.forEach((cat) => {
      const existing = categoryMap.get(cat.category) || { current: 0, previous: 0 };
      existing.previous = cat.amount;
      categoryMap.set(cat.category, existing);
    });

    const categoryChanges = Array.from(categoryMap.entries()).map(([category, data]) => {
      const change = data.current - data.previous;
      const changePercentage = data.previous > 0 
        ? (change / data.previous) * 100 
        : (data.current > 0 ? 100 : 0);
      
      return {
        category,
        current: data.current,
        previous: data.previous,
        change,
        changePercentage,
      };
    }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

    return {
      current,
      previous,
      comparison: {
        totalAmount: {
          current: current.totalAmount,
          previous: previous.totalAmount,
          change: totalChange,
          changePercentage: totalChangePercentage,
        },
        categoryChanges,
      },
    };
  }

  /**
   * Phân tích chi tiết khi click vào biểu đồ
   */
  async getDetailedData(
    period: 'day' | 'week' | 'month' | 'quarter' | 'year',
    value: string // date string hoặc month string
  ): Promise<{
    period: string;
    expenses: Array<{
      id: string;
      description: string;
      amount: number;
      category: string;
      date: Date;
      userName?: string;
    }>;
    summary: {
      totalAmount: number;
      totalCount: number;
      averageAmount: number;
      categoryBreakdown: Array<{ category: string; amount: number; count: number }>;
    };
  }> {
    let startDate: Date;
    let endDate: Date;

    if (period === 'day') {
      startDate = new Date(value);
      endDate = new Date(value);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'week') {
      // value is week string like "2024-W01"
      const [year, week] = value.split('-W').map(Number);
      startDate = this.getDateFromISOWeek(year, week);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
    } else if (period === 'month') {
      const [year, month] = value.split('-').map(Number);
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59, 999);
    } else if (period === 'quarter') {
      const [year, quarter] = value.split('-Q').map(Number);
      const startMonth = (quarter - 1) * 3;
      startDate = new Date(year, startMonth, 1);
      endDate = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
    } else {
      const year = parseInt(value);
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31, 23, 59, 59, 999);
    }

    const expenses = await storage.getExpenses(this.familyId, 10000);
    const filteredExpenses = expenses.filter((exp) => {
      if (!exp.createdAt) return false;
      const expDate = new Date(exp.createdAt);
      return expDate >= startDate && expDate <= endDate;
    });

    const totalAmount = filteredExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount || '0'), 0);
    const totalCount = filteredExpenses.length;
    const averageAmount = totalCount > 0 ? totalAmount / totalCount : 0;

    const categoryMap = new Map<string, { amount: number; count: number }>();
    filteredExpenses.forEach((exp) => {
      const category = exp.category || 'Khác';
      const current = categoryMap.get(category) || { amount: 0, count: 0 };
      current.amount += parseFloat(exp.amount || '0');
      current.count += 1;
      categoryMap.set(category, current);
    });

    return {
      period: value,
      expenses: filteredExpenses.map((exp) => ({
        id: exp.id,
        description: exp.description,
        amount: parseFloat(exp.amount || '0'),
        category: exp.category || 'Khác',
        date: new Date(exp.createdAt || new Date()),
        userName: (exp as any).userName,
      })),
      summary: {
        totalAmount,
        totalCount,
        averageAmount,
        categoryBreakdown: Array.from(categoryMap.entries()).map(([category, data]) => ({
          category,
          ...data,
        })),
      },
    };
  }

  // Helper functions
  private getISOWeek(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return `${d.getUTCFullYear()}-W${String(Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)).padStart(2, '0')}`;
  }

  private getDateFromISOWeek(year: number, week: number): Date {
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4) {
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }
    return ISOweekStart;
  }
}

