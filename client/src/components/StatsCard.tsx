import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string;
  change?: number;
  changeType?: "increase" | "decrease" | "neutral";
  icon?: React.ReactNode;
  loading?: boolean;
}

export function StatsCard({ title, value, change, changeType = "neutral", icon, loading = false }: StatsCardProps) {
  const getTrendIcon = () => {
    switch (changeType) {
      case "increase":
        return <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case "decrease":
        return <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendColor = () => {
    switch (changeType) {
      case "increase":
        return "text-green-600 dark:text-green-400";
      case "decrease":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <Card className="bg-white/80 dark:bg-card/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] group">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium group-hover:text-blue-600 transition-colors" data-testid="text-stats-title">
          {title}
        </CardTitle>
        {icon && <div className="h-4 w-4 group-hover:scale-110 transition-transform duration-300">{icon}</div>}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-16">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold break-words overflow-hidden" data-testid="text-stats-value" style={{ wordBreak: 'break-word', overflowWrap: 'break-word', maxWidth: '100%' }}>
              {value}
            </div>
            {change !== undefined && (
              <div className={`flex items-center gap-1 text-xs ${getTrendColor()}`}>
                {getTrendIcon()}
                <span data-testid="text-stats-change">
                  {changeType === "increase" ? "+" : changeType === "decrease" ? "-" : ""}
                  {Math.abs(change)}% so với tháng trước
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}