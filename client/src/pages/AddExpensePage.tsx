import { ExpenseForm } from "@/components/ExpenseForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { apiService } from "@/lib/api";
import { Lightbulb, TrendingUp, AlertCircle } from "lucide-react";

export default function AddExpensePage() {
  const handleExpenseSubmit = (expense: { description: string; amount: number; category?: string }) => {
    console.log('New expense added:', expense);
  };

  // Fetch real data for tips and insights
  const { data: statsData } = useQuery({
    queryKey: ['stats'],
    queryFn: () => apiService.getStats(),
    staleTime: 30 * 1000,
  });

  const { data: budgetAlertsData } = useQuery({
    queryKey: ['budget-alerts'],
    queryFn: () => apiService.getBudgetAlerts(),
    staleTime: 30 * 1000,
  });

  const { data: savingsGoalsData } = useQuery({
    queryKey: ['savings-goals'],
    queryFn: () => apiService.getSavingsGoals(),
    staleTime: 30 * 1000,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  // Get top category for savings tip
  const getTopCategory = () => {
    if (!(statsData as any)?.categoryStats) return null;
    const categories = (statsData as any).categoryStats;
    if (!categories || categories.length === 0) return null;
    return categories.reduce((max: any, cat: any) => 
      cat.amount > max.amount ? cat : max, categories[0]);
  };

  // Calculate average wedding expense
  const getAverageWeddingExpense = () => {
    if (!(statsData as any)?.categoryStats) return null;
    const weddingCategory = (statsData as any).categoryStats.find((cat: any) => cat.category === 'Đám cưới');
    if (!weddingCategory || weddingCategory.count === 0) return null;
    return Math.round(weddingCategory.amount / weddingCategory.count);
  };

  const topCategory = getTopCategory();
  const avgWedding = getAverageWeddingExpense();
  const budgetRemaining = (budgetAlertsData as any)?.summary?.remaining || 0;
  const totalSavings = savingsGoalsData?.goals?.reduce((sum: number, goal: any) => {
    if (goal.status === 'active') {
      const progress = goal.currentAmount || 0;
      return sum + progress;
    }
    return sum;
  }, 0) || 0;

  const topCategoryPercentage = topCategory && (statsData as any)?.totalAmount > 0
    ? ((topCategory.amount / (statsData as any).totalAmount) * 100).toFixed(1)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Thêm chi tiêu mới</h1>
        <p className="text-muted-foreground">AI sẽ tự động phân loại chi tiêu của bạn</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExpenseForm onSubmit={handleExpenseSubmit} />
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Gợi ý từ AI
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {topCategory && topCategoryPercentage && parseFloat(topCategoryPercentage) > 30 ? (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  Mẹo tiết kiệm
                </h4>
                <p className="text-sm text-muted-foreground">
                  Chi tiêu <strong>{topCategory.category}</strong> của gia đình chiếm {topCategoryPercentage}% tổng chi tiêu. 
                  Hãy cân nhắc tối ưu hóa chi tiêu này để tiết kiệm hiệu quả hơn.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">💡 Mẹo tiết kiệm</h4>
                <p className="text-sm text-muted-foreground">
                  Chi tiêu của gia đình đang được phân bổ hợp lý. Hãy tiếp tục duy trì!
                </p>
              </div>
            )}
            
            <div className="p-4 bg-chart-2/10 rounded-lg">
              <h4 className="font-medium mb-2">📊 Thống kê nhanh</h4>
              {avgWedding && (
                <p className="text-sm text-muted-foreground">
                  Trung bình chi tiêu đám cưới: {formatCurrency(avgWedding)}/lần
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Ngân sách còn lại tháng này: {formatCurrency(budgetRemaining)}
              </p>
              {(statsData as any)?.totalAmount && (
                <p className="text-sm text-muted-foreground">
                  Tổng chi tiêu tháng này: {formatCurrency((statsData as any).totalAmount)}
                </p>
              )}
            </div>
            
            {totalSavings > 0 && (
              <div className="p-4 bg-chart-3/10 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  Mục tiêu tiết kiệm
                </h4>
                <p className="text-sm text-muted-foreground">
                  Tổng tiền đã tiết kiệm: {formatCurrency(totalSavings)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}