"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axiosInstance from "../../../../libs/axios";

export default function CompetitionDetailsPage() {
  const { competitionId } = useParams();
  const router = useRouter();

  const [competition, setCompetition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const loadDetails = async () => {
      try {
        const res = await axiosInstance.get(
          `/producer/competitions/${competitionId}`
        );
        console.log(res.data);

        setCompetition(res.data);
      } catch (err) {
        console.error("Failed to load competition:", err);
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [competitionId]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this competition?")) return;

    setDeleteLoading(true);

    try {
      await axiosInstance.delete(`/producer/competitions/${competitionId}`);
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      alert("Failed to delete competition.");
    }

    setDeleteLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0e0f12] text-gray-300 flex items-center justify-center">
        Loading details...
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="min-h-screen bg-[#0e0f12] text-gray-300 flex items-center justify-center">
        Competition not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0e0f12] text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-[#1f1f22] border border-[#2a2a2d] rounded-lg hover:bg-[#2b2b30]"
        >
          ← Back
        </button>

        <div className="flex gap-3">
          <button
            onClick={() =>
              router.push(`/dashboard/view-competition/${competitionId}/edit`)
            }
            className="px-4 py-2 bg-[#4f46e5] hover:bg-[#4338ca] rounded-lg"
          >
            Edit
          </button>

          <button
            onClick={handleDelete}
            disabled={deleteLoading}
            className="px-4 py-2 bg-[#d03f3f] hover:bg-[#b33232] rounded-lg"
          >
            {deleteLoading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-[#1a1b1e] border border-[#2a2b2f] rounded-xl p-8 shadow-lg">
        <h1 className="text-3xl font-semibold">{competition.name}</h1>
        <p className="text-gray-400 mt-2">{competition.description}</p>

        {/* Type */}
        <p className="mt-4 text-gray-300">
          <span className="text-gray-500">Type: </span>
          {competition.type}
        </p>

        {/* Created By */}
        <p className="text-gray-300 mt-1">
          <span className="text-gray-500">Created By: </span>
          {competition.createdBy?.name} ({competition.createdBy?.email})
        </p>

        {/* Created At */}
        <p className="text-gray-400 text-sm mt-1">
          {new Date(competition.createdAt).toLocaleString()}
        </p>

        {/* Criteria */}
        <div className="mt-8">
          <h2 className="text-2xl font-semibold mb-3">Scoring Criteria</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {competition.criteria.map((c, idx) => (
              <div
                key={idx}
                className="p-4 bg-[#111113] border border-[#2a2a2d] rounded-lg"
              >
                <p className="text-lg">{c.name}</p>
                <p className="text-gray-400 text-sm">Max Score: {c.maxScore}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Judges */}
        <div className="mt-10">
          <h2 className="text-2xl font-semibold mb-3">Judges</h2>
          {competition.judges.length === 0 ? (
            <p className="text-gray-500">No judges assigned yet.</p>
          ) : (
            <div className="space-y-3">
              {competition.judges.map((j) => (
                <div
                  key={j.id}
                  className="p-4 bg-[#111113] border border-[#2a2a2d] rounded-lg"
                >
                  <p>{j.name}</p>
                  <p className="text-gray-400 text-sm">{j.email}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
