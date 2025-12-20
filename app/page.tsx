import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { LogoutButton } from "@/components/logout-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get("app_session")?.value;
  const session = token ? verifySession(token) : null;

  return (
    <div className="min-h-screen w-full bg-zinc-50/50 flex flex-col items-center justify-center p-4">
      <div className="max-w-[600px] w-full space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <h1 className="text-4xl font-bold text-zinc-900 tracking-tighter">Appointment App</h1>
          <p className="text-zinc-500">Manage your bookings and availability with ease.</p>
        </div>

        <Card className="shadow-sm border-zinc-200">
          <CardHeader>
            <CardTitle>Dashboard Overview</CardTitle>
            <CardDescription>Welcome back to your appointment manager.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {session ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-green-50 border border-green-100">
                  <p className="text-green-800 font-medium">
                    Signed in as: <span className="font-bold">{(session as any).email}</span>
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border border-zinc-100 bg-white">
                    <p className="text-sm text-zinc-500">Upcoming</p>
                    <p className="text-2xl font-bold">0</p>
                  </div>
                  <div className="p-4 rounded-lg border border-zinc-100 bg-white">
                    <p className="text-sm text-zinc-500">Available Slots</p>
                    <p className="text-2xl font-bold">0</p>
                  </div>
                </div>
                <LogoutButton />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-zinc-100 border border-zinc-200">
                  <p className="text-zinc-600">You are not signed in. Please log in to access your dashboard.</p>
                </div>
                <Link href="/signin" className="block w-full">
                  <Button className="w-full">Sign In</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
