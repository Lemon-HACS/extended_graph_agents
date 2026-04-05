/** 모델 설정 — 프리셋 + localStorage 영속화 */

export interface ModelSettings {
  model: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  reasoning_effort?: "low" | "medium" | "high";
}

export const MODEL_PRESETS = [
  { label: "GPT-5.4", value: "gpt-5.4" },
  { label: "GPT-5.4-mini", value: "gpt-5.4-mini" },
  { label: "GPT-5.4-nano", value: "gpt-5.4-nano" },
];

const STORAGE_KEY = "ega_model_settings";

export function loadModelSettings(): ModelSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { model: "gpt-5.4" };
}

export function saveModelSettings(settings: ModelSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}
