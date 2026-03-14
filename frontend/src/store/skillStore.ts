import { create } from "zustand";
import type { SkillSummary, SkillDefinition } from "../types";

interface SkillStore {
  skillList: SkillSummary[];
  setSkillList: (list: SkillSummary[]) => void;
  editingSkill: SkillDefinition | null;
  setEditingSkill: (skill: SkillDefinition | null) => void;
  pendingAiSkillYaml: string | null;
  setPendingAiSkillYaml: (yaml: string | null) => void;
}

export const useSkillStore = create<SkillStore>((set) => ({
  skillList: [],
  setSkillList: (list) => set({ skillList: list }),
  editingSkill: null,
  setEditingSkill: (skill) => set({ editingSkill: skill }),
  pendingAiSkillYaml: null,
  setPendingAiSkillYaml: (yaml) => set({ pendingAiSkillYaml: yaml }),
}));
