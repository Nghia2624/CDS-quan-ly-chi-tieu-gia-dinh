import { ExpenseChart } from "@/components/ExpenseChart";
import { StatsCard } from "@/components/StatsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, Target } from "lucide-react";

export default function StatsPage() {
  // todo: remove mock functionality
  const topCategories = [
    { name: "Ăn uống", amount: 2500000, percentage: 35 },
    { name: "Đám cưới", amount: 1800000, percentage: 25 },
    { name: "Học tập", amount: 1200000, percentage: 17 },
    { name: "Y tế", amount: 800000, percentage: 11 },
    { name: "Giải trí", amount: 600000, percentage: 8 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Thống kê chi tiêu</h1>
        <p className="text-muted-foreground">
          Phân tích chi tiêu gia đình và xu hướng tiết kiệm
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Chi tiêu trung bình/ngày"
          value="196,000 ₫"
          change={-12}
          changeType="decrease"
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
        <StatsCard
          title="Danh mục nhiều nhất"
          value="Ăn uống"
          change={8}
          changeType="increase"
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
        />
        <StatsCard
          title="So với tháng trước"
          value="-420,000 ₫"
          change={7}
          changeType="decrease"
          icon={<TrendingDown className="h-4 w-4 text-muted-foreground" />}
        />
        <StatsCard
          title="Mục tiêu tiết kiệm"
          value="75%"
          change={25}
          changeType="increase"
          icon={<Target className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExpenseChart type="monthly" />
        <ExpenseChart type="category" />
      </div>

      {/* Detailed Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top danh mục chi tiêu</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-4">
                {topCategories.map((category, index) => (
                  <div key={category.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{category.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Intl.NumberFormat('vi-VN', {
                            style: 'currency',
                            currency: 'VND'
                          }).format(category.amount)}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {category.percentage}%
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Phân tích AI</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-chart-2/10 rounded-lg">
              <h4 className="font-medium mb-2 text-chart-2">🎯 Xu hướng tích cực</h4>
              <p className="text-sm">
                Chi tiêu y tế giảm 25% so với tháng trước, cho thấy sức khỏe gia đình ổn định.
              </p>
            </div>
            
            <div className="p-4 bg-chart-3/10 rounded-lg">
              <h4 className="font-medium mb-2 text-chart-3">⚠️ Cần chú ý</h4>
              <p className="text-sm">
                Chi tiêu giải trí tăng 40%. Hãy cân nhắc các hoạt động miễn phí như picnic gia đình.
              </p>
            </div>
            
            <div className="p-4 bg-chart-1/10 rounded-lg">
              <h4 className="font-medium mb-2 text-chart-1">💡 Gợi ý tiết kiệm</h4>
              <p className="text-sm">
                Nếu giảm 20% chi tiêu ăn uống bằng cách nấu ăn tại nhà, bạn có thể tiết kiệm 500,000 ₫/tháng.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}