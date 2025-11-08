import { storage } from "../storage";
import { ExpensePredictor } from "../ai/expense-predictor";
import { generateFinancialInsights } from "../gemini";
import { type SavingsGoal, type InsertSavingsGoal } from "@shared/schema";

export interface SavingsGoalProgress {
  goal: SavingsGoal;
  progress: {
    currentAmount: number;
    targetAmount: number;
    percentage: number;
    remaining: number;
    daysRemaining: number;
    estimatedCompletionDate: Date | null;
    monthlyRequired: number;
    onTrack: boolean;
  };
  aiAnalysis: {
    insights: string;
    recommendations: string[];
    riskFactors: string[];
  };
}

export interface SavingsGoalComparison {
  goal: SavingsGoal;
  comparison: {
    vsAverage: number; // percentage difference vs average progress
    vsBestPerformer: number;
    rank: number;
    percentile: number;
  };
}

export class SavingsGoalService {
  private familyId: string;
  private predictor: ExpensePredictor;

  constructor(familyId: string) {
    this.familyId = familyId;
    this.predictor = new ExpensePredictor(familyId);
  }

  /**
   * Tính toán tiến độ mục tiêu tiết kiệm với AI
   */
  async calculateProgress(goalId: string): Promise<SavingsGoalProgress> {
    const goal = await storage.getSavingsGoalById(goalId);
    if (!goal || goal.familyId !== this.familyId) {
      throw new Error("Savings goal not found");
    }

    const currentAmount = parseFloat(goal.currentAmount || '0');
    const targetAmount = parseFloat(goal.targetAmount || '0');
    const percentage = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;
    const remaining = targetAmount - currentAmount;

    // Tính số ngày còn lại
    let daysRemaining = 0;
    let estimatedCompletionDate: Date | null = null;
    let monthlyRequired = 0;

    if (goal.targetDate) {
      const targetDate = new Date(goal.targetDate);
      const now = new Date();
      daysRemaining = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysRemaining > 0) {
        const monthsRemaining = daysRemaining / 30;
        monthlyRequired = remaining / monthsRemaining;
        
        // Dự báo ngày hoàn thành dựa trên tốc độ hiện tại
        if (currentAmount > 0 && goal.createdAt) {
          const daysElapsed = Math.ceil((now.getTime() - new Date(goal.createdAt).getTime()) / (1000 * 60 * 60 * 24));
          if (daysElapsed > 0) {
            const dailyRate = currentAmount / daysElapsed;
            const daysToComplete = remaining / dailyRate;
            estimatedCompletionDate = new Date(now.getTime() + daysToComplete * 24 * 60 * 60 * 1000);
          }
        }
      }
    }

