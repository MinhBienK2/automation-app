import { useState, useEffect, useCallback } from "react";
import { login as apiLogin, logout as apiLogout, me as apiMe } from "../../../lib/workflowApi";

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

      if (savedToken) {
        const user = await apiMe({ token: savedToken });
        if (user) {
          setCurrentUser(user);
          setToken(savedToken);
          setMode("team");
        } else {
          localStorage.removeItem("auth_token");
          setMode("pending");
        }
      } else {
        setMode("pending");
      }
    } catch (error: any) {
      console.error("Failed to load auth config or session:", error);
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
      return true;
    } catch (error: any) {
      setAuthError(error.message || "Failed to log in");
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
