import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setAdminToken } from "../api.js";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const res = await api.post("/admin/login", { password });
      setAdminToken(res.data.token);
      navigate("/admin/dashboard");
    } catch {
      setError("Wrong password. Try again.");
    }
  }

  return (
    <main className="admin-login">
      <form onSubmit={handleSubmit}>
        <h2>Admin Login</h2>
        <input
          type="password"
          placeholder="Admin password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="error">{error}</p>}
        <button type="submit">Login</button>
      </form>
    </main>
  );
}
