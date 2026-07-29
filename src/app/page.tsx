"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth-store";
import { AuthPage } from "@/components/auth/auth-page";
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

  if (!user) return <AuthPage />;
  return <AppShell />;
}
