import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signSession } from "@/lib/session";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email: parsed.email } });
    if (existing) {
      return NextResponse.json({ success: false, error: "Email already registered" }, { status: 400 });
    }

    const hashed = await bcrypt.hash(parsed.password, 10);
    const user = await prisma.user.create({
      data: {
        name: parsed.name,
        email: parsed.email,
        password: hashed,
      },
    });

    const token = signSession({ userId: user.id, email: user.email });

    const res = NextResponse.json({ success: true, data: { id: user.id, email: user.email } });
    res.headers.append("Set-Cookie", `app_session=${token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 7}`);
    return res;
  } catch (err: any) {
    const message = err?.message ?? "Invalid request";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
