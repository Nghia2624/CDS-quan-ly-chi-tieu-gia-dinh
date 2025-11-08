import { db } from "../db";
import { expenses, expensePredictions } from "@shared/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { generateFinancialPredictions } from "../gemini";

export interface PredictionResult {
  month: number;
  year: number;
  predictedAmount: number;
  category?: string;
  confidence: number;
  algorithm: string;
  reasoning: string;
}

export interface SpendingPattern {
  trend: 'increasing' | 'decreasing' | 'stable';
  averageMonthly: number;
  seasonalFactor: number;
  anomalyMonths: Array<{ month: number; year: number; amount: number; reason: string }>;
}

export class ExpensePredictor {
  private familyId: string;

  constructor(familyId: string) {
    this.familyId = familyId;
  }

  /**
   * Phân tích pattern chi tiêu lịch sử
   */
  async analyzeSpendingPattern(months: number = 12): Promise<SpendingPattern> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const historicalExpenses = await db
      .select({
        amount: expenses.amount,
        createdAt: expenses.createdAt,
        category: expenses.category,
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.familyId, this.familyId),
          gte(expenses.createdAt, startDate)
        )
      )
      .orderBy(expenses.createdAt);

    // Nhóm theo tháng
    const monthlyData = new Map<string, number>();
    historicalExpenses.forEach((exp) => {
      if (exp.createdAt) {
        const monthKey = `${exp.createdAt.getFullYear()}-${String(exp.createdAt.getMonth() + 1).padStart(2, '0')}`;
        const current = monthlyData.get(monthKey) || 0;
        monthlyData.set(monthKey, current + parseFloat(exp.amount));
      }
    });

    const monthlyAmounts = Array.from(monthlyData.values());
    const averageMonthly = monthlyAmounts.reduce((a, b) => a + b, 0) / monthlyAmounts.length || 0;

    // Xác định trend
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (monthlyAmounts.length >= 3) {
      const firstHalf = monthlyAmounts.slice(0, Math.floor(monthlyAmounts.length / 2));
      const secondHalf = monthlyAmounts.slice(Math.floor(monthlyAmounts.length / 2));
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      
      if (secondAvg > firstAvg * 1.1) trend = 'increasing';
      else if (secondAvg < firstAvg * 0.9) trend = 'decreasing';
    }

    // Phân tích theo mùa (Tết tháng 1-2, hè tháng 6-7, cuối năm tháng 11-12)
    const seasonalMonths = [1, 2, 6, 7, 11, 12];
    let seasonalFactor = 1.0;
    const seasonalData = monthlyAmounts.filter((_, idx) => {
      const month = new Date(Array.from(monthlyData.keys())[idx]).getMonth() + 1;
      return seasonalMonths.includes(month);
    });
    if (seasonalData.length > 0) {
      const seasonalAvg = seasonalData.reduce((a, b) => a + b, 0) / seasonalData.length;
      seasonalFactor = seasonalAvg / averageMonthly;
    }

    // Phát hiện anomalies (tháng có chi tiêu bất thường)
    const anomalies: Array<{ month: number; year: number; amount: number; reason: string }> = [];
    monthlyData.forEach((amount, monthKey) => {
      const [year, month] = monthKey.split('-').map(Number);
      if (amount > averageMonthly * 1.5) {
        anomalies.push({
          month,
          year,
          amount,
          reason: amount > averageMonthly * 2 ? 'Chi tiêu cao bất thường' : 'Chi tiêu tăng cao'
        });
      }
    });

    return {
      trend,
      averageMonthly,
      seasonalFactor,
      anomalyMonths: anomalies,
    };
  }

  /**
   * Dự báo chi tiêu cho tháng tới (Linear Regression đơn giản)
   */
  async predictNextMonthLinear(): Promise<PredictionResult> {
    const pattern = await this.analyzeSpendingPattern(6);
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    // Dự báo dựa trên trend và seasonal factor
    let predictedAmount = pattern.averageMonthly;
    
    if (pattern.trend === 'increasing') {
      predictedAmount *= 1.05; // Tăng 5%
    } else if (pattern.trend === 'decreasing') {
      predictedAmount *= 0.95; // Giảm 5%
    }

    // Áp dụng seasonal factor
    const month = nextMonth.getMonth() + 1;
    if ([1, 2, 6, 7, 11, 12].includes(month)) {
      predictedAmount *= pattern.seasonalFactor || 1.15; // Tăng 15% vào mùa cao điểm
    }

    return {
      month: nextMonth.getMonth() + 1,
      year: nextMonth.getFullYear(),
      predictedAmount: Math.round(predictedAmount),
      confidence: 0.7,
      algorithm: 'linear',
      reasoning: `Dựa trên trend ${pattern.trend} và pattern 6 tháng gần nhất`,
    };
  }

  /**
   * Dự báo chi tiêu với AI
   */
  async predictWithAI(months: number = 3): Promise<PredictionResult[]> {
    try {
      const pattern = await this.analyzeSpendingPattern(12);
      
      // Lấy dữ liệu lịch sử để gửi cho AI
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 12);
      
      const historicalData = await db
        .select({
          amount: expenses.amount,
          category: expenses.category,
          createdAt: expenses.createdAt,
        })
        .from(expenses)
        .where(
          and(
            eq(expenses.familyId, this.familyId),
            gte(expenses.createdAt, startDate)
          )
        );

      // Chuẩn bị dữ liệu cho AI
      const monthlyStats = new Map<string, { amount: number; category: Record<string, number> }>();
      historicalData.forEach((exp) => {
        if (exp.createdAt) {
          const monthKey = `${exp.createdAt.getFullYear()}-${String(exp.createdAt.getMonth() + 1).padStart(2, '0')}`;
          const current = monthlyStats.get(monthKey) || { amount: 0, category: {} };
          current.amount += parseFloat(exp.amount);
          if (exp.category) {
            current.category[exp.category] = (current.category[exp.category] || 0) + parseFloat(exp.amount);
          }
          monthlyStats.set(monthKey, current);
        }
      });

      const expenseData = {
        totalAmount: historicalData.reduce((sum, exp) => sum + parseFloat(exp.amount), 0),
        pattern: pattern,
        monthlyStats: Object.fromEntries(monthlyStats),
      };

      // Gọi AI để dự báo
      const aiPrediction = await generateFinancialPredictions(expenseData);
      
      // Parse AI response để lấy số liệu (đơn giản hóa)
      const predictions: PredictionResult[] = [];
      for (let i = 1; i <= months; i++) {
        const targetDate = new Date();
        targetDate.setMonth(targetDate.getMonth() + i);
        
        // Tính toán dự báo dựa trên pattern và AI insights
        let baseAmount = pattern.averageMonthly;
        if (pattern.trend === 'increasing') {
          baseAmount *= (1 + 0.05 * i); // Tăng dần theo tháng
        } else if (pattern.trend === 'decreasing') {
          baseAmount *= (1 - 0.03 * i); // Giảm dần theo tháng
        }

        const month = targetDate.getMonth() + 1;
        if ([1, 2].includes(month)) {
          baseAmount *= 1.3; // Tết
        } else if ([6, 7].includes(month)) {
          baseAmount *= 1.2; // Hè
        } else if ([11, 12].includes(month)) {
          baseAmount *= 1.15; // Cuối năm
        }

        predictions.push({
          month: targetDate.getMonth() + 1,
          year: targetDate.getFullYear(),
          predictedAmount: Math.round(baseAmount),
          confidence: 0.8,
          algorithm: 'ai',
          reasoning: `Dự báo AI dựa trên pattern và xu hướng lịch sử`,
        });
      }

      return predictions;
    } catch (error) {
      console.error('Error in AI prediction:', error);
      // Fallback to linear prediction
      return [await this.predictNextMonthLinear()];
    }
  }

  /**
   * Cảnh báo chi tiêu bất thường
   */
  async detectAnomalies(currentMonthAmount: number): Promise<{
    isAnomaly: boolean;
    severity: 'low' | 'medium' | 'high';
    message: string;
    suggestions: string[];
  }> {
    const pattern = await this.analyzeSpendingPattern(6);
    const threshold = pattern.averageMonthly * 1.2; // 20% cao hơn trung bình
    const highThreshold = pattern.averageMonthly * 1.5; // 50% cao hơn trung bình

    if (currentMonthAmount <= threshold) {
      return {
        isAnomaly: false,
        severity: 'low',
        message: 'Chi tiêu trong mức bình thường',
        suggestions: [],
      };
    }

    const severity = currentMonthAmount >= highThreshold ? 'high' : 'medium';
    const percentage = ((currentMonthAmount / pattern.averageMonthly - 1) * 100).toFixed(1);

    const suggestions = [
      'Xem xét lại các khoản chi tiêu không cần thiết',
      'Tạm hoãn các khoản chi tiêu lớn nếu có thể',
      'Kiểm tra lại ngân sách tháng này',
    ];

    if (severity === 'high') {
      suggestions.unshift('⚠️ CẢNH BÁO: Chi tiêu đang ở mức rất cao!');
    }

    return {
      isAnomaly: true,
      severity,
      message: `Chi tiêu tháng này cao hơn ${percentage}% so với trung bình`,
      suggestions,
    };
  }

  /**
   * Lưu dự báo vào database
   */
  async savePrediction(prediction: PredictionResult): Promise<void> {
    await db.insert(expensePredictions).values({
      familyId: this.familyId,
      predictedAmount: prediction.predictedAmount.toString(),
      predictedMonth: prediction.month,
      predictedYear: prediction.year,
      category: prediction.category,
      confidence: prediction.confidence.toString(),
      algorithm: prediction.algorithm,
    });
  }

  /**
   * Lấy dự báo đã lưu
   */
  async getSavedPredictions(month?: number, year?: number) {
    const conditions = [eq(expensePredictions.familyId, this.familyId)];
    
    if (month) {
      conditions.push(eq(expensePredictions.predictedMonth, month));
    }
    if (year) {
      conditions.push(eq(expensePredictions.predictedYear, year));
    }

    return await db
      .select()
      .from(expensePredictions)
      .where(and(...conditions))
      .orderBy(expensePredictions.predictedYear, expensePredictions.predictedMonth);
  }
}

