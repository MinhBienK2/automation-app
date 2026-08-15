import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Checkbox } from "../../../components/ui/checkbox";

import { Alert } from "../../../components/ui/alert";

interface LoginScreenProps {
  onLogin: (email: string, passwordPlain: string) => Promise<boolean>;
  authError: string | null;
  isLoading: boolean;
}

export function LoginScreen({ onLogin, authError, isLoading }: LoginScreenProps) {
  // Only the email is ever restored, and only when the operator asked for it.
  // A password never comes back from storage — see the submit handler, which
  // clears any `remembered_password` an earlier build may have left behind.
  const [rememberMe, setRememberMe] = useState(
    () => localStorage.getItem("remember_me") === "true",
  );
  const [email, setEmail] = useState(() => {
    const savedEmail = localStorage.getItem("remembered_email");
    return localStorage.getItem("remember_me") === "true" && savedEmail ? savedEmail : "";
  });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setSubmitting(true);
    try {
      if (rememberMe) {
        localStorage.setItem("remember_me", "true");
        localStorage.setItem("remembered_email", email);
      } else {
        localStorage.removeItem("remember_me");
        localStorage.removeItem("remembered_email");
      }
      localStorage.removeItem("remembered_password");

      await onLogin(email, password);
    } finally {
      setSubmitting(false);
    }
  };

  const isFieldsDisabled = isLoading || submitting;

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
              disabled={isFieldsDisabled}
              className="bg-base-100 border-base-300"
              required
            />
          </div>

          <div className="form-group">
            <Label htmlFor="password">Password</Label>
            <div className="relative flex items-center">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isFieldsDisabled}
                className="bg-base-100 border-base-300 pr-12 w-full"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-fg-muted hover:text-fg-primary text-xs font-semibold select-none focus:outline-none"
                tabIndex={-1}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="remember-me-container">
            <label className="checkbox-label flex items-center gap-2 cursor-pointer select-none">
              <Checkbox
                id="rememberMe"
                className="checkbox-xs rounded"
                checked={rememberMe}
                onCheckedChange={setRememberMe}
                disabled={isFieldsDisabled}
              />
              <span className="text-sm">Remember email</span>
            </label>
          </div>

          {authError && (
            <Alert variant="error" className="text-sm p-3 justify-center">
              {authError}
            </Alert>
          )}

          <Button type="submit" disabled={isFieldsDisabled} loading={isFieldsDisabled} className="btn-primary w-full">
            Sign In
          </Button>
        </form>

        <div className="login-footer" />
      </div>
    </div>
  );
}
