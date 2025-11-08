import { db } from './db';
import { expenses, users } from '@shared/schema';
import { eq, and, desc, sql, gte, lte, like, or } from 'drizzle-orm';

export interface AdvancedQueryResult {
  success: boolean;
  data: any;
  message: string;
}

export class AIQueryEngine {
  private familyId: string;

  constructor(familyId: string) {
    this.familyId = familyId;
  }

  // ==================== SMART QUERIES ====================
  
  // So sánh chi tiêu tháng này vs tháng trước
  async compareCurrentVsPreviousMonth(): Promise<AdvancedQueryResult> {
    try {
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      
      const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const lastYear = currentMonth === 1 ? currentYear - 1 : currentYear;

      const currentMonthExpenses = await db
        .select({ amount: expenses.amount })
        .from(expenses)
        .where(and(
          eq(expenses.familyId, this.familyId),
          sql`EXTRACT(MONTH FROM ${expenses.createdAt}) = ${currentMonth}`,
          sql`EXTRACT(YEAR FROM ${expenses.createdAt}) = ${currentYear}`
        ));

      const lastMonthExpenses = await db
        .select({ amount: expenses.amount })
        .from(expenses)
        .where(and(
          eq(expenses.familyId, this.familyId),
          sql`EXTRACT(MONTH FROM ${expenses.createdAt}) = ${lastMonth}`,
          sql`EXTRACT(YEAR FROM ${expenses.createdAt}) = ${lastYear}`
        ));

      const currentTotal = currentMonthExpenses.reduce((s, e) => s + parseFloat(e.amount), 0);
      const lastTotal = lastMonthExpenses.reduce((s, e) => s + parseFloat(e.amount), 0);
      const diff = currentTotal - lastTotal;
      const diffPercent = lastTotal > 0 ? ((diff / lastTotal) * 100).toFixed(1) : '0';

      return {
        success: true,
        data: { currentTotal, lastTotal, diff, diffPercent },
        message: `📊 Tháng này: ${(currentTotal/1000000).toFixed(2)}M VNĐ (${currentMonthExpenses.length} giao dịch)\n📊 Tháng trước: ${(lastTotal/1000000).toFixed(2)}M VNĐ (${lastMonthExpenses.length} giao dịch)\n${diff >= 0 ? '📈 Tăng' : '📉 Giảm'} ${Math.abs(diff/1000000).toFixed(2)}M VNĐ (${diffPercent}%)`
      };
    } catch (error) {
      return { success: false, data: null, message: "Lỗi so sánh" };
    }
  }

  // Tìm các khoản chi tiêu lớn (> amount)
  async getLargeExpenses(minAmount: number = 1000000): Promise<AdvancedQueryResult> {
    try {
      const result = await db
        .select({
          description: expenses.description,
          amount: expenses.amount,
          category: expenses.category,
          createdAt: expenses.createdAt,
          userName: users.fullName,
        })
        .from(expenses)
        .leftJoin(users, eq(expenses.userId, users.id))
        .where(and(
          eq(expenses.familyId, this.familyId),
          sql`CAST(${expenses.amount} AS DECIMAL) >= ${minAmount}`
        ))
        .orderBy(desc(sql`CAST(${expenses.amount} AS DECIMAL)`))
        .limit(10);

      const totalAmount = result.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
      
      return {
        success: true,
        data: result,
        message: `Tìm thấy ${result.length} khoản chi lớn (>= ${(minAmount/1000000).toFixed(1)}M), tổng: ${(totalAmount/1000000).toFixed(2)}M VNĐ\nTop 3:\n${result.slice(0,3).map((e,i) => `${i+1}. ${e.description}: ${parseFloat(e.amount).toLocaleString('vi-VN')} VNĐ`).join('\n')}`
      };
    } catch (error) {
      return { success: false, data: null, message: "Lỗi truy vấn" };
    }
  }

