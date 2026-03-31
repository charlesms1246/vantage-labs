"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { usePrivy } from "@privy-io/react-auth";
import { v4 as uuidv4 } from "uuid";
import type { PendingApproval } from "@/types";

interface SessionContextType {
  sessionId: string;
  pendingApproval: PendingApproval | null;
  setPendingApproval: (approval: PendingApproval | null) => void;
  clearApproval: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<string>("");
  const [pendingApproval, setPendingApproval] =
    useState<PendingApproval | null>(null);
  const { user } = usePrivy();

  useEffect(() => {
    if (user) {
      const existingSession = sessionStorage.getItem("vantage_session");
      if (existingSession) {
        setSessionId(existingSession);
      } else {
        const newSession = uuidv4();
        sessionStorage.setItem("vantage_session", newSession);
        setSessionId(newSession);
      }
    }
  }, [user]);

  const clearApproval = () => setPendingApproval(null);

  return (
    <SessionContext.Provider
      value={{ sessionId, pendingApproval, setPendingApproval, clearApproval }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return context;
}
