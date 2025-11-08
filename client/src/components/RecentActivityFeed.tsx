import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { apiService } from "@/lib/api";
import { Calendar, DollarSign, User, TrendingUp, RefreshCw } from "lucide-react";

export function RecentActivityFeed() {
  const { data: expensesData, isLoading } = useQuery({
    queryKey: ['expenses', 'recent'],
    queryFn: () => apiService.getExpenses(20),
    staleTime: 30 * 1000,
  });

  const { data: familyData } = useQuery({
    queryKey: ['family-members'],
    queryFn: () => apiService.getFamilyMembers(),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const formatTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Vừa xong';
      if (diffMins < 60) return `${diffMins} phút trước`;
      if (diffHours < 24) return `${diffHours} giờ trước`;
      if (diffDays < 7) return `${diffDays} ngày trước`;
      return new Date(dateString).toLocaleDateString('vi-VN');
    } catch {
      return 'Vừa xong';
    }
  };

  const activities = expensesData?.expenses?.slice(0, 10).map((expense: any) => {
    const member = familyData?.members?.find((m: any) => 
      m.id === (expense.childId || expense.userId)
    );
    
    return {
      id: expense.id,
      type: 'expense',
      title: expense.description,
      amount: parseFloat(expense.amount),
      category: expense.category,
      user: member?.fullName || expense.userName || 'Không xác định',
      time: expense.createdAt,
      isChild: !!expense.childId,
    };
  }) || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Hoạt động gần đây
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
          <Calendar className="h-5 w-5" />
          Hoạt động gần đây
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Chưa có hoạt động nào</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {activities.map((activity: any) => (
                <div 
                  key={activity.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
                    <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium truncate">{activity.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {activity.user}
                          </span>
                          {activity.isChild && (
                            <Badge variant="outline" className="text-xs">Chi tiêu của con</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCurrency(activity.amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTimeAgo(activity.time)}
                        </p>
                      </div>
                    </div>
                    {activity.category && (
                      <Badge variant="secondary" className="mt-2 text-xs">
                        {activity.category}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

