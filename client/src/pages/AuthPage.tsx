import { useState } from "react";
import { LoginForm } from "@/components/LoginForm";
import { SignupForm } from "@/components/SignupForm";
import { authService } from "@/lib/auth";

interface AuthPageProps {
  onAuthenticated?: () => void;
}

export default function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);

  const handleLogin = async (credentials: { email: string; password: string }) => {
    try {
      await authService.login(credentials.email, credentials.password);
      onAuthenticated?.();
    } catch (error: any) {
      console.error('Login failed:', error.message);
      // Handle error - you might want to show a toast here
    }
  };

  const handleSignup = async (userData: {
    email: string;
    phone: string;
    password: string;
    fullName: string;
    role: string;
  }) => {
    try {
      await authService.register(userData);
      onAuthenticated?.();
    } catch (error: any) {
      console.error('Signup failed:', error.message);
      // Handle error - you might want to show a toast here
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 to-chart-2/5">
      {isLogin ? (
        <LoginForm
          onLogin={handleLogin}
          onSwitchToSignup={() => setIsLogin(false)}
        />
      ) : (
        <SignupForm
          onSignup={handleSignup}
          onSwitchToLogin={() => setIsLogin(true)}
        />
      )}
    </div>
  );
}