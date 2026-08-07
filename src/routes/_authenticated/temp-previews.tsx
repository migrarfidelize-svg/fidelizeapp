import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Preview1Premium, Preview2Marketplace, Preview3Gamification } from "@/components/DiscoverPreviews";
import { Home, Wallet, Compass, Bell, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/temp-previews")({
  component: PreviewsLayout,
});

function PreviewsLayout() {
  const [view, setView] = useState<"premium" | "marketplace" | "gamification">("premium");

  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col items-center py-10">
      <div className="mb-6 flex gap-2">
        {(["premium", "marketplace", "gamification"] as const).map((v) => (
          <button 
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2 rounded-lg font-bold text-sm ${view === v ? "bg-white text-black" : "bg-neutral-800 text-white"}`}
          >
            {v.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="w-[375px] h-[750px] bg-background rounded-[3rem] border-8 border-neutral-800 overflow-hidden shadow-2xl relative">
        <div className="h-full overflow-y-auto">
          {view === "premium" && <Preview1Premium />}
          {view === "marketplace" && <Preview2Marketplace />}
          {view === "gamification" && <Preview3Gamification />}
        </div>

        {/* Mock Bottom Nav */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex justify-around items-center px-4">
          <Home className="h-6 w-6 text-muted-foreground" />
          <Wallet className="h-6 w-6 text-muted-foreground" />
          <div className="bg-primary p-3 rounded-full -mt-8 text-white"><Compass className="h-6 w-6" /></div>
          <Bell className="h-6 w-6 text-muted-foreground" />
          <User className="h-6 w-6 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}