import { useState, useEffect, useCallback } from "react";
import { login as apiLogin, logout as apiLogout, me as apiMe } from "../../../lib/api/workflowApi";

// Verify a saved token, retrying on transient backend errors (e.g. DB pool
// not ready at startup). Returns null only when the token is definitively
// invalid; throws if it could not be verified after retries.
async function verifySavedSession(token: string, maxAttempts = 5): Promise<ReturnType<typeof apiMe> | null> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await apiMe({ token });
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
      }
    }
  }
  throw lastError;
}

export interface User {
  id: string;
  email: string;
  role: "admin" | "user";
  created_at: string;
}

export function useAuthState() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [mode, setMode] = useState<"pending" | "team">("pending");

  const loadConfigAndSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const savedToken = localStorage.getItem("auth_token");

      if (!savedToken) {
        setMode("pending");
        return;
      }

      // Retry a few times in case the backend (or its DB pool) isn't ready
      // yet at startup. A transient failure must NOT destroy the saved token.
      const user = await verifySavedSession(savedToken);
      if (user) {
        setCurrentUser(user);
        setToken(savedToken);
        setMode("team");
      } else {
        // Only reached when the token is definitively invalid/expired.
        localStorage.removeItem("auth_token");
        setMode("pending");
      }
    } catch (error: any) {
      console.error("Failed to load auth config or session:", error);
      // Keep the token so the next launch can retry; show login for now.
      setMode("pending");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfigAndSession();
  }, [loadConfigAndSession]);

  const login = useCallback(async (email: string, passwordPlain: string) => {
    try {
      setAuthError(null);
      setIsLoggingIn(true);
      const response = await apiLogin({ email, password: passwordPlain });
      setCurrentUser(response.user);
      setToken(response.token);
      localStorage.setItem("auth_token", response.token);
      setMode("team");
      console.warn("[LOGIN-OK]", JSON.stringify(response.user));
      return true;
    } catch (error: any) {
      setAuthError(error.message || "Failed to log in");
      console.warn("[LOGIN-ERR]", error?.message);
      return false;
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setIsLoggingOut(true);
      await apiLogout();
      setCurrentUser(null);
      setToken(null);
      localStorage.removeItem("auth_token");
      setMode("pending");
    } catch (error) {
      console.error("Failed to log out:", error);
    } finally {
      setIsLoggingOut(false);
    }
  }, []);

  return {
    currentUser,
    token,
    isLoading,
    isLoggingIn,
    isLoggingOut,
    authError,
    mode,
    login,
    logout,
    reloadSession: loadConfigAndSession,
  };
}
