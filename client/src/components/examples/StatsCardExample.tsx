import { StatsCard } from '../StatsCard';
import { DollarSign, TrendingUp, Users, Calendar } from 'lucide-react';

export default function StatsCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
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
  );
}