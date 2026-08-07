import { redirect } from "@tanstack/react-router";

export type AccountAccess = {
  isSuperAdmin: boolean;
  accountType: "super_admin" | "establishment" | "customer";
  hasEstablishment?: boolean;
};

export function resolveAuthenticatedDestination(access: AccountAccess) {
  if (access.isSuperAdmin || access.accountType === "super_admin") {
    return "/hash";
  }
  
  if (access.accountType === "establishment") {
    if (access.hasEstablishment) {
      return "/app";
    }
    return "/onboarding";
  }
  
  // Default for customers or any other case
  return "/carteira";
}
