import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiService } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Target, TrendingUp, AlertCircle, CheckCircle2, Plus, Edit, Trash2, Lightbulb, TrendingDown } from "lucide-react";

interface SavingsGoal {
  id: string;
  title: string;
  description?: string;
  targetAmount: string;
  currentAmount: string;
  targetDate?: string;
  category?: string;
  priority?: string;
  status: string;
  progress?: {
    percentage: number;
    remaining: number;
    daysRemaining: number;
    monthlyRequired: number;
    onTrack: boolean;
  };
}

export function SavingsGoalsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    targetAmount: "",
    targetDate: "",
    category: "",
    priority: "medium",
  });

  // Fetch goals (OPTIMIZED with better caching)
  const { data: goalsData, isLoading } = useQuery({
    queryKey: ['savings-goals'],
    queryFn: () => apiService.getSavingsGoals(),
    staleTime: 5 * 60 * 1000, // 5 minutes - data is fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache for 30 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on component mount if data exists
  });

  const goals = goalsData?.goals || [];

  // Create goal mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => apiService.createSavingsGoal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings-goals'] });
      setIsCreateOpen(false);
      setFormData({
        title: "",
        description: "",
        targetAmount: "",
        targetDate: "",
        category: "",
        priority: "medium",
      });
      toast({ title: "Thành công", description: "Đã tạo mục tiêu tiết kiệm" });
    },
    onError: (error: any) => {
      toast({ title: "Lỗi", description: error.message || "Không thể tạo mục tiêu", variant: "destructive" });
    },
  });

  // Update goal mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiService.updateSavingsGoal(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings-goals'] });
      setEditingGoal(null);
      toast({ title: "Thành công", description: "Đã cập nhật mục tiêu" });
    },
    onError: (error: any) => {
      toast({ title: "Lỗi", description: error.message || "Không thể cập nhật", variant: "destructive" });
    },
  });

  // Delete goal mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteSavingsGoal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings-goals'] });
      toast({ title: "Thành công", description: "Đã xóa mục tiêu" });
    },
    onError: (error: any) => {
      toast({ title: "Lỗi", description: error.message || "Không thể xóa", variant: "destructive" });
    },
  });

  // Fetch progress for a goal
  const fetchProgress = async (goalId: string) => {
    try {
      const progress = await apiService.getSavingsGoalProgress(goalId);
      return progress;
    } catch (error) {
      console.error('Error fetching progress:', error);
      return null;
    }
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.targetAmount) {
      toast({ title: "Lỗi", description: "Vui lòng điền đầy đủ thông tin", variant: "destructive" });
      return;
    }

    const data = {
      title: formData.title,
      description: formData.description,
      targetAmount: parseFloat(formData.targetAmount),
      targetDate: formData.targetDate || undefined,
      category: formData.category || undefined,
      priority: formData.priority,
    };

    if (editingGoal) {
      updateMutation.mutate({ id: editingGoal.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (goal: SavingsGoal) => {
    if (window.confirm(`Bạn có chắc muốn xóa mục tiêu "${goal.title}"?`)) {
      deleteMutation.mutate(goal.id);
    }
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(num);
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'xe': return '🚗';
      case 'học phí': return '📚';
      case 'nhà cửa': return '🏠';
      case 'du lịch': return '✈️';
      case 'khẩn cấp': return '🚨';
      default: return '💰';
    }
  };

  const activeGoals = goals.filter(g => g.status === 'active');
  const completedGoals = goals.filter(g => g.status === 'completed');

  // Check if user is child (read-only)
  const isReadOnly = user?.role === 'child';

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mục tiêu tiết kiệm</h1>
          <p className="text-muted-foreground mt-1">
            Quản lý và theo dõi các mục tiêu tài chính của gia đình
          </p>
        </div>
        {!isReadOnly && (
          <Dialog open={isCreateOpen || !!editingGoal} onOpenChange={(open) => {
            if (!open) {
              setIsCreateOpen(false);
              setEditingGoal(null);
              setFormData({
                title: "",
                description: "",
                targetAmount: "",
                targetDate: "",
                category: "",
                priority: "medium",
              });
            }
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Tạo mục tiêu mới
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{editingGoal ? 'Chỉnh sửa mục tiêu' : 'Tạo mục tiêu tiết kiệm mới'}</DialogTitle>
                <DialogDescription>
                  Đặt mục tiêu tiết kiệm cho gia đình. AI sẽ giúp bạn theo dõi tiến độ và đưa ra gợi ý.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Tiêu đề *</Label>
                  <Input
                    id="title"
                    placeholder="Ví dụ: Mua xe mới, Học phí con..."
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Mô tả</Label>
                  <Input
                    id="description"
                    placeholder="Mô tả chi tiết về mục tiêu..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="targetAmount">Số tiền mục tiêu (VNĐ) *</Label>
                    <Input
                      id="targetAmount"
                      type="number"
                      placeholder="50000000"
                      value={formData.targetAmount}
                      onChange={(e) => setFormData({ ...formData, targetAmount: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="targetDate">Ngày mục tiêu</Label>
                    <Input
                      id="targetDate"
                      type="date"
                      value={formData.targetDate}
                      onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Danh mục</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn danh mục" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="xe">🚗 Xe</SelectItem>
                        <SelectItem value="học phí">📚 Học phí</SelectItem>
                        <SelectItem value="nhà cửa">🏠 Nhà cửa</SelectItem>
                        <SelectItem value="du lịch">✈️ Du lịch</SelectItem>
                        <SelectItem value="khẩn cấp">🚨 Khẩn cấp</SelectItem>
                        <SelectItem value="khác">💰 Khác</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Ưu tiên</Label>
                    <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">Cao</SelectItem>
                        <SelectItem value="medium">Trung bình</SelectItem>
                        <SelectItem value="low">Thấp</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setIsCreateOpen(false);
                  setEditingGoal(null);
                }}>
                  Hủy
                </Button>
                <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingGoal ? 'Cập nhật' : 'Tạo mục tiêu'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12">Đang tải...</div>
      ) : goals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Chưa có mục tiêu tiết kiệm</h3>
            <p className="text-muted-foreground mb-4">
              Tạo mục tiêu đầu tiên để bắt đầu quản lý tài chính hiệu quả hơn
            </p>
            {!isReadOnly && (
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Tạo mục tiêu mới
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active">
              Đang thực hiện ({activeGoals.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Hoàn thành ({completedGoals.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeGoals.map((goal) => {
                const currentAmount = parseFloat(goal.currentAmount || '0');
                const targetAmount = parseFloat(goal.targetAmount || '0');
                const percentage = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;
                const remaining = targetAmount - currentAmount;
                const progress = goal.progress || {
                  percentage,
                  remaining,
                  daysRemaining: 0,
                  monthlyRequired: 0,
                  onTrack: true,
                };

                return (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    progress={progress}
                    onEdit={!isReadOnly ? () => {
                      setEditingGoal(goal);
                      setFormData({
                        title: goal.title,
                        description: goal.description || "",
                        targetAmount: goal.targetAmount,
                        targetDate: goal.targetDate ? new Date(goal.targetDate).toISOString().split('T')[0] : "",
                        category: goal.category || "",
                        priority: goal.priority || "medium",
                      });
                    } : undefined}
                    onDelete={!isReadOnly ? () => handleDelete(goal) : undefined}
                    onUpdateAmount={!isReadOnly ? async (newAmount: number) => {
                      await updateMutation.mutateAsync({
                        id: goal.id,
                        data: { currentAmount: newAmount },
                      });
                    } : undefined}
                  />
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {completedGoals.map((goal) => {
                const currentAmount = parseFloat(goal.currentAmount || '0');
                const targetAmount = parseFloat(goal.targetAmount || '0');
                const percentage = 100;

                return (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    progress={{
                      percentage,
                      remaining: 0,
                      daysRemaining: 0,
                      monthlyRequired: 0,
                      onTrack: true,
                    }}
                    isCompleted
                    onDelete={!isReadOnly ? () => handleDelete(goal) : undefined}
                  />
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

interface GoalCardProps {
  goal: SavingsGoal;
  progress: {
    percentage: number;
    remaining: number;
    daysRemaining: number;
    monthlyRequired: number;
    onTrack: boolean;
  };
  isCompleted?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onUpdateAmount?: (amount: number) => Promise<void>;
}

function GoalCard({ goal, progress, isCompleted, onEdit, onDelete, onUpdateAmount }: GoalCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const { toast } = useToast();

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(num);
  };

  const loadAIAnalysis = async () => {
    if (showDetails && !aiAnalysis) {
      setIsLoadingAnalysis(true);
      try {
        const analysis = await apiService.getSavingsGoalProgress(goal.id);
        setAiAnalysis(analysis);
      } catch (error) {
        console.error('Error loading AI analysis:', error);
      } finally {
        setIsLoadingAnalysis(false);
      }
    }
  };

  useEffect(() => {
    if (showDetails) {
      loadAIAnalysis();
    }
  }, [showDetails]);

  const currentAmount = parseFloat(goal.currentAmount || '0');
  const targetAmount = parseFloat(goal.targetAmount || '0');

  return (
    <Card className={`hover:shadow-lg transition-shadow ${isCompleted ? 'opacity-75' : ''}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{goal.category === 'xe' ? '🚗' : goal.category === 'học phí' ? '📚' : goal.category === 'nhà cửa' ? '🏠' : goal.category === 'du lịch' ? '✈️' : goal.category === 'khẩn cấp' ? '🚨' : '💰'}</span>
              <CardTitle className="text-lg">{goal.title}</CardTitle>
            </div>
            {goal.description && (
              <CardDescription className="line-clamp-2">{goal.description}</CardDescription>
            )}
          </div>
          <div className="flex gap-1">
            {onEdit && (
              <Button variant="ghost" size="sm" onClick={onEdit}>
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button variant="ghost" size="sm" onClick={onDelete}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Tiến độ</span>
            <span className="font-semibold">{Math.round(progress.percentage)}%</span>
          </div>
          <Progress value={progress.percentage} className="h-3" />
          <div className="flex justify-between text-sm mt-2">
            <span>{formatCurrency(currentAmount)}</span>
            <span className="text-muted-foreground">{formatCurrency(targetAmount)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-muted-foreground">Còn lại</div>
            <div className="font-semibold">{formatCurrency(progress.remaining)}</div>
          </div>
          {progress.daysRemaining > 0 && (
            <div>
              <div className="text-muted-foreground">Còn lại</div>
              <div className="font-semibold">{progress.daysRemaining} ngày</div>
            </div>
          )}
        </div>

        {progress.monthlyRequired > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="text-sm">Cần tiết kiệm</AlertTitle>
            <AlertDescription className="text-sm">
              {formatCurrency(progress.monthlyRequired)}/tháng để đạt mục tiêu
            </AlertDescription>
          </Alert>
        )}

        {!progress.onTrack && (
          <Alert variant="destructive">
            <TrendingDown className="h-4 w-4" />
            <AlertTitle className="text-sm">Chậm tiến độ</AlertTitle>
            <AlertDescription className="text-sm">
              Cần tăng tốc độ tiết kiệm để đạt mục tiêu đúng hạn
            </AlertDescription>
          </Alert>
        )}

        {isCompleted && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-sm text-green-800">Đã hoàn thành!</AlertTitle>
            <AlertDescription className="text-sm text-green-700">
              Chúc mừng bạn đã đạt được mục tiêu này!
            </AlertDescription>
          </Alert>
        )}

        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full" size="sm">
              <Lightbulb className="h-4 w-4 mr-2" />
              Xem phân tích AI
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Phân tích AI: {goal.title}</DialogTitle>
              <DialogDescription>
                Phân tích chi tiết và gợi ý từ AI để đạt mục tiêu
              </DialogDescription>
            </DialogHeader>
            {isLoadingAnalysis ? (
              <div className="text-center py-8">Đang phân tích...</div>
            ) : aiAnalysis?.aiAnalysis ? (
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Phân tích</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {aiAnalysis.aiAnalysis.insights}
                  </p>
                </div>
                {aiAnalysis.aiAnalysis.recommendations?.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Gợi ý</h4>
                    <ul className="space-y-1 text-sm">
                      {aiAnalysis.aiAnalysis.recommendations.map((rec: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-blue-500 mt-1">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiAnalysis.aiAnalysis.riskFactors?.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 text-red-600">Rủi ro</h4>
                    <ul className="space-y-1 text-sm">
                      {aiAnalysis.aiAnalysis.riskFactors.map((risk: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-red-500 mt-1">⚠</span>
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Không thể tải phân tích AI
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

