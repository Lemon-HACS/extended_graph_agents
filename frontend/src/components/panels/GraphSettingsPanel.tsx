import { useLang } from "../../contexts/LangContext";
import { useGraphStore } from "../../store/graphStore";
import type { ModelParams } from "../../types";
import { Field, inputStyle } from "../shared/FunctionEditor";

interface GraphSettingsPanelProps {
  onClose: () => void;
  isMobile?: boolean;
  panelWidth?: number;
}

const MODEL_PRESETS = [
  { label: "GPT-4.1", model: "gpt-4.1" },
  { label: "GPT-5-nano", model: "gpt-5-nano" },
  { label: "GPT-5-mini", model: "gpt-5-mini" },
  { label: "GPT-5.4", model: "gpt-5.4" },
];

function ModelParamsEditor({
  params,
  onChange,
}: {
  params: ModelParams | undefined;
  onChange: (p: ModelParams | undefined) => void;
}) {
  const t = useLang();
  const p = params ?? {};

  const toggle = (key: keyof ModelParams, defaultVal: unknown) => {
    if (key in p) {
      const next = { ...p };
      delete next[key];
      onChange(Object.keys(next).length ? next : undefined);
    } else {
      onChange({ ...p, [key]: defaultVal });
    }
  };

  const set = (key: keyof ModelParams, val: unknown) => {
    onChange({ ...p, [key]: val });
  };

  const checkboxStyle: React.CSSProperties = {
    width: 14, height: 14, accentColor: "#7c3aed", cursor: "pointer",
  };

  const numInputStyle: React.CSSProperties = {
    ...inputStyle,
    width: 80,
    display: "inline-block",
    padding: "3px 8px",
    fontSize: 12,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {/* Temperature */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          checked={"temperature" in p}
          onChange={() => toggle("temperature", 1.0)}
          style={checkboxStyle}
        />
        <span style={{ color: "#94a3b8", fontSize: 12, width: 120 }}>{t.paramTemperature}</span>
        {"temperature" in p && (
          <input
            type="number"
            min={0} max={2} step={0.1}
            value={p.temperature ?? 1.0}
            onChange={(e) => set("temperature", parseFloat(e.target.value))}
            style={numInputStyle}
          />
        )}
      </div>

      {/* Top P */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          checked={"top_p" in p}
          onChange={() => toggle("top_p", 1.0)}
          style={checkboxStyle}
        />
        <span style={{ color: "#94a3b8", fontSize: 12, width: 120 }}>{t.paramTopP}</span>
        {"top_p" in p && (
          <input
            type="number"
            min={0} max={1} step={0.05}
            value={p.top_p ?? 1.0}
            onChange={(e) => set("top_p", parseFloat(e.target.value))}
            style={numInputStyle}
          />
        )}
      </div>

      {/* Max Tokens */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          checked={"max_tokens" in p}
          onChange={() => toggle("max_tokens", 2048)}
          style={checkboxStyle}
        />
        <span style={{ color: "#94a3b8", fontSize: 12, width: 120 }}>{t.paramMaxTokens}</span>
        {"max_tokens" in p && (
          <input
            type="number"
            min={1} max={100000} step={256}
            value={p.max_tokens ?? 2048}
            onChange={(e) => set("max_tokens", parseInt(e.target.value))}
            style={numInputStyle}
          />
        )}
      </div>

      {/* Reasoning Effort */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          checked={"reasoning_effort" in p}
          onChange={() => toggle("reasoning_effort", "medium")}
          style={checkboxStyle}
        />
        <span style={{ color: "#94a3b8", fontSize: 12, width: 120 }}>{t.paramReasoningEffort}</span>
        {"reasoning_effort" in p && (
          <select
            value={p.reasoning_effort ?? "medium"}
            onChange={(e) => set("reasoning_effort", e.target.value)}
            style={{ ...inputStyle, padding: "3px 8px", fontSize: 12, width: "auto" }}
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        )}
      </div>
    </div>
  );
}

export function GraphSettingsPanel({ onClose, isMobile, panelWidth = 380 }: GraphSettingsPanelProps) {
  const t = useLang();
  const { currentGraph, updateGraphMeta } = useGraphStore();

  if (!currentGraph) return null;

  return (
    <div
      style={{
        width: isMobile ? "100%" : panelWidth,
        background: "#0f172a",
        borderLeft: isMobile ? "none" : "1px solid #1e293b",
        borderTop: isMobile ? "1px solid #1e293b" : "none",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        flexShrink: 0,
        ...(isMobile
          ? {
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "70vh",
              zIndex: 30,
              borderRadius: "16px 16px 0 0",
              boxShadow: "0 -4px 24px rgba(0,0,0,0.5)",
            }
          : {}),
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid #1e293b",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 2 }}>⚙️ GRAPH</div>
          <div style={{ color: "white", fontWeight: 600 }}>{t.graphSettings}</div>
        </div>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 18 }}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {/* Default Model */}
        <Field label={t.defaultModel}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
            {MODEL_PRESETS.map((preset) => (
              <button
                key={preset.model}
                onClick={() => updateGraphMeta({ model: preset.model })}
                style={{
                  background: currentGraph.model === preset.model ? "#2d1b69" : "#1e293b",
                  border: `1px solid ${currentGraph.model === preset.model ? "#6d28d9" : "#334155"}`,
                  color: currentGraph.model === preset.model ? "#c4b5fd" : "#94a3b8",
                  borderRadius: 5,
                  padding: "3px 8px",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <input
            value={currentGraph.model ?? ""}
            onChange={(e) => updateGraphMeta({ model: e.target.value })}
            placeholder="gpt-4.1"
            style={inputStyle}
          />
        </Field>

        {/* Default Model Params */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, marginBottom: 8 }}>
            {t.modelParams} <span style={{ color: "#475569", fontWeight: 400 }}>(기본값)</span>
          </div>
          <ModelParamsEditor
            params={currentGraph.model_params}
            onChange={(p) => updateGraphMeta({ model_params: p })}
          />
        </div>

        {/* System Prompt Prefix */}
        <Field label={t.systemPromptPrefix}>
          <textarea
            value={currentGraph.system_prompt_prefix ?? ""}
            onChange={(e) => updateGraphMeta({ system_prompt_prefix: e.target.value || undefined })}
            rows={4}
            style={{ ...inputStyle, fontFamily: "monospace", resize: "vertical" }}
          />
          <div style={{ color: "#334155", fontSize: 11, marginTop: 4 }}>{t.systemPromptPrefixHint}</div>
        </Field>

        {/* Default Max Tool Iterations */}
        <Field label={t.defaultMaxToolIterations}>
          <input
            type="number"
            min={1}
            max={50}
            value={currentGraph.max_tool_iterations ?? ""}
            onChange={(e) => updateGraphMeta({ max_tool_iterations: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="10"
            style={inputStyle}
          />
        </Field>
      </div>
    </div>
  );
}
