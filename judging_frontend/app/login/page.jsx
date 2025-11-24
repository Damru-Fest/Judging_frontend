"use client";

import { useState } from "react";
import { useAuth } from "@/context/Auth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    const res = await login(email, password);

    if (!res.success) {
      setError(res.msg);
      return;
    }

    router.push("/dashboard"); // change later
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0e0f12] px-4">
      <div className="w-full max-w-md bg-[#1a1b1e] p-8 rounded-2xl shadow-xl border border-[#2a2b2f]">
        <h2 className="text-3xl font-semibold text-white text-center mb-6">
          Welcome Back
        </h2>

        {error && (
          <p className="text-red-400 text-sm mb-4 text-center">{error}</p>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-gray-300 text-sm">Email</label>
            <input
              type="email"
              placeholder="john@example.com"
              className="mt-1 w-full p-3 bg-[#111113] border border-[#2a2a2d] text-white rounded-lg focus:outline-none focus:border-[#4a4afd]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-gray-300 text-sm">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              className="mt-1 w-full p-3 bg-[#111113] border border-[#2a2a2d] text-white rounded-lg focus:outline-none focus:border-[#4a4afd]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white py-3 rounded-lg transition-colors font-medium"
          >
            Log In
          </button>
        </form>
      </div>
    </div>
  );
}