    // Kiểm tra có đúng tiến độ không
    let onTrack = true;
    if (goal.targetDate && goal.createdAt) {
      const totalDays = Math.ceil((new Date(goal.targetDate).getTime() - new Date(goal.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      const daysElapsed = Math.ceil((Date.now() - new Date(goal.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      const expectedProgress = (daysElapsed / totalDays) * 100;
      onTrack = percentage >= expectedProgress * 0.9; // Cho phép sai số 10%
    }

    // Phân tích AI
    const aiAnalysis = await this.generateAIAnalysis(goal, {
      currentAmount,
      targetAmount,
      remaining,
      daysRemaining,
      monthlyRequired,
      onTrack,
    });

    return {
      goal,
      progress: {
        currentAmount,
        targetAmount,
        percentage: Math.round(percentage * 100) / 100,
        remaining,
        daysRemaining: Math.max(0, daysRemaining),
        estimatedCompletionDate,
        monthlyRequired: Math.round(monthlyRequired),
        onTrack,
      },
      aiAnalysis,
    };
  }

  /**
   * Tạo AI analysis cho mục tiêu tiết kiệm
   */
  private async generateAIAnalysis(
    goal: SavingsGoal,
    progress: {
      currentAmount: number;
      targetAmount: number;
      remaining: number;
      daysRemaining: number;
      monthlyRequired: number;
      onTrack: boolean;
    }
  ): Promise<SavingsGoalProgress['aiAnalysis']> {
    try {
      // Lấy pattern chi tiêu để phân tích
      const spendingPattern = await this.predictor.analyzeSpendingPattern(6);
      
      // Lấy stats chi tiêu của gia đình
      const expenseStats = await storage.getExpenseStats(this.familyId);
      
      // Tính toán khả năng tiết kiệm
      const avgMonthlySpending = spendingPattern.averageMonthly;
      const savingsRate = progress.monthlyRequired / avgMonthlySpending; // Tỷ lệ cần tiết kiệm so với chi tiêu trung bình

      const analysisData = {
        goal: {
          title: goal.title,
          targetAmount: progress.targetAmount,
          currentAmount: progress.currentAmount,
          remaining: progress.remaining,
          category: goal.category,
          targetDate: goal.targetDate,
        },
        progress: {
          percentage: (progress.currentAmount / progress.targetAmount) * 100,
          daysRemaining: progress.daysRemaining,
          monthlyRequired: progress.monthlyRequired,
          onTrack: progress.onTrack,
        },
        spending: {
          averageMonthly: avgMonthlySpending,
          savingsRate: savingsRate,
          pattern: spendingPattern.trend,
        },
        expenseStats: {
          totalAmount: expenseStats.totalAmount,
          topCategories: expenseStats.categoryStats.slice(0, 3),
        },
      };

      // Gọi AI để phân tích
      const systemPrompt = `Bạn là một chuyên gia tư vấn tài chính gia đình Việt Nam với 20 năm kinh nghiệm.
Phân tích mục tiêu tiết kiệm và đưa ra lời khuyên cụ thể, thực tế.

PHÂN TÍCH:
1. Đánh giá tiến độ hiện tại: đúng tiến độ hay không, lý do
2. Tính khả thi: mức tiết kiệm hàng tháng có khả thi không
3. Gợi ý điều chỉnh: cách điều chỉnh chi tiêu để đạt mục tiêu
4. Rủi ro: các yếu tố có thể ảnh hưởng đến việc đạt mục tiêu

Trả về JSON:
{
  "insights": "Phân tích chi tiết về tình hình và tiến độ (200-300 từ)",
  "recommendations": ["Gợi ý cụ thể 1", "Gợi ý cụ thể 2", "Gợi ý cụ thể 3"],
  "riskFactors": ["Rủi ro 1", "Rủi ro 2"]
}`;

      const expenseDataForAI = {
        totalAmount: expenseStats.totalAmount,
        categoryStats: expenseStats.categoryStats,
        monthlyStats: expenseStats.monthlyStats,
        savingsGoal: analysisData,
      };

      const aiResponse = await generateFinancialInsights(expenseDataForAI);
      
      // Parse AI response (đơn giản hóa - trong thực tế cần parse JSON từ AI)
      const recommendations = this.extractRecommendations(aiResponse);
      const riskFactors = this.identifyRiskFactors(progress, spendingPattern, savingsRate);

      return {
        insights: aiResponse.substring(0, 500) + (aiResponse.length > 500 ? '...' : ''),
        recommendations: recommendations.length > 0 ? recommendations : [
          progress.monthlyRequired > avgMonthlySpending * 0.3 
            ? `Cần tiết kiệm ${Math.round((progress.monthlyRequired / avgMonthlySpending) * 100)}% chi tiêu hàng tháng. Xem xét giảm chi tiêu không cần thiết.`
            : `Mức tiết kiệm hàng tháng (${progress.monthlyRequired.toLocaleString('vi-VN')} VNĐ) là khả thi.`,
          !progress.onTrack 
            ? `Bạn đang chậm tiến độ. Cần tăng mức tiết kiệm hàng tháng hoặc điều chỉnh mục tiêu.`
            : `Bạn đang đúng tiến độ. Tiếp tục duy trì!`,
          `Theo dõi chi tiêu hàng tháng và điều chỉnh linh hoạt để đảm bảo đạt mục tiêu.`,
        ],
        riskFactors,
      };
    } catch (error) {
      console.error('Error generating AI analysis:', error);
      return {
        insights: 'Không thể phân tích AI lúc này. Vui lòng thử lại sau.',
        recommendations: [
          `Cần tiết kiệm ${progress.monthlyRequired.toLocaleString('vi-VN')} VNĐ mỗi tháng để đạt mục tiêu.`,
          progress.onTrack ? 'Bạn đang đúng tiến độ!' : 'Bạn cần tăng tốc độ tiết kiệm.',
        ],
        riskFactors: progress.daysRemaining < 30 && progress.remaining > progress.monthlyRequired 
          ? ['Thời gian còn lại ngắn, cần tăng tốc độ tiết kiệm'] 
          : [],
      };
    }
  }

  private extractRecommendations(aiText: string): string[] {
    const recommendations: string[] = [];
    
    // Tìm các gợi ý trong text (đơn giản hóa)
    const lines = aiText.split('\n');
    lines.forEach(line => {
      if (line.includes('•') || line.includes('-') || line.includes('1.') || line.includes('2.')) {
        const cleaned = line.replace(/^[•\-\d\.\s]+/, '').trim();
        if (cleaned.length > 20 && cleaned.length < 200) {
          recommendations.push(cleaned);
        }
      }
    });

    return recommendations.slice(0, 5);
  }

  private identifyRiskFactors(
    progress: { remaining: number; daysRemaining: number; monthlyRequired: number; onTrack: boolean },
    pattern: any,
    savingsRate: number
  ): string[] {
    const risks: string[] = [];

    if (!progress.onTrack) {
      risks.push('Tiến độ chậm so với kế hoạch');
    }

    if (progress.daysRemaining > 0 && progress.monthlyRequired > pattern.averageMonthly * 0.5) {
      risks.push('Mức tiết kiệm yêu cầu khá cao so với chi tiêu trung bình');
    }

    if (progress.daysRemaining < 90 && progress.remaining > progress.monthlyRequired * 2) {
      risks.push('Thời gian còn lại ngắn nhưng số tiền còn lại còn nhiều');
    }

    if (pattern.trend === 'increasing') {
      risks.push('Chi tiêu đang có xu hướng tăng, có thể ảnh hưởng đến khả năng tiết kiệm');
    }

    return risks;
  }

  /**
   * So sánh với các mục tiêu khác
   */
  async compareGoals(goalId: string): Promise<SavingsGoalComparison> {
    const goal = await storage.getSavingsGoalById(goalId);
    if (!goal || goal.familyId !== this.familyId) {
      throw new Error("Savings goal not found");
    }

    const allGoals = await storage.getSavingsGoals(this.familyId);
    const activeGoals = allGoals.filter(g => g.status === 'active');

    if (activeGoals.length <= 1) {
      return {
        goal,
        comparison: {
          vsAverage: 0,
          vsBestPerformer: 0,
          rank: 1,
          percentile: 100,
        },
      };
    }

    // Tính progress của từng goal
    const goalProgresses = await Promise.all(
      activeGoals.map(async (g) => {
        const progress = await this.calculateProgress(g.id);
        return {
          goalId: g.id,
          percentage: progress.progress.percentage,
        };
      })
    );

    const currentProgress = goalProgresses.find(gp => gp.goalId === goalId);
    if (!currentProgress) {
      throw new Error("Cannot calculate progress");
    }

    const percentages = goalProgresses.map(gp => gp.percentage);
    const average = percentages.reduce((a, b) => a + b, 0) / percentages.length;
    const best = Math.max(...percentages);
    const sorted = [...percentages].sort((a, b) => b - a);
    const rank = sorted.indexOf(currentProgress.percentage) + 1;
    const percentile = ((activeGoals.length - rank + 1) / activeGoals.length) * 100;

    return {
      goal,
      comparison: {
        vsAverage: currentProgress.percentage - average,
        vsBestPerformer: currentProgress.percentage - best,
        rank,
        percentile: Math.round(percentile),
      },
    };
  }

  /**
   * Gợi ý điều chỉnh chi tiêu để đạt mục tiêu
   */
  async suggestAdjustments(goalId: string): Promise<{
    currentSpending: number;
    targetSpending: number;
    reductions: Array<{ category: string; current: number; suggested: number; savings: number }>;
    totalSavings: number;
  }> {
    const progress = await this.calculateProgress(goalId);
    const expenseStats = await storage.getExpenseStats(this.familyId);

    // Tính toán số tiền cần giảm
    const monthlyRequired = progress.progress.monthlyRequired;
    const currentMonthlySpending = expenseStats.totalAmount / 12; // Giả sử dữ liệu là 12 tháng

    // Phân tích từng category để tìm cơ hội tiết kiệm
    const reductions = expenseStats.categoryStats
      .filter(cat => cat.amount > 0)
      .map(cat => {
        // Gợi ý giảm 10-20% cho các category không thiết yếu
        const isEssential = ['Y tế', 'Học tập', 'Gia dụng'].includes(cat.category);
        const reductionPercent = isEssential ? 0.05 : 0.15; // 5% cho thiết yếu, 15% cho không thiết yếu
        
        const monthlyCategory = cat.amount / 12;
        const suggested = monthlyCategory * (1 - reductionPercent);
        const savings = monthlyCategory * reductionPercent;

        return {
          category: cat.category,
          current: monthlyCategory,
          suggested,
          savings,
        };
      })
      .sort((a, b) => b.savings - a.savings);

    const totalSavings = reductions.reduce((sum, r) => sum + r.savings, 0);

    return {
      currentSpending: currentMonthlySpending,
      targetSpending: currentMonthlySpending - monthlyRequired,
      reductions: reductions.slice(0, 5), // Top 5 categories
      totalSavings,
    };
  }

  /**
   * Dự báo khả năng đạt mục tiêu
   */
  async forecastAchievement(goalId: string): Promise<{
    willAchieve: boolean;
    confidence: number;
    estimatedDate: Date | null;
    alternativeScenarios: Array<{
      scenario: string;
      estimatedDate: Date;
      monthlyRequired: number;
    }>;
  }> {
    const progress = await this.calculateProgress(goalId);
    const spendingPattern = await this.predictor.analyzeSpendingPattern(6);

    // Tính toán tốc độ tiết kiệm hiện tại
    let estimatedDate: Date | null = null;
    let willAchieve = false;
    let confidence = 0.5;

    if (progress.goal.targetDate) {
      const targetDate = new Date(progress.goal.targetDate);
      const now = new Date();
      const daysRemaining = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (progress.goal.createdAt) {
        const daysElapsed = Math.ceil((now.getTime() - new Date(progress.goal.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        if (daysElapsed > 0 && progress.progress.currentAmount > 0) {
          const dailyRate = progress.progress.currentAmount / daysElapsed;
          const daysToComplete = progress.progress.remaining / dailyRate;
          estimatedDate = new Date(now.getTime() + daysToComplete * 24 * 60 * 60 * 1000);
          
          willAchieve = estimatedDate <= targetDate;
          confidence = willAchieve ? 0.8 : 0.4;
        }
      }
    }

    // Các kịch bản thay thế
    const alternativeScenarios = [
      {
        scenario: 'Tăng tốc độ tiết kiệm 20%',
        estimatedDate: estimatedDate ? new Date(estimatedDate.getTime() - (estimatedDate.getTime() - Date.now()) * 0.2) : null,
        monthlyRequired: progress.progress.monthlyRequired * 0.8,
      },
      {
        scenario: 'Tiết kiệm hiện tại',
        estimatedDate: estimatedDate,
        monthlyRequired: progress.progress.monthlyRequired,
      },
      {
        scenario: 'Giảm tốc độ tiết kiệm 20%',
        estimatedDate: estimatedDate ? new Date(estimatedDate.getTime() + (estimatedDate.getTime() - Date.now()) * 0.2) : null,
        monthlyRequired: progress.progress.monthlyRequired * 1.2,
      },
    ].filter(s => s.estimatedDate !== null) as Array<{
      scenario: string;
      estimatedDate: Date;
      monthlyRequired: number;
    }>;

    return {
      willAchieve,
      confidence,
      estimatedDate,
      alternativeScenarios,
    };
  }
}

