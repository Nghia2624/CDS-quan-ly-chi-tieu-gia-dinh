import { LoginForm } from '../LoginForm';

export default function LoginFormExample() {
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <LoginForm
        onLogin={(credentials) => console.log('Login:', credentials)}
        onSwitchToSignup={() => console.log('Switch to signup')}
      />
    </div>
  );
}