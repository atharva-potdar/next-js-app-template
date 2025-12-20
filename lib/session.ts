import jwt from "jsonwebtoken";

const SECRET = process.env.BETTER_AUTH_SECRET ?? process.env.SESSION_SECRET ?? "dev-secret";

export function signSession(payload: Record<string, unknown>, opts?: jwt.SignOptions) {
  return jwt.sign(payload, SECRET, { expiresIn: "7d", ...(opts ?? {}) });
}

export function verifySession(token: string) {
  try {
    return jwt.verify(token, SECRET) as Record<string, unknown> | null;
  } catch (e) {
    return null;
  }
}
