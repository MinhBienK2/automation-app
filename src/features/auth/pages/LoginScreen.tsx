import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";

interface LoginScreenProps {
  onLogin: (email: string, passwordPlain: string) => Promise<boolean>;
  authError: string | null;
  isLoading: boolean;
}

export function LoginScreen({ onLogin, authError, isLoading }: LoginScreenProps) {
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem("remember_me") === "true");
  const [email, setEmail] = useState(() => {
    const savedEmail = localStorage.getItem("remembered_email");
    return localStorage.getItem("remember_me") === "true" && savedEmail ? savedEmail : "";
  });
  const [password, setPassword] = useState(() => {
    const savedPassword = localStorage.getItem("remembered_password");
    return localStorage.getItem("remember_me") === "true" && savedPassword ? savedPassword : "";
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setSubmitting(true);
    try {
      if (rememberMe) {
        localStorage.setItem("remember_me", "true");
        localStorage.setItem("remembered_email", email);
        localStorage.setItem("remembered_password", password);
      } else {
        localStorage.removeItem("remember_me");
        localStorage.removeItem("remembered_email");
        localStorage.removeItem("remembered_password");
      }

      await onLogin(email, password);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-screen-container">
      <div className="login-card bg-base-200 border-base-300">
        <div className="login-header">
          <div className="logo-placeholder bg-gradient-to-br from-primary to-primary-hover">A</div>
          <h2 className="text-base-content font-bold">Automation Lab</h2>
          <p className="subtitle text-secondary">Sign in to your workplace account</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="e.g. admin@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading || submitting}
              className="bg-base-100 border-base-300"
              required
            />
          </div>

          <div className="form-group">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="bg-base-100 border-base-300"
              required
            />
          </div>

          <div className="remember-me-container">
            <label className="checkbox-label flex items-center gap-2 cursor-pointer select-none">
              <input
                id="rememberMe"
                type="checkbox"
                className="checkbox checkbox-primary checkbox-xs rounded"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={isLoading}
              />
              <span className="text-sm">Remember credentials</span>
            </label>
          </div>

          {authError && (
            <div className="alert alert-error text-sm p-3 justify-center" role="alert">
              {authError}
            </div>
          )}

          <Button type="submit" disabled={isLoading || submitting} loading={isLoading || submitting} className="btn-primary w-full">
            Sign In
          </Button>
        </form>

        <div className="login-footer">
          <p className="credential-hint">
            Default credentials: <strong>admin@gmail.com</strong> / <strong>admin</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
