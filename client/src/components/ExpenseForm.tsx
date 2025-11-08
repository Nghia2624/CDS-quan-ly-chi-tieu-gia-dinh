import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PlusCircle, Sparkles, Edit3, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiService } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { FadeIn } from "@/components/ui/animations";

interface ExpenseFormProps {
  onSubmit?: (expense: {
    description: string;
    amount: number;
    category?: string;
  }) => void;
}

export function ExpenseForm({ onSubmit }: ExpenseFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null);
  const [manualCategory, setManualCategory] = useState<string>("");
  const [useManualCategory, setUseManualCategory] = useState(false);
  const [aiConfidence, setAiConfidence] = useState<number>(0);

  const categories = [
    "Ăn uống",
    "Đám cưới", 
    "Học tập",
    "Y tế",
    "Giải trí",
    "Giao thông",
    "Quần áo",
    "Gia dụng",
    "Đám ma",
    "Khác"
  ];

  // Quick amount suggestions - từ 50K đến 15M
  const quickAmounts = [
    { label: "50K", value: "50000" },
    { label: "100K", value: "100000" },
    { label: "200K", value: "200000" },
    { label: "500K", value: "500000" },
    { label: "1M", value: "1000000" },
    { label: "2M", value: "2000000" },
    { label: "3M", value: "3000000" },
    { label: "5M", value: "5000000" },
    { label: "7M", value: "7000000" },
    { label: "10M", value: "10000000" },
    { label: "15M", value: "15000000" }
  ];

  // Common descriptions for quick selection - tổng quan hơn
  const commonDescriptions = [
    "Mua thực phẩm cho gia đình",
    "Mừng cưới",
    "Học phí cho con",
    "Khám bệnh định kỳ",
    "Giải trí cuối tuần",
    "Đổ xăng xe máy",
    "Mua quần áo mới",
    "Mua đồ gia dụng",
    "Viếng tang",
    "Chi tiêu khác",
    "Mua thuốc men",
    "Đi du lịch",
    "Sửa chữa nhà cửa",
    "Mua sách vở",
    "Đi ăn nhà hàng"
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!description.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập mô tả chi tiêu",
        variant: "destructive"
      });
      return;
    }
    
    if (!amount || parseFloat(amount.replace(/,/g, '')) <= 0) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập số tiền hợp lệ",
        variant: "destructive"
      });
      return;
    }

    if (useManualCategory && !manualCategory) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn danh mục khi sử dụng chế độ thủ công",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      let finalCategory = "";
      let confidence = 0;

      if (useManualCategory) {
        // Use manual category
        finalCategory = manualCategory;
        confidence = 1.0;
      } else {
        // Use AI categorization - gọi API AI trước
        try {
          const aiResponse = await apiService.categorizeExpense({
            description: description.trim(),
            amount: parseFloat(amount.replace(/,/g, ''))
          }) as any;
          
          finalCategory = aiResponse.category || "Khác";
          confidence = aiResponse.confidence || 0.5;
          setSuggestedCategory(finalCategory);
          setAiConfidence(confidence);
        } catch (aiError) {
          console.warn('AI categorization failed, using fallback:', aiError);
          // Fallback to manual selection if AI fails
          toast({
            title: "AI không thể phân loại",
            description: "Vui lòng chọn danh mục thủ công",
            variant: "destructive"
          });
          setUseManualCategory(true);
          return; // Stop execution to let user select manually
        }
      }

      // Create expense with final category
      const expenseData = {
        description: description.trim(),
        amount: parseFloat(amount.replace(/,/g, '')),
        category: finalCategory,
        aiConfidence: confidence.toString()
      };

      await apiService.createExpense(expenseData);
      
      toast({
        title: "Thêm chi tiêu thành công",
        description: `Đã thêm chi tiêu "${description}" với số tiền ${formatCurrency(parseFloat(amount.replace(/,/g, '')))} vào danh mục "${finalCategory}"`
      });

      // Reset form
      setDescription("");
      setAmount("");
      setSuggestedCategory(null);
      setManualCategory("");
      setUseManualCategory(false);
      setAiConfidence(0);

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['family-members'] });

      onSubmit?.({
        description: description.trim(),
        amount: parseFloat(amount.replace(/,/g, '')),
        category: finalCategory,
      });
      
    } catch (error: any) {
      console.error('Error creating expense:', error);
      toast({
        title: "Lỗi",
        description: error.response?.data?.message || error.message || "Có lỗi xảy ra khi thêm chi tiêu",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? value.replace(/[^0-9]/g, '') : value.toString();
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  return (
    <FadeIn>
      <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:scale-[1.01]">
        <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50 border-b">
          <CardTitle className="flex items-center gap-2 text-xl">
            <PlusCircle className="h-6 w-6 text-green-600 animate-pulse" />
            Thêm chi tiêu mới
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="description">Mô tả chi tiêu</Label>
            <Textarea
              id="description"
              placeholder="Ví dụ: Đi đám cưới bạn A, mua sách cho con..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="input-expense-description"
              className="min-h-[80px]"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="amount">Số tiền (VNĐ)</Label>
            <Input
              id="amount"
              type="text"
              placeholder="500,000"
              value={formatCurrency(amount)}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="input-expense-amount"
            />
            
            {/* Quick amount selection */}
            <div className="space-y-3 mt-3">
              <div className="text-sm font-medium text-muted-foreground">Chọn nhanh mệnh giá:</div>
              
              {/* Quick amounts - từ 50K đến 15M */}
              <div className="grid grid-cols-5 gap-2">
                {quickAmounts.map((item) => (
                  <Button
                    key={item.value}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 hover:bg-green-50 hover:border-green-300 font-medium"
                    onClick={() => setAmount(item.value)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
              
              <div className="text-xs text-muted-foreground text-center">
                Hoặc nhập số tiền trực tiếp vào ô trên (từ 50K đến 15M)
              </div>
            </div>

            {/* Common descriptions */}
            <div className="space-y-3 mt-3">
              <div className="text-sm font-medium text-muted-foreground">Chọn nhanh mô tả (tổng quan):</div>
              <div className="grid grid-cols-3 gap-2">
                {commonDescriptions.map((desc) => (
                  <Button
                    key={desc}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 truncate hover:bg-blue-50 hover:border-blue-300 text-left font-medium"
                    onClick={() => setDescription(desc)}
                  >
                    {desc}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Category Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Chọn danh mục</Label>
              <div className="flex items-center gap-2">
                <Switch
                  id="manual-category"
                  checked={useManualCategory}
                  onCheckedChange={setUseManualCategory}
                />
                <Label htmlFor="manual-category" className="text-sm">
                  Chọn thủ công
                </Label>
              </div>
            </div>

            {useManualCategory ? (
              <div className="space-y-2">
                <Select value={manualCategory} onValueChange={setManualCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn danh mục chi tiêu" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  💡 Bạn có thể chọn danh mục thủ công nếu AI phân loại không chính xác
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">AI sẽ tự động phân loại</span>
                </div>
                {suggestedCategory && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" data-testid="badge-suggested-category">
                          {suggestedCategory}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Độ tin cậy: {Math.round(aiConfidence * 100)}%
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setUseManualCategory(true)}
                      className="text-xs"
                    >
                      <Edit3 className="h-3 w-3 mr-1" />
                      Sửa
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  🤖 AI sẽ phân tích mô tả và tự động chọn danh mục phù hợp nhất
                </p>
              </div>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700"
            disabled={isProcessing || !description.trim() || !amount || (useManualCategory && !manualCategory)}
            data-testid="button-submit-expense"
          >
            {isProcessing ? (
              <>
                <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                {useManualCategory ? "Đang thêm chi tiêu..." : "Đang xử lý với AI..."}
              </>
            ) : (
              <>
                <PlusCircle className="h-4 w-4 mr-2" />
                Thêm chi tiêu
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
    </FadeIn>
  );
}