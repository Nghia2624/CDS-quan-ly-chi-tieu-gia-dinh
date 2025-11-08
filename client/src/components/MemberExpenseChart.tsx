import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { apiService } from "@/lib/api";
import { Users, Calendar, DollarSign } from "lucide-react";
import { ExpenseCard } from "./ExpenseCard";

interface MemberExpenseChartProps {
  onExpenseClick?: (expenses: any[]) => void;
}

export function MemberExpenseChart({ onExpenseClick }: MemberExpenseChartProps) {
  const [selectedMember, setSelectedMember] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<"week" | "month" | "quarter" | "year">("month");
  const [selectedData, setSelectedData] = useState<any>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // Fetch family members
  const { data: familyData } = useQuery({
    queryKey: ['family-members'],
    queryFn: () => apiService.getFamilyMembers(),
  });

  // Fetch expenses
  const { data: expensesData, isLoading } = useQuery({
    queryKey: ['expenses', 'all'],
    queryFn: () => apiService.getExpenses(1000),
  });

  // Filter expenses by time period and member
  const filteredExpenses = useMemo(() => {
    if (!expensesData?.expenses) return [];

    const now = new Date();
    let startDate: Date;

    switch (timeFilter) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "quarter":
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    return expensesData.expenses.filter((exp: any) => {
      const expDate = new Date(exp.createdAt);
      if (expDate < startDate) return false;

      // Filter by member
      if (selectedMember === "all") return true;
      
      // Check if expense belongs to selected member
      const targetUserId = exp.childId || exp.userId;
      return targetUserId === selectedMember;
    });
  }, [expensesData, selectedMember, timeFilter]);

  // Process data by member - Show ALL members including children (FIXED - better childId handling)
  const memberData = useMemo(() => {
    if (!familyData?.members) {
      console.log('No family members data');
      return [];
    }

    const memberMap: { [key: string]: { name: string; amount: number; count: number; role: string; memberId: string } } = {};

    // Initialize ALL members including children
    familyData.members.forEach((member: any) => {
      memberMap[member.id] = {
        name: member.fullName,
        amount: 0,
        count: 0,
        role: member.role,
        memberId: member.id,
      };
    });

    console.log('Initialized member map:', Object.keys(memberMap));
    console.log('Processing filtered expenses:', filteredExpenses.length);

    // Process filtered expenses - use childId if available, otherwise userId
    filteredExpenses.forEach((exp: any) => {
      // IMPORTANT: If childId is set, the expense belongs to the child
      // Otherwise, it belongs to the user who created it
      const targetUserId = exp.childId || exp.userId;
      
      console.log(`Expense: ${exp.description}, userId: ${exp.userId}, childId: ${exp.childId}, targetUserId: ${targetUserId}, amount: ${exp.amount}`);
      
      if (memberMap[targetUserId]) {
        memberMap[targetUserId].amount += parseFloat(exp.amount);
        memberMap[targetUserId].count += 1;
      } else {
        console.warn(`Target user ${targetUserId} not found in member map for expense:`, exp.description);
      }
    });

    console.log('Final member data:', memberMap);

    // Return ALL members (including those with 0 expenses)
    const result = Object.values(memberMap)
      .map(m => ({ ...m, member: m.name })) // Add member field for chart click
      .sort((a, b) => {
        // First sort by role: father, mother, then children
        const roleOrder: { [key: string]: number } = { father: 0, mother: 1, child: 2 };
        const roleDiff = (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99);
        if (roleDiff !== 0) return roleDiff;
        // Then sort by amount (descending)
        return b.amount - a.amount;
      });
    
    console.log('Sorted member data:', result);
    return result;
  }, [familyData, filteredExpenses]);

  // Helper function to get ISO week number
  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  // Process weekly data - can show for all members or selected member
  const weeklyData = useMemo(() => {
    if (!filteredExpenses.length) return [];

    const weekMap: { [key: string]: number } = {};
    const now = new Date();
    
    // Initialize last 8 weeks
    for (let i = 7; i >= 0; i--) {
      const weekDate = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const weekNum = getWeekNumber(weekDate);
      const weekKey = `T${weekNum}`;
      weekMap[weekKey] = 0;
    }

    filteredExpenses.forEach((exp: any) => {
      const targetUserId = exp.childId || exp.userId;
      // If all members, include all; otherwise only selected member
      if (selectedMember === "all" || targetUserId === selectedMember) {
        const expDate = new Date(exp.createdAt);
        const weekNum = getWeekNumber(expDate);
        const weekKey = `T${weekNum}`;
        if (weekMap[weekKey] !== undefined) {
          weekMap[weekKey] += parseFloat(exp.amount);
        }
      }
    });

    return Object.entries(weekMap).map(([week, amount]) => ({ week, amount }));
  }, [selectedMember, filteredExpenses]);

  // Process monthly data for selected member
  const monthlyData = useMemo(() => {
    if (selectedMember === "all" || !filteredExpenses.length) return [];

    const monthMap: { [key: string]: number } = {};
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `T${monthDate.getMonth() + 1}`;
      monthMap[monthKey] = 0;
    }

    filteredExpenses.forEach((exp: any) => {
      const targetUserId = exp.childId || exp.userId;
      if (targetUserId === selectedMember) {
        const expDate = new Date(exp.createdAt);
        const monthKey = `T${expDate.getMonth() + 1}`;
        if (monthMap[monthKey] !== undefined) {
          monthMap[monthKey] += parseFloat(exp.amount);
        }
      }
    });

    return Object.entries(monthMap).map(([month, amount]) => ({ month, amount }));
  }, [selectedMember, filteredExpenses]);

  // Process quarterly data for selected member
  const quarterlyData = useMemo(() => {
    if (selectedMember === "all" || !filteredExpenses.length) return [];

    const quarterMap: { [key: string]: number } = {
      "Q1": 0,
      "Q2": 0,
      "Q3": 0,
      "Q4": 0,
    };

    filteredExpenses.forEach((exp: any) => {
      const targetUserId = exp.childId || exp.userId;
      if (targetUserId === selectedMember) {
        const expDate = new Date(exp.createdAt);
        const quarter = Math.floor(expDate.getMonth() / 3) + 1;
        const quarterKey = `Q${quarter}`;
        if (quarterMap[quarterKey] !== undefined) {
          quarterMap[quarterKey] += parseFloat(exp.amount);
        }
      }
    });

    return Object.entries(quarterMap).map(([quarter, amount]) => ({ quarter, amount }));
  }, [selectedMember, filteredExpenses]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(value);
  };

  const formatCurrencyShort = (value: number) => {
    return (value / 1000000).toFixed(1) + "M";
  };

  const handleChartClick = (data: any, chartType: string) => {
    if (!data?.activePayload?.[0]) return;

    const payload = data.activePayload[0].payload;
    let clickedExpenses: any[] = [];

    if (chartType === "member") {
      // Get expenses for clicked member - use ALL expenses, not filtered
      const memberId = payload.memberId || selectedMember;
      clickedExpenses = expensesData?.expenses?.filter((exp: any) => {
        const targetUserId = exp.childId || exp.userId;
        return targetUserId === memberId;
      }) || [];
    } else if (chartType === "week") {
      // Get expenses for clicked week
      const weekKey = payload.week;
      clickedExpenses = expensesData?.expenses?.filter((exp: any) => {
        const targetUserId = exp.childId || exp.userId;
        // If all members selected, include all; otherwise filter by selected member
        if (selectedMember !== "all" && targetUserId !== selectedMember) return false;
        const expDate = new Date(exp.createdAt);
        const expWeek = `T${getWeekNumber(expDate)}`;
        return expWeek === weekKey;
      }) || [];
    } else if (chartType === "month") {
      // Get expenses for clicked month
      const monthKey = payload.month;
      clickedExpenses = expensesData?.expenses?.filter((exp: any) => {
        const targetUserId = exp.childId || exp.userId;
        if (selectedMember !== "all" && targetUserId !== selectedMember) return false;
        const expDate = new Date(exp.createdAt);
        const expMonth = `T${expDate.getMonth() + 1}`;
        return expMonth === monthKey;
      }) || [];
    } else if (chartType === "quarter") {
      // Get expenses for clicked quarter
      const quarterKey = payload.quarter;
      clickedExpenses = expensesData?.expenses?.filter((exp: any) => {
        const targetUserId = exp.childId || exp.userId;
        if (selectedMember !== "all" && targetUserId !== selectedMember) return false;
        const expDate = new Date(exp.createdAt);
        const quarter = `Q${Math.floor(expDate.getMonth() / 3) + 1}`;
        return quarter === quarterKey;
      }) || [];
    }

    if (clickedExpenses.length > 0) {
      setSelectedData({
        title: payload.name || payload.member || payload.week || payload.month || payload.quarter,
        expenses: clickedExpenses,
        totalAmount: clickedExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0),
      });
      setShowDetailDialog(true);
      if (onExpenseClick) {
        onExpenseClick(clickedExpenses);
      }
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg">
          <p className="font-medium text-gray-900 mb-1">{payload[0].name}</p>
          <p className="text-lg font-bold text-blue-600">{formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Chi tiêu theo thành viên
            </CardTitle>
            <div className="flex gap-2">
              <Select value={selectedMember} onValueChange={setSelectedMember}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Chọn thành viên" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  {familyData?.members?.map((member: any) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.fullName} ({member.role === 'father' ? 'Bố' : member.role === 'mother' ? 'Mẹ' : 'Con'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={timeFilter} onValueChange={(v: any) => setTimeFilter(v)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Tuần</SelectItem>
                  <SelectItem value="month">Tháng</SelectItem>
                  <SelectItem value="quarter">Quý</SelectItem>
                  <SelectItem value="year">Năm</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-[300px]">
              <div className="text-center">
                <Calendar className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-500">Đang tải dữ liệu...</p>
              </div>
            </div>
          ) : (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Tổng quan</TabsTrigger>
                <TabsTrigger value="week">Theo tuần</TabsTrigger>
                <TabsTrigger value="timeline">Theo tháng/quý</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-4">
                {memberData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Không có dữ liệu thành viên</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                      <span>{selectedMember === "all" ? "Tất cả thành viên" : `Chi tiêu của ${familyData?.members?.find((m: any) => m.id === selectedMember)?.fullName}`}</span>
                      <span>Tổng: {formatCurrency(memberData.reduce((sum, m) => sum + m.amount, 0))}</span>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={memberData} onClick={(data) => handleChartClick(data, "member")} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis 
                          dataKey="name" 
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          interval={0}
                          fontSize={11}
                        />
                        <YAxis tickFormatter={formatCurrencyShort} fontSize={11} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} style={{ cursor: 'pointer' }} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                      {memberData.map((member) => (
                        <div key={member.memberId} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="text-xs text-muted-foreground">{member.name}</div>
                          <div className="text-lg font-semibold">{formatCurrency(member.amount)}</div>
                          <div className="text-xs text-muted-foreground">{member.count} giao dịch</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="week" className="space-y-4">
                {weeklyData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Không có dữ liệu chi tiêu theo tuần</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                      <span>Chi tiêu {selectedMember === "all" ? "tất cả thành viên" : `của ${familyData?.members?.find((m: any) => m.id === selectedMember)?.fullName}`} trong 8 tuần gần đây</span>
                      <span>Tổng: {formatCurrency(weeklyData.reduce((sum, item) => sum + item.amount, 0))}</span>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={weeklyData} onClick={(data) => handleChartClick(data, "week")} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="week" fontSize={11} />
                        <YAxis tickFormatter={formatCurrencyShort} fontSize={11} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} style={{ cursor: 'pointer' }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                )}
              </TabsContent>

              <TabsContent value="timeline" className="space-y-4">
                {selectedMember === "all" ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Vui lòng chọn một thành viên để xem chi tiêu theo tháng/quý.</p>
                  </div>
                ) : (
                  <>
                    {timeFilter === "month" && (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={monthlyData} onClick={(data) => handleChartClick(data, "month")} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="month" fontSize={11} />
                          <YAxis tickFormatter={formatCurrencyShort} fontSize={11} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="amount" fill="#f59e0b" radius={[4, 4, 0, 0]} style={{ cursor: 'pointer' }} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                    {timeFilter === "quarter" && (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={quarterlyData} onClick={(data) => handleChartClick(data, "quarter")} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="quarter" fontSize={11} />
                          <YAxis tickFormatter={formatCurrencyShort} fontSize={11} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="amount" fill="#ef4444" radius={[4, 4, 0, 0]} style={{ cursor: 'pointer' }} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                    {timeFilter === "year" && (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={monthlyData} onClick={(data) => handleChartClick(data, "month")} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="month" fontSize={11} />
                          <YAxis tickFormatter={formatCurrencyShort} fontSize={11} />
                          <Tooltip content={<CustomTooltip />} />
                          <Line type="monotone" dataKey="amount" stroke="#8b5cf6" strokeWidth={2} style={{ cursor: 'pointer' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Chi tiết chi tiêu: {selectedData?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Tổng số giao dịch</p>
                <p className="text-2xl font-bold">{selectedData?.expenses?.length || 0}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Tổng số tiền</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(selectedData?.totalAmount || 0)}
                </p>
              </div>
            </div>
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {selectedData?.expenses?.map((expense: any) => {
                  // Get user name from family members
                  const targetUserId = expense.childId || expense.userId;
                  const member = familyData?.members?.find((m: any) => m.id === targetUserId);
                  const userName = member ? member.fullName : (expense.userName || 'N/A');
                  
                  return (
                    <ExpenseCard
                      key={expense.id}
                      description={expense.description}
                      amount={parseFloat(expense.amount)}
                      category={expense.category}
                      date={expense.createdAt ? new Date(expense.createdAt).toISOString().split('T')[0] : ''}
                      user={userName}
                      aiConfidence={expense.aiConfidence}
                    />
                  );
                })}
                {(!selectedData?.expenses || selectedData.expenses.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Không có chi tiêu nào</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
