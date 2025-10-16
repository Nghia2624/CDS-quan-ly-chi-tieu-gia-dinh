import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { apiService } from "@/lib/api";
import { useDataSync } from "@/hooks/use-data-sync";
import { RefreshCw } from "lucide-react";

interface ExpenseChartProps {
  type: "monthly" | "category";
  onMonthClick?: (month: string, year: number) => void;
}

export function ExpenseChart({ type, onMonthClick }: ExpenseChartProps) {
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

  // Process category data from real expenses
  const categoryData = (() => {
    if (!expensesData?.expenses) return [];
    
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
    
    expensesData.expenses.forEach((expense: any) => {
      const category = expense.category || 'Khác';
      if (!categoryMap[category]) {
        categoryMap[category] = { value: 0, color: colors[category] || 'hsl(0, 0%, 50%)' };
      }
      categoryMap[category].value += parseFloat(expense.amount);
    });
    
    return Object.entries(categoryMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.value - a.value);
  })();

  // Process monthly data from real expenses
  const monthlyData = (() => {
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
    
    // Process all expenses and group by month
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
      .map(([month, data]) => ({ 
        month: `T${data.monthNumber}`, 
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
  })();

  const formatCurrency = (value: number) => {
    return (value / 1000000).toFixed(1) + "M";
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-lg">
          <p className="text-sm font-medium text-gray-900">
            {type === "monthly" ? `${data?.monthName || label} ${data?.year || ''}` : label}
          </p>
          <p className="text-lg font-bold text-blue-600">
            {new Intl.NumberFormat('vi-VN', {
              style: 'currency',
              currency: 'VND'
            }).format(payload[0].value)}
          </p>
          {type === "category" && (
            <p className="text-xs text-gray-500 mt-1">
              {((payload[0].value / categoryData.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(1)}% tổng chi tiêu
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (type === "monthly") {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Chi tiêu theo tháng</CardTitle>
            <button
              onClick={refreshAllData}
              disabled={isRefreshing}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
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
            <BarChart 
              data={monthlyData}
              onClick={(data) => {
                if (data && data.activePayload && data.activePayload[0] && onMonthClick) {
                  const monthData = data.activePayload[0].payload;
                  onMonthClick(monthData.monthName, monthData.year);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                tickFormatter={formatCurrency}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="amount" 
                fill="hsl(var(--chart-1))"
                radius={[4, 4, 0, 0]}
                style={{ cursor: 'pointer' }}
              />
            </BarChart>
          </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Chi tiêu theo danh mục</CardTitle>
          <button
            onClick={refreshAllData}
            disabled={isRefreshing}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
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
            <div key={index} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.name}</span>
              </div>
              <span className="font-medium">
                {new Intl.NumberFormat('vi-VN', {
                  style: 'currency',
                  currency: 'VND'
                }).format(item.value)}
              </span>
            </div>
          ))}
        </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}