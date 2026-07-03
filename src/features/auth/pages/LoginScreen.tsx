import { useState } from "react";
import { Button } from "../../../components/ui/button";

interface LoginScreenProps {
  onLogin: (email: string, passwordPlain: string) => Promise<boolean>;
  authError: string | null;
  isLoading: boolean;
  onPrivate: () => void;
  pgAvailable: boolean;
}

export function LoginScreen({ onLogin, authError, isLoading, onPrivate, pgAvailable }: LoginScreenProps) {
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem("remember_me") === "true");
  const [email, setEmail] = useState(() => {
    const savedEmail = localStorage.getItem("remembered_email");
    return localStorage.getItem("remember_me") === "true" && savedEmail ? savedEmail : "";
  });
  const [password, setPassword] = useState(() => {
    const savedPassword = localStorage.getItem("remembered_password");
    return localStorage.getItem("remember_me") === "true" && savedPassword ? savedPassword : "";
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

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
  };

  return (
    <div className="login-screen-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo-placeholder">A</div>
          <h2>Automation Lab</h2>
          <p className="subtitle">
            {pgAvailable ? "Sign in to your workplace account" : "Local Standalone Workspace"}
          </p>
        </div>

        {pgAvailable ? (
          <>
            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  placeholder="e.g. admin@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="remember-me-container">
                <label className="checkbox-label">
                  <input
                    id="rememberMe"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={isLoading}
                  />
                  <span>Remember credentials</span>
                </label>
              </div>

              {authError && (
                <div className="error-message" role="alert">
                  {authError}
                </div>
              )}

              <Button type="submit" disabled={isLoading} className="login-submit-btn">
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="login-divider" style={{ margin: "1.5rem 0", display: "flex", alignItems: "center", justifyContent: "center", color: "#667D8D", fontSize: "0.875rem" }}>
              <span style={{ flex: 1, height: "1px", background: "rgba(255, 255, 255, 0.1)" }}></span>
              <span style={{ padding: "0 1rem" }}>or</span>
              <span style={{ flex: 1, height: "1px", background: "rgba(255, 255, 255, 0.1)" }}></span>
            </div>
          </>
        ) : (
          <div style={{ margin: "1.5rem 0", textAlign: "center", color: "#9AAEBD" }}>
            <p style={{ fontSize: "0.875rem", marginBottom: "1.5rem", lineHeight: "1.5" }}>
              PostgreSQL connection is not configured in the repository environment. Use local storage to manage your resources.
            </p>
          </div>
        )}

        <Button
          type="button"
          onClick={onPrivate}
          disabled={isLoading}
          variant="secondary"
          className="login-private-btn"
          style={{ width: "100%", padding: "0.75rem 1rem", height: "auto" }}
        >
          Continue as Private
        </Button>

        {pgAvailable && (
          <div className="login-footer">
            <p className="credential-hint">
              Default credentials: <strong>admin@gmail.com</strong> / <strong>admin</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
