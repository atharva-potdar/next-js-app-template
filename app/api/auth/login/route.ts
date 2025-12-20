import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signSession } from "@/lib/session";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.parse(body);

    const user = await prisma.user.findUnique({ where: { email: parsed.email } });
    if (!user || !user.password) {
      return NextResponse.json({ success: false, error: "Invalid email or password" }, { status: 400 });
    }

    const match = await bcrypt.compare(parsed.password, user.password);
    if (!match) {
      return NextResponse.json({ success: false, error: "Invalid email or password" }, { status: 400 });
    }

    const token = signSession({ userId: user.id, email: user.email });

    const res = NextResponse.json({ success: true, data: { id: user.id, email: user.email } });
    res.headers.append("Set-Cookie", `app_session=${token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 7}`);
    return res;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message ?? "Invalid request" }, { status: 400 });
  }
}
