import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { apiService } from "@/lib/api";
import { TrendingUp, TrendingDown, Minus, BarChart3, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface PeriodComparisonProps {
  currentPeriod: "week" | "month" | "quarter" | "year";
}

export function PeriodComparison({ currentPeriod }: PeriodComparisonProps) {
  const { data: expensesData, isLoading } = useQuery({
    queryKey: ['expenses', 'all'],
    queryFn: () => apiService.getExpenses(1000),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const formatCurrencyShort = (value: number) => {
    return (value / 1000000).toFixed(1) + "M";
  };

  const getPeriodData = () => {
    if (!expensesData?.expenses) return { current: 0, previous: 0, change: 0 };

    const now = new Date();
    let currentStart: Date, currentEnd: Date, previousStart: Date, previousEnd: Date;

    switch (currentPeriod) {
      case "week":
        currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        currentEnd = now;
        previousStart = new Date(currentStart.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousEnd = currentStart;
        break;
      case "month":
        // Tháng hiện tại: từ đầu tháng đến hôm nay (hoặc cuối tháng nếu đã hết tháng)
        currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
        currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999); // Cuối tháng hiện tại
        // Nếu chưa hết tháng, chỉ tính đến hôm nay
        if (now < currentEnd) {
          currentEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        }
        // Tháng trước: cả tháng đầy đủ
        previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      case "quarter":
        const quarter = Math.floor(now.getMonth() / 3);
        currentStart = new Date(now.getFullYear(), quarter * 3, 1);
        currentEnd = now;
        const prevQuarter = quarter === 0 ? 3 : quarter - 1;
        const prevQuarterYear = quarter === 0 ? now.getFullYear() - 1 : now.getFullYear();
        previousStart = new Date(prevQuarterYear, prevQuarter * 3, 1);
        previousEnd = new Date(prevQuarterYear, (prevQuarter + 1) * 3, 0);
        break;
      case "year":
        currentStart = new Date(now.getFullYear(), 0, 1);
        currentEnd = now;
        previousStart = new Date(now.getFullYear() - 1, 0, 1);
        previousEnd = new Date(now.getFullYear() - 1, 11, 31);
        break;
    }

    const currentExpenses = expensesData.expenses.filter((exp: any) => {
      const expDate = new Date(exp.createdAt);
      return expDate >= currentStart && expDate <= currentEnd;
    }).reduce((sum: number, exp: any) => sum + parseFloat(exp.amount), 0);

    const previousExpenses = expensesData.expenses.filter((exp: any) => {
      const expDate = new Date(exp.createdAt);
      return expDate >= previousStart && expDate <= previousEnd;
    }).reduce((sum: number, exp: any) => sum + parseFloat(exp.amount), 0);

    const change = previousExpenses === 0 
      ? (currentExpenses > 0 ? 100 : 0)
      : Math.round(((currentExpenses - previousExpenses) / previousExpenses) * 100);

    return { current: currentExpenses, previous: previousExpenses, change };
  };

  const periodLabels: { [key: string]: string } = {
    week: "Tuần",
    month: "Tháng",
    quarter: "Quý",
    year: "Năm"
  };

  const data = getPeriodData();
  const chartData = [
    { period: `${periodLabels[currentPeriod]} trước`, amount: data.previous },
    { period: `${periodLabels[currentPeriod]} này`, amount: data.current },
  ];

  const changeColor = data.change > 0 ? "text-red-600" : data.change < 0 ? "text-green-600" : "text-muted-foreground";
  const ChangeIcon = data.change > 0 ? TrendingUp : data.change < 0 ? TrendingDown : Minus;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            So sánh với {periodLabels[currentPeriod]} trước
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px]">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          So sánh với {periodLabels[currentPeriod]} trước
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{periodLabels[currentPeriod]} này</p>
              <p className="text-2xl font-bold">{formatCurrency(data.current)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">{periodLabels[currentPeriod]} trước</p>
              <p className="text-2xl font-bold text-muted-foreground">{formatCurrency(data.previous)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={data.change > 0 ? "destructive" : data.change < 0 ? "default" : "secondary"} className="gap-1">
              <ChangeIcon className="h-3 w-3" />
              {data.change > 0 ? '+' : ''}{data.change}%
            </Badge>
            <span className="text-sm text-muted-foreground">
              {data.change > 0 ? 'tăng' : data.change < 0 ? 'giảm' : 'không đổi'} so với {periodLabels[currentPeriod]} trước
            </span>
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis tickFormatter={formatCurrencyShort} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? '#94a3b8' : '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

