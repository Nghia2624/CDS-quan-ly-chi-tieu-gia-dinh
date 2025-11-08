import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, DollarSign, Sparkles, User } from "lucide-react";

interface ExpenseCardProps {
  description: string;
  amount: number;
  category: string;
  date: string;
  user?: string;
  aiConfidence?: number;
}

export function ExpenseCard({ description, amount, category, date, user, aiConfidence }: ExpenseCardProps) {
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

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceText = (confidence: number) => {
    if (confidence >= 0.8) return 'Cao';
    if (confidence >= 0.6) return 'Trung bình';
    return 'Thấp';
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
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span data-testid="text-expense-user">{user}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs" data-testid="badge-expense-category">
                  {category}
                </Badge>
                {aiConfidence && (
                  <div className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-blue-500" />
                    <span className={`text-xs font-medium ${getConfidenceColor(aiConfidence)}`}>
                      AI: {getConfidenceText(aiConfidence)}
                    </span>
                  </div>
                )}
              </div>
              
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