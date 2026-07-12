"use client";

import { useEffect } from "react";
import { startBackgroundSync } from "@/lib/sync/client";

export function SyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => startBackgroundSync(30_000), []);
  return <>{children}</>;
}
