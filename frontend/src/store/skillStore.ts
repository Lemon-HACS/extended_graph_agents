import { create } from "zustand";
import type { SkillSummary } from "../types";

interface SkillStore {
  skillList: SkillSummary[];
  setSkillList: (list: SkillSummary[]) => void;
}

export const useSkillStore = create<SkillStore>((set) => ({
  skillList: [],
  setSkillList: (list) => set({ skillList: list }),
}));
