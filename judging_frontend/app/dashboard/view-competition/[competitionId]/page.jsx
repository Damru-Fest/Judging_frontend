"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axiosInstance from "../../../../libs/axios";
import { useAuth } from "../../../../context/Auth";

export default function CompetitionDetailsPage() {
  const { competitionId } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [competition, setCompetition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [currentParticipant, setCurrentParticipant] = useState(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrix, setMatrix] = useState(null); // NEW
  const [scoreInputs, setScoreInputs] = useState({});
  const [submitScoreLoading, setSubmitScoreLoading] = useState(false);
  const [scoreError, setScoreError] = useState("");

  const openScoreModal = async (participant) => {
    setShowScoreModal(true);
    setMatrixLoading(true);
    setScoreError("");
    setMatrix(null);
    setCurrentParticipant(participant);

    try {
      const res = await axiosInstance.get(
        `/judge/competitions/${competitionId}/participants/${participant._id}/matrix`
      );

      setMatrix(res.data);

      // Preload score inputs
      const criteria = res.data.competition.criteria;
      const existing = res.data.existingScore;

      const initial = {};

      if (existing && existing.scores) {
        existing.scores.forEach((s) => {
          initial[s.criterionName] = s.value;
        });
      } else {
        criteria.forEach((c) => {
          initial[c.name] = 0;
        });
      }

      setScoreInputs(initial);
    } catch (err) {
      console.log(err);
      setScoreError("Failed to load scoring data");
    }

    setMatrixLoading(false);
  };

  const updateScoreInput = (criterionName, value) => {
    setScoreInputs((prev) => ({
      ...prev,
      [criterionName]: Number(value),
    }));
  };

  const submitScore = async () => {
    if (!currentParticipant) return;

    setSubmitScoreLoading(true);
    setScoreError("");

    try {
      const payload = {
        participantId: currentParticipant._id,
        scores: competition.criteria.map((c) => ({
          criterionName: c.name,
          value: scoreInputs[c.name] ?? 0,
        })),
      };
      await axiosInstance.post(
        `/judge/competitions/${competitionId}/scores`,
        payload
      );

      setShowScoreModal(false);

      // refresh list
      const roleForRefresh =
        user.role === "producer" || user.role === "director"
          ? "director"
          : "judge";

      const pRes = await axiosInstance.get(
        `/${roleForRefresh}/competitions/${competitionId}/participants`
      );

      setParticipants(pRes.data || []);
    } catch (err) {
      console.log(err);
      setScoreError("Failed to submit score");
    }

    setSubmitScoreLoading(false);
  };

  const handleCSVUpload = async (file) => {
    if (!file) return;

    setUploading(true);
    setUploadError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      await axiosInstance.post(
        `/director/competitions/${competitionId}/participants/upload`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      // Close modal
      setShowUpload(false);

      // Reload participants list
      const pRes = await axiosInstance.get(
        `/director/competitions/${competitionId}/participants`
      );
      setParticipants(pRes.data || []);
    } catch (err) {
      console.error(err);
      setUploadError("Failed to upload CSV");
    }

    setUploading(false);
  };

  useEffect(() => {
    const loadDetails = async () => {
      try {
        let role;
        if (user.role === "producer" || user.role === "director") {
          role = "director";
        } else {
          role = user.role;
        }
        const res = await axiosInstance.get(
          `/${user.role}/competitions/${competitionId}`
        );

        const pRes = await axiosInstance.get(
          `/${role}/competitions/${competitionId}/participants`
        );
        setParticipants(pRes.data || []);
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
      {showScoreModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <div className="bg-[#1a1b1e] border border-[#2a2a2d] p-6 rounded-xl w-96 shadow-xl">
            {matrixLoading ? (
              <p className="text-gray-300 text-center">Loading...</p>
            ) : matrix ? (
              <>
                <h2 className="text-xl font-semibold mb-4">
                  Score:{" "}
                  {matrix.participant.teamName ||
                    matrix.participant.members?.[0] ||
                    "Participant"}
                </h2>

                {scoreError && (
                  <p className="text-red-400 mb-2 text-sm">{scoreError}</p>
                )}

                {/* Criteria Inputs */}
                <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                  {matrix.competition.criteria.map((c) => (
                    <div key={c.name} className="flex flex-col">
                      <label className="text-gray-300 mb-1">
                        {c.name} (max {c.maxScore})
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={c.maxScore}
                        value={scoreInputs[c.name]}
                        onChange={(e) =>
                          setScoreInputs((prev) => ({
                            ...prev,
                            [c.name]: Number(e.target.value),
                          }))
                        }
                        className="p-3 bg-[#111113] border border-[#2a2a2d] rounded-lg text-white"
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={submitScore}
                  disabled={submitScoreLoading}
                  className="mt-4 w-full py-2 bg-[#4f46e5] hover:bg-[#4338ca] rounded-lg text-white"
                >
                  {submitScoreLoading ? "Submitting..." : "Submit Score"}
                </button>

                <button
                  onClick={() => setShowScoreModal(false)}
                  className="mt-2 w-full py-2 bg-[#2a2b2f] hover:bg-[#35363b] rounded-lg text-white"
                >
                  Cancel
                </button>
              </>
            ) : (
              <p className="text-red-400">Failed to load matrix</p>
            )}
          </div>
        </div>
      )}

      {showUpload && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1a1b1e] border border-[#2a2a2d] p-6 rounded-xl w-96 shadow-xl">
            <h2 className="text-xl font-semibold mb-4">
              Upload Participants CSV
            </h2>

            {uploadError && (
              <p className="text-red-400 mb-2 text-sm">{uploadError}</p>
            )}

            <input
              type="file"
              accept=".csv"
              onChange={(e) => handleCSVUpload(e.target.files[0])}
              className="w-full bg-[#111113] border border-[#2a2a2d] p-3 rounded-lg text-white"
            />

            <button
              onClick={() => setShowUpload(false)}
              className="mt-4 w-full py-2 bg-[#2a2b2f] hover:bg-[#35363b] rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-[#1f1f22] border border-[#2a2a2d] rounded-lg hover:bg-[#2b2b30]"
        >
          ← Back
        </button>

        <div className="flex gap-3">
          {user.role === "producer" && (
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  router.push(
                    `/dashboard/view-competition/${competitionId}/edit`
                  )
                }
                className="px-4 py-2 bg-[#4f46e5] hover:bg-[#4338ca] rounded-lg"
              >
                Edit
              </button>

              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="px-4 py-2 bg-[#d03f3f] hover:bg-[#b33232] rounded-lg disabled:opacity-50"
              >
                {deleteLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          )}
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
                  key={j._id}
                  className="p-4 bg-[#111113] border border-[#2a2a2d] rounded-lg"
                >
                  <p>{j.name}</p>
                  <p className="text-gray-400 text-sm">{j.email}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Participants */}
        <div className="mt-10">
          <h2 className="text-2xl font-semibold mb-3">Participants</h2>
          {(user.role === "producer" || user.role === "director") && (
            <button
              onClick={() => setShowUpload(true)}
              className="mb-4 px-4 py-2 bg-[#4f46e5] hover:bg-[#4338ca] rounded-lg"
            >
              Upload CSV
            </button>
          )}

          {participants.length === 0 ? (
            <p className="text-gray-500">No participants yet.</p>
          ) : (
            <div className="space-y-6">
              {/* TEAM GROUPING */}
              {Object.entries(
                participants.reduce((acc, p) => {
                  const team = p.teamName || `Participant-${p.members[0]}`;
                  if (!acc[team]) acc[team] = [];
                  acc[team].push(p);
                  return acc;
                }, {})
              ).map(([teamName, teamMembers], idx) => (
                <div
                  key={idx}
                  className="bg-[#111113] border border-[#2a2a2d] p-5 rounded-lg"
                >
                  <h3 className="text-xl font-medium mb-3">
                    {teamName === `Participant-${teamMembers[0].members[0]}`
                      ? `Solo Participant`
                      : teamName}
                  </h3>

                  <div className="space-y-2">
                    {teamMembers.map((p) => (
                      <div
                        key={p._id}
                        className="bg-[#1a1b1e] border border-[#2a2b2f] p-3 rounded-lg"
                      >
                        <p className="text-lg text-white">
                          {p.teamName ? p.teamName : p.members[0]}
                        </p>

                        {/* SCORE BUTTON — only for judges */}
                        {user.role === "judge" && (
                          <button
                            onClick={() => openScoreModal(p)}
                            className="mt-3 px-4 py-2 bg-[#4f46e5] hover:bg-[#4338ca] rounded-lg text-sm"
                          >
                            Score Participant
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
