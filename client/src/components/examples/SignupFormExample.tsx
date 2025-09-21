import { SignupForm } from '../SignupForm';

export default function SignupFormExample() {
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <SignupForm
        onSignup={(userData) => console.log('Signup:', userData)}
        onSwitchToLogin={() => console.log('Switch to login')}
      />
    </div>
  );
}