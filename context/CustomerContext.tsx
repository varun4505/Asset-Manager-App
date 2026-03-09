import React, { createContext, useContext, useMemo, type ReactNode } from "react";

interface CustomerContextValue {
  activeCustomerId: string | null;
}

const CustomerContext = createContext<CustomerContextValue | null>(null);

export function CustomerProvider({ children }: { children: ReactNode }) {
  const value = useMemo<CustomerContextValue>(
    () => ({
      activeCustomerId: null,
    }),
    [],
  );

  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>;
}

export function useCustomer() {
  const context = useContext(CustomerContext);
  if (!context) {
    throw new Error("useCustomer must be used within CustomerProvider");
  }
  return context;
}

