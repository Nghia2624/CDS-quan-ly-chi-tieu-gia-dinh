import { useState } from "react";
import { LoginForm } from "@/components/LoginForm";
import { SignupForm } from "@/components/SignupForm";

interface AuthPageProps {
  onAuthenticated?: () => void;
}

export default function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);

  const handleLogin = (credentials: { email: string; password: string }) => {
    console.log('Login successful:', credentials);
    // todo: remove mock functionality - handle real authentication
    onAuthenticated?.();
  };

  const handleSignup = (userData: {
    email: string;
    phone: string;
    password: string;
    fullName: string;
    role: string;
  }) => {
    console.log('Signup successful:', userData);
    // todo: remove mock functionality - handle real registration
    onAuthenticated?.();
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