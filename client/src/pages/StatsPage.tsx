import { ExpenseChart } from "@/components/ExpenseChart";
import { StatsCard } from "@/components/StatsCard";
import { DetailedStatsTable } from "@/components/DetailedStatsTable";
import { DataExportImport } from "@/components/DataExportImport";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, TrendingDown, Target, Download, RefreshCw, Calendar, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiService } from "@/lib/api";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useDataSync } from "@/hooks/use-data-sync";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";

export default function StatsPage() {
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState<{month: string, year: number} | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const { isRefreshing, refreshAllData, getSyncStatus } = useDataSync();

  // Fetch real data with better caching
  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['stats', selectedPeriod, selectedCategory],
    queryFn: () => apiService.getStats(),
    staleTime: 30 * 1000, // 30 seconds - more aggressive refresh
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Always refetch on mount
    retry: 3, // Retry failed requests
    retryDelay: 1000, // 1 second between retries
  });

  const { data: expensesData, isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses', selectedPeriod],
    queryFn: () => apiService.getExpenses(1000), // Get more data for better analysis
    staleTime: 30 * 1000, // 30 seconds - more aggressive refresh
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Always refetch on mount
    retry: 3, // Retry failed requests
    retryDelay: 1000, // 1 second between retries
  });

  const handleRefresh = async () => {
    setConnectionStatus('checking');
    try {
      await refreshAllData();
      setConnectionStatus('connected');
      toast({ title: "Đã cập nhật thống kê" });
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

  const handleMonthClick = (month: string, year: number) => {
    setSelectedMonth({ month, year });
    toast({ 
      title: `Đã chọn tháng ${month}/${year}`, 
      description: "Đang hiển thị thống kê chi tiết cho tháng này" 
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const getTotalExpenses = () => {
    if (!expensesData?.expenses) return 0;
    
    // Use selected month or current month
    const targetMonth = selectedMonth ? selectedMonth.month : new Date().toLocaleString('vi-VN', { month: 'long' });
    const targetYear = selectedMonth ? selectedMonth.year : new Date().getFullYear();
    
    const filteredExpenses = expensesData.expenses.filter((exp: any) => {
      const expDate = new Date(exp.createdAt);
      const expMonth = expDate.toLocaleString('vi-VN', { month: 'long' });
      return expMonth === targetMonth && expDate.getFullYear() === targetYear;
    });
    
    const total = filteredExpenses.reduce((sum: number, exp: any) => sum + parseFloat(exp.amount), 0);
    
    return total;
  };

  const getFilteredExpenses = () => {
    if (!expensesData?.expenses) return [];
    
    const targetMonth = selectedMonth ? selectedMonth.month : new Date().toLocaleString('vi-VN', { month: 'long' });
    const targetYear = selectedMonth ? selectedMonth.year : new Date().getFullYear();
    
    return expensesData.expenses.filter((exp: any) => {
      const expDate = new Date(exp.createdAt);
      const expMonth = expDate.toLocaleString('vi-VN', { month: 'long' });
      return expMonth === targetMonth && expDate.getFullYear() === targetYear;
    });
  };

  const getAverageDaily = () => {
    const total = getTotalExpenses();
    const daysInMonth = new Date().getDate();
    return total / daysInMonth;
  };

  const getTopCategories = () => {
    const filteredExpenses = getFilteredExpenses();
    if (filteredExpenses.length === 0) return [];
    
    const categoryMap: { [key: string]: number } = {};
    filteredExpenses.forEach((exp: any) => {
      const category = exp.category || 'Khác';
      categoryMap[category] = (categoryMap[category] || 0) + parseFloat(exp.amount);
    });
    
    const total = getTotalExpenses();
    return Object.entries(categoryMap)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
        rank: 0 // Will be set after sorting
      }))
      .sort((a, b) => b.amount - a.amount)
      .map((item, index) => ({
        ...item,
        rank: index + 1 // Set correct rank after sorting
      }))
      .slice(0, 5);
  };

  const getBudgetStatus = () => {
    const monthlyBudget = 25000000; // 25M VND (updated to match user requirement)
    const totalSpent = getTotalExpenses();
    const remaining = monthlyBudget - totalSpent;
    const percentage = Math.round((totalSpent / monthlyBudget) * 100);
    
    return {
      total: monthlyBudget,
      spent: totalSpent,
      remaining: remaining,
      percentage: percentage,
      status: remaining > 0 ? 'good' : remaining > -2000000 ? 'warning' : 'danger'
    };
  };

  const budgetStatus = getBudgetStatus();

  return (
    <div className="space-y-6">
      <FadeIn delay={0.2}>
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-4 lg:p-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="flex-1">
                <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                  Thống kê chi tiêu
                  {selectedMonth && (
                    <span className="text-base lg:text-lg font-normal text-muted-foreground ml-2">
                      - {selectedMonth.month}/{selectedMonth.year}
                    </span>
                  )}
                </h1>
                <p className="text-muted-foreground text-sm lg:text-base">
                  Phân tích chi tiêu gia đình và xu hướng tiết kiệm
                  {selectedMonth && (
                    <span className="block text-xs lg:text-sm text-blue-600">
                      📊 Đang xem dữ liệu tháng {selectedMonth.month}/{selectedMonth.year}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Tuần này</SelectItem>
                    <SelectItem value="month">Tháng này</SelectItem>
                    <SelectItem value="quarter">Quý này</SelectItem>
                    <SelectItem value="year">Năm này</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRefresh} 
                  disabled={isRefreshing}
                  className="w-full sm:w-auto"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? 'Đang đồng bộ...' : 'Làm mới'}
                </Button>
                {selectedMonth && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setSelectedMonth(null)}
                    className="w-full sm:w-auto"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Tháng hiện tại
                  </Button>
                )}
                <DataExportImport onDataImported={handleRefresh} />
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Summary Stats */}
      <StaggerContainer>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StaggerItem>
            <div className="group">
              <StatsCard
                title="Chi tiêu trung bình/ngày"
                value={formatCurrency(getAverageDaily())}
                change={-12}
                changeType="decrease"
                icon={<DollarSign className="h-4 w-4 text-muted-foreground group-hover:text-green-500 transition-colors" />}
                loading={statsLoading}
              />
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="group">
              <StatsCard
                title="Danh mục nhiều nhất"
                value={getTopCategories()[0]?.name || "Chưa có dữ liệu"}
                change={8}
                changeType="increase"
                icon={<TrendingUp className="h-4 w-4 text-muted-foreground group-hover:text-blue-500 transition-colors" />}
                loading={statsLoading}
              />
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="group">
              <StatsCard
                title="Tổng chi tiêu"
                value={formatCurrency(getTotalExpenses())}
                change={budgetStatus.percentage}
                changeType={budgetStatus.status === 'good' ? 'decrease' : 'increase'}
                icon={<TrendingDown className="h-4 w-4 text-muted-foreground group-hover:text-red-500 transition-colors" />}
                loading={statsLoading}
              />
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="group">
              <StatsCard
                title="Ngân sách còn lại"
                value={formatCurrency(budgetStatus.remaining)}
                change={budgetStatus.percentage}
                changeType={budgetStatus.status === 'good' ? 'increase' : 'decrease'}
                icon={<Target className="h-4 w-4 text-muted-foreground group-hover:text-purple-500 transition-colors" />}
                loading={statsLoading}
              />
            </div>
          </StaggerItem>
        </div>
      </StaggerContainer>

      {/* Budget Progress */}
      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Tiến độ ngân sách tháng này
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>Đã chi: {formatCurrency(budgetStatus.spent)}</span>
              <span>Còn lại: {formatCurrency(budgetStatus.remaining)}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div 
                className={`h-3 rounded-full transition-all duration-500 ${
                  budgetStatus.status === 'good' ? 'bg-green-500' : 
                  budgetStatus.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(budgetStatus.percentage, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0 ₫</span>
              <span>{formatCurrency(budgetStatus.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <ExpenseChart type="monthly" onMonthClick={handleMonthClick} />
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <ExpenseChart type="category" />
        </Card>
      </div>

      {/* Detailed Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Top danh mục chi tiêu</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="flex items-center justify-center h-[200px]">
                <RefreshCw className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-4">
                  {getTopCategories().map((category: any, index: any) => (
                    <div key={category.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium">
                          {category.rank}
                        </div>
                        <div>
                          <p className="font-medium">{category.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(category.amount)}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">
                        {category.percentage}%
                      </Badge>
                    </div>
                  ))}
                  {getTopCategories().length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Chưa có dữ liệu chi tiêu</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🤖 Phân tích AI
              <Badge variant="secondary" className="text-xs">
                {statsLoading ? 'Đang phân tích...' : 'Hoàn thành'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(statsData as any)?.insights ? (
              <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    AI
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-2 text-blue-700">Phân tích thông minh</h4>
                    <div className="text-sm text-gray-700 leading-relaxed max-h-32 overflow-y-auto">
                      {(statsData as any).insights}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
                <p className="text-sm">AI đang phân tích dữ liệu...</p>
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <h4 className="font-medium text-green-700 text-sm">Thống kê nhanh</h4>
                </div>
                <p className="text-xs text-gray-600">
                  {getFilteredExpenses().length} giao dịch trong tháng {selectedMonth ? `${selectedMonth.month}/${selectedMonth.year}` : 'này'}
                </p>
              </div>
              
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <h4 className="font-medium text-purple-700 text-sm">Tình trạng ngân sách</h4>
                </div>
                <p className="text-xs text-gray-600">
                  {budgetStatus.remaining > 0 
                    ? `Còn ${formatCurrency(budgetStatus.remaining)}`
                    : `Vượt ${formatCurrency(Math.abs(budgetStatus.remaining))}`
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Statistics Table */}
      <FadeIn delay={0.6}>
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <DetailedStatsTable />
        </Card>
      </FadeIn>
    </div>
  );
}