import { useLang } from "../../contexts/LangContext";
import type { FunctionTool, FunctionConfig } from "../../types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Parameter {
  name: string;
  type: "string" | "integer" | "number" | "boolean" | "array" | "object";
  description: string;
  required: boolean;
  enumValues: string; // comma-separated
}

interface KVEntry {
  key: string;
  value: string;
}

const FUNCTION_TYPES = ["native", "template", "script", "web", "bash", "file", "sqlite"];
const PARAM_TYPES = ["string", "integer", "number", "boolean", "array", "object"] as const;
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const FILE_OPS = ["read", "write", "append"];

// ── Converters ─────────────────────────────────────────────────────────────────

function parseParameters(schema: Record<string, unknown>): Parameter[] {
  const properties = (schema?.properties ?? {}) as Record<string, Record<string, unknown>>;
  const required = (schema?.required ?? []) as string[];
  return Object.entries(properties).map(([name, prop]) => ({
    name,
    type: (prop.type as Parameter["type"]) ?? "string",
    description: (prop.description as string) ?? "",
    required: required.includes(name),
    enumValues: ((prop.enum as string[]) ?? []).join(", "),
  }));
}

function buildParameters(params: Parameter[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const p of params) {
    const prop: Record<string, unknown> = { type: p.type };
    if (p.description) prop.description = p.description;
    const enumArr = p.enumValues.split(",").map((s) => s.trim()).filter(Boolean);
    if (enumArr.length > 0) prop.enum = enumArr;
    properties[p.name] = prop;
    if (p.required) required.push(p.name);
  }
  return { type: "object", properties, required };
}

function parseKV(obj: Record<string, unknown>): KVEntry[] {
  return Object.entries(obj ?? {}).map(([key, value]) => ({ key, value: String(value) }));
}

function buildKV(entries: KVEntry[]): Record<string, string> {
  return Object.fromEntries(entries.filter((e) => e.key).map((e) => [e.key, e.value]));
}

// ── Main FunctionEditor ────────────────────────────────────────────────────────

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
  const params = parseParameters(func.spec.parameters as Record<string, unknown>);

  const updateParams = (next: Parameter[]) => {
    onChange({ spec: { ...func.spec, parameters: buildParameters(next) } });
  };

  const updateParam = (i: number, patch: Partial<Parameter>) => {
    const next = params.map((p, idx) => (idx === i ? { ...p, ...patch } : p));
    updateParams(next);
  };

  const addParam = () => {
    updateParams([...params, { name: "", type: "string", description: "", required: false, enumValues: "" }]);
  };

  const removeParam = (i: number) => {
    updateParams(params.filter((_, idx) => idx !== i));
  };

  const updateFunctionConfig = (patch: Partial<FunctionConfig>) => {
    onChange({ function: { ...func.function, ...patch } });
  };

  return (
    <div style={{ background: "#1e293b", borderRadius: 8, padding: 12, marginBottom: 8 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600 }}>
          {t.functionLabel} {index + 1}
        </span>
        <button onClick={onRemove} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 12 }}>
          ✕
        </button>
      </div>

      {/* Spec: name */}
      <Field label={t.name}>
        <input
          value={func.spec.name}
          onChange={(e) => onChange({ spec: { ...func.spec, name: e.target.value } })}
          style={inputStyle}
        />
      </Field>

      {/* Spec: description */}
      <Field label={t.description}>
        <input
          value={func.spec.description}
          onChange={(e) => onChange({ spec: { ...func.spec, description: e.target.value } })}
          style={inputStyle}
        />
      </Field>

      {/* Function type */}
      <Field label={t.functionType}>
        <select
          value={func.function.type}
          onChange={(e) => onChange({ function: { type: e.target.value } })}
          style={inputStyle}
        >
          {FUNCTION_TYPES.map((ft) => (
            <option key={ft} value={ft}>{ft}</option>
          ))}
        </select>
      </Field>

      {/* Parameters */}
      <div style={{ marginTop: 10 }}>
        <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", marginBottom: 4, textTransform: "uppercase" }}>
          Parameters
        </div>
        {params.map((p, i) => (
          <ParameterRow key={i} param={p} onChange={(patch) => updateParam(i, patch)} onRemove={() => removeParam(i)} />
        ))}
        <button onClick={addParam} style={{ ...addBtnStyle, marginTop: 4, fontSize: 11, padding: "4px 8px" }}>
          + Add Parameter
        </button>
      </div>

      {/* Type-specific function config */}
      <div style={{ marginTop: 10, borderTop: "1px solid #334155", paddingTop: 10 }}>
        <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", marginBottom: 6, textTransform: "uppercase" }}>
          {t.functionConfig}
        </div>
        <TypeConfig config={func.function} onChange={updateFunctionConfig} />
      </div>
    </div>
  );
}

