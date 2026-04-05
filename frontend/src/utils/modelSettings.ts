/** 모델 설정 — 프리셋 + localStorage 영속화 */

export interface ModelSettings {
  model: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  reasoning_effort?: "low" | "medium" | "high";
}

export const MODEL_PRESETS = [
  { label: "GPT-4o", value: "gpt-4o" },
  { label: "GPT-4o-mini", value: "gpt-4o-mini" },
  { label: "GPT-4.1", value: "gpt-4.1" },
  { label: "GPT-4.1-mini", value: "gpt-4.1-mini" },
  { label: "GPT-4.1-nano", value: "gpt-4.1-nano" },
  { label: "o4-mini", value: "o4-mini" },
  { label: "Claude Sonnet 4", value: "claude-sonnet-4-20250514" },
  { label: "Claude Haiku 3.5", value: "claude-haiku-4-5-20251001" },
  { label: "Gemini 2.5 Flash", value: "gemini-2.5-flash-preview-04-17" },
];

const STORAGE_KEY = "ega_model_settings";

export function loadModelSettings(): ModelSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { model: "gpt-4o" };
}

export function saveModelSettings(settings: ModelSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}
