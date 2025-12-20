import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { LogoutButton } from "@/components/logout-button";

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get("app_session")?.value;
  const session = token ? verifySession(token) : null;

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-zinc-50">
      <h1 className="text-4xl font-bold text-zinc-900 tracking-tighter">Welcome</h1>

      <div className="p-6 border rounded-xl shadow-sm bg-white flex flex-col gap-4">
        <p className="text-zinc-500">This is a blank template homepage for testing.</p>
        <p className="text-zinc-700">Random text: The quick brown fox jumped over {Math.floor(Math.random() * 1000)} fences.</p>
        {session ? (
          <>
            <p className="text-green-600">Signed in as: {(session as any).email}</p>
            <LogoutButton />
          </>
        ) : (
          <p className="text-red-500">Not signed in</p>
        )}
      </div>
    </div>
  );
}
