import { Home, Plus, MessageCircle, BarChart3, Settings, Users, LogOut, Eye, TrendingUp, Target } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { authService } from "@/lib/auth";
import { apiService } from "@/lib/api";
import { useState, useEffect } from "react";

const menuItems = [
  {
    title: "Tổng quan",
    url: "/",
    icon: Home,
  },
  {
    title: "Thêm chi tiêu",
    url: "/add-expense",
    icon: Plus,
  },
  {
    title: "Phân tích",
    url: "/analysis",
    icon: TrendingUp,
  },
  {
    title: "Mục tiêu tiết kiệm",
    url: "/savings-goals",
    icon: Target,
  },
  {
    title: "Chat AI",
    url: "/chat",
    icon: MessageCircle,
  },
  {
    title: "Thống kê",
    url: "/stats",
    icon: BarChart3,
  },
  {
    title: "Gia đình",
    url: "/family",
    icon: Users,
  },
  {
    title: "Cài đặt",
    url: "/settings",
    icon: Settings,
  },
];

interface AppSidebarProps {
  statsData?: any;
}

export function AppSidebar({ statsData }: AppSidebarProps = {}) {
  const [location] = useLocation();
  const user = authService.getUser();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    const loadExpenses = async () => {
      try {
        const response = await apiService.getExpenses(100);
        setExpenses(response.expenses || []);
      } catch (error) {
        console.error('Error loading expenses:', error);
      }
    };
    loadExpenses();
  }, []);

  const handleLogout = () => {
    authService.clearAuth();
    window.location.reload(); // Refresh to show login page
  };

  const getCategoryStats = () => {
    const stats: { [key: string]: { count: number; total: number; color: string } } = {};
    
    // Use data from API stats if available (more accurate)
    if (statsData?.categoryStats && Array.isArray(statsData.categoryStats)) {
      statsData.categoryStats.forEach((cat: any) => {
        stats[cat.category] = {
          count: cat.count || 0,
          total: cat.amount || 0,
          color: getCategoryColor(cat.category)
        };
      });
      return stats;
    }
    
    // Fallback: Initialize all 9 categories with 0 values
    const allCategories = ['Ăn uống', 'Đám cưới', 'Học tập', 'Y tế', 'Giải trí', 'Giao thông', 'Quần áo', 'Gia dụng', 'Đám ma'];
    allCategories.forEach(category => {
      stats[category] = { count: 0, total: 0, color: getCategoryColor(category) };
    });
    
    // Add 'Khác' category
    stats['Khác'] = { count: 0, total: 0, color: getCategoryColor('Khác') };
    
    // Process actual expenses (fallback method)
    expenses.forEach(expense => {
      const category = expense.category || 'Khác';
      if (stats[category]) {
        stats[category].count++;
        stats[category].total += parseFloat(expense.amount);
      }
    });
    
    // Filter out categories with 0 expenses for display
    const filteredStats: { [key: string]: { count: number; total: number; color: string } } = {};
    Object.entries(stats).forEach(([category, data]) => {
      if (data.count > 0) {
        filteredStats[category] = data;
      }
    });
    
    return filteredStats;
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'Ăn uống': 'bg-blue-500',
      'Đám cưới': 'bg-green-500', 
      'Học tập': 'bg-orange-500',
      'Y tế': 'bg-purple-500',
      'Giải trí': 'bg-pink-500',
      'Giao thông': 'bg-yellow-500',
      'Quần áo': 'bg-indigo-500',
      'Gia dụng': 'bg-red-500',
      'Đám ma': 'bg-gray-600',
      'Khác': 'bg-gray-500'
    };
    return colors[category] || 'bg-gray-500';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category);
    setIsDialogOpen(true);
  };

  const getCategoryExpenses = (category: string) => {
    return expenses.filter(expense => expense.category === category);
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h1 className="font-semibold text-sm">Quản lý Chi tiêu Nghĩa</h1>
            <p className="text-xs text-muted-foreground">
              Gia đình Nghĩa
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu chính</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Danh mục chi tiêu</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-3 py-2 space-y-2">
              {Object.entries(getCategoryStats()).map(([category, stats]) => (
                <div 
                  key={category} 
                  className="flex items-center justify-between text-xs hover:bg-muted p-2 rounded cursor-pointer transition-colors"
                  onClick={() => handleCategoryClick(category)}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${stats.color}`} />
                    <span>{category}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {stats.count}
                    </Badge>
                    <Eye className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-3 py-2 space-y-2">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">
                {user?.fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user?.fullName || 'User'}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role || 'member'}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout}
            className="w-full justify-start text-xs"
            data-testid="button-logout"
          >
            <LogOut className="h-3 w-3 mr-2" />
            Đăng xuất
          </Button>
        </div>
      </SidebarFooter>

      {/* Category Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${selectedCategory ? getCategoryColor(selectedCategory) : ''}`} />
              Chi tiết danh mục: {selectedCategory}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4">
              {selectedCategory && getCategoryExpenses(selectedCategory).map((expense, index) => (
                <Card key={expense.id || index}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{expense.description}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {expense.createdAt ? new Date(expense.createdAt).toLocaleDateString('vi-VN') : 'Không xác định'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">{formatCurrency(parseFloat(expense.amount))}</p>
                        {expense.aiConfidence && (
                          <p className="text-xs text-muted-foreground">
                            AI: {(parseFloat(expense.aiConfidence) * 100).toFixed(0)}%
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {selectedCategory && getCategoryExpenses(selectedCategory).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Không có chi tiêu nào trong danh mục này</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}