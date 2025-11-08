import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/lib/auth";
import { apiService } from "@/lib/api";
import { Settings, User, Bell, Shield, Database, Trash2, Save, Download, Upload, RefreshCw, AlertTriangle, Key, Eye, EyeOff, Lock } from "lucide-react";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import { useDataSync } from "@/hooks/use-data-sync";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";

export default function SettingsPage() {
  const { toast } = useToast();
  const user = authService.getUser();
  const { isRefreshing, refreshAllData, getSyncStatus } = useDataSync();
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    notifications: true,
    aiCategorization: true,
    monthlyBudget: 25000000,
    currency: 'VND',
    language: 'vi',
    theme: 'system',
    autoBackup: true,
    dataRetention: '12',
    privacyMode: false
  });

  // Fetch data with React Query for better sync
  const { data: familyMembers = [], isLoading: familyLoading } = useQuery({
    queryKey: ['family-members'],
    queryFn: () => apiService.getFamilyMembers(),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 3,
    retryDelay: 1000,
  });

  const { data: expenseStats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => apiService.getStats(),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 3,
    retryDelay: 1000,
  });
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  // Data is now fetched via React Query automatically

  // Data is now fetched via React Query - no need for manual loading

  const handleSaveSettings = async () => {
    setIsLoading(true);
    try {
      // Update user settings
      await apiService.updateUser({
        fullName: settings.fullName,
        email: settings.email,
        monthlyBudget: settings.monthlyBudget
      });
      toast({ title: "Cài đặt đã được lưu thành công" });
    } catch (error) {
      toast({ title: "Lỗi", description: "Không thể lưu cài đặt", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa tài khoản? Hành động này không thể hoàn tác.")) {
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        authService.clearAuth();
        window.location.reload();
      } catch (error) {
        toast({ title: "Lỗi", description: "Không thể xóa tài khoản", variant: "destructive" });
      }
    }
  };

  const handleExportData = async () => {
    try {
      const expenses = await apiService.getExpenses(1000);
      const familyMembers = await apiService.getFamilyMembers();
      
      // Create CSV format
      const escapeCSV = (value: any): string => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      
      // Export expenses as CSV
      const headers = ['Mô tả', 'Số tiền (VNĐ)', 'Danh mục', 'Ngày tạo', 'Người chi tiêu', 'Loại'];
      const csvRows = [
        headers.map(escapeCSV).join(','),
        ...(expenses.expenses || []).map((expense: any) => {
          const targetUserId = expense.childId || expense.userId;
          const targetUser = familyMembers.members.find((m: any) => m.id === targetUserId);
          const userName = targetUser ? targetUser.fullName : 'Unknown';
          const isChildExpense = !!expense.childId;
          
          return [
            escapeCSV(expense.description),
            escapeCSV(String(parseFloat(expense.amount || 0))),
            escapeCSV(expense.category || ''),
            escapeCSV(new Date(expense.createdAt).toLocaleDateString('vi-VN')),
            escapeCSV(userName),
            escapeCSV(isChildExpense ? 'Chi tiêu của con' : 'Chi tiêu của bố mẹ')
          ].join(',');
        })
      ];
      
      // Add BOM for UTF-8
      const BOM = '\uFEFF';
      const csvContent = BOM + csvRows.join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `financeflow-backup-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({ title: "Đã xuất dữ liệu thành công", description: "File CSV đã được tải về" });
    } catch (error) {
      toast({ title: "Lỗi", description: "Không thể xuất dữ liệu", variant: "destructive" });
    }
  };

  const handleRefreshData = async () => {
    setIsLoading(true);
    try {
      await refreshAllData();
      toast({ title: "Đã cập nhật dữ liệu" });
    } catch (error) {
      toast({ title: "Lỗi", description: "Không thể cập nhật dữ liệu", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({ title: "Lỗi", description: "Mật khẩu mới không khớp", variant: "destructive" });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({ title: "Lỗi", description: "Mật khẩu mới phải có ít nhất 6 ký tự", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({ title: "Đã thay đổi mật khẩu thành công" });
      setShowPasswordDialog(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      toast({ title: "Lỗi", description: "Không thể thay đổi mật khẩu", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <FadeIn delay={0.1}>
        <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:scale-[1.01]">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg animate-pulse">
                  <Settings className="h-6 w-6 text-white" />
                </div>
      <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                    Cài đặt
                  </h1>
                  <p className="text-muted-foreground">
                    Quản lý tài khoản và cài đặt ứng dụng
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshData}
                disabled={isLoading || isRefreshing}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading || isRefreshing ? 'animate-spin' : ''}`} />
                {isLoading || isRefreshing ? 'Đang đồng bộ...' : 'Làm mới'}
              </Button>
      </div>
          </CardContent>
        </Card>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Settings */}
        <FadeIn delay={0.2}>
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b">
            <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
              Thông tin cá nhân
            </CardTitle>
            <CardDescription>Cập nhật thông tin tài khoản của bạn</CardDescription>
          </CardHeader>
            <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <Label>Họ và tên</Label>
                <Input value={user?.fullName || ''} disabled className="bg-gray-50" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
                <Input value={user?.email || ''} disabled className="bg-gray-50" />
            </div>
            <div className="space-y-2">
              <Label>Vai trò</Label>
                <Input value={user?.role === 'father' ? 'Bố' : user?.role === 'mother' ? 'Mẹ' : user?.role || ''} disabled className="bg-gray-50" />
            </div>
            <div className="space-y-2">
              <Label>ID Gia đình</Label>
                <Input value={user?.familyId || ''} disabled className="bg-gray-50" />
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label>Bảo mật</Label>
                <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <Key className="h-4 w-4 mr-2" />
                      Thay đổi mật khẩu
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Thay đổi mật khẩu</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="current-password">Mật khẩu hiện tại</Label>
                        <div className="relative">
                          <Input
                            id="current-password"
                            type={showPasswords.current ? "text" : "password"}
                            value={passwordData.currentPassword}
                            onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                          >
                            {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="new-password">Mật khẩu mới</Label>
                        <div className="relative">
                          <Input
                            id="new-password"
                            type={showPasswords.new ? "text" : "password"}
                            value={passwordData.newPassword}
                            onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                          >
                            {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password">Xác nhận mật khẩu mới</Label>
                        <div className="relative">
                          <Input
                            id="confirm-password"
                            type={showPasswords.confirm ? "text" : "password"}
                            value={passwordData.confirmPassword}
                            onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                          >
                            {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 pt-4">
                        <Button 
                          onClick={handleChangePassword}
                          disabled={isLoading || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                          className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                        >
                          {isLoading ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Đang thay đổi...
                            </>
                          ) : (
                            "Thay đổi mật khẩu"
                          )}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => setShowPasswordDialog(false)}
                          className="flex-1"
                        >
                          Hủy
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
            </div>
          </CardContent>
        </Card>
        </FadeIn>

        {/* Family Members */}
        <FadeIn delay={0.3}>
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50 border-b">
            <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-green-600" />
              Thành viên gia đình
            </CardTitle>
            <CardDescription>Quản lý các thành viên trong gia đình</CardDescription>
          </CardHeader>
            <CardContent className="p-6">
            <div className="space-y-3">
                {familyMembers && (familyMembers as any).members && (familyMembers as any).members.length > 0 ? (
                  (familyMembers as any).members.map((member: any, index: number) => (
                    <div key={member.id || index} className="flex items-center justify-between p-4 border rounded-lg bg-gradient-to-r from-white to-gray-50/50 hover:shadow-md transition-all duration-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
                          <User className="h-5 w-5" />
                        </div>
                  <div>
                          <p className="font-medium text-gray-900">{member.fullName}</p>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                  </div>
                      </div>
                      <Badge 
                        variant={member.role === 'father' ? 'default' : 'secondary'}
                        className={member.role === 'father' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-gray-100 text-gray-800 border-gray-200'}
                      >
                        {member.role === 'father' ? 'Bố' : member.role === 'mother' ? 'Mẹ' : member.role === 'child' ? 'Con' : 'Thành viên'}
                  </Badge>
                </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Chưa có thành viên nào</p>
                    <p className="text-sm">Dữ liệu đang được tải...</p>
                  </div>
                )}
            </div>
          </CardContent>
        </Card>
        </FadeIn>

        {/* App Settings */}
        <FadeIn delay={0.4}>
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
            <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-purple-600" />
              Cài đặt ứng dụng
            </CardTitle>
            <CardDescription>Tùy chỉnh trải nghiệm sử dụng</CardDescription>
          </CardHeader>
            <CardContent className="space-y-6 p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                  <Label className="text-base font-medium">Thông báo</Label>
                <p className="text-sm text-muted-foreground">Nhận thông báo về chi tiêu và lời khuyên</p>
              </div>
              <Switch 
                checked={settings.notifications}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, notifications: checked }))}
              />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                  <Label className="text-base font-medium">Phân loại AI tự động</Label>
                <p className="text-sm text-muted-foreground">Sử dụng AI để phân loại chi tiêu</p>
              </div>
              <Switch 
                checked={settings.aiCategorization}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, aiCategorization: checked }))}
              />
            </div>
            
            <Separator />
            
            <div className="space-y-2">
                <Label className="text-base font-medium">Ngân sách hàng tháng</Label>
                <div className="relative">
              <Input 
                type="number"
                value={settings.monthlyBudget}
                onChange={(e) => setSettings(prev => ({ ...prev, monthlyBudget: parseInt(e.target.value) || 0 }))}
                    placeholder="25000000"
                    className="pr-16"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">
                    VND
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Hiện tại: {formatCurrency(settings.monthlyBudget)}
                </p>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label className="text-base font-medium">Ngôn ngữ</Label>
                <Select value={settings.language} onValueChange={(value) => setSettings(prev => ({ ...prev, language: value }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn ngôn ngữ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vi">Tiếng Việt</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label className="text-base font-medium">Chủ đề</Label>
                <Select value={settings.theme} onValueChange={(value) => setSettings(prev => ({ ...prev, theme: value }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn chủ đề" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Sáng</SelectItem>
                    <SelectItem value="dark">Tối</SelectItem>
                    <SelectItem value="system">Hệ thống</SelectItem>
                  </SelectContent>
                </Select>
            </div>
          </CardContent>
        </Card>
        </FadeIn>

        {/* Data Management */}
        <FadeIn delay={0.5}>
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50 border-b">
            <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-green-600" />
                Quản lý dữ liệu
            </CardTitle>
              <CardDescription>Xuất, nhập và quản lý dữ liệu của bạn</CardDescription>
          </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button 
                  onClick={handleExportData}
                  className="bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Xuất dữ liệu
                </Button>
                
                <Button 
                  onClick={handleRefreshData}
                  disabled={isLoading || isRefreshing}
                  variant="outline"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading || isRefreshing ? 'animate-spin' : ''}`} />
                  {isLoading || isRefreshing ? 'Đang đồng bộ...' : 'Làm mới'}
                </Button>
              </div>
              
            {expenseStats && (
                <div className="mt-6 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg space-y-3 border border-gray-200">
                  <h4 className="font-semibold text-base text-gray-800 flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Thống kê dữ liệu
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-white rounded-lg border">
                      <div className="text-2xl font-bold text-green-600 break-words overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'break-word', maxWidth: '100%' }}>
                        {formatCurrency(expenseStats.totalAmount || 0)}
                      </div>
                      <div className="text-sm text-gray-600">Tổng chi tiêu</div>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg border">
                      <div className="text-2xl font-bold text-blue-600">
                        {expenseStats.categoryStats?.reduce((sum: number, cat: any) => sum + cat.count, 0) || 0}
                      </div>
                      <div className="text-sm text-gray-600">Giao dịch</div>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg border">
                      <div className="text-2xl font-bold text-purple-600">
                        {expenseStats.categoryStats?.length || 0}
                      </div>
                      <div className="text-sm text-gray-600">Danh mục</div>
                </div>
                </div>
                </div>
            )}
          </CardContent>
        </Card>
        </FadeIn>
      </div>

      {/* Danger Zone */}
      <FadeIn delay={0.6}>
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50 border-b border-red-200">
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
            Vùng nguy hiểm
          </CardTitle>
            <CardDescription className="text-red-600">Các hành động không thể hoàn tác</CardDescription>
        </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-red-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
            <div>
                  <h4 className="font-semibold text-red-800">Xóa tài khoản</h4>
                  <p className="text-sm text-red-600">Xóa vĩnh viễn tài khoản và tất cả dữ liệu</p>
                </div>
            </div>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={handleDeleteAccount}
                className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Xóa tài khoản
            </Button>
          </div>
            
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">Cảnh báo quan trọng:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Tất cả dữ liệu chi tiêu sẽ bị xóa vĩnh viễn</li>
                    <li>Không thể khôi phục tài khoản sau khi xóa</li>
                    <li>Bạn sẽ bị loại khỏi gia đình hiện tại</li>
                  </ul>
                </div>
              </div>
            </div>
        </CardContent>
      </Card>
      </FadeIn>

      {/* Save Button */}
      <FadeIn delay={0.7}>
      <div className="flex justify-end">
        <Button 
          onClick={handleSaveSettings}
          disabled={isLoading}
            className="min-w-[140px] bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Đang lưu...
              </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Lưu cài đặt
            </>
          )}
        </Button>
      </div>
      </FadeIn>
    </div>
  );
}
