import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Mail, Phone, User } from "lucide-react";

interface SignupFormProps {
  onSignup?: (userData: {
    email: string;
    phone: string;
    password: string;
    fullName: string;
    role: string;
  }) => void;
  onSwitchToLogin?: () => void;
}

export function SignupForm({ onSignup, onSwitchToLogin }: SignupFormProps) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !phone.trim() || !password.trim() || !fullName.trim() || !role) return;
    if (password !== confirmPassword) return;

    setIsLoading(true);
    
    // todo: remove mock functionality
    setTimeout(() => {
      onSignup?.({
        email: email.trim(),
        phone: phone.trim(),
        password: password.trim(),
        fullName: fullName.trim(),
        role
      });
      console.log('Signup attempt:', { email: email.trim(), phone: phone.trim(), fullName: fullName.trim(), role });
      setIsLoading(false);
    }, 1000);
  };

  const isFormValid = email.trim() && phone.trim() && password.trim() && 
                    confirmPassword.trim() && fullName.trim() && role &&
                    password === confirmPassword;

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <UserPlus className="h-5 w-5" />
          Đăng ký tài khoản
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Tạo tài khoản quản lý chi tiêu gia đình
        </p>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Họ và tên</Label>
            <div className="relative">
              <Input
                id="fullName"
                type="text"
                placeholder="Nguyễn Văn A"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                data-testid="input-signup-fullname"
                className="pl-10"
              />
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Input
                id="email"
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="input-signup-email"
                className="pl-10"
              />
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Số điện thoại</Label>
            <div className="relative">
              <Input
                id="phone"
                type="tel"
                placeholder="0901234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-testid="input-signup-phone"
                className="pl-10"
              />
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Vai trò trong gia đình</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger data-testid="select-family-role">
                <SelectValue placeholder="Chọn vai trò" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="father">Bố</SelectItem>
                <SelectItem value="mother">Mẹ</SelectItem>
                <SelectItem value="child">Con</SelectItem>
                <SelectItem value="other">Khác</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input
              id="password"
              type="password"
              placeholder="Tối thiểu 6 ký tự"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="input-signup-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Nhập lại mật khẩu"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              data-testid="input-signup-confirm-password"
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-destructive">Mật khẩu không khớp</p>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={isLoading || !isFormValid}
            data-testid="button-signup-submit"
          >
            {isLoading ? "Đang tạo tài khoản..." : "Đăng ký"}
          </Button>
        </form>

        <div className="mt-6">
          <Separator />
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Đã có tài khoản?{" "}
              <Button 
                variant="ghost" 
                className="p-0 h-auto text-primary hover:text-primary/80"
                onClick={onSwitchToLogin}
                data-testid="button-switch-to-login"
              >
                Đăng nhập ngay
              </Button>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}