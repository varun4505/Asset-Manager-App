import React, { createContext, useContext, useMemo, type ReactNode } from "react";

interface AdminContextValue {
  isAdminView: boolean;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const value = useMemo<AdminContextValue>(
    () => ({
      isAdminView: false,
    }),
    [],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error("useAdmin must be used within AdminProvider");
  }
  return context;
}