  // Phân tích chi tiêu theo thành viên
  async getExpensesByMember(): Promise<AdvancedQueryResult> {
    try {
      const results = await db
        .select({
          userId: expenses.userId,
          childId: expenses.childId,
          amount: expenses.amount,
          userName: users.fullName,
          userRole: users.role,
        })
        .from(expenses)
        .leftJoin(users, eq(expenses.userId, users.id))
        .where(eq(expenses.familyId, this.familyId));

      // Get all family members
      const familyMembers = await db
        .select()
        .from(users)
        .where(eq(users.familyId, this.familyId));

      // Calculate per member
      const memberStats = familyMembers.map(member => {
        const memberExpenses = results.filter(exp => 
          exp.childId === member.id || (exp.userId === member.id && !exp.childId)
        );
        const total = memberExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
        return {
          name: member.fullName,
          role: member.role,
          count: memberExpenses.length,
          total
        };
      }).sort((a, b) => b.total - a.total);

      return {
        success: true,
        data: memberStats,
        message: `📊 Chi tiêu theo thành viên:\n${memberStats.map(m => `${m.name} (${m.role}): ${(m.total/1000000).toFixed(2)}M VNĐ (${m.count} giao dịch)`).join('\n')}`
      };
    } catch (error) {
      return { success: false, data: null, message: "Lỗi phân tích thành viên" };
    }
  }

  // Tìm khoản chi tiêu lớn nhất từ trước đến nay
  async getLargestExpense(): Promise<AdvancedQueryResult> {
    try {
      const result = await db
        .select({
          id: expenses.id,
          description: expenses.description,
          amount: expenses.amount,
          category: expenses.category,
          createdAt: expenses.createdAt,
          userName: users.fullName,
          userRole: users.role,
        })
        .from(expenses)
        .leftJoin(users, eq(expenses.userId, users.id))
        .where(eq(expenses.familyId, this.familyId))
        .orderBy(desc(sql`CAST(${expenses.amount} AS DECIMAL)`))
        .limit(1);

      if (result.length === 0) {
        return {
          success: false,
          data: null,
          message: "Không tìm thấy dữ liệu chi tiêu"
        };
      }

      const expense = result[0];
      const amount = parseFloat(expense.amount);
      const amountInMillion = (amount / 1000000).toFixed(2);
      
      console.log('🔍 getLargestExpense result:', {
        description: expense.description,
        amount: amount,
        amountInMillion: amountInMillion,
        category: expense.category,
        date: expense.createdAt
      });
      
      return {
        success: true,
        data: {
          description: expense.description,
          amount: amount,
          category: expense.category,
          userName: expense.userName,
          userRole: expense.userRole,
          date: expense.createdAt?.toLocaleDateString('vi-VN')
        },
        message: `💰 KHOẢN CHI TIÊU LỚN NHẤT TỪ TRƯỚC ĐẾN NAY:\n` +
          `📝 Mô tả: ${expense.description}\n` +
          `💵 Số tiền: ${amount.toLocaleString('vi-VN')} VNĐ (${amountInMillion} triệu VNĐ)\n` +
          `🏷️ Danh mục: ${expense.category || 'Khác'}\n` +
          `👤 Người chi: ${expense.userName || 'Không rõ'}\n` +
          `📅 Ngày: ${expense.createdAt?.toLocaleDateString('vi-VN') || 'Không rõ'}\n\n` +
          `⚠️ QUAN TRỌNG: Đây là khoản chi tiêu lớn nhất trong toàn bộ lịch sử chi tiêu của gia đình. Số tiền chính xác là ${amount.toLocaleString('vi-VN')} VNĐ (${amountInMillion} triệu VNĐ).`
      };
    } catch (error) {
      console.error('Error getting largest expense:', error);
      return {
        success: false,
        data: null,
        message: "Lỗi khi truy vấn dữ liệu"
      };
    }
  }

