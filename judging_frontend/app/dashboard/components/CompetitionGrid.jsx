"use client";

import { useEffect, useState } from "react";
import axiosInstance from "../../../libs/axios";
import EmptyState from "./EmptyState";
import { useRouter } from "next/navigation";
export default function CompetitionGrid({ role }) {
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadCompetitions = async () => {
    try {
      const res = await axiosInstance.get(`/${role}/competitions`);
      setCompetitions(res.data);
    } catch (err) {
      console.log("Error loading competitions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompetitions();
  }, []);

  const pushToCompe = (id) => {
    router.push(`/dashboard/view-competition/${id}`);
  };

  const selectCompe = async (id) => {
    try {
      const res = await axiosInstance.post(`/judge/competitions/${id}/select`);
      router.push(`/dashboard/view-competition/${id}`);
    } catch (err) {
      console.log("Error loading competitions:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-gray-300 p-6">Loading competitions...</div>;
  }

  if (!loading && competitions?.length === 0) {
    return <EmptyState />;
  }
  console.log(competitions);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6">
      {competitions?.map((comp) => (
        <div
          key={comp._id}
          className="bg-[#1a1b1e] p-5 rounded-xl border border-[#2a2b2f] hover:border-[#4f46e5] transition-colors"
        >
          <h3 className="text-white text-xl font-semibold">{comp.name}</h3>
          <p className="text-gray-400 text-sm mt-2 line-clamp-2">
            {comp.description}
          </p>

          <div className="mt-4 flex justify-between text-sm text-gray-300">
            <span>Type: {comp.type}</span>
            <span>{comp.participantCount} participants</span>
          </div>
          {(role === "producer" || role === "director") && (
            <button
              className="mt-4 w-full bg-[#4f46e5] px-4 py-2 rounded-lg hover:bg-[#4338ca] text-white"
              onClick={() => pushToCompe(comp._id)}
            >
              View Details
            </button>
          )}
          {role === "judge" && (
            <button
              className="mt-4 w-full bg-[#4f46e5] px-4 py-2 rounded-lg hover:bg-[#4338ca] text-white"
              onClick={() => selectCompe(comp._id)}
            >
              Select
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
