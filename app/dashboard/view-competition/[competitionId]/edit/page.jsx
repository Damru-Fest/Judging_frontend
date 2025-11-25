"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axiosInstance from "../../../../../libs/axios";

export default function EditCompetitionPage() {
  const { competitionId } = useParams();
  const router = useRouter();

  const [competition, setCompetition] = useState(null);
  const [existingCriteria, setExistingCriteria] = useState([]); // read-only
  const [newCriteria, setNewCriteria] = useState([]); // user-added only

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch competition data
  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await axiosInstance.get(`/competitions/${competitionId}`);
        const comp = res.data?.competition || res.data?.data;

        setCompetition(comp);

        // Existing criteria are read-only
        setExistingCriteria(
          (comp.criteria || []).map((c) => ({
            name: c.name,
            maxScore: c.maxScore,
          }))
        );
      } catch (err) {
        console.error(err);
        setError("Failed to load competition.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [competitionId]);

  // Add new empty criteria row
  const addCriteria = () => {
    setNewCriteria([...newCriteria, { name: "", maxScore: "" }]);
  };

  // Update a new criteria row
  const updateNewCriteria = (i, field, value) => {
    const updated = [...newCriteria];
    updated[i][field] = value;
    setNewCriteria(updated);
  };

  // Submit only added criteria
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      // Build array payload
      const payload = {
        criteria: newCriteria.map((crit) => ({
          name: crit.name,
          weight: Number(crit.maxScore),
        })),
      };

      // POST request to add all criteria in one go
      await axiosInstance.post(
        `/competitions/${competitionId}/criteria`,
        payload
      );

      // Redirect after save
      router.push(`/dashboard/view-competition/${competitionId}`);
    } catch (err) {
      console.error(err);
      setError("Failed to add criteria.");
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  if (!competition) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Competition not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0e0f12] text-white p-6 flex justify-center">
      <div className="max-w-2xl w-full bg-[#1a1b1e] border border-[#2d2e32] p-8 rounded-xl shadow-lg">
        <h1 className="text-3xl font-semibold mb-6">Add Criteria</h1>

        {error && <p className="text-red-400 mb-4">{error}</p>}

        {/* NON-EDITABLE FIELDS */}
        <div className="mb-6 space-y-3">
          <div>
            <p className="text-gray-500 text-sm">Competition Name</p>
            <p className="text-lg">{competition.title}</p>
          </div>

          <div>
            <p className="text-gray-500 text-sm">Description</p>
            <p className="text-gray-300">{competition.description}</p>
          </div>

          <div>
            <p className="text-gray-500 text-sm">Type</p>
            <p className="capitalize">{competition.type}</p>
          </div>
        </div>

        {/* EXISTING CRITERIA (READ-ONLY) */}
        <div>
          <h2 className="text-xl mb-3">Existing Criteria</h2>
          <div className="space-y-4">
            {existingCriteria.map((crit, index) => (
              <div
                key={index}
                className="bg-[#111113] border border-[#2d2d30] p-4 rounded-lg"
              >
                <p className="text-lg">{crit.name}</p>
                <p className="text-gray-400 text-sm">
                  Max Score: {crit.maxScore}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* NEW CRITERIA */}
        <form onSubmit={handleSave} className="space-y-6 mt-8">
          <h2 className="text-xl mb-3">Add New Criteria</h2>

          <div className="space-y-4">
            {newCriteria.map((crit, index) => (
              <div
                key={index}
                className="bg-[#111113] border border-[#2d2d30] p-4 rounded-lg"
              >
                <input
                  type="text"
                  placeholder="Criteria Name"
                  className="w-full p-3 bg-[#1b1c1f] border border-[#2b2b2f] rounded-lg text-white mb-3 focus:border-[#4f46e5]"
                  value={crit.name}
                  onChange={(e) =>
                    updateNewCriteria(index, "name", e.target.value)
                  }
                  required
                  minLength={2}
                  maxLength={50}
                />

                <input
                  type="number"
                  placeholder="Max Score"
                  className="w-32 p-3 bg-[#1b1c1f] border border-[#2b2b2f] rounded-lg text-white focus:border-[#4f46e5]"
                  value={crit.maxScore}
                  onChange={(e) =>
                    updateNewCriteria(index, "maxScore", e.target.value)
                  }
                  required
                  min={1}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addCriteria}
            className="px-4 py-2 bg-[#2d2e32] hover:bg-[#3a3b40] text-gray-200 rounded-lg text-sm"
          >
            + Add Criteria
          </button>

          {/* SAVE */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-lg mt-4 text-lg"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
