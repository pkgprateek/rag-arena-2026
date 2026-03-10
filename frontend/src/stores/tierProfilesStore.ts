import { create } from "zustand";
import type { Tier, TierProfile } from "@/types";

interface TierProfilesState {
  profiles: Record<Tier, TierProfile> | null;
  setProfiles: (profiles: Record<Tier, TierProfile>) => void;
}

export const useTierProfilesStore = create<TierProfilesState>((set) => ({
  profiles: null,
  setProfiles: (profiles) => set({ profiles }),
}));
