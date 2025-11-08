import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { apiService } from "@/lib/api";
import { AlertTriangle, Bell, TrendingUp, Calendar } from "lucide-react";

export function BudgetAlerts() {
  const { data, isLoading } = useQuery({
    queryKey: ['budget-alerts'],
    queryFn: () => apiService.getBudgetAlerts(),
    refetchInterval: 60000, // Refetch every minute
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center text-muted-foreground">Đang tải...</div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const budgetData = data as any || {};
  const summary = budgetData.summary || { monthlyBudget: 25000000, totalSpent: 0, remaining: 25000000, percentageUsed: 0 };
  const alerts = budgetData.alerts || [];

  const getAlertVariant = (type: string) => {
    switch (type) {
      case 'critical': return 'destructive';
      case 'warning': return 'default';
      default: return 'default';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Cảnh báo ngân sách
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Budget Progress */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Chi tiêu tháng này</span>
            <span className="font-semibold">
              {summary.percentageUsed || 0}%
            </span>
          </div>
          <Progress 
            value={parseFloat(summary.percentageUsed || '0')} 
            className="h-3"
          />
          <div className="flex justify-between text-sm mt-2">
            <span>{formatCurrency(summary.totalSpent || 0)}</span>
            <span className="text-muted-foreground">
              {formatCurrency(summary.monthlyBudget || 0)}
            </span>
          </div>
        </div>

        {/* Remaining info */}
        <div className="grid grid-cols-2 gap-4 p-3 bg-muted rounded-lg">
          <div>
            <div className="text-xs text-muted-foreground">Còn lại</div>
            <div className="font-semibold">
              {formatCurrency(summary.remaining || 0)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Ngày còn lại</div>
            <div className="font-semibold">
              {summary.daysRemaining || 0} ngày
            </div>
          </div>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((alert: any, idx: number) => (
              <Alert 
                key={idx} 
                variant={getAlertVariant(alert.type)}
                className={alert.type === 'critical' ? 'border-red-500 bg-red-50' : ''}
              >
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{alert.title}</AlertTitle>
                <AlertDescription>{alert.message}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {alerts.length === 0 && (
          <Alert className="bg-green-50 border-green-200">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">
              Ngân sách trong tầm kiểm soát
            </AlertTitle>
            <AlertDescription className="text-green-700">
              Bạn đang quản lý chi tiêu tốt. Tiếp tục phát huy!
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

