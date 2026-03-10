import { DEFAULT_TIER_PROFILES, TIER_ORDER, TIER_VISUALS } from "@/lib/constants";
import { useTierProfilesStore } from "@/stores/tierProfilesStore";
import type { Tier, TierConfig, TierProfile } from "@/types";

function formatTierName(tier: Tier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function toTierConfig(profile: TierProfile): TierConfig {
  return {
    ...profile,
    name: formatTierName(profile.id),
    label: profile.market_position,
    description: profile.ui_summary,
    ...TIER_VISUALS[profile.id],
  };
}

export function useTierCatalog(): {
  tiers: Record<Tier, TierConfig>;
  tierOrder: Tier[];
} {
  const profiles = useTierProfilesStore((state) => state.profiles);
  const source = profiles ?? DEFAULT_TIER_PROFILES;

  const tiers = TIER_ORDER.reduce(
    (acc, tier) => {
      acc[tier] = toTierConfig(source[tier]);
      return acc;
    },
    {} as Record<Tier, TierConfig>,
  );

  return { tiers, tierOrder: TIER_ORDER };
}
