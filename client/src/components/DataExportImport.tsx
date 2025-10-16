import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Upload, FileText, Calendar, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiService } from "@/lib/api";
import { FadeIn, SlideIn } from "@/components/ui/animations";

interface DataExportImportProps {
  onDataImported?: () => void;
}

export function DataExportImport({ onDataImported }: DataExportImportProps) {
  const { toast } = useToast();
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState("excel");
  const [exportPeriod, setExportPeriod] = useState("month");
  const [exportCategory, setExportCategory] = useState("all");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleExport = async () => {
    try {
      setIsProcessing(true);
      
      // Fetch data based on filters
      const expenses = await apiService.getExpenses(1000);
      
      if (exportFormat === "excel") {
        await exportToExcel(expenses.expenses || []);
      } else if (exportFormat === "csv") {
        await exportToCSV(expenses.expenses || []);
      } else if (exportFormat === "pdf") {
        await exportToPDF(expenses.expenses || []);
      }
      
      toast({
        title: "Xuất dữ liệu thành công",
        description: `Đã xuất dữ liệu chi tiêu ra file ${exportFormat.toUpperCase()}`
      });
      
      setIsExportOpen(false);
    } catch (error: any) {
      toast({
        title: "Lỗi xuất dữ liệu",
        description: error.message || "Không thể xuất dữ liệu",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn file để nhập",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsProcessing(true);
      
      const formData = new FormData();
      formData.append('file', importFile);
      
      // Call import API
      const response = await fetch('/api/expenses/import', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Import failed');
      }
      
      const result = await response.json();
      
      toast({
        title: "Nhập dữ liệu thành công",
        description: `Đã nhập ${result.count} chi tiêu từ file`
      });
      
      onDataImported?.();
      setIsImportOpen(false);
      setImportFile(null);
    } catch (error: any) {
      toast({
        title: "Lỗi nhập dữ liệu",
        description: error.message || "Không thể nhập dữ liệu",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const exportToExcel = async (data: any[]) => {
    // Create Excel file using SheetJS
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(data.map(expense => ({
      'Mô tả': expense.description,
      'Số tiền': parseFloat(expense.amount),
      'Danh mục': expense.category,
      'Ngày tạo': new Date(expense.createdAt).toLocaleDateString('vi-VN'),
      'Người tạo': expense.userId,
      'AI Confidence': expense.aiConfidence ? (parseFloat(expense.aiConfidence) * 100).toFixed(1) + '%' : 'N/A'
    })));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Chi tiêu');
    
    const fileName = `chi-tieu-gia-dinh-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const exportToCSV = async (data: any[]) => {
    const csvContent = [
      ['Mô tả', 'Số tiền', 'Danh mục', 'Ngày tạo', 'Người tạo', 'AI Confidence'],
      ...data.map(expense => [
        expense.description,
        parseFloat(expense.amount),
        expense.category,
        new Date(expense.createdAt).toLocaleDateString('vi-VN'),
        expense.userId,
        expense.aiConfidence ? (parseFloat(expense.aiConfidence) * 100).toFixed(1) + '%' : 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `chi-tieu-gia-dinh-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = async (data: any[]) => {
    // Create PDF using jsPDF
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text('Báo cáo chi tiêu gia đình', 14, 22);
    
    doc.setFontSize(12);
    doc.text(`Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`, 14, 30);
    doc.text(`Tổng số giao dịch: ${data.length}`, 14, 38);
    
    // Add simple table (without autoTable for now)
    let yPosition = 50;
    doc.setFontSize(10);
    
    // Headers
    doc.text('Mô tả', 14, yPosition);
    doc.text('Số tiền', 80, yPosition);
    doc.text('Danh mục', 120, yPosition);
    doc.text('Ngày', 160, yPosition);
    yPosition += 10;
    
    // Data rows
    data.slice(0, 20).forEach(expense => {
      if (yPosition > 280) return; // Page limit
      
      doc.text(expense.description.substring(0, 25), 14, yPosition);
      doc.text(parseFloat(expense.amount).toLocaleString('vi-VN'), 80, yPosition);
      doc.text(expense.category, 120, yPosition);
      doc.text(new Date(expense.createdAt).toLocaleDateString('vi-VN'), 160, yPosition);
      yPosition += 8;
    });
    
    const fileName = `chi-tieu-gia-dinh-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        {/* Export Dialog */}
        <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Xuất dữ liệu
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Xuất dữ liệu chi tiêu
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="format">Định dạng file</Label>
                <Select value={exportFormat} onValueChange={setExportFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                    <SelectItem value="csv">CSV (.csv)</SelectItem>
                    <SelectItem value="pdf">PDF (.pdf)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="period">Thời gian</Label>
                <Select value={exportPeriod} onValueChange={setExportPeriod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Tuần này</SelectItem>
                    <SelectItem value="month">Tháng này</SelectItem>
                    <SelectItem value="quarter">Quý này</SelectItem>
                    <SelectItem value="year">Năm này</SelectItem>
                    <SelectItem value="all">Tất cả</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="category">Danh mục</Label>
                <Select value={exportCategory} onValueChange={setExportCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả danh mục</SelectItem>
                    <SelectItem value="Ăn uống">Ăn uống</SelectItem>
                    <SelectItem value="Đám cưới">Đám cưới</SelectItem>
                    <SelectItem value="Học tập">Học tập</SelectItem>
                    <SelectItem value="Y tế">Y tế</SelectItem>
                    <SelectItem value="Giải trí">Giải trí</SelectItem>
                    <SelectItem value="Giao thông">Giao thông</SelectItem>
                    <SelectItem value="Quần áo">Quần áo</SelectItem>
                    <SelectItem value="Gia dụng">Gia dụng</SelectItem>
                    <SelectItem value="Đám ma">Đám ma</SelectItem>
                    <SelectItem value="Khác">Khác</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                onClick={handleExport} 
                disabled={isProcessing}
                className="w-full"
              >
                {isProcessing ? "Đang xuất..." : "Xuất dữ liệu"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Import Dialog */}
        <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Nhập dữ liệu
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Nhập dữ liệu chi tiêu
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file">Chọn file</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                />
                <p className="text-sm text-muted-foreground">
                  Hỗ trợ file CSV, Excel (.xlsx, .xls)
                </p>
              </div>
              
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Định dạng file yêu cầu:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Cột 1: Mô tả chi tiêu</li>
                  <li>• Cột 2: Số tiền (số)</li>
                  <li>• Cột 3: Danh mục (tùy chọn)</li>
                  <li>• Cột 4: Ngày (DD/MM/YYYY)</li>
                </ul>
              </div>
              
              <Button 
                onClick={handleImport} 
                disabled={!importFile || isProcessing}
                className="w-full"
              >
                {isProcessing ? "Đang nhập..." : "Nhập dữ liệu"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
