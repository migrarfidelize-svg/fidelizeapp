import React, { createContext, useContext, ReactNode } from "react";

export type CRMThemeType = "command" | "premium" | "nexus" | "default";

interface ThemeContextType {
  theme: CRMThemeType;
}

const CRMThemeContext = createContext<ThemeContextType>({ theme: "default" });

export const useCRMTheme = () => {
  const context = useContext(CRMThemeContext);
  if (!context) {
    return { theme: "default" as CRMThemeType };
  }
  return context;
};

export function CRMThemeProvider({ theme, children }: { theme: CRMThemeType; children: ReactNode }) {
  return (
    <CRMThemeContext.Provider value={{ theme }}>
      <div className={`crm-theme-${theme} h-full w-full contents`}>
        {children}
      </div>
    </CRMThemeContext.Provider>
  );
}
