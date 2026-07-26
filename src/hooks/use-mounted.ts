"use client";

import { useSyncExternalStore } from "react";

// SSR-safe mounted flag using useSyncExternalStore (no setState-in-effect).
const emptySubscribe = () => () => {};

export function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true, // client snapshot: always mounted
    () => false // server snapshot: not mounted
  );
}
