import React, { createContext, useContext, useMemo, type ReactNode } from "react";

interface DeliveryContextValue {
  activeDeliveryId: string | null;
}

const DeliveryContext = createContext<DeliveryContextValue | null>(null);

export function DeliveryProvider({ children }: { children: ReactNode }) {
  const value = useMemo<DeliveryContextValue>(
    () => ({
      activeDeliveryId: null,
    }),
    [],
  );

  return <DeliveryContext.Provider value={value}>{children}</DeliveryContext.Provider>;
}

export function useDelivery() {
  const context = useContext(DeliveryContext);
  if (!context) {
    throw new Error("useDelivery must be used within DeliveryProvider");
  }
  return context;
}

