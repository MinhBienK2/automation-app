import { useState, useEffect, useCallback } from "react";
import { login as apiLogin, logout as apiLogout, me as apiMe, getAppConfig } from "../../../lib/workflowApi";

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
  const [authError, setAuthError] = useState<string | null>(null);
  const [mode, setMode] = useState<"pending" | "private" | "team">("pending");
  const [pgAvailable, setPgAvailable] = useState(false);
  const [publicDatabaseUrl, setPublicDatabaseUrl] = useState("");

  const loadConfigAndSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const config = await getAppConfig();
      const isPgConfigured = config.mode === "public";
      setPgAvailable(isPgConfigured);
      setPublicDatabaseUrl(config.publicDatabaseUrl || "");

      if (!isPgConfigured) {
        setMode("private");
      } else {
        const preferredMode = localStorage.getItem("preferred_mode");
        const savedToken = localStorage.getItem("auth_token");

        if (preferredMode === "private") {
          setMode("private");
        } else if (savedToken) {
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
      }
    } catch (error: any) {
      console.error("Failed to load auth config or session:", error);
      setMode("private");
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
      setIsLoading(true);
      const response = await apiLogin({ email, password: passwordPlain });
      setCurrentUser(response.user);
      setToken(response.token);
      localStorage.setItem("auth_token", response.token);
      localStorage.setItem("preferred_mode", "team");
      setMode("team");
      return true;
    } catch (error: any) {
      setAuthError(error.message || "Failed to log in");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      await apiLogout();
      setCurrentUser(null);
      setToken(null);
      localStorage.removeItem("auth_token");
      localStorage.removeItem("preferred_mode");
      setMode("pending");
    } catch (error) {
      console.error("Failed to log out:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const enterPrivateMode = useCallback(() => {
    localStorage.setItem("preferred_mode", "private");
    setMode("private");
  }, []);

  const switchToLoginMode = useCallback(() => {
    localStorage.removeItem("preferred_mode");
    setMode("pending");
  }, []);

  return {
    currentUser,
    token,
    isLoading,
    authError,
    mode,
    pgAvailable,
    publicDatabaseUrl,
    login,
    logout,
    enterPrivateMode,
    switchToLoginMode,
    reloadSession: loadConfigAndSession,
  };
}
