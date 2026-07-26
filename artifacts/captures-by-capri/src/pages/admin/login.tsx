import { useState } from "react";
import { useLocation } from "wouter";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // A single shared password; there is no user table, so no email field.
      // On success the server sets a signed httpOnly session cookie.
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        navigate("/admin");
        return;
      }

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Invalid password");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background dark">
      <div className="w-full max-w-sm px-6">
        <div className="mb-10 text-center">
          <img
            src="/logo.png"
            alt="Captures by Capri"
            className="h-16 w-auto brightness-0 invert mx-auto mb-6"
          />
          <p className="text-xs tracking-[0.4em] uppercase text-muted-foreground">
            Admin Portal
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="password"
              className="block text-xs tracking-widest uppercase text-muted-foreground mb-2"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              className="w-full bg-transparent border border-border rounded px-4 py-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/50 transition-colors"
              placeholder="Enter password"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 tracking-wide">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 border border-foreground/30 text-sm tracking-[0.2em] uppercase hover:bg-foreground/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
