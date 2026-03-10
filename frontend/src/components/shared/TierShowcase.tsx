import { Badge } from "@/components/ui/badge";
import { useTierCatalog } from "@/hooks/useTierCatalog";
import { cn } from "@/lib/utils";
import type { Tier } from "@/types";

interface TierShowcaseProps {
  highlightedTiers?: Tier[];
  className?: string;
  cardClassName?: string;
  compact?: boolean;
}

export function TierShowcase({
  highlightedTiers,
  className,
  cardClassName,
  compact = false,
}: TierShowcaseProps) {
  const highlighted = new Set(highlightedTiers ?? []);
  const { tiers, tierOrder } = useTierCatalog();

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[24px] border border-slate-200 bg-white/70 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-zinc-900/55",
        className
      )}
    >
      <div className="grid grid-cols-1 divide-y divide-slate-200/80 sm:grid-cols-2 sm:divide-x sm:divide-y-0 dark:divide-white/10">
      {tierOrder.map((tier) => {
        const config = tiers[tier];
        const isHighlighted = highlighted.size === 0 || highlighted.has(tier);

        return (
          <article
            key={tier}
            className={cn(
              "bg-white/40 p-4 transition-colors dark:bg-zinc-900/20",
              isHighlighted
                ? "opacity-100"
                : "opacity-55",
              compact ? "min-h-[116px]" : "min-h-[132px]",
              cardClassName
            )}
          >
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  {config.name}
                </h3>
              </div>
              <Badge
                variant="secondary"
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400"
              >
                {config.label}
              </Badge>
            </div>

            <p className="max-w-[42ch] text-[13px] leading-6 text-slate-600 dark:text-zinc-300">
              {config.description}
            </p>
          </article>
        );
      })}
      </div>
    </div>
  );
}
