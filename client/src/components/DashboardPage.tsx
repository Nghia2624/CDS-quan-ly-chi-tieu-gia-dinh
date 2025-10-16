import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "./StatsCard";
import { ExpenseCard } from "./ExpenseCard";
import { ExpenseChart } from "./ExpenseChart";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, Users, Calendar, Plus, RefreshCw, AlertCircle, CheckCircle, Wallet, Wifi, WifiOff } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiService } from "@/lib/api";
import { authService } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useDataSync } from "@/hooks/use-data-sync";
import { FadeIn, SlideIn, StaggerContainer, StaggerItem, Pulse, CountUp } from "@/components/ui/animations";
import heroImage from "@assets/generated_images/Vietnamese_family_financial_planning_c3a42b13.png";

export function DashboardPage() {
  const { toast } = useToast();
  const user = authService.getUser();
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const { isRefreshing, lastSync, refreshAllData, getSyncStatus } = useDataSync();

  // Fetch real data with better caching
  const { data: expensesData, isLoading: expensesLoading, refetch: refetchExpenses } = useQuery({
    queryKey: ['expenses', 'all'], // Get all expenses for dashboard
    queryFn: () => apiService.getExpenses(1000), // Get more data for consistency
    staleTime: 30 * 1000, // 30 seconds - more aggressive refresh
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Always refetch on mount
    retry: 3, // Retry failed requests
    retryDelay: 1000, // 1 second between retries
  });

  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => apiService.getStats(),
    staleTime: 30 * 1000, // 30 seconds - more aggressive refresh
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Always refetch on mount
    retry: 3, // Retry failed requests
    retryDelay: 1000, // 1 second between retries
  });

  const { data: familyData, isLoading: familyLoading } = useQuery({
    queryKey: ['family-members'],
    queryFn: () => apiService.getFamilyMembers(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Always refetch on mount
    retry: 3, // Retry failed requests
    retryDelay: 1000, // 1 second between retries
  });

  const handleRefresh = async () => {
    setLastRefresh(new Date());
    setConnectionStatus('checking');
    try {
      await refreshAllData();
      setConnectionStatus('connected');
    } catch (error) {
      setConnectionStatus('disconnected');
    }
  };

  // Monitor connection status
  useEffect(() => {
    const checkConnection = async () => {
      try {
        await apiService.getStats();
        setConnectionStatus('connected');
      } catch (error) {
        setConnectionStatus('disconnected');
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Chào buổi sáng";
    if (hour < 18) return "Chào buổi chiều";
    return "Chào buổi tối";
  };

  const getTotalExpenses = () => {
    if (!expensesData?.expenses) return 0;
    
    // Use current month - same logic as StatsPage
    const currentMonth = new Date().toLocaleString('vi-VN', { month: 'long' });
    const currentYear = new Date().getFullYear();
    
    const filteredExpenses = expensesData.expenses.filter((exp: any) => {
      const expDate = new Date(exp.createdAt);
      const expMonth = expDate.toLocaleString('vi-VN', { month: 'long' });
      return expMonth === currentMonth && expDate.getFullYear() === currentYear;
    });
    
    const total = filteredExpenses.reduce((sum: number, exp: any) => sum + parseFloat(exp.amount), 0);
    
    return total;
  };

  const getMonthlyBudget = () => {
    // Fixed budget for family of 4
    return 25000000; // 25M fixed budget
  };

  const getSavingsAmount = () => {
    const monthlyBudget = getMonthlyBudget();
    const totalSpent = getTotalExpenses();
    return Math.max(0, monthlyBudget - totalSpent);
  };

  const getSavingsPercentage = () => {
    const monthlyBudget = getMonthlyBudget();
    const totalSpent = getTotalExpenses();
    if (monthlyBudget === 0) return 0;
    return Math.round(((monthlyBudget - totalSpent) / monthlyBudget) * 100);
  };

  const getTopCategory = () => {
    if (!(statsData as any)?.categoryStats) return null;
    const categories = (statsData as any).categoryStats;
    if (!categories || categories.length === 0) return null;
    return categories.reduce((max: any, cat: any) => 
      cat.amount > max.amount ? cat : max, categories[0]);
  };

  const getExpenseTrend = () => {
    if (!expensesData?.expenses) return 0;
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    
    const currentMonthExpenses = expensesData.expenses
      .filter((exp: any) => {
        const expDate = new Date(exp.createdAt);
        return expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear;
      })
      .reduce((sum: number, exp: any) => sum + parseFloat(exp.amount), 0);
    
    const lastMonthExpenses = expensesData.expenses
      .filter((exp: any) => {
        const expDate = new Date(exp.createdAt);
        return expDate.getMonth() === lastMonth && expDate.getFullYear() === lastMonthYear;
      })
      .reduce((sum: number, exp: any) => sum + parseFloat(exp.amount), 0);
    
    if (lastMonthExpenses === 0) return 0;
    return Math.round(((currentMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100);
  };

  return (
    <div className="space-y-6 bg-background min-h-screen">
      {/* Hero Section */}
      <FadeIn delay={0.2}>
        <Card className="relative overflow-hidden group hover:shadow-2xl transition-all duration-500 transform hover:scale-[1.02]">
          <div 
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
            style={{ backgroundImage: `url(${heroImage})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-black/30 group-hover:from-black/50 group-hover:to-black/20 transition-all duration-500" />
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 group-hover:from-blue-500/30 group-hover:to-purple-500/30 transition-all duration-500" />
          </div>
          <CardContent className="relative z-10 p-8 text-white">
            <div className="flex justify-between items-start">
              <SlideIn direction="left" delay={0.3}>
                <div>
                  <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                    Xin {getGreeting().toLowerCase()}, Nghĩa! 👋
                  </h1>
                  <p className="text-lg opacity-90 mb-4">
                      {(statsData as any)?.insights ? (
                      <span className="flex items-center gap-2">
                        <Pulse>
                          <span className="text-yellow-300">✨</span>
                        </Pulse>
                        AI đã phân tích và đưa ra lời khuyên tài chính thông minh
                      </span>
                    ) : (
                      <span>Chào mừng đến với hệ thống quản lý chi tiêu thông minh</span>
                    )}
                  </p>
                  <div className="flex items-center gap-4 text-sm opacity-80">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                      Phân loại tự động với AI
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                      Gợi ý tiết kiệm thông minh
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></span>
                      Theo dõi chi tiêu gia đình
                    </span>
                  </div>
                </div>
              </SlideIn>
              <SlideIn direction="right" delay={0.4}>
                <div className="flex gap-2 items-center">
                  {/* Sync Status Indicator */}
                  <div className="flex items-center gap-1 text-white/80 text-sm">
                    {getSyncStatus().isSynced ? (
                      <>
                        <Wifi className="h-4 w-4 text-green-400" />
                        <span>Đã đồng bộ</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="h-4 w-4 text-yellow-400" />
                        <span>Chưa đồng bộ</span>
                      </>
                    )}
                  </div>
                  
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm transition-all duration-300 hover:scale-105 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {isRefreshing ? 'Đang đồng bộ...' : 'Làm mới'}
                  </Button>
                </div>
              </SlideIn>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Stats Cards */}
      <StaggerContainer>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StaggerItem>
            <div className="group">
              <StatsCard
                title="Tổng chi tiêu tháng này"
                value={formatCurrency(getTotalExpenses())}
                change={getExpenseTrend()}
                changeType={getExpenseTrend() > 0 ? "increase" : getExpenseTrend() < 0 ? "decrease" : "neutral"}
                icon={<DollarSign className="h-4 w-4 text-muted-foreground group-hover:text-green-500 transition-colors" />}
                loading={statsLoading}
              />
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="group">
              <StatsCard
                title="Tiết kiệm được"
                value={formatCurrency(getSavingsAmount())}
                change={getSavingsPercentage()}
                changeType={getSavingsAmount() > 0 ? "increase" : "decrease"}
                icon={<TrendingUp className="h-4 w-4 text-muted-foreground group-hover:text-blue-500 transition-colors" />}
                loading={statsLoading}
              />
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="group">
              <StatsCard
                title="Ngân sách tháng này"
                value={formatCurrency(getMonthlyBudget())}
                change={getSavingsPercentage()}
                changeType={getSavingsPercentage() > 0 ? "increase" : "decrease"}
                icon={<Wallet className="h-4 w-4 text-muted-foreground group-hover:text-purple-500 transition-colors" />}
                loading={false}
              />
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="group">
              <StatsCard
                title="Số giao dịch"
                value={`${expensesData?.expenses?.length || 0}`}
                change={expensesData?.expenses?.length ? 5 : 0}
                changeType="increase"
                icon={<Calendar className="h-4 w-4 text-muted-foreground group-hover:text-orange-500 transition-colors" />}
                loading={expensesLoading}
              />
            </div>
          </StaggerItem>
        </div>
      </StaggerContainer>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Expenses */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Chi tiêu gần đây</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <a href="/add-expense">
                  <Plus className="h-4 w-4 mr-2" />
                  Thêm chi tiêu
                </a>
              </Button>
            </CardHeader>
            <CardContent>
              {expensesLoading ? (
                <div className="flex items-center justify-center h-[200px]">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {expensesData?.expenses?.length ? (
                      expensesData.expenses
                        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map((expense: any) => (
                        <ExpenseCard
                          key={expense.id}
                          description={expense.description}
                          amount={parseFloat(expense.amount)}
                          category={expense.category}
                          date={expense.createdAt ? new Date(expense.createdAt).toISOString().split('T')[0] : ''}
                          user={expense.userName || (expense.userRole === 'father' ? 'Bố' : expense.userRole === 'mother' ? 'Mẹ' : 'Thành viên')}
                          aiConfidence={expense.aiConfidence}
                        />
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Chưa có chi tiêu nào</p>
                        <p className="text-sm">Hãy thêm chi tiêu đầu tiên của bạn</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats & AI Insights */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Thống kê nhanh
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {getTopCategory() && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Danh mục nhiều nhất</p>
                    <p className="text-lg font-bold">{getTopCategory()?.category}</p>
                  </div>
                  <Badge variant="secondary">
                    {formatCurrency(getTopCategory()?.amount || 0)}
                  </Badge>
                </div>
              )}
              
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="text-sm font-medium">Trung bình/ngày</p>
                  <p className="text-lg font-bold">
                    {formatCurrency(getTotalExpenses() / new Date().getDate())}
                  </p>
                </div>
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="text-sm font-medium">Tỷ lệ tiết kiệm</p>
                  <p className="text-lg font-bold text-green-600">
                    {getSavingsPercentage()}%
                  </p>
                </div>
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="text-sm font-medium">Ngân sách còn lại</p>
                  <p className="text-lg font-bold">
                    {formatCurrency(getSavingsAmount())}
                  </p>
                </div>
                {getSavingsAmount() > 0 ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                )}
              </div>
            </CardContent>
          </Card>

              {/* AI Insights */}
              {(statsData as any)?.insights && (
            <Card className="col-span-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Gợi ý từ AI
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg max-h-24 overflow-y-auto">
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                      {((statsData as any).insights || '').split('\n').slice(0, 3).join(' ')}
                    </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExpenseChart type="category" />
        <ExpenseChart type="monthly" />
      </div>

      {/* Last Updated */}
      <div className="text-center text-sm text-muted-foreground">
        Cập nhật lần cuối: {lastRefresh.toLocaleTimeString('vi-VN')}
      </div>
    </div>
  );
}