  // Tìm chi tiêu theo tên người cụ thể
  async getExpensesByPerson(personName: string): Promise<AdvancedQueryResult> {
    try {
      const results = await db
        .select({
          id: expenses.id,
          description: expenses.description,
          amount: expenses.amount,
          category: expenses.category,
          createdAt: expenses.createdAt,
          userName: users.fullName,
          userRole: users.role,
        })
        .from(expenses)
        .leftJoin(users, eq(expenses.userId, users.id))
        .where(
          and(
            eq(expenses.familyId, this.familyId),
            or(
              like(expenses.description, `%${personName}%`),
              like(users.fullName, `%${personName}%`)
            )
          )
        )
        .orderBy(desc(expenses.createdAt));

      if (results.length === 0) {
        return {
          success: false,
          data: [],
          message: `Không tìm thấy chi tiêu liên quan đến "${personName}"`
        };
      }

      const totalAmount = results.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
      
      return {
        success: true,
        data: {
          personName,
          totalAmount,
          count: results.length,
          expenses: results.map(exp => ({
            description: exp.description,
            amount: parseFloat(exp.amount),
            category: exp.category,
            date: exp.createdAt?.toLocaleDateString('vi-VN')
          }))
        },
        message: `Tìm thấy ${results.length} giao dịch liên quan đến "${personName}" với tổng số tiền: ${totalAmount.toLocaleString('vi-VN')} VNĐ`
      };
    } catch (error) {
      console.error('Error getting expenses by person:', error);
      return {
        success: false,
        data: null,
        message: "Lỗi khi truy vấn dữ liệu"
      };
    }
  }

  // Tìm chi tiêu theo danh mục và khoảng thời gian
  async getExpensesByCategoryAndTime(category: string, startDate?: string, endDate?: string): Promise<AdvancedQueryResult> {
    try {
      let whereConditions = [
        eq(expenses.familyId, this.familyId),
        eq(expenses.category, category)
      ];

      if (startDate) {
        whereConditions.push(gte(expenses.createdAt, new Date(startDate)));
      }
      if (endDate) {
        whereConditions.push(lte(expenses.createdAt, new Date(endDate)));
      }

      const results = await db
        .select({
          id: expenses.id,
          description: expenses.description,
          amount: expenses.amount,
          category: expenses.category,
          createdAt: expenses.createdAt,
          userName: users.fullName,
          userRole: users.role,
        })
        .from(expenses)
        .leftJoin(users, eq(expenses.userId, users.id))
        .where(and(...whereConditions))
        .orderBy(desc(expenses.createdAt));

      if (results.length === 0) {
        return {
          success: false,
          data: [],
          message: `Không tìm thấy chi tiêu danh mục "${category}" trong khoảng thời gian đã chọn`
        };
      }

      const totalAmount = results.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
      
      return {
        success: true,
        data: {
          category,
          totalAmount,
          count: results.length,
          timeRange: { startDate, endDate },
          expenses: results.map(exp => ({
            description: exp.description,
            amount: parseFloat(exp.amount),
            userName: exp.userName,
            userRole: exp.userRole,
            date: exp.createdAt?.toLocaleDateString('vi-VN')
          }))
        },
        message: `Danh mục "${category}": ${results.length} giao dịch, tổng: ${totalAmount.toLocaleString('vi-VN')} VNĐ`
      };
    } catch (error) {
      console.error('Error getting expenses by category and time:', error);
      return {
        success: false,
        data: null,
        message: "Lỗi khi truy vấn dữ liệu"
      };
    }
  }

