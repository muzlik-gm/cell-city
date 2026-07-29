"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth-store";
import { AuthPage } from "@/components/auth/auth-page";
import { BusinessOnboarding } from "@/components/auth/business-onboarding";
import { AppShell } from "@/components/app-shell";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { user, loading, fetchUser } = useAuth();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated → show auth page
  if (!user) return <AuthPage />;

  // App user with no business → show business onboarding
  if (user.type === "app_user" && !user.business) return <BusinessOnboarding />;

  // Employee or app user with business → show app shell
  return <AppShell />;
}
