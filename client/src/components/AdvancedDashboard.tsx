import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Lightbulb,
  Target,
  Calendar,
  DollarSign,
  Users,
  Sparkles
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiService } from "@/lib/api";
import { authService } from "@/lib/auth";

interface AdvancedDashboardProps {
  className?: string;
}

export function AdvancedDashboard({ className }: AdvancedDashboardProps) {
  const user = authService.getUser();

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['advanced-stats'],
    queryFn: () => apiService.getStats(),
  });

  const { data: expensesData, isLoading: expensesLoading } = useQuery({
    queryKey: ['recent-expenses'],
    queryFn: () => apiService.getExpenses(1000), // Get more data to calculate trends
  });

  const { data: familyData, isLoading: familyLoading } = useQuery({
    queryKey: ['family-members'],
    queryFn: () => apiService.getFamilyMembers(),
  });

  // Fetch budget alerts to get actual budget data
  const { data: budgetAlertsData } = useQuery({
    queryKey: ['budget-alerts'],
    queryFn: () => apiService.getBudgetAlerts(),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const getBudgetStatus = () => {
    // Get budget from API alerts, fallback to default
    const monthlyBudget = (budgetAlertsData as any)?.summary?.monthlyBudget || 25000000; // 25M default
    const totalSpent = (statsData as any)?.totalAmount || 0;
    const remaining = monthlyBudget - totalSpent;
    const percentage = (totalSpent / monthlyBudget) * 100;
    
    let status: 'good' | 'warning' | 'danger';
    if (percentage <= 70) status = 'good';
    else if (percentage <= 90) status = 'warning';
    else status = 'danger';

    return { totalSpent, remaining, percentage, status };
  };

  const getTopCategory = () => {
    if (!(statsData as any)?.categoryStats) return null;
    return (statsData as any).categoryStats.reduce((max: any, cat: any) => 
      cat.amount > max.amount ? cat : max, (statsData as any).categoryStats[0]);
  };

  const getRecentTrend = () => {
    if (!expensesData?.expenses) {
      return {
        daily: 0,
        weekly: 0,
        monthly: 0,
        trend: 'neutral' as const,
        changePercent: 0
      };
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    // Calculate current month expenses
    const currentMonthExpenses = expensesData.expenses
      .filter((exp: any) => {
        if (!exp.createdAt) return false;
        const expDate = new Date(exp.createdAt);
        return expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear;
      })
      .reduce((sum: number, exp: any) => sum + parseFloat(exp.amount), 0);

    // Calculate last month expenses
    const lastMonthExpenses = expensesData.expenses
      .filter((exp: any) => {
        if (!exp.createdAt) return false;
        const expDate = new Date(exp.createdAt);
        return expDate.getMonth() === lastMonth && expDate.getFullYear() === lastMonthYear;
      })
      .reduce((sum: number, exp: any) => sum + parseFloat(exp.amount), 0);

    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysElapsed = now.getDate();
    const avgDaily = currentMonthExpenses / (daysElapsed || 1);

    // Calculate trend
    let trend: 'up' | 'down' | 'neutral' = 'neutral';
    let changePercent = 0;
    if (lastMonthExpenses > 0) {
      changePercent = ((currentMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100;
      trend = changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'neutral';
    } else if (currentMonthExpenses > 0) {
      trend = 'up';
      changePercent = 100;
    }

    return {
      daily: avgDaily,
      weekly: avgDaily * 7,
      monthly: currentMonthExpenses,
      trend,
      changePercent: Math.abs(changePercent)
    };
  };

  const budgetStatus = getBudgetStatus();
  const topCategory = getTopCategory();
  const trend = getRecentTrend();

  if (statsLoading || expensesLoading || familyLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded mb-2"></div>
                <div className="h-8 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tổng chi tiêu</p>
                <p className="text-2xl font-bold">{formatCurrency(budgetStatus.totalSpent)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="mt-2 flex items-center text-sm">
              {trend.trend === 'up' ? (
                <TrendingUp className="h-4 w-4 text-red-500 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 text-green-500 mr-1" />
              )}
              <span className={trend.trend === 'up' ? 'text-red-500' : 'text-green-500'}>
                {trend.trend === 'up' ? '+' : '-'}5.2% so với tháng trước
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ngân sách còn lại</p>
                <p className="text-2xl font-bold">{formatCurrency(budgetStatus.remaining)}</p>
              </div>
              <Target className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="mt-2">
              <Progress 
                value={budgetStatus.percentage} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {budgetStatus.percentage.toFixed(1)}% đã sử dụng
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Danh mục nhiều nhất</p>
                <p className="text-2xl font-bold">{topCategory?.category || 'N/A'}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="mt-2">
              <p className="text-sm text-muted-foreground">
                {topCategory ? formatCurrency(topCategory.amount) : 'Chưa có dữ liệu'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Thành viên</p>
                <p className="text-2xl font-bold">{(familyData as any)?.members?.length || 0}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="mt-2">
              <p className="text-sm text-muted-foreground">
                {expensesData?.expenses?.length || 0} giao dịch
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Status Alert */}
      {budgetStatus.status !== 'good' && (
        <Alert className={budgetStatus.status === 'danger' ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {budgetStatus.status === 'danger' 
              ? `Cảnh báo: Bạn đã vượt ngân sách ${formatCurrency(Math.abs(budgetStatus.remaining))}!`
              : `Chú ý: Bạn đã sử dụng ${budgetStatus.percentage.toFixed(1)}% ngân sách tháng này.`
            }
          </AlertDescription>
        </Alert>
      )}

      {/* AI Insights */}
              {(statsData as any)?.insights && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              Phân tích thông minh từ AI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
              <p className="text-sm text-muted-foreground">{(statsData as any).insights}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Hành động nhanh</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="h-20 flex flex-col gap-2" asChild>
              <a href="/add-expense">
                <DollarSign className="h-6 w-6" />
                <span>Thêm chi tiêu</span>
              </a>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2" asChild>
              <a href="/stats">
                <TrendingUp className="h-6 w-6" />
                <span>Xem thống kê</span>
              </a>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2" asChild>
              <a href="/chat">
                <Sparkles className="h-6 w-6" />
                <span>Hỏi AI</span>
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Hoạt động gần đây</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {expensesData?.expenses?.slice(0, 5).map((expense: any, index: number) => (
              <div key={expense.id || index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div>
                    <p className="font-medium text-sm">{expense.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(expense.createdAt).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">{formatCurrency(parseFloat(expense.amount))}</p>
                  <Badge variant="secondary" className="text-xs">{expense.category}</Badge>
                </div>
              </div>
            ))}
            {(!expensesData?.expenses || expensesData.expenses.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Chưa có hoạt động nào</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
