import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { LogIn, Mail, Phone } from "lucide-react";

interface LoginFormProps {
  onLogin?: (credentials: { email: string; password: string }) => void;
  onSwitchToSignup?: () => void;
}

export function LoginForm({ onLogin, onSwitchToSignup }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setIsLoading(true);
    
    // todo: remove mock functionality
    setTimeout(() => {
      onLogin?.({ email: email.trim(), password: password.trim() });
      console.log('Login attempt:', { email: email.trim() });
      setIsLoading(false);
    }, 1000);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <LogIn className="h-5 w-5" />
          Đăng nhập
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Đăng nhập vào tài khoản gia đình
        </p>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email hoặc Số điện thoại</Label>
            <div className="relative">
              <Input
                id="email"
                type="text"
                placeholder="example@email.com hoặc 0901234567"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="input-login-email"
                className="pl-10"
              />
              {email.includes('@') ? (
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              ) : (
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input
              id="password"
              type="password"
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="input-login-password"
            />
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={isLoading || !email.trim() || !password.trim()}
            data-testid="button-login-submit"
          >
            {isLoading ? "Đang đăng nhập..." : "Đăng nhập"}
          </Button>
        </form>

        <div className="mt-6">
          <Separator />
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Chưa có tài khoản?{" "}
              <Button 
                variant="ghost" 
                className="p-0 h-auto text-primary hover:text-primary/80"
                onClick={onSwitchToSignup}
                data-testid="button-switch-to-signup"
              >
                Đăng ký ngay
              </Button>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}