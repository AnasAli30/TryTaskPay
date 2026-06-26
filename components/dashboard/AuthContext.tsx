'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface AuthContextValue {
  showAuthGate: boolean;
  openAuthGate: () => void;
  closeAuthGate: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  showAuthGate: false,
  openAuthGate: () => {},
  closeAuthGate: () => {},
});

export function AuthGateProvider({ children }: { children: ReactNode }) {
  const [showAuthGate, setShowAuthGate] = useState(false);
  const openAuthGate = useCallback(() => setShowAuthGate(true), []);
  const closeAuthGate = useCallback(() => setShowAuthGate(false), []);

  return (
    <AuthContext.Provider value={{ showAuthGate, openAuthGate, closeAuthGate }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthGate() {
  return useContext(AuthContext);
}
