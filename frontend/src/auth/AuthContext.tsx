import {createContext, useContext, useEffect, useMemo, useState} from "react";
import type {ReactNode} from "react";
import {api, setApiAuthToken} from "../services/api";
import type {AuthSession} from "../types/api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";
interface AuthValue {
  status: AuthStatus;
  session?: AuthSession;
  signIn: (credential: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | undefined>(undefined);
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const testMode = import.meta.env.MODE === "test";

export function AuthProvider({children}: {children: ReactNode}) {
  const [status, setStatus] = useState<AuthStatus>(testMode ? "authenticated" : clientId ? "loading" : "unauthenticated");
  const [session, setSession] = useState<AuthSession>();

  useEffect(() => {
    if (testMode || !clientId) return;
    void api.currentUser().then((value) => { setSession(value); setStatus("authenticated"); }).catch(() => {
      setApiAuthToken(undefined); setStatus("unauthenticated");
    });
  }, []);

  useEffect(() => {
    if (testMode) return;
    const expire = () => { setApiAuthToken(undefined); setSession(undefined); setStatus("unauthenticated"); };
    window.addEventListener("employee-routes-auth-expired", expire);
    return () => window.removeEventListener("employee-routes-auth-expired", expire);
  }, []);

  const value = useMemo<AuthValue>(() => ({
    status,
    session,
    signIn: async (credential) => {
      setStatus("loading");
      try {
        const value = await api.googleLogin(credential);
        setSession(value);
        setStatus("authenticated");
      } catch (error) { setStatus("error"); throw error; }
    },
    signOut: async () => {
      try { await api.logout(); } finally { setApiAuthToken(undefined); setSession(undefined); setStatus(testMode ? "authenticated" : "unauthenticated"); }
    },
  }), [session, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

