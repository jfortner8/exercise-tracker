import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthSession } from "@et/core/api-types";
import { configureClient } from "@/api/client";
import { deleteToken, readToken, saveToken } from "./token";

type Status = "loading" | "signedOut" | "signedIn";

interface SessionValue {
  status: Status;
  /** After sign-in, confirm or password reset: keeps the token and opens the app. */
  signIn: (session: AuthSession) => Promise<void>;
  /** Forgets the token and everything cached for this account. */
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

/** Whether someone's signed in. The token stays in secure storage; a 401 from the API signs out. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("loading");

  const signOut = useCallback(async () => {
    configureClient(null, null);
    await deleteToken().catch(() => {});
    queryClient.clear();
    setStatus("signedOut");
  }, [queryClient]);

  useEffect(() => {
    readToken()
      .then((token) => {
        configureClient(token, token ? () => void signOut() : null);
        setStatus(token ? "signedIn" : "signedOut");
      })
      .catch(() => setStatus("signedOut"));
  }, [signOut]);

  const signIn = useCallback(
    async (session: AuthSession) => {
      await saveToken(session.token);
      queryClient.clear();
      configureClient(session.token, () => void signOut());
      setStatus("signedIn");
    },
    [queryClient, signOut],
  );

  const value = useMemo(() => ({ status, signIn, signOut }), [status, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useSession outside SessionProvider");
  return s;
}
