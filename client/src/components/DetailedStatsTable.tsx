import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, SortAsc, SortDesc, Filter, Download, Eye, EyeOff, FileText, BarChart3, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiService } from "@/lib/api";
import { useDataSync } from "@/hooks/use-data-sync";
import { FadeIn } from "@/components/ui/animations";

interface Expense {
  id: string;
  description: string;
  amount: string;
  category: string;
  createdAt: string;
  aiConfidence?: string;
  userName?: string;
  userRole?: string;
}

type SortField = 'description' | 'amount' | 'category' | 'date';
type SortDirection = 'asc' | 'desc';

export function DetailedStatsTable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAI, setShowAI] = useState(true);
  const itemsPerPage = 10;
  let isRefreshing = false;
  let refreshAllData = () => {};
  let getSyncStatus = () => ({ isSynced: false });
  
  try {
    const dataSync = useDataSync();
    isRefreshing = dataSync.isRefreshing;
    refreshAllData = dataSync.refreshAllData;
    getSyncStatus = dataSync.getSyncStatus;
  } catch (error) {
    console.warn('useDataSync hook error:', error);
  }

  // Fetch expenses data - use same query key as DashboardPage
  const { data: expensesData, isLoading } = useQuery({
    queryKey: ['expenses', 'all'],
    queryFn: () => apiService.getExpenses(1000),
    staleTime: 30 * 1000, // 30 seconds - more aggressive refresh
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Always refetch on mount
    retry: 3, // Retry failed requests
    retryDelay: 1000, // 1 second between retries
  });

  const expenses: Expense[] = expensesData?.expenses || [];

  // Filter and sort expenses
  const filteredAndSortedExpenses = useMemo(() => {
    let filtered = expenses.filter(expense => {
      const matchesSearch = expense.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === "all" || expense.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'description':
          aValue = a.description.toLowerCase();
          bValue = b.description.toLowerCase();
          break;
        case 'amount':
          aValue = parseFloat(a.amount);
          bValue = parseFloat(b.amount);
          break;
        case 'category':
          aValue = a.category.toLowerCase();
          bValue = b.category.toLowerCase();
          break;
        case 'date':
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [expenses, searchTerm, selectedCategory, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedExpenses.length / itemsPerPage);
  const paginatedExpenses = filteredAndSortedExpenses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'Ăn uống': 'bg-orange-100 text-orange-800 border-orange-200',
      'Đám cưới': 'bg-pink-100 text-pink-800 border-pink-200',
      'Học tập': 'bg-blue-100 text-blue-800 border-blue-200',
      'Y tế': 'bg-red-100 text-red-800 border-red-200',
      'Giải trí': 'bg-purple-100 text-purple-800 border-purple-200',
      'Giao thông': 'bg-green-100 text-green-800 border-green-200',
      'Quần áo': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Gia dụng': 'bg-indigo-100 text-indigo-800 border-indigo-200',
      'Đám ma': 'bg-gray-100 text-gray-800 border-gray-200',
      'Khác': 'bg-slate-100 text-slate-800 border-slate-200'
    };
    return colors[category] || colors['Khác'];
  };

  const getAIConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAIConfidenceText = (confidence: number) => {
    if (confidence >= 0.8) return 'Cao';
    if (confidence >= 0.6) return 'Trung bình';
    return 'Thấp';
  };

  const categories = Array.from(new Set(expenses.map(exp => exp.category)));

  const handleExport = () => {
    // Proper CSV escaping function
    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      // If contains comma, quote, or newline, wrap in quotes and escape quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    
    const headers = ['Mô tả', 'Số tiền (VNĐ)', 'Danh mục', 'Ngày', 'Người chi tiêu', 'Loại', 'AI Confidence'];
    const csvRows = [
      headers.map(escapeCSV).join(','),
      ...filteredAndSortedExpenses.map(expense => {
        const isChildExpense = !!(expense as any).childId;
        const amount = expense.amount ? parseFloat(expense.amount) : 0;
        const amountStr = isNaN(amount) ? '0' : String(amount);
        return [
          escapeCSV(expense.description || ''),
          escapeCSV(amountStr),
          escapeCSV(expense.category || ''),
          escapeCSV(formatDate(expense.createdAt)),
          escapeCSV((expense as any).userName || 'N/A'),
          escapeCSV(isChildExpense ? 'Chi tiêu của con' : 'Chi tiêu của bố mẹ'),
          escapeCSV(expense.aiConfidence ? `${(parseFloat(expense.aiConfidence) * 100).toFixed(0)}%` : 'N/A')
        ].join(',');
      })
    ];
    
    // Add BOM for UTF-8 to ensure Excel displays Vietnamese correctly
    const BOM = '\uFEFF';
    const csvContent = BOM + csvRows.join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `expenses_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <FadeIn>
      <Card className="bg-card/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/50 dark:to-purple-950/50 border-b">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Bảng thống kê chi tiết
              <Badge variant="secondary" className="ml-2">
                {filteredAndSortedExpenses.length} giao dịch
              </Badge>
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshAllData}
                disabled={isRefreshing}
                className="flex items-center gap-2 bg-white hover:bg-gray-50"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Đang đồng bộ...' : 'Làm mới'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="flex items-center gap-2 bg-white hover:bg-gray-50"
              >
                <Download className="h-4 w-4" />
                Xuất CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Filters */}
          <div className="p-4 bg-muted/50 border-b">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Tìm kiếm theo mô tả..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-background border-border focus:border-primary"
                  />
                </div>
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-48 bg-background border-border">
                  <SelectValue placeholder="Chọn danh mục" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả danh mục</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAI(!showAI)}
                className="w-full sm:w-auto bg-white border-gray-200 hover:bg-gray-50"
              >
                {showAI ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {showAI ? 'Ẩn AI' : 'Hiện AI'}
              </Button>
            </div>
          </div>

          {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full" style={{tableLayout: 'fixed'}}>
              <thead className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/50 dark:to-purple-950/50 sticky top-0 z-10">
                <tr>
                  <th 
                    className="cursor-pointer hover:bg-blue-100/50 dark:hover:bg-blue-900/50 transition-colors font-bold text-foreground text-left py-4 px-4 border-b border-border"
                    style={{width: showAI ? '30%' : '35%'}}
                    onClick={() => handleSort('description')}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">Mô tả</span>
                      {sortField === 'description' && (
                        sortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="cursor-pointer hover:bg-blue-100/50 dark:hover:bg-blue-900/50 transition-colors font-bold text-foreground text-right py-4 px-4 border-b border-border"
                    style={{width: showAI ? '15%' : '17%'}}
                    onClick={() => handleSort('amount')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-sm font-semibold">Số tiền</span>
                      {sortField === 'amount' && (
                        sortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="cursor-pointer hover:bg-blue-100/50 dark:hover:bg-blue-900/50 transition-colors font-bold text-foreground text-center py-4 px-4 border-b border-border"
                    style={{width: showAI ? '15%' : '17%'}}
                    onClick={() => handleSort('category')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm font-semibold">Danh mục</span>
                      {sortField === 'category' && (
                        sortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="cursor-pointer hover:bg-blue-100/50 dark:hover:bg-blue-900/50 transition-colors font-bold text-foreground text-center py-4 px-4 border-b border-border"
                    style={{width: showAI ? '15%' : '17%'}}
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm font-semibold">Ngày</span>
                      {sortField === 'date' && (
                        sortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="font-bold text-foreground text-center py-4 px-4 border-b border-border"
                    style={{width: showAI ? '15%' : '17%'}}
                  >
                    <span className="text-sm font-semibold">Người chi tiêu</span>
                  </th>
                  {showAI && (
                    <th 
                      className="font-bold text-foreground text-center py-4 px-4 border-b border-border"
                      style={{width: '10%'}}
                    >
                      <span className="text-sm font-semibold">AI Confidence</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {paginatedExpenses.map((expense, index) => (
                  <tr 
                    key={expense.id || index} 
                    className="hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-purple-50/30 dark:hover:from-blue-950/30 dark:hover:to-purple-950/30 transition-all duration-200 border-b border-border group"
                  >
                    <td 
                      className="py-4 px-4 align-middle text-left"
                      style={{width: showAI ? '30%' : '35%'}}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 group-hover:bg-blue-600 transition-colors"></div>
                        <div className="font-medium text-foreground truncate">
                          {expense.description}
                        </div>
                      </div>
                    </td>
                    <td 
                      className="py-4 px-4 text-right align-middle"
                      style={{width: showAI ? '15%' : '17%'}}
                    >
                      <div className="font-bold text-green-600 whitespace-nowrap">
                        {formatCurrency(parseFloat(expense.amount))}
                      </div>
                    </td>
                    <td 
                      className="py-4 px-4 text-center align-middle"
                      style={{width: showAI ? '15%' : '17%'}}
                    >
                      <Badge 
                        className={`${getCategoryColor(expense.category)} text-xs px-3 py-1 font-medium rounded-full whitespace-nowrap`}
                        variant="secondary"
                      >
                        {expense.category}
                      </Badge>
                    </td>
                    <td 
                      className="py-4 px-4 text-center align-middle"
                      style={{width: showAI ? '15%' : '17%'}}
                    >
                      <div className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                        {formatDate(expense.createdAt)}
                      </div>
                    </td>
                    <td 
                      className="py-4 px-4 text-center align-middle"
                      style={{width: showAI ? '15%' : '17%'}}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-base flex-shrink-0">
                          {(expense as any).userRole === 'father' ? '👨' : (expense as any).userRole === 'mother' ? '👩' : '👤'}
                        </div>
                        <div className="text-center min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">
                            {(expense as any).userName || 'N/A'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {(expense as any).userRole === 'father' ? 'Bố' : (expense as any).userRole === 'mother' ? 'Mẹ' : 'TV'}
                          </div>
                        </div>
                      </div>
                    </td>
                    {showAI && (
                      <td 
                        className="py-4 px-4 text-center align-middle"
                        style={{width: '10%'}}
                      >
                        {expense.aiConfidence ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-xs font-semibold ${getAIConfidenceColor(parseFloat(expense.aiConfidence))}`}>
                              {getAIConfidenceText(parseFloat(expense.aiConfidence))}
                            </span>
                            <span className="text-xs text-muted-foreground font-medium">
                              {(parseFloat(expense.aiConfidence) * 100).toFixed(0)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs font-medium">N/A</span>
                        )}
                      </td>
                    )}
                  </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t bg-gray-50/50">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-muted-foreground">
                  Hiển thị {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredAndSortedExpenses.length)} trong {filteredAndSortedExpenses.length} giao dịch
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="bg-white hover:bg-gray-50"
                  >
                    Trước
                  </Button>
                  <span className="flex items-center px-3 py-1 text-sm bg-white rounded border">
                    Trang {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="bg-white hover:bg-gray-50"
                  >
                    Sau
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  );
}