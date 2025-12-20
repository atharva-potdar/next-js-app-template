"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/lib/auth-client";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await resp.json();
      if (data?.success) {
        router.push("/");
      } else {
        setError(data?.error ?? "Sign up failed");
      }
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-900">
      <div className="w-full max-w-lg p-10 rounded-md border-2 border-pink-400">
        <div className="flex flex-col items-center gap-6">
          <div className="h-16 w-36 bg-zinc-800 rounded-md flex items-center justify-center text-pink-300">
            App Logo
          </div>

          <form className="w-full" onSubmit={onSubmit}>
            <div className="mb-3">
              <label className="block text-pink-300 mb-2">Full name</label>
              <input
                className="w-full px-3 py-2 rounded-md bg-zinc-800 text-white border border-pink-400"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="mb-3">
              <label className="block text-pink-300 mb-2">Email</label>
              <input
                className="w-full px-3 py-2 rounded-md bg-zinc-800 text-white border border-pink-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
              />
            </div>

            <div className="mb-3">
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
              {loading ? "Signing up..." : "SIGN UP"}
            </button>
          </form>

          <div className="text-sm text-pink-300">
            <Link href="/signin">Already have an account? Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
