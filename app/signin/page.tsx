"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await resp.json();
      if (data?.success) {
        router.push("/");
      } else {
        setError(data?.error ?? "Sign in failed");
      }
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-900">
      <div className="w-full max-w-md p-10 rounded-3xl border-2 border-pink-400">
        <div className="flex flex-col items-center gap-6">
          <div className="h-16 w-36 bg-zinc-800 rounded-md flex items-center justify-center text-pink-300">
            App Logo
          </div>

          <form className="w-full" onSubmit={onSubmit}>
            <div className="mb-4">
              <label className="block text-pink-300 mb-2">Email</label>
              <input
                className="w-full px-3 py-2 rounded-md bg-zinc-800 text-white border border-pink-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-pink-300 mb-2">Password</label>
              <input
                className="w-full px-3 py-2 rounded-md bg-zinc-800 text-white border border-pink-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
              />
            </div>

            {error && <p className="text-red-400 mb-2">{error}</p>}

            <button
              type="submit"
              className="w-full py-2 rounded-md bg-pink-400 text-zinc-900 font-semibold"
              disabled={loading}
            >
              {loading ? "Signing in..." : "SIGN IN"}
            </button>
          </form>

          <div className="text-sm text-pink-300">
            <Link href="/signup">Don't have an account? Sign Up</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
