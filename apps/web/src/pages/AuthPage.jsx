import { useState } from "react";
import { Navigate } from "react-router-dom";
import { login, register } from "../services/api.js";
import { useChatStore } from "../store/chatStore.js";

export default function AuthPage() {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const setSession = useChatStore((state) => state.setSession);
  const setError = useChatStore((state) => state.setError);
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/chat" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = mode === "login"
        ? await login({ username, password })
        : await register({ username, password });
      setSession({ token: response.token, user: response.user });
    } catch (error) {
      setError(error.message || "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="glass-surface w-full max-w-md rounded-[32px] p-8">
        <div className="mb-8 text-center">
          <img src="/logo.svg" alt="logo" className="mx-auto h-14 w-14" />
          <h1 className="mt-4 text-3xl font-semibold">MATHAMOTA</h1>
          <p className="mt-2 text-sm text-text-muted">Private chat with username and password only.</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-white/40 p-1">
          <button type="button" onClick={() => setMode("login")} className={`rounded-2xl px-4 py-2 text-sm font-semibold ${mode === "login" ? "bg-accent text-white" : "text-text-main"}`}>
            Login
          </button>
          <button type="button" onClick={() => setMode("register")} className={`rounded-2xl px-4 py-2 text-sm font-semibold ${mode === "register" ? "bg-accent text-white" : "text-text-main"}`}>
            Sign up
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm text-text-muted">Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              className="glass-strong w-full rounded-2xl px-4 py-3 outline-none"
              placeholder="yourusername"
              autoComplete="username"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-text-muted">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="glass-strong w-full rounded-2xl px-4 py-3 outline-none"
              placeholder="Enter password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
          </button>
        </form>
      </div>
    </main>
  );
}
