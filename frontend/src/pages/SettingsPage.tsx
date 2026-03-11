import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SettingsView } from "@/components/settings/SettingsView";

export function SettingsPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.18),_transparent_30%),linear-gradient(180deg,#f6efe3_0%,#f3f4f6_45%,#ffffff_100%)] text-slate-900 dark:bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.16),_transparent_30%),linear-gradient(180deg,#111827_0%,#0f172a_50%,#09090b_100%)] dark:text-zinc-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1320px] flex-col px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-2">
          <Button asChild variant="ghost" className="gap-2 rounded-full px-3 text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Back to arena
            </Link>
          </Button>
        </div>
        <div className="min-h-0 flex-1 pb-6">
          <SettingsView />
        </div>
      </div>
    </div>
  );
}
