import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";
import { apiService } from "@/lib/api";
import { Calendar, TrendingUp, TrendingDown, AlertTriangle, DollarSign, BarChart3, PieChart as PieChartIcon, GitCompare } from "lucide-react";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(amount);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

interface ExpenseDetail {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: Date;
  userName?: string;
}

export function EnhancedAnalysisDashboard() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'quarter' | 'year'>('month');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedPeriodValue, setSelectedPeriodValue] = useState<string>('');
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailData, setDetailData] = useState<{ period: string; expenses: ExpenseDetail[]; summary: any } | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [comparePeriod, setComparePeriod] = useState<'month' | 'quarter' | 'year'>('month');

  // Calculate date ranges
  const getDateRange = (p: typeof period) => {
    let end = new Date(selectedDate);
    let start: Date;

    switch (p) {
      case 'day':
        start = new Date(end);
        start.setHours(0, 0, 0, 0);
        end = new Date(end);
        end.setHours(23, 59, 59, 999);
        break;
      case 'week':
        start = new Date(end);
        start.setDate(end.getDate() - 6);
        break;
      case 'month':
        start = new Date(end.getFullYear(), end.getMonth(), 1);
        end = new Date(end.getFullYear(), end.getMonth() + 1, 0);
        break;
      case 'quarter':
        const quarter = Math.floor(end.getMonth() / 3);
        start = new Date(end.getFullYear(), quarter * 3, 1);
        end = new Date(end.getFullYear(), (quarter + 1) * 3, 0);
        break;
      case 'year':
        start = new Date(end.getFullYear(), 0, 1);
        end = new Date(end.getFullYear(), 11, 31);
        break;
    }

    return { start, end };
  };

  const dateRange = getDateRange(period);
  const startDateStr = dateRange.start.toISOString().split('T')[0];
  const endDateStr = dateRange.end.toISOString().split('T')[0];

  // Fetch analysis data (OPTIMIZED with better caching)
  const { data: analysisData, isLoading } = useQuery({
    queryKey: ['analysis', period, startDateStr, endDateStr],
    queryFn: () => apiService.analyzePeriod(startDateStr, endDateStr, false), // Disable predictions to speed up
    enabled: !compareMode,
    staleTime: 5 * 60 * 1000, // 5 minutes - data is fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache for 30 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on component mount if data exists
  });

  // Fetch comparison data (OPTIMIZED with better caching)
  const getComparisonRanges = () => {
    const now = new Date();
    let currentStart: Date, currentEnd: Date, previousStart: Date, previousEnd: Date;

    if (comparePeriod === 'month') {
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
      currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (comparePeriod === 'quarter') {
      const quarter = Math.floor(now.getMonth() / 3);
      currentStart = new Date(now.getFullYear(), quarter * 3, 1);
      currentEnd = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
      previousStart = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
      previousEnd = new Date(now.getFullYear(), quarter * 3, 0);
    } else {
      currentStart = new Date(now.getFullYear(), 0, 1);
      currentEnd = new Date(now.getFullYear(), 11, 31);
      previousStart = new Date(now.getFullYear() - 1, 0, 1);
      previousEnd = new Date(now.getFullYear() - 1, 11, 31);
    }

    return {
      currentStart: currentStart.toISOString().split('T')[0],
      currentEnd: currentEnd.toISOString().split('T')[0],
      previousStart: previousStart.toISOString().split('T')[0],
      previousEnd: previousEnd.toISOString().split('T')[0],
    };
  };

  const comparisonRanges = getComparisonRanges();
  
  const { data: comparisonData, isLoading: comparisonLoading } = useQuery({
    queryKey: ['comparison', comparePeriod, comparisonRanges],
    queryFn: () => apiService.comparePeriods(
      comparePeriod,
      comparisonRanges.currentStart,
      comparisonRanges.currentEnd,
      comparisonRanges.previousStart,
      comparisonRanges.previousEnd
    ),
    enabled: compareMode,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Handle chart click (FIXED - better error handling and data validation)
  const handleChartClick = async (data: any, chartType: 'daily' | 'weekly' | 'monthly' | 'category') => {
    if (!data || !data.activePayload || !data.activePayload[0]) {
      console.log('No data in chart click');
      return;
    }

    let periodType: 'day' | 'week' | 'month' | 'quarter' | 'year' = 'month';
    let value = '';

    const payload = data.activePayload[0].payload;
    console.log('Chart clicked:', chartType, payload);

    if (chartType === 'daily') {
      periodType = 'day';
      value = payload.date;
    } else if (chartType === 'weekly') {
      periodType = 'week';
      value = payload.week;
    } else if (chartType === 'monthly') {
      periodType = 'month';
      value = payload.month;
    } else if (chartType === 'category') {
      // For category, show expenses of that category in the period
      setDetailData({
        period: payload.category || payload.name || 'Unknown',
        expenses: [],
        summary: { 
          totalAmount: payload.amount || payload.value || 0, 
          totalCount: payload.count || 0, 
          averageAmount: 0,
          categoryBreakdown: [{
            category: payload.category || payload.name || 'Unknown',
            amount: payload.amount || payload.value || 0,
            count: payload.count || 0
          }]
        },
      });
      setShowDetailDialog(true);
      return;
    }

    if (!value) {
      console.error('No value for period:', periodType);
      return;
    }

    try {
      console.log('Fetching detailed data for:', periodType, value);
      const detailed = await apiService.getDetailedData(periodType, value) as any;
      console.log('Detailed data received:', detailed);
      
      // Validate response data
      if (!detailed || !detailed.summary) {
        throw new Error('Invalid response format');
      }
      
      setDetailData(detailed);
      setShowDetailDialog(true);
    } catch (error: any) {
      console.error('Error fetching detailed data:', error);
      // Show error in dialog instead of blank screen
      setDetailData({
        period: value,
        expenses: [],
        summary: { 
          totalAmount: 0, 
          totalCount: 0, 
          averageAmount: 0,
          categoryBreakdown: []
        },
      });
      setShowDetailDialog(true);
    }
  };

  if (compareMode) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">So sánh chi tiêu</h1>
          <div className="flex gap-2">
            <Select value={comparePeriod} onValueChange={(v: any) => setComparePeriod(v)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Theo tháng</SelectItem>
                <SelectItem value="quarter">Theo quý</SelectItem>
                <SelectItem value="year">Theo năm</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setCompareMode(false)}>
              Thoát so sánh
            </Button>
          </div>
        </div>

        {comparisonLoading ? (
          <div className="text-center py-12">Đang tải...</div>
        ) : comparisonData && typeof comparisonData === 'object' && 'current' in comparisonData ? (
          <div className="grid gap-6 md:grid-cols-2">
            <ComparisonCard
              title={`Kỳ hiện tại (${comparePeriod})`}
              data={(comparisonData as any).current}
            />
            <ComparisonCard
              title={`Kỳ trước (${comparePeriod})`}
              data={(comparisonData as any).previous}
            />
          </div>
        ) : null}

        {comparisonData && (comparisonData as any).comparison && (
          <Card>
            <CardHeader>
              <CardTitle>Phân tích so sánh</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <span>Tổng chi tiêu</span>
                  <div className="flex items-center gap-2">
                    <span>{formatCurrency((comparisonData as any).comparison.totalAmount.current)}</span>
                    <span className="text-muted-foreground">→</span>
                    <span>{formatCurrency((comparisonData as any).comparison.totalAmount.previous)}</span>
                    {(comparisonData as any).comparison.totalAmount.changePercentage > 0 ? (
                      <Badge variant="destructive">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        +{(comparisonData as any).comparison.totalAmount.changePercentage.toFixed(1)}%
                      </Badge>
                    ) : (
                      <Badge variant="default" className="bg-green-500">
                        <TrendingDown className="h-3 w-3 mr-1" />
                        {(comparisonData as any).comparison.totalAmount.changePercentage.toFixed(1)}%
                      </Badge>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Thay đổi theo danh mục</h4>
                  <div className="space-y-2">
                    {((comparisonData as any).comparison.categoryChanges as any[]).slice(0, 10).map((cat: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded">
                        <span className="text-sm">{cat.category}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(cat.current)} → {formatCurrency(cat.previous)}
                          </span>
                          {cat.changePercentage > 0 ? (
                            <Badge variant="destructive" className="text-xs">
                              +{cat.changePercentage.toFixed(1)}%
                            </Badge>
                          ) : (
                            <Badge variant="default" className="bg-green-500 text-xs">
                              {cat.changePercentage.toFixed(1)}%
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Phân tích chi tiêu</h1>
          <p className="text-muted-foreground mt-1">
            Phân tích chi tiết chi tiêu theo thời gian với AI
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Ngày</SelectItem>
              <SelectItem value="week">Tuần</SelectItem>
              <SelectItem value="month">Tháng</SelectItem>
              <SelectItem value="quarter">Quý</SelectItem>
              <SelectItem value="year">Năm</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setCompareMode(true)}>
            <GitCompare className="h-4 w-4 mr-2" />
            So sánh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Đang tải...</div>
      ) : analysisData && typeof analysisData === 'object' && 'totalAmount' in analysisData ? (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Tổng chi tiêu</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency((analysisData as any).totalAmount || 0)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Số giao dịch</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(analysisData as any).categoryBreakdown?.reduce((sum: number, cat: any) => sum + (cat.count || 0), 0) || 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Dự báo tháng tới</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(analysisData as any).predictions ? formatCurrency((analysisData as any).predictions.nextMonth) : 'N/A'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Cảnh báo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(analysisData as any).anomalies?.length || 0}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Daily Chart */}
            {(analysisData as any).dailyStats && (analysisData as any).dailyStats.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Chi tiêu theo ngày (Click để xem chi tiết)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart
                      data={(analysisData as any).dailyStats}
                      onClick={(data: any) => handleChartClick(data, 'daily')}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis tickFormatter={(v) => (v / 1000000).toFixed(0) + 'M'} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke="hsl(var(--chart-1))"
                        fill="hsl(var(--chart-1))"
                        fillOpacity={0.6}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Weekly Chart */}
            {(analysisData as any).weeklyStats && (analysisData as any).weeklyStats.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Chi tiêu theo tuần (Click để xem chi tiết)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={(analysisData as any).weeklyStats}
                      onClick={(data: any) => handleChartClick(data, 'weekly')}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" />
                      <YAxis tickFormatter={(v) => (v / 1000000).toFixed(0) + 'M'} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="amount" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Monthly Chart */}
          {(analysisData as any).monthlyStats && (analysisData as any).monthlyStats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Chi tiêu theo tháng (Click để xem chi tiết)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart
                    data={(analysisData as any).monthlyStats}
                    onClick={(data: any) => handleChartClick(data, 'monthly')}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(v) => (v / 1000000).toFixed(0) + 'M'} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Category Breakdown */}
          {(analysisData as any).categoryBreakdown && (analysisData as any).categoryBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Chi tiêu theo danh mục (Click để xem chi tiết)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart onClick={(data: any) => handleChartClick(data, 'category')}>
                      <Pie
                        data={(analysisData as any).categoryBreakdown}
                        dataKey="amount"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                      >
                        {((analysisData as any).categoryBreakdown as any[]).map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={`hsl(${index * 360 / ((analysisData as any).categoryBreakdown.length || 1)}, 70%, 50%)`} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {((analysisData as any).categoryBreakdown as any[]).map((cat: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded">
                        <span>{cat.category}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{formatCurrency(cat.amount)}</span>
                          <Badge variant="secondary">{cat.percentage.toFixed(1)}%</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Insights */}
          {(analysisData as any).aiInsights && (
            <Card>
              <CardHeader>
                <CardTitle>Phân tích AI</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap">{(analysisData as any).aiInsights}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Anomalies */}
          {(analysisData as any).anomalies && (analysisData as any).anomalies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Chi tiêu bất thường
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {((analysisData as any).anomalies as any[]).map((anomaly: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <div>
                        <div className="font-medium">{formatDate(anomaly.date)}</div>
                        <div className="text-sm text-muted-foreground">{anomaly.reason}</div>
                      </div>
                      <div className="font-semibold text-orange-600">{formatCurrency(anomaly.amount)}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết chi tiêu</DialogTitle>
            <DialogDescription>
              Chi tiết giao dịch cho {detailData?.period}
            </DialogDescription>
          </DialogHeader>
          {detailData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">Tổng số tiền</div>
                  <div className="text-lg font-bold">{formatCurrency(detailData.summary?.totalAmount || 0)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Số giao dịch</div>
                  <div className="text-lg font-bold">{detailData.summary?.totalCount || 0}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Trung bình</div>
                  <div className="text-lg font-bold">
                    {formatCurrency(detailData.summary?.averageAmount || 0)}
                  </div>
                </div>
              </div>

              {detailData.summary?.categoryBreakdown && detailData.summary.categoryBreakdown.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Phân tích theo danh mục</h4>
                  <div className="space-y-1">
                    {detailData.summary.categoryBreakdown.map((cat: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded">
                        <span>{cat.category || 'Không rõ'}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{formatCurrency(cat.amount || 0)}</span>
                          <Badge variant="secondary">{cat.count || 0} giao dịch</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-semibold mb-2">Danh sách giao dịch</h4>
                {detailData.expenses && detailData.expenses.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {detailData.expenses.map((exp) => (
                      <div key={exp.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{exp.description || 'Không có mô tả'}</div>
                          <div className="text-sm text-muted-foreground">
                            {exp.date ? formatDate(new Date(exp.date).toISOString()) : 'N/A'} • {exp.category || 'Không rõ'}
                            {exp.userName && ` • ${exp.userName}`}
                          </div>
                        </div>
                        <div className="font-semibold">{formatCurrency(exp.amount || 0)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Không có giao dịch nào trong khoảng thời gian này</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Đang tải dữ liệu...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ComparisonCard({ title, data }: { title: string; data: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-2xl font-bold">
            {new Intl.NumberFormat('vi-VN', {
              style: 'currency',
              currency: 'VND'
            }).format(data.totalAmount)}
          </div>
          <div className="text-sm text-muted-foreground">
            {data.categoryBreakdown?.length || 0} danh mục
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

