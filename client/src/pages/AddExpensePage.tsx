import { ExpenseForm } from "@/components/ExpenseForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AddExpensePage() {
  const handleExpenseSubmit = (expense: { description: string; amount: number; category?: string }) => {
    console.log('New expense added:', expense);
    // todo: remove mock functionality - handle real expense creation
  };

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
            <CardTitle>Gợi ý từ AI</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">💡 Mẹo tiết kiệm</h4>
              <p className="text-sm text-muted-foreground">
                Chi tiêu ăn uống của gia đình trong tuần này đã tăng 20%. 
                Hãy cân nhắc nấu ăn tại nhà nhiều hơn để tiết kiệm.
              </p>
            </div>
            
            <div className="p-4 bg-chart-2/10 rounded-lg">
              <h4 className="font-medium mb-2">📊 Thống kê nhanh</h4>
              <p className="text-sm text-muted-foreground">
                Trung bình chi tiêu đám cưới: 450,000 ₫/lần
              </p>
              <p className="text-sm text-muted-foreground">
                Ngân sách còn lại tháng này: 2,100,000 ₫
              </p>
            </div>
            
            <div className="p-4 bg-chart-3/10 rounded-lg">
              <h4 className="font-medium mb-2">🎯 Mục tiêu tiết kiệm</h4>
              <p className="text-sm text-muted-foreground">
                Bạn đã đạt 75% mục tiêu tiết kiệm tháng này!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}