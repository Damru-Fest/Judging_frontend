"use client";

import { createContext, useContext, useState, useEffect } from "react";
import axiosInstance from "../libs/axios";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axiosInstance.get("/auth/me");
        setUser(res.data.user);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const login = async (email, password) => {
    try {
      const res = await axiosInstance.post("/auth/login", { email, password });

      setUser(res.data.user);

      return { success: true };
    } catch (err) {
      if (err.response?.status === 401)
        return { success: false, msg: "Invalid credentials" };

      if (err.response?.status === 404)
        return { success: false, msg: "User not found" };

      return { success: false, msg: "Server error" };
    }
  };

  const logout = async () => {
    try {
      await axiosInstance.post("/auth/logout");
    } catch {}
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        loading,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
