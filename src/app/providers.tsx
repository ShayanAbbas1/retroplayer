"use client";

import { SessionProvider } from "next-auth/react";

export function NextAuthProvider({ children }: { children: React.ReactNode }) {
  // every session fetch re-runs the jwt callback, which is where the token
  // refresh lives — without an interval an open tab only finds out it has gone
  // stale when the window regains focus
  return <SessionProvider refetchInterval={300}>{children}</SessionProvider>;
}