  // Thống kê chi tiêu theo tháng
  async getMonthlyStats(month?: number, year?: number): Promise<AdvancedQueryResult> {
    try {
      const targetMonth = month || new Date().getMonth() + 1;
      const targetYear = year || new Date().getFullYear();

      const results = await db
        .select({
          id: expenses.id,
          description: expenses.description,
          amount: expenses.amount,
          category: expenses.category,
          createdAt: expenses.createdAt,
          userName: users.fullName,
          userRole: users.role,
        })
        .from(expenses)
        .leftJoin(users, eq(expenses.userId, users.id))
        .where(
          and(
            eq(expenses.familyId, this.familyId),
            sql`EXTRACT(MONTH FROM ${expenses.createdAt}) = ${targetMonth}`,
            sql`EXTRACT(YEAR FROM ${expenses.createdAt}) = ${targetYear}`
          )
        )
        .orderBy(desc(expenses.createdAt));

      const totalAmount = results.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
      
      // Thống kê theo danh mục
      const categoryStats = results.reduce((acc, exp) => {
        if (exp.category) {
          if (!acc[exp.category]) {
            acc[exp.category] = { amount: 0, count: 0 };
          }
          acc[exp.category].amount += parseFloat(exp.amount);
          acc[exp.category].count += 1;
        }
        return acc;
      }, {} as Record<string, { amount: number; count: number }>);

      return {
        success: true,
        data: {
          month: targetMonth,
          year: targetYear,
          totalAmount,
          totalTransactions: results.length,
          categoryStats: Object.entries(categoryStats)
            .map(([category, stats]) => ({
              category,
              amount: stats.amount,
              count: stats.count,
              percentage: ((stats.amount / totalAmount) * 100).toFixed(1)
            }))
            .sort((a, b) => b.amount - a.amount)
        },
        message: `Tháng ${targetMonth}/${targetYear}: ${results.length} giao dịch, tổng: ${totalAmount.toLocaleString('vi-VN')} VNĐ`
      };
    } catch (error) {
      console.error('Error getting monthly stats:', error);
      return {
        success: false,
        data: null,
        message: "Lỗi khi truy vấn dữ liệu"
      };
    }
  }

  // Tìm xu hướng chi tiêu
  async getSpendingTrends(days: number = 30): Promise<AdvancedQueryResult> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const results = await db
        .select({
          id: expenses.id,
          description: expenses.description,
          amount: expenses.amount,
          category: expenses.category,
          createdAt: expenses.createdAt,
          userName: users.fullName,
          userRole: users.role,
        })
        .from(expenses)
        .leftJoin(users, eq(expenses.userId, users.id))
        .where(
          and(
            eq(expenses.familyId, this.familyId),
            gte(expenses.createdAt, startDate)
          )
        )
        .orderBy(desc(expenses.createdAt));

      // Nhóm theo ngày
      const dailyStats = results.reduce((acc, exp) => {
        if (exp.createdAt) {
          const date = exp.createdAt.toISOString().split('T')[0];
          if (!acc[date]) {
            acc[date] = { amount: 0, count: 0 };
          }
          acc[date].amount += parseFloat(exp.amount);
          acc[date].count += 1;
        }
        return acc;
      }, {} as Record<string, { amount: number; count: number }>);

      const totalAmount = results.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
      const averageDaily = totalAmount / days;

