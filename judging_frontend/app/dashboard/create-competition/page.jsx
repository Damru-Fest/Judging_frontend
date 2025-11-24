"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../context/Auth";
import axiosInstance from "../../../libs/axios";
import ProducerNavbar from "../components/ProducerNavbar";
import CompetitionGrid from "../components/CompetitionGrid";

export default function CreateCompetitionPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  if (authLoading) return <LoadingLogo />;

  if (!user) return null;

  // Only producers see this version of the dashboard
  if (user.role !== "producer") {
    return router.replace("/login");
  }

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("solo");

  const [criteria, setCriteria] = useState([{ name: "", weight: "" }]);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // add criteria row
  const addCriteria = () => {
    setCriteria([...criteria, { name: "", weight: "" }]);
  };

  // remove criteria row
  const removeCriteria = (index) => {
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  // update criteria fields
  const updateCriteria = (index, field, value) => {
    const updated = [...criteria];
    updated[index][field] = value;
    setCriteria(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const payload = {
        name,
        description,
        type,
        criteria: criteria
          .filter((c) => c.name.trim().length > 0)
          .map((c) => ({
            name: c.name,
            weight: Number(c.weight),
          })),
      };

      await axiosInstance.post("/producer/competitions", payload);

      router.push("/dashboard");
    } catch (err) {
      console.log(err);
      setError("Failed to create competition.");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0e0f12] text-white p-6 flex justify-center">
      <div className="max-w-2xl w-full bg-[#1a1b1e] border border-[#2d2e32] rounded-xl p-8 shadow-lg">
        <h1 className="text-3xl font-semibold mb-6">Create Competition</h1>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-gray-300 mb-1">Competition Name</label>
            <input
              type="text"
              className="w-full p-3 bg-[#111113] border border-[#2a2a2d] rounded-lg text-white focus:border-[#4f46e5] outline-none"
              placeholder="Programming Challenge 2025"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={3}
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-gray-300 mb-1">Description</label>
            <textarea
              className="w-full p-3 bg-[#111113] border border-[#2a2a2d] rounded-lg text-white focus:border-[#4f46e5] outline-none"
              placeholder="Annual programming competition"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-gray-300 mb-2">Type</label>
            <select
              className="w-full p-3 bg-[#111113] border border-[#2a2a2d] rounded-lg text-white focus:border-[#4f46e5]"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="solo">Solo</option>
              <option value="team">Team</option>
            </select>
          </div>

          {/* Criteria List */}
          <div>
            <label className="block text-gray-300 mb-3">Scoring Criteria</label>

            {criteria.map((crit, index) => (
              <div
                key={index}
                className="bg-[#111113] border border-[#2d2d30] p-4 rounded-lg mb-4"
              >
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Criteria Name"
                    className="w-full p-3 bg-[#1b1c1f] border border-[#2b2b2f] rounded-lg text-white focus:border-[#4f46e5]"
                    value={crit.name}
                    onChange={(e) =>
                      updateCriteria(index, "name", e.target.value)
                    }
                    required
                    minLength={2}
                    maxLength={50}
                  />

                  <input
                    type="number"
                    placeholder="Max Score"
                    className="w-32 p-3 bg-[#1b1c1f] border border-[#2b2b2f] rounded-lg text-white focus:border-[#4f46e5]"
                    value={crit.weight}
                    onChange={(e) =>
                      updateCriteria(index, "weight", e.target.value)
                    }
                    required
                    min={1}
                  />
                </div>

                {/* Remove button */}
                {criteria.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCriteria(index)}
                    className="mt-3 text-red-400 hover:text-red-300 text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}

            {/* Add Criteria Button */}
            <button
              type="button"
              onClick={addCriteria}
              className="px-4 py-2 bg-[#2d2e32] hover:bg-[#3a3b40] text-gray-200 rounded-lg text-sm"
            >
              + Add Criteria
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-lg mt-4 text-lg"
          >
            {loading ? "Creating..." : "Create Competition"}
          </button>
        </form>
      </div>
    </div>
  );
}
