import { useLang } from "../../contexts/LangContext";
import type { FunctionTool } from "../../types";

const FUNCTION_TYPES = [
  "native",
  "template",
  "script",
  "web",
  "bash",
  "file",
  "sqlite",
];

export function FunctionEditor({
  index,
  func,
  onChange,
  onRemove,
}: {
  index: number;
  func: FunctionTool;
  onChange: (f: Partial<FunctionTool>) => void;
  onRemove: () => void;
}) {
  const t = useLang();

  return (
    <div
      style={{
        background: "#1e293b",
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span style={{ color: "#94a3b8", fontSize: 11 }}>
          {t.functionLabel} {index + 1}
        </span>
        <button
          onClick={onRemove}
          style={{
            background: "none",
            border: "none",
            color: "#ef4444",
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>

      <Field label={t.name}>
        <input
          value={func.spec.name}
          onChange={(e) =>
            onChange({ spec: { ...func.spec, name: e.target.value } })
          }
          style={inputStyle}
        />
      </Field>

      <Field label={t.description}>
        <input
          value={func.spec.description}
          onChange={(e) =>
            onChange({ spec: { ...func.spec, description: e.target.value } })
          }
          style={inputStyle}
        />
      </Field>

      <Field label={t.functionType}>
        <select
          value={func.function.type}
          onChange={(e) =>
            onChange({ function: { ...func.function, type: e.target.value } })
          }
          style={inputStyle}
        >
          {FUNCTION_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t.functionConfig}>
        <textarea
          value={JSON.stringify(func.function, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              onChange({ function: parsed });
            } catch {
              // ignore parse errors while typing
            }
          }}
          rows={4}
          style={{
            ...inputStyle,
            fontFamily: "monospace",
            fontSize: 11,
            resize: "vertical",
          }}
        />
      </Field>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label
        style={{
          display: "block",
          color: "#94a3b8",
          fontSize: 11,
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 6,
  color: "white",
  padding: "6px 10px",
  fontSize: 13,
  boxSizing: "border-box",
};

export const addBtnStyle: React.CSSProperties = {
  background: "#1e3a1e",
  border: "1px dashed #22c55e",
  color: "#4ade80",
  borderRadius: 6,
  padding: "6px 12px",
  cursor: "pointer",
  fontSize: 12,
  width: "100%",
  marginTop: 4,
};
