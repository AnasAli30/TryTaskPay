'use client';

import { createContext, useContext, type ReactNode } from 'react';

export type AppMode = 'miniapp' | 'browser';

interface AppModeContextValue {
  mode: AppMode;
  isBrowser: boolean;
  isMiniapp: boolean;
}

const AppModeContext = createContext<AppModeContextValue>({
  mode: 'miniapp',
  isBrowser: false,
  isMiniapp: true,
});

export function useAppMode() {
  return useContext(AppModeContext);
}

export function AppModeProvider({
  mode,
  children,
}: {
  mode: AppMode;
  children: ReactNode;
}) {
  return (
    <AppModeContext.Provider
      value={{
        mode,
        isBrowser: mode === 'browser',
        isMiniapp: mode === 'miniapp',
      }}
    >
      {children}
    </AppModeContext.Provider>
  );
}
