import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, DollarSign } from "lucide-react";

interface ExpenseCardProps {
  description: string;
  amount: number;
  category: string;
  date: string;
  user?: string;
}

export function ExpenseCard({ description, amount, category, date, user }: ExpenseCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <Card className="hover-elevate cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <p className="font-medium text-sm" data-testid="text-expense-description">
              {description}
            </p>
            
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span data-testid="text-expense-date">{formatDate(date)}</span>
              </div>
              
              {user && (
                <span className="text-xs text-muted-foreground" data-testid="text-expense-user">
                  bởi {user}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-xs" data-testid="badge-expense-category">
                {category}
              </Badge>
              
              <div className="flex items-center gap-1 text-right">
                <DollarSign className="h-3 w-3 text-muted-foreground" />
                <span className="font-semibold text-sm" data-testid="text-expense-amount">
                  {formatCurrency(amount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}