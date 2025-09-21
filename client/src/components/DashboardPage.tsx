import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "./StatsCard";
import { ExpenseCard } from "./ExpenseCard";
import { ExpenseChart } from "./ExpenseChart";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DollarSign, TrendingUp, Users, Calendar } from "lucide-react";
import heroImage from "@assets/generated_images/Vietnamese_family_financial_planning_c3a42b13.png";

export function DashboardPage() {
  // todo: remove mock functionality
  const recentExpenses = [
    {
      id: "1",
      description: "Đi đám cưới bạn Minh",
      amount: 500000,
      category: "Đám cưới",
      date: "2024-12-20",
      user: "Mẹ Hương"
    },
    {
      id: "2", 
      description: "Mua sách giáo khoa cho con",
      amount: 250000,
      category: "Học tập", 
      date: "2024-12-19",
      user: "Bố An"
    },
    {
      id: "3",
      description: "Ăn tối gia đình tại nhà hàng",
      amount: 380000,
      category: "Ăn uống",
      date: "2024-12-18"
    },
    {
      id: "4",
      description: "Khám bệnh định kỳ cho bé",
      amount: 150000,
      category: "Y tế",
      date: "2024-12-17",
      user: "Mẹ Hương"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <Card className="relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-black/30" />
        </div>
        <CardContent className="relative z-10 p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">
            Chào mừng gia đình Nguyễn! 👋
          </h1>
          <p className="text-lg opacity-90 mb-4">
            AI đã giúp bạn tiết kiệm 1,200,000 ₫ trong tháng này
          </p>
          <div className="flex items-center gap-4 text-sm opacity-80">
            <span>• Phân loại tự động 95% chi tiêu</span>
            <span>• Gợi ý tiết kiệm thông minh</span>
            <span>• Theo dõi chi tiêu gia đình</span>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Tổng chi tiêu tháng này"
          value="5,900,000 ₫"
          change={8.5}
          changeType="increase"
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
        <StatsCard
          title="Tiết kiệm được"
          value="1,200,000 ₫"
          change={15}
          changeType="increase"
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
        />
        <StatsCard
          title="Thành viên gia đình"
          value="4 người"
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
        />
        <StatsCard
          title="Số giao dịch"
          value="28"
          change={-5}
          changeType="decrease"
          icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Expenses */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Chi tiêu gần đây</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {recentExpenses.map((expense) => (
                    <ExpenseCard
                      key={expense.id}
                      description={expense.description}
                      amount={expense.amount}
                      category={expense.category}
                      date={expense.date}
                      user={expense.user}
                    />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="space-y-6">
          <ExpenseChart type="category" />
        </div>
      </div>

      {/* Monthly Chart */}
      <ExpenseChart type="monthly" />
    </div>
  );
}