      return {
        success: true,
        data: {
          period: `${days} ngày gần nhất`,
          totalAmount,
          totalTransactions: results.length,
          averageDaily,
          dailyStats: Object.entries(dailyStats)
            .map(([date, stats]) => ({
              date,
              amount: stats.amount,
              count: stats.count
            }))
            .sort((a, b) => a.date.localeCompare(b.date))
        },
        message: `${days} ngày gần nhất: ${results.length} giao dịch, tổng: ${totalAmount.toLocaleString('vi-VN')} VNĐ, trung bình: ${averageDaily.toLocaleString('vi-VN')} VNĐ/ngày`
      };
    } catch (error) {
      console.error('Error getting spending trends:', error);
      return {
        success: false,
        data: null,
        message: "Lỗi khi truy vấn dữ liệu"
      };
    }
  }

  // Phân tích thông minh tổng quan
  async getSmartAnalysis(): Promise<AdvancedQueryResult> {
    try {
      // Lấy dữ liệu cơ bản
      const allExpenses = await db
        .select()
        .from(expenses)
        .where(eq(expenses.familyId, this.familyId))
        .orderBy(desc(expenses.createdAt));

      if (allExpenses.length === 0) {
        return {
          success: false,
          data: null,
          message: "Chưa có dữ liệu chi tiêu để phân tích"
        };
      }

      const totalAmount = allExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
      
      // Thống kê theo danh mục
      const categoryStats = allExpenses.reduce((acc, exp) => {
        if (exp.category) {
          if (!acc[exp.category]) {
            acc[exp.category] = { amount: 0, count: 0 };
          }
          acc[exp.category].amount += parseFloat(exp.amount);
          acc[exp.category].count += 1;
        }
        return acc;
      }, {} as Record<string, { amount: number; count: number }>);

      // Tìm khoản chi tiêu lớn nhất
      const largestExpense = allExpenses.reduce((max, exp) => 
        parseFloat(exp.amount) > parseFloat(max.amount) ? exp : max
      );

      // Thống kê tháng hiện tại
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const currentMonthExpenses = allExpenses.filter(exp => {
        if (!exp.createdAt) return false;
        const expDate = new Date(exp.createdAt);
        return expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear;
      });
      const currentMonthTotal = currentMonthExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

      // Top 5 danh mục chi tiêu nhiều nhất
      const topCategories = Object.entries(categoryStats)
        .map(([category, stats]) => ({
          category,
          amount: stats.amount,
          count: stats.count,
          percentage: ((stats.amount / totalAmount) * 100).toFixed(1)
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      return {
        success: true,
        data: {
          totalAmount,
          totalTransactions: allExpenses.length,
          currentMonthTotal,
          currentMonthTransactions: currentMonthExpenses.length,
          largestExpense: {
            description: largestExpense.description,
            amount: parseFloat(largestExpense.amount),
            category: largestExpense.category,
            date: largestExpense.createdAt?.toLocaleDateString('vi-VN')
          },
          topCategories,
          averageTransaction: (totalAmount / allExpenses.length).toFixed(0)
        },
        message: `Phân tích hoàn tất: ${allExpenses.length} giao dịch, tổng: ${totalAmount.toLocaleString('vi-VN')} VNĐ`
      };
    } catch (error) {
      console.error('Error getting smart analysis:', error);
      return {
        success: false,
        data: null,
        message: "Lỗi khi phân tích dữ liệu"
      };
    }
  }

  // Gợi ý tối ưu chi tiêu
  async getOptimizationSuggestions(): Promise<AdvancedQueryResult> {
    try {
      const allExpenses = await db
        .select()
        .from(expenses)
        .where(eq(expenses.familyId, this.familyId))
        .orderBy(desc(expenses.createdAt));

      if (allExpenses.length === 0) {
        return {
          success: false,
          data: null,
          message: "Chưa có dữ liệu chi tiêu để phân tích"
        };
      }

      // Phân tích theo danh mục
      const categoryStats = allExpenses.reduce((acc, exp) => {
        const cat = exp.category || 'Khác';
        if (!acc[cat]) {
          acc[cat] = { amount: 0, count: 0 };
        }
        acc[cat].amount += parseFloat(exp.amount);
        acc[cat].count += 1;
        return acc;
      }, {} as Record<string, { amount: number; count: number }>);

      // Tìm các khoản chi lớn
      const largeExpenses = allExpenses
        .filter(exp => parseFloat(exp.amount) >= 500000)
        .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
        .slice(0, 10);

      // Top 5 danh mục chi nhiều nhất
      const topCategories = Object.entries(categoryStats)
        .map(([cat, stats]) => ({ category: cat, ...stats }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      const totalAmount = allExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
      const monthlyAvg = totalAmount / 12;

      return {
        success: true,
        data: { topCategories, largeExpenses, monthlyAvg, totalAmount },
        message: `📊 PHÂN TÍCH TỐI ƯU CHI TIÊU:\n\n` +
          `💰 Chi tiêu trung bình/tháng: ${(monthlyAvg/1000000).toFixed(2)}M VNĐ\n\n` +
          `🏆 Top 5 danh mục chi nhiều nhất:\n${topCategories.map((cat, i) => 
            `${i+1}. ${cat.category}: ${(cat.amount/1000000).toFixed(2)}M VNĐ (${cat.count} giao dịch)`
          ).join('\n')}\n\n` +
          `💡 Các khoản chi lớn (>= 500K): ${largeExpenses.length} giao dịch, tổng: ${(largeExpenses.reduce((s, e) => s + parseFloat(e.amount), 0)/1000000).toFixed(2)}M VNĐ\n` +
          `Top 3: ${largeExpenses.slice(0, 3).map(e => `${e.description}: ${parseFloat(e.amount).toLocaleString('vi-VN')} VNĐ`).join(', ')}`
      };
    } catch (error) {
      console.error('Error getting optimization suggestions:', error);
      return {
        success: false,
        data: null,
        message: "Lỗi khi phân tích tối ưu"
      };
    }
  }

  // Phân tích chi tiết tháng trước
  async getPreviousMonthAnalysis(): Promise<AdvancedQueryResult> {
    try {
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      
      const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const lastYear = currentMonth === 1 ? currentYear - 1 : currentYear;

      const lastMonthExpenses = await db
        .select()
        .from(expenses)
        .where(and(
          eq(expenses.familyId, this.familyId),
          sql`EXTRACT(MONTH FROM ${expenses.createdAt}) = ${lastMonth}`,
          sql`EXTRACT(YEAR FROM ${expenses.createdAt}) = ${lastYear}`
        ));

      const currentMonthExpenses = await db
        .select()
        .from(expenses)
        .where(and(
          eq(expenses.familyId, this.familyId),
          sql`EXTRACT(MONTH FROM ${expenses.createdAt}) = ${currentMonth}`,
          sql`EXTRACT(YEAR FROM ${expenses.createdAt}) = ${currentYear}`
        ));

      const lastMonthTotal = lastMonthExpenses.reduce((s, e) => s + parseFloat(e.amount), 0);
      const currentMonthTotal = currentMonthExpenses.reduce((s, e) => s + parseFloat(e.amount), 0);
      const diff = currentMonthTotal - lastMonthTotal;
      const diffPercent = lastMonthTotal > 0 ? ((diff / lastMonthTotal) * 100).toFixed(1) : '0';

      // Phân tích theo danh mục tháng trước
      const lastMonthCategories = lastMonthExpenses.reduce((acc, exp) => {
        const cat = exp.category || 'Khác';
        if (!acc[cat]) {
          acc[cat] = { amount: 0, count: 0 };
        }
        acc[cat].amount += parseFloat(exp.amount);
        acc[cat].count += 1;
        return acc;
      }, {} as Record<string, { amount: number; count: number }>);

      const topCategories = Object.entries(lastMonthCategories)
        .map(([cat, stats]) => ({ category: cat, ...stats }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      return {
        success: true,
        data: { lastMonthTotal, currentMonthTotal, diff, diffPercent, topCategories },
        message: `📅 PHÂN TÍCH CHI TIẾT THÁNG TRƯỚC (Tháng ${lastMonth}/${lastYear}):\n\n` +
          `💰 Tổng chi tiêu: ${(lastMonthTotal/1000000).toFixed(2)}M VNĐ (${lastMonthExpenses.length} giao dịch)\n` +
          `📊 So với tháng này: ${diff >= 0 ? 'Tăng' : 'Giảm'} ${Math.abs(diff/1000000).toFixed(2)}M VNĐ (${diffPercent}%)\n\n` +
          `🏆 Top 5 danh mục tháng trước:\n${topCategories.map((cat, i) => 
            `${i+1}. ${cat.category}: ${(cat.amount/1000000).toFixed(2)}M VNĐ (${cat.count} giao dịch)`
          ).join('\n')}`
      };
    } catch (error) {
      console.error('Error getting previous month analysis:', error);
      return {
        success: false,
        data: null,
        message: "Lỗi khi phân tích tháng trước"
      };
    }
  }

  // Kế hoạch tiết kiệm
  async getSavingsPlan(targetAmount: number): Promise<AdvancedQueryResult> {
    try {
      const allExpenses = await db
        .select()
        .from(expenses)
        .where(eq(expenses.familyId, this.familyId))
        .orderBy(desc(expenses.createdAt));

      if (allExpenses.length === 0) {
        return {
          success: false,
          data: null,
          message: "Chưa có dữ liệu chi tiêu để lập kế hoạch"
        };
      }

      // Tính chi tiêu trung bình/tháng
      const totalAmount = allExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
      const monthlyAvg = totalAmount / 12;

      // Phân tích theo danh mục để tìm cơ hội tiết kiệm
      const categoryStats = allExpenses.reduce((acc, exp) => {
        const cat = exp.category || 'Khác';
        if (!acc[cat]) {
          acc[cat] = { amount: 0, count: 0 };
        }
        acc[cat].amount += parseFloat(exp.amount);
        acc[cat].count += 1;
        return acc;
      }, {} as Record<string, { amount: number; count: number }>);

      // Tìm các danh mục có thể cắt giảm (không phải y tế, học tập)
      const reducibleCategories = Object.entries(categoryStats)
        .filter(([cat]) => !['Y tế', 'Học tập'].includes(cat))
        .map(([cat, stats]) => ({
          category: cat,
          monthlyAmount: stats.amount / 12,
          count: stats.count,
          potentialSavings: (stats.amount / 12) * 0.15 // Giả sử có thể tiết kiệm 15%
        }))
        .sort((a, b) => b.potentialSavings - a.potentialSavings)
        .slice(0, 5);

      const totalPotentialSavings = reducibleCategories.reduce((sum, cat) => sum + cat.potentialSavings, 0);
      const needsMore = Math.max(0, targetAmount - totalPotentialSavings);

      return {
        success: true,
        data: { monthlyAvg, targetAmount, reducibleCategories, totalPotentialSavings, needsMore },
        message: `💡 KẾ HOẠCH TIẾT KIỆM ${(targetAmount/1000000).toFixed(1)}M VNĐ/THÁNG:\n\n` +
          `📊 Chi tiêu trung bình hiện tại: ${(monthlyAvg/1000000).toFixed(2)}M VNĐ/tháng\n\n` +
          `🎯 Các danh mục có thể cắt giảm (ước tính tiết kiệm 15%):\n${reducibleCategories.map((cat, i) => 
            `${i+1}. ${cat.category}: ${(cat.potentialSavings/1000000).toFixed(2)}M VNĐ/tháng (từ ${(cat.monthlyAmount/1000000).toFixed(2)}M VNĐ)`
          ).join('\n')}\n\n` +
          `💰 Tổng tiết kiệm tiềm năng: ${(totalPotentialSavings/1000000).toFixed(2)}M VNĐ/tháng\n` +
          (needsMore > 0 
            ? `⚠️ Cần thêm ${(needsMore/1000000).toFixed(2)}M VNĐ/tháng. Gợi ý: Tăng thu nhập hoặc cắt giảm thêm các khoản khác.`
            : `✅ Có thể đạt mục tiêu bằng cách cắt giảm các danh mục trên!`)
      };
    } catch (error) {
      console.error('Error getting savings plan:', error);
      return {
        success: false,
        data: null,
        message: "Lỗi khi lập kế hoạch tiết kiệm"
      };
    }
  }
}
