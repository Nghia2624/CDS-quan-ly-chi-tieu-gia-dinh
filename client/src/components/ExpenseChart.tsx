import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface ExpenseChartProps {
  type: "monthly" | "category";
}

export function ExpenseChart({ type }: ExpenseChartProps) {
  // todo: remove mock functionality
  const monthlyData = [
    { month: "T1", amount: 5200000 },
    { month: "T2", amount: 4800000 },
    { month: "T3", amount: 6100000 },
    { month: "T4", amount: 5500000 },
    { month: "T5", amount: 6800000 },
    { month: "T6", amount: 5900000 },
  ];

  const categoryData = [
    { name: "Ăn uống", value: 2500000, color: "hsl(var(--chart-1))" },
    { name: "Đám cưới", value: 1800000, color: "hsl(var(--chart-2))" },
    { name: "Học tập", value: 1200000, color: "hsl(var(--chart-3))" },
    { name: "Y tế", value: 800000, color: "hsl(var(--chart-4))" },
    { name: "Giải trí", value: 600000, color: "hsl(var(--chart-5))" },
  ];

  const formatCurrency = (value: number) => {
    return (value / 1000000).toFixed(1) + "M";
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-sm text-chart-1">
            {new Intl.NumberFormat('vi-VN', {
              style: 'currency',
              currency: 'VND'
            }).format(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  if (type === "monthly") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Chi tiêu theo tháng</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                tickFormatter={formatCurrency}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="amount" 
                fill="hsl(var(--chart-1))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chi tiêu theo danh mục</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={categoryData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={120}
              paddingAngle={5}
              dataKey="value"
            >
              {categoryData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        
        <div className="mt-4 space-y-2">
          {categoryData.map((item, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.name}</span>
              </div>
              <span className="font-medium">
                {new Intl.NumberFormat('vi-VN', {
                  style: 'currency',
                  currency: 'VND'
                }).format(item.value)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}