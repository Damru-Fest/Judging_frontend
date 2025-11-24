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
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardMeta, setLeaderboardMeta] = useState(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [showFullLeaderboard, setShowFullLeaderboard] = useState(false);
  const [leaderboardView, setLeaderboardView] = useState("podium"); // 'podium' or 'table'
  const [sortBy, setSortBy] = useState("avgTotal");
  const [expandedParticipant, setExpandedParticipant] = useState(null);

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

      // Refresh leaderboard as well
      await loadLeaderboard();
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-9999">
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
              <div className="text-6xl mb-4">🎯</div>
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
                          <div className="text-2xl mb-2">🥈</div>
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
                          <div className="text-2xl mb-2">🥉</div>
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
                                    key={jIdx}
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
                                            key={cIdx}
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
                                              <span className="text-white text-sm font-medium min-w-[2rem] text-right">
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
