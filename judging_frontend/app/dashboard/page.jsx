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
  if (user.role === "producer") {
    return (
      <div className="min-h-screen bg-[#0e0f12] text-white">
        <ProducerNavbar />
        <CompetitionGrid />
      </div>
    );
  }

  // Fallback for other roles (judges, participants, etc.)
  return (
    <div className="min-h-screen bg-[#0e0f12] text-gray-300 p-8">
      <h1 className="text-2xl">Welcome, {user.name}</h1>
      <p className="mt-2">Your role: {user.role}</p>
    </div>
  );
}
