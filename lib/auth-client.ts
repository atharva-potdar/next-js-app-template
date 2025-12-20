import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export const { useSession, signOut } = authClient as any;

// Provide simple fetch-based wrappers for signIn/signUp to match the
// minimal usage in the app pages. These forward to the Better-Auth
// route handler at `/api/auth/*` which is already mounted.
export async function signIn(data: { email: string; password: string }) {
	const res = await fetch("/api/auth/signin", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
	return res.ok ? res.json() : { success: false, error: await res.text() };
}

export async function signUp(data: { name?: string; email: string; password: string }) {
	const res = await fetch("/api/auth/signup", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
	return res.ok ? res.json() : { success: false, error: await res.text() };
}
