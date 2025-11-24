"use client";

import { useAuth } from "../../context/Auth";
import ProducerNavbar from "./components/ProducerNavbar";
import CompetitionGrid from "./components/CompetitionGrid";
import LoadingLogo from "@/components/loading";

export default function DashboardPage() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingLogo />;

  if (!user) return null;

  // Only producers see this version of the dashboard

  return (
    <div className="min-h-screen bg-[#0e0f12] text-white">
      <ProducerNavbar />
      <CompetitionGrid role={user.role} />
    </div>
  );
}
