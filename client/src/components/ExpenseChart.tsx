import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { apiService } from "@/lib/api";
import { useDataSync } from "@/hooks/use-data-sync";
import { RefreshCw, Calendar, DollarSign } from "lucide-react";
import { ExpenseCard } from "./ExpenseCard";

interface ExpenseChartProps {
  type: "monthly" | "category";
  onMonthClick?: (month: string, year: number) => void;
  onExpenseClick?: (expenses: any[]) => void;
}

export function ExpenseChart({ type, onMonthClick, onExpenseClick }: ExpenseChartProps) {
  const [timeFilter, setTimeFilter] = useState<"week" | "month" | "quarter" | "year">("month");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<any>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailExpenses, setDetailExpenses] = useState<any[]>([]);
  const [detailTitle, setDetailTitle] = useState("");

  let isRefreshing = false;
  let refreshAllData = () => {};
  
  try {
    const dataSync = useDataSync();
    isRefreshing = dataSync.isRefreshing;
    refreshAllData = dataSync.refreshAllData;
  } catch (error) {
    console.warn('useDataSync hook error:', error);
  }
  
  // Fetch real data - use same query key as DashboardPage
  const { data: expensesData, isLoading } = useQuery({
    queryKey: ['expenses', 'all'],
    queryFn: () => apiService.getExpenses(1000),
    staleTime: 30 * 1000, // 30 seconds - more aggressive refresh
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Always refetch on mount
    retry: 3, // Retry failed requests
    retryDelay: 1000, // 1 second between retries
  });

  // Filter expenses by time period
  const filteredExpenses = useMemo(() => {
    if (!expensesData?.expenses) return [];

    const now = new Date();
    let startDate: Date;

    switch (timeFilter) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "quarter":
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    return expensesData.expenses.filter((exp: any) => {
      const expDate = new Date(exp.createdAt);
      return expDate >= startDate;
    });
  }, [expensesData, timeFilter]);

  // Process category data from filtered expenses
  const categoryData = useMemo(() => {
    if (!filteredExpenses.length) return [];
    
    const categoryMap: { [key: string]: { value: number; color: string } } = {};
    const colors: { [key: string]: string } = {
      'Ăn uống': 'hsl(221, 83%, 53%)',
      'Đám cưới': 'hsl(142, 71%, 45%)',
      'Học tập': 'hsl(25, 95%, 53%)',
      'Y tế': 'hsl(262, 83%, 58%)',
      'Giải trí': 'hsl(336, 84%, 63%)',
      'Giao thông': 'hsl(48, 96%, 53%)',
      'Quần áo': 'hsl(239, 84%, 67%)',
      'Gia dụng': 'hsl(0, 84%, 60%)',
      'Đám ma': 'hsl(0, 0%, 45%)',
      'Khác': 'hsl(0, 0%, 50%)'
    };
    
    filteredExpenses.forEach((expense: any) => {
      const category = expense.category || 'Khác';
      if (!categoryMap[category]) {
        categoryMap[category] = { value: 0, color: colors[category] || 'hsl(0, 0%, 50%)' };
      }
      categoryMap[category].value += parseFloat(expense.amount);
    });
    
    return Object.entries(categoryMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  // Process monthly data - ALWAYS show last 12 months regardless of filter
  const monthlyData = useMemo(() => {
    if (!expensesData?.expenses) return [];
    
    const monthMap: { [key: string]: { amount: number; year: number; monthName: string; monthNumber: number } } = {};
    const currentDate = new Date();
    
    // Initialize last 12 months with 0 amounts
    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthNumber = date.getMonth() + 1;
      const year = date.getFullYear();
      const monthKey = `${year}-${monthNumber.toString().padStart(2, '0')}`;
      const monthName = date.toLocaleString('vi-VN', { month: 'long' });
      
      monthMap[monthKey] = {
        amount: 0,
        year: year,
        monthName: monthName,
        monthNumber: monthNumber
      };
    }
    
    // Process ALL expenses (not filtered) and group by month for the last 12 months
    expensesData.expenses.forEach((expense: any) => {
      const date = new Date(expense.createdAt);
      const monthNumber = date.getMonth() + 1;
      const year = date.getFullYear();
      const monthKey = `${year}-${monthNumber.toString().padStart(2, '0')}`;
      
      // Add to existing month if it's within the last 12 months
      if (monthMap[monthKey]) {
        monthMap[monthKey].amount += parseFloat(expense.amount);
      }
    });
    
    // Convert to array and sort by year and month
    const sortedData = Object.entries(monthMap)
      .map(([monthKey, data]) => ({ 
        month: `${data.monthName.substring(0, 3)}/${data.year.toString().slice(-2)}`, 
        monthFull: `${data.monthName} ${data.year}`,
        amount: data.amount,
        year: data.year,
        monthName: data.monthName,
        monthNumber: data.monthNumber
      }))
      .sort((a, b) => {
        // Sort by year and month
        if (a.year !== b.year) return a.year - b.year;
        return a.monthNumber - b.monthNumber;
      });
    
    return sortedData;
  }, [expensesData]);

  const formatCurrency = (value: number) => {
    return (value / 1000000).toFixed(1) + "M";
  };

  const formatCurrencyFull = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(value);
  };

  const handleCategoryClick = (categoryName: string) => {
    const expenses = filteredExpenses.filter((exp: any) => (exp.category || 'Khác') === categoryName);
    setSelectedCategory(categoryName);
    setDetailExpenses(expenses);
    setDetailTitle(`Chi tiết danh mục: ${categoryName}`);
    setShowDetailDialog(true);
    if (onExpenseClick) {
      onExpenseClick(expenses);
    }
  };

  const handleMonthClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const monthData = data.activePayload[0].payload;
      // Use all expenses (not filtered) for monthly detail
      const expenses = expensesData?.expenses?.filter((exp: any) => {
        const expDate = new Date(exp.createdAt);
        return expDate.getMonth() + 1 === monthData.monthNumber && expDate.getFullYear() === monthData.year;
      }) || [];
      setSelectedMonth(monthData);
      setDetailExpenses(expenses);
      setDetailTitle(`Chi tiết tháng ${monthData.monthName} ${monthData.year}`);
      setShowDetailDialog(true);
      if (onMonthClick) {
        onMonthClick(monthData.monthName, monthData.year);
      }
      if (onExpenseClick) {
        onExpenseClick(expenses);
      }
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const value = payload[0].value || 0;
      return (
        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg min-w-[180px]">
          <p className="text-sm font-medium text-gray-900 mb-2">
            {type === "monthly" ? (data?.monthFull || `${data?.monthName || label} ${data?.year || ''}`) : label}
          </p>
          <p className="text-xl font-bold text-blue-600 mb-1">
            {formatCurrencyFull(value)}
          </p>
          {type === "category" && categoryData.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {((value / categoryData.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(1)}% tổng chi tiêu
            </p>
          )}
          {type === "monthly" && monthlyData.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {value > 0 ? `${Math.round((value / monthlyData.reduce((sum, item) => sum + item.amount, 0)) * 100)}% tổng 12 tháng` : 'Không có chi tiêu'}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (type === "monthly") {
    return (
      <>
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Chi tiêu theo tháng
              </CardTitle>
              <div className="flex gap-2">
                <Select value={timeFilter} onValueChange={(v: any) => setTimeFilter(v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Tuần</SelectItem>
                    <SelectItem value="month">Tháng</SelectItem>
                    <SelectItem value="quarter">Quý</SelectItem>
                    <SelectItem value="year">Năm</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  onClick={refreshAllData}
                  disabled={isRefreshing}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                  title="Làm mới dữ liệu"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-[300px]">
                <div className="text-center">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-500">Đang tải dữ liệu...</p>
                </div>
              </div>
            ) : (
            <ResponsiveContainer width="100%" height={300}>
              {monthlyData.length > 0 ? (
                <BarChart 
                  data={monthlyData}
                  onClick={handleMonthClick}
                  margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="month" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval={0}
                  />
                  <YAxis 
                    tickFormatter={formatCurrency}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    width={60}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="amount" 
                    fill="hsl(var(--chart-1))"
                    radius={[4, 4, 0, 0]}
                    style={{ cursor: 'pointer' }}
                  />
                </BarChart>
              ) : (
                <div className="flex items-center justify-center h-[300px]">
                  <div className="text-center">
                    <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-500">Chưa có dữ liệu chi tiêu</p>
                  </div>
                </div>
              )}
            </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                {detailTitle}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Tổng số giao dịch</p>
                  <p className="text-2xl font-bold">{detailExpenses.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Tổng số tiền</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrencyFull(detailExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0))}
                  </p>
                </div>
              </div>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {detailExpenses.map((expense: any) => (
                    <ExpenseCard
                      key={expense.id}
                      description={expense.description}
                      amount={parseFloat(expense.amount)}
                      category={expense.category}
                      date={expense.createdAt ? new Date(expense.createdAt).toISOString().split('T')[0] : ''}
                      user={expense.userName || 'N/A'}
                      aiConfidence={expense.aiConfidence}
                    />
                  ))}
                  {detailExpenses.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Không có chi tiêu nào</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Chi tiêu theo danh mục
            </CardTitle>
            <div className="flex gap-2">
              <Select value={timeFilter} onValueChange={(v: any) => setTimeFilter(v)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Tuần</SelectItem>
                  <SelectItem value="month">Tháng</SelectItem>
                  <SelectItem value="quarter">Quý</SelectItem>
                  <SelectItem value="year">Năm</SelectItem>
                </SelectContent>
              </Select>
              <button
                onClick={refreshAllData}
                disabled={isRefreshing}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="Làm mới dữ liệu"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-[300px]">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-500">Đang tải dữ liệu...</p>
              </div>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                    onClick={(data: any) => {
                      if (data && categoryData[data.activeIndex]) {
                        handleCategoryClick(categoryData[data.activeIndex].name);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              
              <div className="mt-4 space-y-2">
                {categoryData.map((item, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => handleCategoryClick(item.name)}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span>{item.name}</span>
                    </div>
                    <span className="font-medium">
                      {formatCurrencyFull(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              {detailTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Tổng số giao dịch</p>
                <p className="text-2xl font-bold">{detailExpenses.length}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Tổng số tiền</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrencyFull(detailExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0))}
                </p>
              </div>
            </div>
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {detailExpenses.map((expense: any) => (
                  <ExpenseCard
                    key={expense.id}
                    description={expense.description}
                    amount={parseFloat(expense.amount)}
                    category={expense.category}
                    date={expense.createdAt ? new Date(expense.createdAt).toISOString().split('T')[0] : ''}
                    user={expense.userName || 'N/A'}
                    aiConfidence={expense.aiConfidence}
                  />
                ))}
                {detailExpenses.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Không có chi tiêu nào</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}