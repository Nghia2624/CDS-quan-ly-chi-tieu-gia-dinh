import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Download, Filter, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function QuickActions() {
  const { toast } = useToast();

  const actions = [
    {
      icon: <Plus className="h-5 w-5" />,
      label: "Thêm chi tiêu",
      description: "Ghi nhận khoản chi tiêu mới",
      action: () => {
        window.location.href = "/add-expense";
      },
      color: "bg-blue-500 hover:bg-blue-600"
    },
    {
      icon: <Target className="h-5 w-5" />,
      label: "Mục tiêu tiết kiệm",
      description: "Xem và quản lý mục tiêu",
      action: () => {
        window.location.href = "/savings-goals";
      },
      color: "bg-green-500 hover:bg-green-600"
    },
    {
      icon: <Download className="h-5 w-5" />,
      label: "Xuất dữ liệu",
      description: "Xuất file CSV",
      action: () => {
        toast({
          title: "Mở cửa sổ xuất dữ liệu",
          description: "Sử dụng nút xuất trong phần thống kê"
        });
      },
      color: "bg-purple-500 hover:bg-purple-600"
    },
    {
      icon: <Filter className="h-5 w-5" />,
      label: "Lọc dữ liệu",
      description: "Xem thống kê chi tiết",
      action: () => {
        window.location.href = "/stats";
      },
      color: "bg-orange-500 hover:bg-orange-600"
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Thao tác nhanh</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {actions.map((action, index) => (
            <Button
              key={index}
              variant="ghost"
              className="flex flex-col items-center justify-center h-auto py-4 gap-2 hover:bg-muted transition-all"
              onClick={action.action}
            >
              <div className={`p-2 rounded-lg text-white ${action.color} transition-transform hover:scale-110`}>
                {action.icon}
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">{action.label}</p>
                <p className="text-xs text-muted-foreground">{action.description}</p>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

