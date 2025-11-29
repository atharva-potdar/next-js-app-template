import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export default function Home() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-zinc-50">
      <h1 className="text-4xl font-bold text-zinc-900 tracking-tighter">
        System Status: <span className="text-green-600">ONLINE</span>
      </h1>

      <div className="p-6 border rounded-xl shadow-sm bg-white flex flex-col gap-4">
        <p className="text-zinc-500">
          If you see this formatted correctly, Tailwind v4 is working.
        </p>

        <div className="flex gap-2">
          <Button>Shadcn Button (Primary)</Button>
          <Button variant="destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Shadcn + Lucide (Destructive)
          </Button>
        </div>
      </div>
    </div>
  );
}
