import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Sparkles } from "lucide-react";

interface ExpenseFormProps {
  onSubmit?: (expense: {
    description: string;
    amount: number;
    category?: string;
  }) => void;
}

export function ExpenseForm({ onSubmit }: ExpenseFormProps) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null);

  // todo: remove mock functionality
  const mockCategories = ["Ăn uống", "Đám cưới", "Học tập", "Y tế", "Giải trí"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount) return;

    setIsProcessing(true);
    
    // todo: remove mock functionality - simulate AI processing
    setTimeout(() => {
      const randomCategory = mockCategories[Math.floor(Math.random() * mockCategories.length)];
      setSuggestedCategory(randomCategory);
      setIsProcessing(false);
      
      onSubmit?.({
        description: description.trim(),
        amount: parseFloat(amount),
        category: randomCategory,
      });
      
      console.log('Expense submitted:', { description, amount: parseFloat(amount), category: randomCategory });
    }, 1500);
  };

  const formatCurrency = (value: string) => {
    const num = value.replace(/[^0-9]/g, '');
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlusCircle className="h-5 w-5" />
          Thêm chi tiêu mới
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          </div>

          {suggestedCategory && (
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">AI đã phân loại:</span>
              <Badge variant="secondary" data-testid="badge-suggested-category">
                {suggestedCategory}
              </Badge>
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full"
            disabled={isProcessing || !description.trim() || !amount}
            data-testid="button-submit-expense"
          >
            {isProcessing ? (
              <>
                <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                Đang xử lý với AI...
              </>
            ) : (
              "Thêm chi tiêu"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}