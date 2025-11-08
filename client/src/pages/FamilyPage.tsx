import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiService } from "@/lib/api";
import { useState, useEffect } from "react";
import { Users, UserPlus, Mail, User, Crown, Baby, UserCheck, RefreshCw, Edit, Trash2, Calendar, DollarSign, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/animations";
import { useDataSync } from "@/hooks/use-data-sync";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function FamilyPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("mother");
  const [editingMember, setEditingMember] = useState<any>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editFullName, setEditFullName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const { isRefreshing, refreshAllData, getSyncStatus } = useDataSync();

  // Monitor connection status
  useEffect(() => {
    const checkConnection = async () => {
      try {
        await apiService.getFamilyMembers();
        setConnectionStatus('connected');
      } catch (error) {
        setConnectionStatus('disconnected');
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const membersQuery = useQuery({
    queryKey: ['family-members'],
    queryFn: () => apiService.getFamilyMembers(),
    staleTime: 30 * 1000, // 30 seconds - more aggressive refresh
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Always refetch on mount
    retry: 3, // Retry failed requests
    retryDelay: 1000, // 1 second between retries
  });

  const inviteMutation = useMutation({
    mutationFn: () => apiService.inviteFamilyMember({ email, fullName, role }),
    onSuccess: () => {
      toast({ title: "Đã mời/Thêm thành viên thành công" });
      queryClient.invalidateQueries({ queryKey: ['family-members'] });
      setEmail(""); 
      setFullName("");
      setRole("mother");
    },
    onError: (err: any) => {
      console.error('Invite error:', err);
      toast({ 
        title: "Lỗi", 
        description: err.message || "Không thể mời thành viên", 
        variant: "destructive" 
      });
    },
  });

  const editMutation = useMutation({
    mutationFn: (data: { id: string; email: string; fullName: string; role: string }) => 
      apiService.updateFamilyMember(data.id, { email: data.email, fullName: data.fullName, role: data.role }),
    onSuccess: () => {
      toast({ title: "Cập nhật thành viên thành công" });
      queryClient.invalidateQueries({ queryKey: ['family-members'] });
      setEditingMember(null);
      setEditEmail("");
      setEditFullName("");
      setEditRole("");
    },
    onError: (err: any) => {
      toast({ 
        title: "Lỗi", 
        description: err.message || "Không thể cập nhật thành viên", 
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteFamilyMember(id),
    onSuccess: () => {
      toast({ title: "Xóa thành viên thành công" });
      queryClient.invalidateQueries({ queryKey: ['family-members'] });
    },
    onError: (err: any) => {
      toast({ 
        title: "Lỗi", 
        description: err.message || "Không thể xóa thành viên", 
        variant: "destructive" 
      });
    },
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'father': return <Crown className="h-4 w-4 text-blue-600" />;
      case 'mother': return <User className="h-4 w-4 text-pink-600" />;
      case 'child': return <Baby className="h-4 w-4 text-green-600" />;
      default: return <UserCheck className="h-4 w-4 text-gray-600" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'father': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'mother': return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'child': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'father': return 'Bố';
      case 'mother': return 'Mẹ';
      case 'child': return 'Con';
      default: return 'Thành viên';
    }
  };

  const handleEditMember = (member: any) => {
    setEditingMember(member);
    setEditEmail(member.email);
    setEditFullName(member.fullName);
    setEditRole(member.role);
  };

  const handleSaveEdit = () => {
    if (editingMember) {
      editMutation.mutate({
        id: editingMember.id,
        email: editEmail,
        fullName: editFullName,
        role: editRole
      });
    }
  };

  const handleDeleteMember = (id: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa thành viên này?")) {
      deleteMutation.mutate(id);
    }
  };

  const getFamilyStats = () => {
    const members = (membersQuery.data as any)?.members || [];
    const totalMembers = members.length;
    const roleCounts = members.reduce((acc: any, member: any) => {
      acc[member.role] = (acc[member.role] || 0) + 1;
      return acc;
    }, {});
    
    return {
      totalMembers,
      roleCounts,
      fathers: roleCounts.father || 0,
      mothers: roleCounts.mother || 0,
      children: roleCounts.child || 0,
      others: roleCounts.other || 0
    };
  };

  const familyStats = getFamilyStats();

  return (
    <div className="space-y-6">
      <FadeIn delay={0.2}>
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                    Quản lý gia đình
                  </h1>
                  <p className="text-muted-foreground">
                    Quản lý thành viên và mời thêm người vào gia đình
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshAllData}
                disabled={isRefreshing}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Đang đồng bộ...' : 'Làm mới'}
              </Button>
            </div>
            
            {/* Family Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <StaggerItem>
                <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg hover:shadow-lg transition-all duration-300 transform hover:scale-105">
                  <Users className="h-8 w-8 text-blue-600 mx-auto mb-2 animate-pulse" />
                  <div className="text-2xl font-bold text-blue-700">{familyStats.totalMembers}</div>
                  <div className="text-sm text-blue-600">Tổng thành viên</div>
                </div>
              </StaggerItem>
              <StaggerItem>
                <div className="text-center p-4 bg-gradient-to-br from-pink-50 to-pink-100 rounded-lg hover:shadow-lg transition-all duration-300 transform hover:scale-105">
                  <Crown className="h-8 w-8 text-pink-600 mx-auto mb-2 animate-pulse" />
                  <div className="text-2xl font-bold text-pink-700">{familyStats.fathers}</div>
                  <div className="text-sm text-pink-600">Bố</div>
                </div>
              </StaggerItem>
              <StaggerItem>
                <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg hover:shadow-lg transition-all duration-300 transform hover:scale-105">
                  <User className="h-8 w-8 text-purple-600 mx-auto mb-2 animate-pulse" />
                  <div className="text-2xl font-bold text-purple-700">{familyStats.mothers}</div>
                  <div className="text-sm text-purple-600">Mẹ</div>
                </div>
              </StaggerItem>
              <StaggerItem>
                <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg hover:shadow-lg transition-all duration-300 transform hover:scale-105">
                  <Baby className="h-8 w-8 text-green-600 mx-auto mb-2 animate-pulse" />
                  <div className="text-2xl font-bold text-green-700">{familyStats.children}</div>
                  <div className="text-sm text-green-600">Con</div>
                </div>
              </StaggerItem>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <div className="grid gap-6 lg:grid-cols-2">
        <FadeIn delay={0.3}>
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Thành viên gia đình
              </CardTitle>
                 </CardHeader>
            <CardContent className="p-6">
              {membersQuery.isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : membersQuery.isError ? (
                <div className="text-center py-8">
                  <div className="text-red-500 mb-2">⚠️</div>
                  <p className="text-destructive font-medium">Lỗi tải danh sách thành viên</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {(membersQuery.error as any)?.message || "Vui lòng thử lại sau"}
                  </p>
                </div>
              ) : (
                <StaggerContainer>
                  <div className="space-y-3">
                    {(membersQuery.data as any)?.members?.length ? (
                      (membersQuery.data as any).members.map((member: any, index: number) => (
                        <StaggerItem key={member.id}>
                          <div className="flex items-center justify-between p-4 rounded-lg border bg-gradient-to-r from-white to-gray-50/50 hover:shadow-md transition-all duration-200">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
                                {getRoleIcon(member.role)}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{member.fullName}</p>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {member.email}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge 
                                className={`${getRoleColor(member.role)} text-xs px-3 py-1 font-medium rounded-full`}
                                variant="secondary"
                              >
                                {getRoleLabel(member.role)}
                              </Badge>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditMember(member)}
                                  className="h-8 w-8 p-0 hover:bg-blue-100"
                                >
                                  <Edit className="h-4 w-4 text-blue-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteMember(member.id)}
                                  className="h-8 w-8 p-0 hover:bg-red-100"
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </StaggerItem>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Chưa có thành viên nào</p>
                        <p className="text-sm">Hãy mời thành viên đầu tiên</p>
                      </div>
                    )}
                  </div>
                </StaggerContainer>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.4}>
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-green-600" />
                  Mời/Thêm thành viên
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshAllData}
                  disabled={isRefreshing}
                  className="text-xs"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? 'Đang đồng bộ...' : 'Làm mới'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={(e) => { e.preventDefault(); inviteMutation.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <Input 
                    id="email"
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    required
                    className="bg-white border-gray-200 focus:border-blue-500"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-medium">Họ và tên</Label>
                  <Input 
                    id="fullName"
                    value={fullName} 
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    required
                    className="bg-white border-gray-200 focus:border-blue-500"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="role" className="text-sm font-medium">Vai trò</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger className="bg-white border-gray-200 focus:border-blue-500">
                      <SelectValue placeholder="Chọn vai trò" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="father">
                        <div className="flex items-center gap-2">
                          <Crown className="h-4 w-4 text-blue-600" />
                          Bố
                        </div>
                      </SelectItem>
                      <SelectItem value="mother">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-pink-600" />
                          Mẹ
                        </div>
                      </SelectItem>
                      <SelectItem value="child">
                        <div className="flex items-center gap-2">
                          <Baby className="h-4 w-4 text-green-600" />
                          Con
                        </div>
                      </SelectItem>
                      <SelectItem value="other">
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4 text-gray-600" />
                          Thành viên khác
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                  disabled={inviteMutation.isPending || !email || !fullName}
                >
                  {inviteMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Đang mời...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Mời/Thêm thành viên
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* Edit Member Dialog */}
      <Dialog open={!!editingMember} onOpenChange={() => setEditingMember(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa thành viên</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email" className="text-sm font-medium">Email</Label>
              <Input 
                id="edit-email"
                type="email" 
                value={editEmail} 
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="example@email.com"
                required
                className="bg-white border-gray-200 focus:border-blue-500"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-fullName" className="text-sm font-medium">Họ và tên</Label>
              <Input 
                id="edit-fullName"
                value={editFullName} 
                onChange={(e) => setEditFullName(e.target.value)}
                placeholder="Nguyễn Văn A"
                required
                className="bg-white border-gray-200 focus:border-blue-500"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-role" className="text-sm font-medium">Vai trò</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger className="bg-white border-gray-200 focus:border-blue-500">
                  <SelectValue placeholder="Chọn vai trò" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="father">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-blue-600" />
                      Bố
                    </div>
                  </SelectItem>
                  <SelectItem value="mother">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-pink-600" />
                      Mẹ
                    </div>
                  </SelectItem>
                  <SelectItem value="child">
                    <div className="flex items-center gap-2">
                      <Baby className="h-4 w-4 text-green-600" />
                      Con
                    </div>
                  </SelectItem>
                  <SelectItem value="other">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-gray-600" />
                      Thành viên khác
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleSaveEdit}
                disabled={editMutation.isPending || !editEmail || !editFullName}
                className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                {editMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Đang cập nhật...
                  </>
                ) : (
                  "Cập nhật"
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setEditingMember(null)}
                className="flex-1"
              >
                Hủy
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