// ── ParameterRow ───────────────────────────────────────────────────────────────

function ParameterRow({
  param,
  onChange,
  onRemove,
}: {
  param: Parameter;
  onChange: (p: Partial<Parameter>) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ background: "#0f172a", borderRadius: 6, padding: "8px 10px", marginBottom: 4 }}>
      <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 4 }}>
        <input
          value={param.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="name"
          style={{ ...inputStyle, flex: 2, fontSize: 11 }}
        />
        <select
          value={param.type}
          onChange={(e) => onChange({ type: e.target.value as Parameter["type"] })}
          style={{ ...inputStyle, flex: 1, fontSize: 11 }}
        >
          {PARAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 3, color: "#94a3b8", fontSize: 10, flexShrink: 0, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={param.required}
            onChange={(e) => onChange({ required: e.target.checked })}
          />
          req
        </label>
        <button onClick={onRemove} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 11, flexShrink: 0 }}>
          ✕
        </button>
      </div>
      <input
        value={param.description}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="description"
        style={{ ...inputStyle, fontSize: 11, marginBottom: param.type === "string" ? 4 : 0 }}
      />
      {param.type === "string" && (
        <input
          value={param.enumValues}
          onChange={(e) => onChange({ enumValues: e.target.value })}
          placeholder='enum values (comma separated, e.g. "read, write")'
          style={{ ...inputStyle, fontSize: 11 }}
        />
      )}
    </div>
  );
}

// ── TypeConfig ─────────────────────────────────────────────────────────────────

function TypeConfig({
  config,
  onChange,
}: {
  config: FunctionConfig;
  onChange: (patch: Partial<FunctionConfig>) => void;
}) {
  switch (config.type) {
    case "native":
      return <NativeConfig config={config} onChange={onChange} />;
    case "template":
      return <TemplateConfig config={config} onChange={onChange} />;
    case "web":
      return <WebConfig config={config} onChange={onChange} />;
    case "bash":
      return <BashConfig config={config} onChange={onChange} />;
    case "file":
      return <FileConfig config={config} onChange={onChange} />;
    case "sqlite":
      return <SqliteConfig config={config} onChange={onChange} />;
    case "script":
      return <ScriptConfig config={config} onChange={onChange} />;
    default:
      return null;
  }
}

// ── NativeConfig ───────────────────────────────────────────────────────────────

function NativeConfig({ config, onChange }: { config: FunctionConfig; onChange: (p: Partial<FunctionConfig>) => void }) {
  const data = parseKV((config.data ?? {}) as Record<string, unknown>);

  const updateData = (entries: KVEntry[]) => onChange({ data: buildKV(entries) });
  const setEntry = (i: number, patch: Partial<KVEntry>) => {
    updateData(data.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  };

  return (
    <>
      <Field label="Service">
        <input
          value={(config.service as string) ?? ""}
          onChange={(e) => onChange({ service: e.target.value })}
          placeholder="domain.service (e.g. light.turn_on)"
          style={inputStyle}
        />
      </Field>
      <div>
        <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>Data (key → Jinja2 value)</div>
        {data.map((entry, i) => (
          <div key={i} style={{ display: "flex", gap: 4, marginBottom: 4 }}>
            <input
              value={entry.key}
              onChange={(e) => setEntry(i, { key: e.target.value })}
              placeholder="key"
              style={{ ...inputStyle, flex: 1, fontSize: 11 }}
            />
            <input
              value={entry.value}
              onChange={(e) => setEntry(i, { value: e.target.value })}
              placeholder='{{ param }}'
              style={{ ...inputStyle, flex: 2, fontSize: 11, fontFamily: "monospace" }}
            />
            <button onClick={() => updateData(data.filter((_, idx) => idx !== i))}
              style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}>✕</button>
          </div>
        ))}
        <button onClick={() => updateData([...data, { key: "", value: "" }])} style={{ ...addBtnStyle, fontSize: 11, padding: "3px 8px" }}>
          + Add Data Field
        </button>
      </div>
    </>
  );
}

// ── TemplateConfig ─────────────────────────────────────────────────────────────

function TemplateConfig({ config, onChange }: { config: FunctionConfig; onChange: (p: Partial<FunctionConfig>) => void }) {
  return (
    <Field label="value_template">
      <textarea
        value={(config.value_template as string) ?? ""}
        onChange={(e) => onChange({ value_template: e.target.value })}
        rows={5}
        placeholder="{% set state = states(entity_id) %}&#10;{{ state }}"
        style={{ ...inputStyle, fontFamily: "monospace", fontSize: 11, resize: "vertical" }}
      />
    </Field>
  );
}

