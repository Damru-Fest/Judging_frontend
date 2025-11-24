"use client";

import { useAuth } from "../../../context/Auth";
import { useRouter } from "next/navigation";

export default function ProducerNavbar() {
  const { logout, user } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <div className="w-full bg-[#111113] border-b border-[#242426] p-4 flex items-center justify-between">
      <div className="text-white text-xl font-semibold">Producer Dashboard</div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/dashboard/create-competition")}
          className="px-4 py-2 rounded-lg bg-[#4f46e5] hover:bg-[#4338ca] text-white"
        >
          Create Competition
        </button>

        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-lg bg-[#1f1f22] hover:bg-[#2b2b30] border border-[#2e2e32] text-gray-200"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
