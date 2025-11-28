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
  const [scoringMode, setScoringMode] = useState({}); // participantId: boolean
  const [scoreInputs, setScoreInputs] = useState({}); // participantId: { criterionName: value }
  const [submitScoreLoading, setSubmitScoreLoading] = useState({}); // participantId: boolean
  const [scoreErrors, setScoreErrors] = useState({}); // participantId: string
  const [existingScores, setExistingScores] = useState({}); // participantId: scores array
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardMeta, setLeaderboardMeta] = useState(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [showFullLeaderboard, setShowFullLeaderboard] = useState(false);
  const [leaderboardView, setLeaderboardView] = useState("podium"); // 'podium' or 'table'
  const [sortBy, setSortBy] = useState("avgTotal");
  const [expandedParticipant, setExpandedParticipant] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteParticipantLoading, setDeleteParticipantLoading] = useState({});
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);

  const initializeScoring = async (participant) => {
    const participantId = participant.id;

    setScoringMode((prev) => ({ ...prev, [participantId]: true }));
    setScoreErrors((prev) => ({ ...prev, [participantId]: "" }));

    try {
      const res = await axiosInstance.get(
        `/competitions/${competitionId}/participant/${participantId}/matrix`
      );

      const existing = res.data.existingScores;
      const initial = {};

      if (existing && existing.length > 0) {
        existing.forEach((s) => {
          initial[s.criteria.name] = s.score;
        });
        setExistingScores((prev) => ({
          ...prev,
          [participantId]: existing,
        }));
      } else {
        competition.criteria.forEach((c) => {
          initial[c.name] = 0;
        });
      }

      setScoreInputs((prev) => ({ ...prev, [participantId]: initial }));
    } catch (err) {
      console.log(err);
      setScoreErrors((prev) => ({
        ...prev,
        [participantId]: "Failed to load scoring data",
      }));
    }
  };

  const updateScoreInput = (participantId, criterionName, value) => {
    setScoreInputs((prev) => ({
      ...prev,
      [participantId]: {
        ...prev[participantId],
        [criterionName]: Number(value),
      },
    }));
  };

  const cancelScoring = (participantId) => {
    setScoringMode((prev) => ({ ...prev, [participantId]: false }));
    setScoreErrors((prev) => ({ ...prev, [participantId]: "" }));
  };

  const submitScore = async (participantId) => {
    setSubmitScoreLoading((prev) => ({ ...prev, [participantId]: true }));
    setScoreErrors((prev) => ({ ...prev, [participantId]: "" }));

    try {
      const payload = {
        competitionId: competitionId,
        participantId: participantId,
        scores: competition.criteria?.map((c) => ({
          criteriaId: c.id,
          value: scoreInputs[participantId]?.[c.name] ?? 0,
        })),
      };
      await axiosInstance.post(`/competitions/score`, payload);

      setScoringMode((prev) => ({ ...prev, [participantId]: false }));

      // refresh list
      const pRes = await axiosInstance.get(
        `/competitions/${competitionId}/participants`
      );

      setParticipants(pRes.data || []);

      // Refresh leaderboard as well
      await loadLeaderboard();
    } catch (err) {
      console.log(err);
      setScoreErrors((prev) => ({
        ...prev,
        [participantId]: "Failed to submit score",
      }));
    }

    setSubmitScoreLoading((prev) => ({ ...prev, [participantId]: false }));
  };

  const handleCSVUpload = async (file) => {
    if (!file) return;

    setUploading(true);
    setUploadError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      await axiosInstance.post(
        `/competitions/${competitionId}/participants/upload`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      // Close modal
      setShowUpload(false);

      // Reload participants list
      const pRes = await axiosInstance.get(
        `/competitions/${competitionId}/participants`
      );
      setParticipants(pRes.data || []);
    } catch (err) {
      console.error(err);
      setUploadError("Failed to upload CSV");
    }

    setUploading(false);
  };

  const deleteParticipant = async (participantId) => {
    if (!confirm("Are you sure you want to delete this participant?")) return;

    setDeleteParticipantLoading((prev) => ({ ...prev, [participantId]: true }));

    try {
      const response = await fetch(
        `/api/competitions/${competitionId}/participants/${participantId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete participant");
      }

      // Remove participant from local state
      setParticipants((prev) => prev.filter((p) => p.id !== participantId));

      // Reload leaderboard
      loadLeaderboard();
    } catch (err) {
      console.error("Delete participant error:", err);
      alert(`Error deleting participant: ${err.message}`);
    }

    setDeleteParticipantLoading((prev) => ({
      ...prev,
      [participantId]: false,
    }));
  };

  const handleDragStart = (e, index) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverItem(index);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();

    if (draggedItem === null || draggedItem === dropIndex) return;

    const newParticipants = [...filteredParticipants];
    const draggedParticipant = newParticipants[draggedItem];

    // Remove dragged item
    newParticipants.splice(draggedItem, 1);

    // Insert at new position
    newParticipants.splice(dropIndex, 0, draggedParticipant);

    // Update the main participants array with new order
    const reorderedParticipants = [...participants];
    filteredParticipants.forEach((participant, index) => {
      const mainIndex = reorderedParticipants.findIndex(
        (p) => p.id === participant.id
      );
      if (mainIndex !== -1) {
        reorderedParticipants[mainIndex] = newParticipants[index];
      }
    });

    setParticipants(reorderedParticipants);
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const loadLeaderboard = async () => {
    try {
      setLeaderboardLoading(true);
      const lbRes = await axiosInstance.get(
        `/leaderboard/${competitionId}?limit=${
          showFullLeaderboard ? 50 : 10
        }&sortBy=${sortBy}`
      );
      setLeaderboard(lbRes.data.leaderboard || []);
      setLeaderboardMeta(lbRes.data.metadata || null);
    } catch (err) {
      console.error("Failed to load leaderboard:", err);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  useEffect(() => {
    const loadDetails = async () => {
      try {
        const res = await axiosInstance.get(`/competitions/${competitionId}`);

        const pRes = await axiosInstance.get(
          `/competitions/${competitionId}/participants`
        );

        setParticipants(pRes.data || []);
        setCompetition(res.data?.competition || res.data?.data);
        await loadLeaderboard();
      } catch (err) {
        console.error("Failed to load competition:", err);
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [competitionId]);

  useEffect(() => {
    if (competition) {
      loadLeaderboard();
    }
  }, [sortBy, showFullLeaderboard]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this competition?")) return;

    setDeleteLoading(true);

    try {
      await axiosInstance.delete(`/competitions/${competitionId}`);
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      alert("Failed to delete competition.");
    }

    setDeleteLoading(false);
  };

  // Filter participants based on search query
  const filteredParticipants = participants.filter((participant) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const teamName = participant.teamName?.toLowerCase() || "";
    const email = participant.email?.toLowerCase() || "";
    const members = Array.isArray(participant.members)
      ? participant.members.join(" ").toLowerCase()
      : "";

    return (
      teamName.includes(query) ||
      email.includes(query) ||
      members.includes(query)
    );
  });

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
          {(user.role === "PRODUCER" || user.role === "ADMIN") && (
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
        <h1 className="text-3xl font-semibold">{competition.title}</h1>
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
            {competition.criteria?.map((c, idx) => (
              <div
                key={c.id || c.name || idx}
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
          {!competition.Judges || competition.Judges.length === 0 ? (
            <p className="text-gray-500">No judges assigned yet.</p>
          ) : (
            <div className="space-y-3">
              {competition.Judges.map((j) => (
                <div
                  key={j.id || j.email}
                  className="p-4 bg-[#111113] border border-[#2a2a2d] rounded-lg"
                >
                  <p>{j.name}</p>
                  <p className="text-gray-400 text-sm">{j.email}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Leaderboard */}
        <div className="mt-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h2 className="text-3xl font-bold bg-linear-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Competition Leaderboard
            </h2>

            <div className="flex flex-wrap gap-3">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 bg-[#1a1b1e] border border-[#2a2a2d] rounded-lg text-white text-sm"
              >
                <option value="avgTotal">Average Score</option>
                <option value="totalSum">Total Sum</option>
                <option value="maxScore">Highest Score</option>
                <option value="latest">Most Recent</option>
              </select>

              <div className="flex bg-[#1a1b1e] border border-[#2a2a2d] rounded-lg p-1">
                <button
                  onClick={() => setLeaderboardView("podium")}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    leaderboardView === "podium"
                      ? "bg-[#4f46e5] text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Podium
                </button>
                <button
                  onClick={() => setLeaderboardView("table")}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    leaderboardView === "table"
                      ? "bg-[#4f46e5] text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Table
                </button>
              </div>

              <button
                onClick={() => setShowFullLeaderboard(!showFullLeaderboard)}
                className="px-4 py-2 bg-[#2a2b2f] hover:bg-[#35363b] border border-[#3a3a3d] rounded-lg text-white text-sm transition-colors"
              >
                {showFullLeaderboard ? "Show Top 10" : "Show All"}
              </button>
            </div>
          </div>

          {leaderboardLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4f46e5]"></div>
              <span className="ml-3 text-gray-400">Loading leaderboard...</span>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No scores submitted yet</p>
              <p className="text-gray-600 text-sm mt-2">
                Scores will appear here once judges start evaluating
              </p>
            </div>
          ) : (
            <>
              {/* Podium View */}
              {leaderboardView === "podium" && leaderboard.length >= 3 && (
                <div className="mb-8">
                  <div className="flex justify-center items-end gap-4 mb-8">
                    {/* 2nd Place */}
                    {leaderboard[1] && (
                      <div
                        className="text-center transform hover:scale-105 transition-transform cursor-pointer"
                        onClick={() =>
                          setExpandedParticipant(
                            expandedParticipant === leaderboard[1]._id
                              ? null
                              : leaderboard[1]._id
                          )
                        }
                      >
                        <div className="bg-linear-to-t from-gray-600 to-gray-400 text-white p-4 rounded-t-lg h-32 flex flex-col justify-end min-w-[120px]">
                          <div className="text-sm font-semibold truncate">
                            {leaderboard[1].participant?.teamName ||
                              leaderboard[1].participant?.members?.[0] ||
                              "Team"}
                          </div>
                          <div className="text-xs opacity-90">
                            {leaderboard[1].scores?.average ||
                              leaderboard[1].avgTotal}{" "}
                            pts
                          </div>
                        </div>
                        <div className="bg-linear-to-b from-gray-600 to-gray-800 text-white py-2 px-3 rounded-b-lg">
                          <div className="text-lg font-bold">#2</div>
                        </div>
                      </div>
                    )}

                    {/* 1st Place */}
                    {leaderboard[0] && (
                      <div
                        className="text-center transform hover:scale-105 transition-transform cursor-pointer"
                        onClick={() =>
                          setExpandedParticipant(
                            expandedParticipant === leaderboard[0]._id
                              ? null
                              : leaderboard[0]._id
                          )
                        }
                      >
                        <div className="bg-linear-to-t from-yellow-600 to-yellow-400 text-white p-4 rounded-t-lg h-40 flex flex-col justify-end min-w-[140px] shadow-lg shadow-yellow-500/20">
                          <div className="text-sm font-bold truncate">
                            {leaderboard[0].participant?.teamName ||
                              leaderboard[0].participant?.members?.[0] ||
                              "Team"}
                          </div>
                          <div className="text-xs opacity-90">
                            {leaderboard[0].scores?.average ||
                              leaderboard[0].avgTotal}{" "}
                            pts
                          </div>
                        </div>
                        <div className="bg-linear-to-b from-yellow-600 to-yellow-800 text-white py-3 px-4 rounded-b-lg">
                          <div className="text-xl font-bold">#1</div>
                        </div>
                      </div>
                    )}

                    {/* 3rd Place */}
                    {leaderboard[2] && (
                      <div
                        className="text-center transform hover:scale-105 transition-transform cursor-pointer"
                        onClick={() =>
                          setExpandedParticipant(
                            expandedParticipant === leaderboard[2]._id
                              ? null
                              : leaderboard[2]._id
                          )
                        }
                      >
                        <div className="bg-linear-to-t from-amber-700 to-amber-500 text-white p-4 rounded-t-lg h-28 flex flex-col justify-end min-w-[120px]">
                          <div className="text-sm font-semibold truncate">
                            {leaderboard[2].participant?.teamName ||
                              leaderboard[2].participant?.members?.[0] ||
                              "Team"}
                          </div>
                          <div className="text-xs opacity-90">
                            {leaderboard[2].scores?.average ||
                              leaderboard[2].avgTotal}{" "}
                            pts
                          </div>
                        </div>
                        <div className="bg-linear-to-b from-amber-700 to-amber-900 text-white py-2 px-3 rounded-b-lg">
                          <div className="text-lg font-bold">#3</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Table View / Remaining Positions */}
              <div className="space-y-3">
                {(leaderboardView === "table"
                  ? leaderboard
                  : leaderboard.slice(3)
                ).map((item, index) => {
                  const actualRank =
                    leaderboardView === "table" ? item.rank : item.rank;
                  const isExpanded = expandedParticipant === item._id;
                  const participantName =
                    item.participant?.teamName ||
                    item.participant?.members?.[0] ||
                    "Participant";

                  const getRankColor = (rank) => {
                    if (rank === 1)
                      return "from-yellow-500/20 to-yellow-600/10 border-yellow-500/30";
                    if (rank === 2)
                      return "from-gray-400/20 to-gray-500/10 border-gray-400/30";
                    if (rank === 3)
                      return "from-amber-500/20 to-amber-600/10 border-amber-500/30";
                    if (rank <= 10)
                      return "from-blue-500/10 to-purple-500/10 border-blue-500/20";
                    return "from-gray-600/10 to-gray-700/10 border-gray-600/20";
                  };

                  return (
                    <div
                      key={item._id}
                      className={`bg-linear-to-r ${getRankColor(
                        actualRank
                      )} border backdrop-blur-sm rounded-xl p-5 transition-all duration-300 hover:shadow-lg cursor-pointer ${
                        isExpanded
                          ? "shadow-lg shadow-[#4f46e5]/10"
                          : "hover:shadow-md"
                      }`}
                      onClick={() =>
                        setExpandedParticipant(isExpanded ? null : item._id)
                      }
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="flex items-center gap-3">
                              <span className="text-xl font-bold text-white">
                                #{actualRank}
                              </span>
                              <span className="text-lg font-semibold text-white">
                                {participantName}
                              </span>
                              {item.scores?.judgeCount > 1 && (
                                <span className="px-2 py-1 bg-[#4f46e5]/20 text-[#4f46e5] text-xs rounded-full">
                                  {item.scores.judgeCount} judges
                                </span>
                              )}
                            </div>
                            {item.participant?.members &&
                              item.participant.members.length > 1 && (
                                <p className="text-gray-400 text-sm mt-1">
                                  Team:{" "}
                                  {item.participant.members
                                    .slice(0, 3)
                                    .join(", ")}
                                  {item.participant.members.length > 3 &&
                                    ` +${
                                      item.participant.members.length - 3
                                    } more`}
                                </p>
                              )}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-2xl font-bold text-white">
                            {item.scores?.average || item.avgTotal}
                          </div>
                          <div className="text-gray-400 text-sm">
                            {item.percentile}th percentile
                          </div>
                          {item.scores?.maximum !== item.scores?.average && (
                            <div className="text-gray-500 text-xs">
                              Best: {item.scores?.maximum}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>Score Progress</span>
                          <span>
                            {Math.round(
                              ((item.scores?.average || item.avgTotal) /
                                competition.criteria.reduce(
                                  (sum, c) => sum + c.maxScore,
                                  0
                                )) *
                                100
                            )}
                            %
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-linear-to-r from-[#4f46e5] to-purple-500 h-2 rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(
                                100,
                                ((item.scores?.average || item.avgTotal) /
                                  competition.criteria.reduce(
                                    (sum, c) => sum + c.maxScore,
                                    0
                                  )) *
                                  100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-gray-600/30">
                          {/* Judge Scores */}
                          {item.allJudgeScores &&
                            item.allJudgeScores.length > 0 && (
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {item.allJudgeScores.map((judge, jIdx) => (
                                  <div
                                    key={
                                      judge.judgeId || judge.judgeName || jIdx
                                    }
                                    className="bg-[#0a0a0c]/50 border border-[#2a2a2d] p-4 rounded-lg"
                                  >
                                    <div className="flex justify-between items-center mb-3">
                                      <h4 className="text-white font-medium">
                                        {judge.judgeName || `Judge ${jIdx + 1}`}
                                      </h4>
                                      <span className="text-[#4f46e5] font-bold">
                                        {judge.score} pts
                                      </span>
                                    </div>

                                    <div className="space-y-2">
                                      {judge.criteriaScores?.map(
                                        (crit, cIdx) => (
                                          <div
                                            key={crit.criterionName || cIdx}
                                            className="flex justify-between items-center"
                                          >
                                            <span className="text-gray-300 text-sm">
                                              {crit.criterionName}
                                            </span>
                                            <div className="flex items-center gap-2">
                                              <div className="w-16 bg-gray-700 rounded-full h-1.5">
                                                <div
                                                  className="bg-[#4f46e5] h-1.5 rounded-full"
                                                  style={{
                                                    width: `${
                                                      (crit.value /
                                                        competition.criteria.find(
                                                          (c) =>
                                                            c.name ===
                                                            crit.criterionName
                                                        )?.maxScore || 1) * 100
                                                    }%`,
                                                  }}
                                                />
                                              </div>
                                              <span className="text-white text-sm font-medium min-w-8 text-right">
                                                {crit.value}
                                              </span>
                                            </div>
                                          </div>
                                        )
                                      )}
                                    </div>

                                    <p className="text-gray-500 text-xs mt-3">
                                      {new Date(
                                        judge.submittedAt
                                      ).toLocaleDateString()}{" "}
                                      at{" "}
                                      {new Date(
                                        judge.submittedAt
                                      ).toLocaleTimeString()}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Enhanced Statistics */}
              {leaderboardMeta && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
                  <div className="bg-linear-to-br from-green-500/10 to-green-600/5 border border-green-500/20 p-6 rounded-xl">
                    <div className="text-2xl font-bold text-white">
                      {leaderboardMeta.statistics?.highestScore || "N/A"}
                    </div>
                    <div className="text-gray-400 text-sm">Highest Score</div>
                  </div>

                  <div className="bg-linear-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 p-6 rounded-xl">
                    <div className="text-2xl font-bold text-white">
                      {leaderboardMeta.statistics?.averageScore?.toFixed(1) ||
                        "N/A"}
                    </div>
                    <div className="text-gray-400 text-sm">Average Score</div>
                  </div>

                  <div className="bg-linear-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 p-6 rounded-xl">
                    <div className="text-2xl font-bold text-white">
                      {leaderboardMeta.totalParticipants || 0}
                    </div>
                    <div className="text-gray-400 text-sm">
                      Total Participants
                    </div>
                  </div>

                  <div className="bg-linear-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 p-6 rounded-xl">
                    <div className="text-2xl font-bold text-white">
                      {leaderboardMeta.statistics?.completionRate || 0}%
                    </div>
                    <div className="text-gray-400 text-sm">Completion Rate</div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Participants */}
        <div className="mt-10">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">Participants & Scoring</h2>
            {(user.role === "PRODUCER" ||
              user.role === "DIRECTOR" ||
              user.role === "ADMIN") && (
              <div className="flex gap-3">
                <button
                  onClick={() => setShowUpload(true)}
                  className="px-4 py-2 bg-[#4f46e5] hover:bg-[#4338ca] rounded-lg"
                >
                  Upload CSV
                </button>
                {participants.length > 0 && (
                  <div className="text-sm text-gray-400 flex items-center">
                    <svg
                      className="w-4 h-4 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                      />
                    </svg>
                    Drag to reorder
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Search participants by name, team, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 pl-10 bg-[#111113] border border-[#2a2a2d] rounded-lg text-white placeholder-gray-500 focus:border-[#4f46e5] focus:ring-1 focus:ring-[#4f46e5] transition-colors"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="text-gray-400 text-sm mt-2">
                Found {filteredParticipants.length} of {participants.length}{" "}
                participants
              </p>
            )}
          </div>

          {participants.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No participants yet</p>
              <p className="text-gray-600 text-sm mt-2">
                Upload a CSV file to add participants
              </p>
            </div>
          ) : filteredParticipants.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No participants found</p>
              <p className="text-gray-600 text-sm mt-2">
                Try adjusting your search criteria
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredParticipants.map((participant, index) => {
                const isScoring = scoringMode[participant.id];
                const participantScores = scoreInputs[participant.id] || {};
                const isSubmitting = submitScoreLoading[participant.id];
                const hasError = scoreErrors[participant.id];
                const isDeleting = deleteParticipantLoading[participant.id];
                const canManageParticipants =
                  user.role === "PRODUCER" ||
                  user.role === "DIRECTOR" ||
                  user.role === "ADMIN";

                return (
                  <div
                    key={participant.id || participant.email}
                    className={`bg-[#111113] border border-[#2a2a2d] rounded-lg overflow-hidden transition-all duration-200 ${
                      dragOverItem === index
                        ? "border-[#4f46e5] shadow-lg shadow-[#4f46e5]/20"
                        : ""
                    } ${draggedItem === index ? "opacity-50" : ""}`}
                    draggable={canManageParticipants}
                    onDragStart={(e) =>
                      canManageParticipants && handleDragStart(e, index)
                    }
                    onDragOver={(e) =>
                      canManageParticipants && handleDragOver(e, index)
                    }
                    onDragEnd={handleDragEnd}
                    onDrop={(e) =>
                      canManageParticipants && handleDrop(e, index)
                    }
                  >
                    {/* Participant Header */}
                    <div className="p-5 border-b border-[#2a2a2d]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          {canManageParticipants && (
                            <div className="cursor-move text-gray-500 hover:text-gray-300">
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                                />
                              </svg>
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              {participant.teamName ? (
                                <div>
                                  <h3 className="text-xl font-semibold text-white">
                                    {participant.teamName}
                                  </h3>
                                  <p className="text-gray-400 text-sm mt-1">
                                    Team Members:{" "}
                                    {Array.isArray(participant.members)
                                      ? participant.members.join(", ")
                                      : "No members"}
                                  </p>
                                </div>
                              ) : (
                                <h3 className="text-xl font-semibold text-white">
                                  {participant.members?.[0] || "Participant"}
                                </h3>
                              )}
                            </div>
                            {participant.email && (
                              <p className="text-gray-500 text-sm">
                                📧 {participant.email}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2 items-center">
                          {user.role === "JUDGE" && (
                            <>
                              {!isScoring ? (
                                <button
                                  onClick={() => initializeScoring(participant)}
                                  className="px-4 py-2 bg-[#4f46e5] hover:bg-[#4338ca] rounded-lg text-sm transition-colors"
                                >
                                  Score Participant
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => submitScore(participant.id)}
                                    disabled={isSubmitting}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-sm transition-colors flex items-center gap-2"
                                  >
                                    {isSubmitting ? (
                                      <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Saving...
                                      </>
                                    ) : (
                                      <>Save Score</>
                                    )}
                                  </button>
                                  <button
                                    onClick={() =>
                                      cancelScoring(participant.id)
                                    }
                                    disabled={isSubmitting}
                                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 rounded-lg text-sm transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}
                            </>
                          )}

                          {canManageParticipants && (
                            <button
                              onClick={() => deleteParticipant(participant.id)}
                              disabled={isDeleting}
                              className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-sm transition-colors flex items-center gap-2"
                              title="Delete participant"
                            >
                              {isDeleting ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              ) : (
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {hasError && (
                        <div className="mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                          <p className="text-red-400 text-sm">{hasError}</p>
                        </div>
                      )}
                    </div>

                    {/* Scoring Interface */}
                    {isScoring && (
                      <div className="p-5 bg-[#0a0b0e]">
                        <h4 className="text-lg font-medium mb-4 text-white">
                          Score Criteria
                        </h4>

                        {/* Excel-like scoring grid */}
                        <div className="overflow-x-auto">
                          <div className="min-w-full">
                            {/* Header */}
                            <div
                              className="grid gap-3 mb-3"
                              style={{
                                gridTemplateColumns: `2fr repeat(${competition.criteria.length}, 1fr) 1fr`,
                              }}
                            >
                              <div className="font-medium text-gray-300 text-sm">
                                Criterion
                              </div>
                              {competition.criteria?.map((criterion) => (
                                <div
                                  key={criterion.id || criterion.name}
                                  className="text-center font-medium text-gray-300 text-sm"
                                >
                                  {criterion.name}
                                  <div className="text-xs text-gray-500 mt-1">
                                    (max {criterion.maxScore})
                                  </div>
                                </div>
                              ))}
                              <div className="text-center font-medium text-gray-300 text-sm">
                                Total
                              </div>
                            </div>

                            {/* Input Row */}
                            <div
                              className="grid gap-3 items-center"
                              style={{
                                gridTemplateColumns: `2fr repeat(${competition.criteria.length}, 1fr) 1fr`,
                              }}
                            >
                              <div className="text-white font-medium">
                                Enter Scores
                              </div>
                              {competition.criteria?.map((criterion) => (
                                <div
                                  key={criterion.id || criterion.name}
                                  className="relative"
                                >
                                  <input
                                    type="number"
                                    min="0"
                                    max={criterion.maxScore}
                                    value={
                                      participantScores[criterion.name] || 0
                                    }
                                    onChange={(e) =>
                                      updateScoreInput(
                                        participant.id,
                                        criterion.name,
                                        e.target.value
                                      )
                                    }
                                    className="w-full p-2 bg-[#1a1b1e] border border-[#2a2a2d] rounded text-white text-center focus:border-[#4f46e5] focus:ring-1 focus:ring-[#4f46e5] transition-colors"
                                    placeholder="0"
                                  />
                                  {/* Score bar indicator */}
                                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700 rounded-b">
                                    <div
                                      className="h-full bg-[#4f46e5] rounded-b transition-all duration-300"
                                      style={{
                                        width: `${Math.min(
                                          100,
                                          ((participantScores[criterion.name] ||
                                            0) /
                                            criterion.maxScore) *
                                            100
                                        )}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              ))}
                              <div className="text-center">
                                <div className="bg-[#1a1b1e] border border-[#4f46e5] rounded p-2 text-white font-bold">
                                  {competition.criteria.reduce(
                                    (total, c) =>
                                      total + (participantScores[c.name] || 0),
                                    0
                                  )}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                  of{" "}
                                  {competition.criteria.reduce(
                                    (sum, c) => sum + c.maxScore,
                                    0
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Progress bar for overall score */}
                            <div className="mt-4">
                              <div className="flex justify-between text-sm text-gray-400 mb-2">
                                <span>Overall Progress</span>
                                <span>
                                  {Math.round(
                                    (competition.criteria.reduce(
                                      (total, c) =>
                                        total +
                                        (participantScores[c.name] || 0),
                                      0
                                    ) /
                                      competition.criteria.reduce(
                                        (sum, c) => sum + c.maxScore,
                                        0
                                      )) *
                                      100
                                  )}
                                  %
                                </span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-3">
                                <div
                                  className="bg-linear-to-r from-[#4f46e5] to-purple-500 h-3 rounded-full transition-all duration-500"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      (competition.criteria.reduce(
                                        (total, c) =>
                                          total +
                                          (participantScores[c.name] || 0),
                                        0
                                      ) /
                                        competition.criteria.reduce(
                                          (sum, c) => sum + c.maxScore,
                                          0
                                        )) *
                                        100
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