// ── WebConfig ──────────────────────────────────────────────────────────────────

function WebConfig({ config, onChange }: { config: FunctionConfig; onChange: (p: Partial<FunctionConfig>) => void }) {
  const headers = parseKV((config.headers ?? {}) as Record<string, unknown>);
  const updateHeaders = (entries: KVEntry[]) => onChange({ headers: buildKV(entries) });

  return (
    <>
      <Field label="URL">
        <input
          value={(config.url as string) ?? ""}
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder="https://example.com/api/{{ param }}"
          style={inputStyle}
        />
      </Field>
      <Field label="Method">
        <select value={(config.method as string) ?? "GET"} onChange={(e) => onChange({ method: e.target.value })} style={inputStyle}>
          {HTTP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </Field>
      <div style={{ marginBottom: 10 }}>
        <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>Headers</div>
        {headers.map((entry, i) => (
          <div key={i} style={{ display: "flex", gap: 4, marginBottom: 4 }}>
            <input value={entry.key} onChange={(e) => updateHeaders(headers.map((h, idx) => idx === i ? { ...h, key: e.target.value } : h))}
              placeholder="Header-Name" style={{ ...inputStyle, flex: 1, fontSize: 11 }} />
            <input value={entry.value} onChange={(e) => updateHeaders(headers.map((h, idx) => idx === i ? { ...h, value: e.target.value } : h))}
              placeholder="value" style={{ ...inputStyle, flex: 2, fontSize: 11 }} />
            <button onClick={() => updateHeaders(headers.filter((_, idx) => idx !== i))}
              style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}>✕</button>
          </div>
        ))}
        <button onClick={() => updateHeaders([...headers, { key: "", value: "" }])} style={{ ...addBtnStyle, fontSize: 11, padding: "3px 8px" }}>
          + Add Header
        </button>
      </div>
    </>
  );
}

// ── BashConfig ─────────────────────────────────────────────────────────────────

function BashConfig({ config, onChange }: { config: FunctionConfig; onChange: (p: Partial<FunctionConfig>) => void }) {
  return (
    <Field label="Command">
      <textarea
        value={(config.command as string) ?? ""}
        onChange={(e) => onChange({ command: e.target.value })}
        rows={3}
        placeholder="df -h /data"
        style={{ ...inputStyle, fontFamily: "monospace", fontSize: 11, resize: "vertical" }}
      />
    </Field>
  );
}

// ── FileConfig ─────────────────────────────────────────────────────────────────

function FileConfig({ config, onChange }: { config: FunctionConfig; onChange: (p: Partial<FunctionConfig>) => void }) {
  return (
    <>
      <Field label="Operation">
        <select value={(config.operation as string) ?? "read"} onChange={(e) => onChange({ operation: e.target.value })} style={inputStyle}>
          {FILE_OPS.map((op) => <option key={op} value={op}>{op}</option>)}
        </select>
      </Field>
      <Field label="Path">
        <input
          value={(config.path as string) ?? ""}
          onChange={(e) => onChange({ path: e.target.value })}
          placeholder="notes.txt"
          style={inputStyle}
        />
      </Field>
    </>
  );
}

// ── SqliteConfig ───────────────────────────────────────────────────────────────

function SqliteConfig({ config, onChange }: { config: FunctionConfig; onChange: (p: Partial<FunctionConfig>) => void }) {
  return (
    <>
      <Field label="DB Path">
        <input
          value={(config.db_path as string) ?? ""}
          onChange={(e) => onChange({ db_path: e.target.value })}
          placeholder="/config/home-assistant_v2.db"
          style={inputStyle}
        />
      </Field>
      <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 12, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={(config.allow_write as boolean) ?? false}
          onChange={(e) => onChange({ allow_write: e.target.checked })}
        />
        Allow Write (INSERT / UPDATE / DELETE)
      </label>
    </>
  );
}

// ── ScriptConfig ───────────────────────────────────────────────────────────────

function ScriptConfig({ config, onChange }: { config: FunctionConfig; onChange: (p: Partial<FunctionConfig>) => void }) {
  return (
    <Field label="Sequence (JSON)">
      <textarea
        value={JSON.stringify(config.sequence ?? [], null, 2)}
        onChange={(e) => {
          try {
            onChange({ sequence: JSON.parse(e.target.value) });
          } catch {
            // ignore parse errors while typing
          }
        }}
        rows={6}
        style={{ ...inputStyle, fontFamily: "monospace", fontSize: 11, resize: "vertical" }}
      />
    </Field>
  );
}

// ── Shared UI ──────────────────────────────────────────────────────────────────

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: "block", color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>
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
