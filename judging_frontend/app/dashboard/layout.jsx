"use client";

import { useAuth } from "../../context/Auth";
import LoadingLogo from "../../components/loading";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout({ children }) {
  const { loading, isAuthenticated } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return <LoadingLogo />;
  }
  if (!isAuthenticated) return null;

  if (!loading && isAuthenticated) {
    return <>{children}</>;
  }
}
