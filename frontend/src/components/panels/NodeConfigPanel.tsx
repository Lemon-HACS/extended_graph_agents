import { useCallback, useRef, useState } from "react";
import { useGraphStore } from "../../store/graphStore";
import { useSkillStore } from "../../store/skillStore";
import { useLang } from "../../contexts/LangContext";
import type { GraphNode, FunctionTool, OutputSchemaField, ModelParams } from "../../types";
import { FunctionEditor, Field, inputStyle, addBtnStyle } from "../shared/FunctionEditor";
import { renderTemplate, getStates, type HassConnection, type HassEntityState } from "../../utils/haApi";

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
      delete (next as Record<string, unknown>)[key];
      onChange(Object.keys(next).length ? next : undefined);
    } else {
      onChange({ ...p, [key]: defaultVal });
    }
  };

  const setVal = (key: keyof ModelParams, val: unknown) => {
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
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={"temperature" in p} onChange={() => toggle("temperature", 1.0)} style={checkboxStyle} />
        <span style={{ color: "#94a3b8", fontSize: 12, width: 120 }}>{t.paramTemperature}</span>
        {"temperature" in p && (
          <input type="number" min={0} max={2} step={0.1} value={p.temperature ?? 1.0} onChange={(e) => setVal("temperature", parseFloat(e.target.value))} style={numInputStyle} />
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={"top_p" in p} onChange={() => toggle("top_p", 1.0)} style={checkboxStyle} />
        <span style={{ color: "#94a3b8", fontSize: 12, width: 120 }}>{t.paramTopP}</span>
        {"top_p" in p && (
          <input type="number" min={0} max={1} step={0.05} value={p.top_p ?? 1.0} onChange={(e) => setVal("top_p", parseFloat(e.target.value))} style={numInputStyle} />
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={"max_tokens" in p} onChange={() => toggle("max_tokens", 2048)} style={checkboxStyle} />
        <span style={{ color: "#94a3b8", fontSize: 12, width: 120 }}>{t.paramMaxTokens}</span>
        {"max_tokens" in p && (
          <input type="number" min={1} max={100000} step={256} value={p.max_tokens ?? 2048} onChange={(e) => setVal("max_tokens", parseInt(e.target.value))} style={numInputStyle} />
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={"reasoning_effort" in p} onChange={() => toggle("reasoning_effort", "medium")} style={checkboxStyle} />
        <span style={{ color: "#94a3b8", fontSize: 12, width: 120 }}>{t.paramReasoningEffort}</span>
        {"reasoning_effort" in p && (
          <select value={p.reasoning_effort ?? "medium"} onChange={(e) => setVal("reasoning_effort", e.target.value)} style={{ ...inputStyle, padding: "3px 8px", fontSize: 12, width: "auto" }}>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        )}
      </div>
    </div>
  );
}

interface NodeConfigPanelProps {
  conn: HassConnection;
  onClose: () => void;
  isMobile?: boolean;
  panelWidth?: number;
}

export function NodeConfigPanel({ conn, onClose, isMobile, panelWidth = 380 }: NodeConfigPanelProps) {
  const { flowNodes, flowEdges, selectedNodeId, updateNodeData, updateNodes, deleteNode } = useGraphStore();
  const t = useLang();
  const selectedNode = flowNodes.find((n) => n.id === selectedNodeId);

  if (!selectedNode) return null;

  const data = selectedNode.data as unknown as GraphNode;

  const update = useCallback(
    (field: string, value: unknown) => {
      updateNodeData(selectedNode.id, { [field]: value });
    },
    [selectedNode.id, updateNodeData]
  );

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
              height: "60vh",
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
        }}
      >
        <div>
          <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 2 }}>
            {data.type === "router" ? "🔀 ROUTER"
              : data.type === "input" ? "💬 INPUT"
              : data.type === "output" ? "📤 OUTPUT"
              : "🤖 AGENT"}
          </div>
          <div style={{ color: "white", fontWeight: 600 }}>{t.nodeConfig}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => { deleteNode(selectedNode.id); onClose(); }}
            style={{
              background: "#2d1515",
              border: "1px solid #7f1d1d",
              color: "#f87171",
              borderRadius: 6,
              padding: "4px 10px",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            🗑 {t.deleteNode}
          </button>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {/* Input/Output nodes */}
        {(data.type === "input" || data.type === "output") && (
          <>
            <Field label={t.nodeId}>
              <input value={data.id} readOnly style={inputStyle} />
            </Field>
            <div
              style={{
                marginTop: 8,
                padding: 12,
                background: "rgba(255,255,255,0.04)",
                borderRadius: 8,
                color: "#64748b",
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              {data.type === "input"
                ? "사용자 메시지가 여기서 시작됩니다.\n연결된 노드에서 {{ user_input }}으로 접근할 수 있습니다."
                : "연결된 노드의 출력이 대화 에이전트 응답으로 반환됩니다."}
            </div>

            {data.type === "output" && (() => {
              const incomingNodes = flowEdges
                .filter((e) => e.target === selectedNodeId)
                .map((e) => flowNodes.find((n) => n.id === e.source))
                .filter(Boolean);
              return (
                <div style={{ marginTop: 12 }}>
                  <label style={{ display: "block", color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>
                    {t.outputTemplate}
                  </label>
                  {incomingNodes.length > 0 && (
                    <div
                      style={{
                        background: "#0a0f1e",
                        border: "1px solid #1e293b",
                        borderRadius: 6,
                        padding: "8px 10px",
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, marginBottom: 6, letterSpacing: "0.05em" }}>
                        연결된 노드 (템플릿에서 사용 가능)
                      </div>
                      {incomingNodes.map((n) => {
                        const nd = n!.data as unknown as GraphNode;
                        const nodeId = n!.id;
                        const nodeName = nd.name ?? nodeId;
                        return (
                          <div key={nodeId} style={{ marginBottom: 6 }}>
                            <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 2 }}>
                              <span style={{ color: "#c4b5fd" }}>{nodeName}</span>
                              <span style={{ color: "#334155" }}> (ID: </span>
                              <span style={{ color: "#7dd3fc", fontFamily: "monospace" }}>{nodeId}</span>
                              <span style={{ color: "#334155" }}>)</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <code
                                onClick={() => {
                                  const tmpl = `{{ node_outputs['${nodeId}'] }}`;
                                  update("output_template", (data.output_template ? data.output_template + "\n" : "") + tmpl);
                                }}
                                style={{
                                  background: "#1e293b",
                                  color: "#86efac",
                                  fontSize: 10,
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  cursor: "pointer",
                                  display: "block",
                                  fontFamily: "monospace",
                                }}
                                title="클릭하여 삽입"
                              >
                                {"{{ node_outputs['" + nodeId + "'] }}"} <span style={{ color: "#475569" }}>← 전체 출력</span>
                              </code>
                              {nd.output_schema && nd.output_schema.length > 0 && nd.output_schema.map((field) => (
                                <code
                                  key={field.key}
                                  onClick={() => {
                                    const tmpl = `{{ variables['${nodeId}.${field.key}'] }}`;
                                    update("output_template", (data.output_template ? data.output_template + "\n" : "") + tmpl);
                                  }}
                                  style={{
                                    background: "#1e293b",
                                    color: "#fbbf24",
                                    fontSize: 10,
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    cursor: "pointer",
                                    display: "block",
                                    fontFamily: "monospace",
                                  }}
                                  title="클릭하여 삽입"
                                >
                                  {"{{ variables['" + nodeId + "." + field.key + "'] }}"} <span style={{ color: "#475569" }}>← {field.key}</span>
                                </code>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      <div style={{ color: "#334155", fontSize: 10, marginTop: 4 }}>
                        💡 코드를 클릭하면 템플릿에 삽입됩니다
                      </div>
                    </div>
                  )}
                  <textarea
                    value={data.output_template ?? ""}
                    onChange={(e) => update("output_template", e.target.value || undefined)}
                    rows={4}
                    style={{ ...inputStyle, fontFamily: "monospace", resize: "vertical" }}
                  />
                  <div style={{ color: "#334155", fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>
                    {t.outputTemplateHint}
                  </div>
                </div>
              );
            })()}
          </>
        )}

        {/* Router / Regular: full config */}
        {(data.type === "router" || data.type === "regular") && (
          <>
            <Field label={t.nodeId}>
              <input value={data.id} readOnly style={inputStyle} />
            </Field>

            <Field label={t.name}>
              <input
                value={data.name ?? ""}
                onChange={(e) => update("name", e.target.value)}
                style={inputStyle}
              />
            </Field>

            <Field label={t.modelOptional}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                {MODEL_PRESETS.map((preset) => (
                  <button
                    key={preset.model}
                    onClick={() => update("model", preset.model)}
                    style={{
                      background: data.model === preset.model ? "#2d1b69" : "#1e293b",
                      border: `1px solid ${data.model === preset.model ? "#6d28d9" : "#334155"}`,
                      color: data.model === preset.model ? "#c4b5fd" : "#94a3b8",
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
                value={data.model ?? ""}
                onChange={(e) => update("model", e.target.value || undefined)}
                placeholder={t.modelPlaceholder}
                style={inputStyle}
              />
            </Field>

            <div style={{ marginBottom: 16 }}>
              <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, marginBottom: 8 }}>
                {t.modelParams} <span style={{ color: "#475569", fontWeight: 400 }}>(노드 오버라이드)</span>
              </div>
              <ModelParamsEditor
                params={data.model_params}
                onChange={(p) => update("model_params", p)}
              />
            </div>

            <PromptField
              value={data.prompt ?? ""}
              onChange={(v) => update("prompt", v)}
              conn={conn}
            />

            {data.type === "router" && (
              <RouterConfig data={data} update={update} />
            )}

            {data.type === "regular" && (
              <RegularConfig data={data} update={update} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function RouterConfig({
  data,
  update,
}: {
  data: GraphNode;
  update: (f: string, v: unknown) => void;
}) {
  const t = useLang();
  const { flowEdges, flowNodes } = useGraphStore();

  const outgoingEdges = flowEdges.filter((e) => e.source === data.id);

  return (
    <div>
      <Field label={t.outputKey}>
        <input
          value={data.output_key ?? "route"}
          onChange={(e) => update("output_key", e.target.value)}
          style={inputStyle}
        />
      </Field>

      <Field label="Values (LLM 선택지)">
        <input
          value={(data.values ?? []).join(", ")}
          onChange={(e) =>
            update(
              "values",
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            )
          }
          placeholder="예: research, smart_home, general"
          style={inputStyle}
        />
        <div style={{ color: "#475569", fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>
          LLM이 이 값 중 하나를 선택합니다. 엣지 조건과 일치시켜 주세요.
        </div>
      </Field>

      {outgoingEdges.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 8, fontWeight: 600 }}>
            연결된 엣지
          </div>
          {outgoingEdges.map((edge) => {
            const targetNode = flowNodes.find((n) => n.id === edge.target);
            const targetName = ((targetNode?.data as unknown as GraphNode)?.name) || edge.target;
            const condition = edge.data?.condition as { variable?: string; value?: string } | null;
            const condLabel = condition?.variable
              ? `${condition.variable}=${condition.value}`
              : "default";
            return (
              <div
                key={edge.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 0",
                  borderBottom: "1px solid #1e293b",
                  fontSize: 12,
                  color: "#94a3b8",
                }}
              >
                <span style={{ color: "#64748b" }}>→</span>
                <span style={{ color: "#86efac", flex: 1 }}>{targetName}</span>
                <span
                  style={{
                    background: "#1e293b",
                    borderRadius: 8,
                    padding: "1px 7px",
                    fontSize: 11,
                    color: "#60a5fa",
                  }}
                >
                  {condLabel}
                </span>
              </div>
            );
          })}
          <div style={{ color: "#334155", fontSize: 11, marginTop: 8 }}>
            엣지를 클릭하면 조건 및 모드를 설정할 수 있습니다.
          </div>
        </div>
      )}
    </div>
  );
}

function OutputSchemaEditor({
  schema,
  onChange,
}: {
  schema: OutputSchemaField[];
  onChange: (s: OutputSchemaField[]) => void;
}) {
  const t = useLang();

  const addField = () =>
    onChange([...schema, { key: "", type: "string", description: "", enum: [] }]);

  const updateField = (i: number, patch: Partial<OutputSchemaField>) =>
    onChange(schema.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  const removeField = (i: number) => onChange(schema.filter((_, idx) => idx !== i));

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
        {t.outputSchema}
      </div>
      {schema.map((field, i) => (
        <div
          key={i}
          style={{
            background: "#1e293b",
            borderRadius: 8,
            padding: 10,
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <input
              value={field.key}
              onChange={(e) => updateField(i, { key: e.target.value })}
              placeholder={t.schemaFieldKey}
              style={{ ...inputStyle, flex: 2 }}
            />
            <select
              value={field.type}
              onChange={(e) =>
                updateField(i, { type: e.target.value as OutputSchemaField["type"] })
              }
              style={{ ...inputStyle, flex: 1 }}
            >
              <option value="string">string</option>
              <option value="number">number</option>
              <option value="integer">integer</option>
              <option value="boolean">boolean</option>
            </select>
            <button
              onClick={() => removeField(i)}
              style={{
                background: "none",
                border: "none",
                color: "#ef4444",
                cursor: "pointer",
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>
          <input
            value={field.description ?? ""}
            onChange={(e) => updateField(i, { description: e.target.value })}
            placeholder={t.schemaFieldDesc}
            style={{ ...inputStyle, marginBottom: 4 }}
          />
          <input
            value={(field.enum ?? []).join(", ")}
            onChange={(e) =>
              updateField(i, {
                enum: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder={t.schemaFieldEnum}
            style={inputStyle}
          />
        </div>
      ))}
      <button onClick={addField} style={addBtnStyle}>
        {t.addSchemaField}
      </button>
    </div>
  );
}

function RegularConfig({
  data,
  update,
}: {
  data: GraphNode;
  update: (f: string, v: unknown) => void;
}) {
  const t = useLang();
  const functions = data.functions ?? [];
  const skills = data.skills ?? [];
  const outputSchema = data.output_schema ?? [];
  const jsonModeEnabled = outputSchema.length > 0;

  const toggleJsonMode = () => {
    if (jsonModeEnabled) {
      update("output_schema", []);
    } else {
      update("output_schema", [{ key: "result", type: "string", description: "", enum: [] }]);
    }
  };

  const addFunction = () => {
    const newFunc: FunctionTool = {
      spec: {
        name: `function_${functions.length + 1}`,
        description: "",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      function: {
        type: "native",
        service: "",
        data: {},
      },
    };
    update("functions", [...functions, newFunc]);
  };

  const updateFunction = (i: number, funcData: Partial<FunctionTool>) => {
    update(
      "functions",
      functions.map((f, idx) => (idx === i ? { ...f, ...funcData } : f))
    );
  };

  const removeFunction = (i: number) => {
    update(
      "functions",
      functions.filter((_, idx) => idx !== i)
    );
  };

  return (
    <div>
      {/* JSON Output Mode toggle */}
      <div
        style={{
          marginTop: 16,
          padding: 12,
          background: jsonModeEnabled ? "#0a1f0a" : "#1e293b",
          border: `1px solid ${jsonModeEnabled ? "#22c55e" : "#334155"}`,
          borderRadius: 8,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: jsonModeEnabled ? "#86efac" : "#94a3b8", fontSize: 12, fontWeight: 600 }}>
              {t.jsonOutputMode}
            </div>
            <div style={{ color: "#475569", fontSize: 11, marginTop: 2 }}>
              {t.jsonOutputModeHint}
            </div>
          </div>
          <button
            onClick={toggleJsonMode}
            style={{
              background: jsonModeEnabled ? "#15803d" : "#334155",
              border: "none",
              color: "white",
              borderRadius: 12,
              padding: "3px 12px",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {jsonModeEnabled ? "ON" : "OFF"}
          </button>
        </div>

        {jsonModeEnabled && (
          <OutputSchemaEditor
            schema={outputSchema}
            onChange={(s) => update("output_schema", s)}
          />
        )}
      </div>

      {/* Functions (hidden in JSON mode) */}
      {!jsonModeEnabled && (
        <div style={{ marginTop: 16 }}>
          <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 8, fontWeight: 600 }}>
            {t.functions}
          </div>
          {functions.map((func, i) => (
            <FunctionEditor
              key={i}
              index={i}
              func={func}
              onChange={(f) => updateFunction(i, f)}
              onRemove={() => removeFunction(i)}
            />
          ))}
          <button onClick={addFunction} style={addBtnStyle}>
            {t.addFunction}
          </button>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 8, fontWeight: 600 }}>
          {t.skills}
        </div>
        <SkillMultiSelect
          selectedIds={skills}
          onChange={(ids) => update("skills", ids)}
        />
      </div>
    </div>
  );
}

const smallBtnStyle: React.CSSProperties = {
  background: "#1e293b",
  border: "1px solid #334155",
  color: "#94a3b8",
  borderRadius: 4,
  padding: "3px 8px",
  cursor: "pointer",
  fontSize: 10,
  fontWeight: 600,
  flexShrink: 0,
};

function PromptField({
  value,
  onChange,
  conn,
}: {
  value: string;
  onChange: (v: string) => void;
  conn: HassConnection;
}) {
  const t = useLang();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPos, setCursorPos] = useState(0);

  const [showEntityModal, setShowEntityModal] = useState(false);
  const [entities, setEntities] = useState<HassEntityState[]>([]);
  const [entitySearch, setEntitySearch] = useState("");
  const [loadingEntities, setLoadingEntities] = useState(false);

  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const saveCursor = () => {
    if (textareaRef.current) setCursorPos(textareaRef.current.selectionStart);
  };

  const openEntityModal = async () => {
    setShowEntityModal(true);
    setEntitySearch("");
    if (entities.length === 0) {
      setLoadingEntities(true);
      try {
        const states = await getStates(conn);
        setEntities(states.sort((a, b) => a.entity_id.localeCompare(b.entity_id)));
      } finally {
        setLoadingEntities(false);
      }
    }
  };

  const insertEntity = (entityId: string) => {
    const insertion = `{{ states('${entityId}') }}`;
    const newValue = value.slice(0, cursorPos) + insertion + value.slice(cursorPos);
    onChange(newValue);
    setShowEntityModal(false);
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = cursorPos + insertion.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
        setCursorPos(newPos);
      }
    }, 0);
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    setPreviewResult(null);
    setPreviewError(null);
    try {
      const result = await renderTemplate(conn, value);
      setPreviewResult(result);
    } catch (err) {
      setPreviewError(String(err));
    } finally {
      setPreviewLoading(false);
    }
  };

  const filteredEntities = entities.filter((e) => {
    const q = entitySearch.toLowerCase();
    const friendlyName = (e.attributes?.friendly_name as string | undefined) ?? "";
    return (
      e.entity_id.toLowerCase().includes(q) ||
      friendlyName.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Label row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600 }}>{t.systemPrompt}</div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={openEntityModal} style={smallBtnStyle} title={t.insertEntity}>
            🔍 {t.insertEntity}
          </button>
          <button
            onClick={handlePreview}
            disabled={previewLoading || !value}
            style={{ ...smallBtnStyle, opacity: previewLoading || !value ? 0.5 : 1 }}
          >
            {previewLoading ? "..." : `▶ ${t.previewPrompt}`}
          </button>
        </div>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={saveCursor}
        onKeyUp={saveCursor}
        onBlur={saveCursor}
        rows={6}
        style={{ ...inputStyle, fontFamily: "monospace", resize: "vertical" }}
      />

      {/* Hint */}
      <div style={{ color: "#334155", fontSize: 11, marginTop: 4, lineHeight: 1.6 }}>
        {t.jinjaHint}
      </div>

      {/* Preview result */}
      {(previewResult !== null || previewError !== null) && (
        <div
          style={{
            marginTop: 8,
            padding: 10,
            background: previewError ? "#1a0808" : "#081a0e",
            border: `1px solid ${previewError ? "#7f1d1d" : "#14532d"}`,
            borderRadius: 6,
            fontSize: 12,
            fontFamily: "monospace",
            color: previewError ? "#f87171" : "#86efac",
            whiteSpace: "pre-wrap",
            lineHeight: 1.5,
          }}
        >
          <div
            style={{
              color: previewError ? "#ef4444" : "#22c55e",
              fontSize: 10,
              marginBottom: 4,
              fontWeight: 600,
            }}
          >
            {previewError ? `⚠ ${t.previewError}` : `✓ ${t.previewResult}`}
          </div>
          {previewError ?? previewResult}
        </div>
      )}

      {/* Entity search modal */}
      {showEntityModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setShowEntityModal(false)}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 12,
              width: 380,
              maxHeight: 500,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid #1e293b",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ color: "white", fontWeight: 600, fontSize: 13 }}>
                🔍 {t.insertEntity}
              </div>
              <button
                onClick={() => setShowEntityModal(false)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 18 }}
              >
                ✕
              </button>
            </div>

            {/* Search input */}
            <div style={{ padding: "8px 12px", borderBottom: "1px solid #1e293b" }}>
              <input
                autoFocus
                value={entitySearch}
                onChange={(e) => setEntitySearch(e.target.value)}
                placeholder={t.entitySearch}
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
              />
            </div>

            {/* Entity list */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {loadingEntities ? (
                <div style={{ padding: 20, color: "#64748b", fontSize: 12, textAlign: "center" }}>
                  로딩 중...
                </div>
              ) : filteredEntities.length === 0 ? (
                <div style={{ padding: 20, color: "#64748b", fontSize: 12, textAlign: "center" }}>
                  결과 없음
                </div>
              ) : (
                filteredEntities.map((entity) => (
                  <div
                    key={entity.entity_id}
                    onClick={() => insertEntity(entity.entity_id)}
                    style={{
                      padding: "8px 16px",
                      cursor: "pointer",
                      borderBottom: "1px solid #0a1020",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLDivElement).style.background = "#1e293b")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLDivElement).style.background = "transparent")
                    }
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "#e2e8f0", fontFamily: "monospace" }}>
                        {entity.entity_id}
                      </div>
                      {(entity.attributes?.friendly_name as string | undefined) && (
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                          {entity.attributes.friendly_name as string}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#64748b",
                        marginLeft: 8,
                        flexShrink: 0,
                      }}
                    >
                      {entity.state}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Hint */}
            <div
              style={{
                padding: "8px 16px",
                borderTop: "1px solid #1e293b",
                color: "#334155",
                fontSize: 10,
              }}
            >
              클릭하면 {"{{ states('entity_id') }}"} 형태로 커서 위치에 삽입됩니다
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SkillMultiSelect({
  selectedIds,
  onChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const { skillList } = useSkillStore();
  const t = useLang();

  const available = skillList.filter((s) => !selectedIds.includes(s.id));

  const remove = (id: string) => onChange(selectedIds.filter((sid) => sid !== id));
  const add = (id: string) => { if (id) onChange([...selectedIds, id]); };

  return (
    <div>
      {selectedIds.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
          {selectedIds.map((id) => {
            const skill = skillList.find((s) => s.id === id);
            return (
              <span
                key={id}
                style={{
                  background: "#1e1a3a",
                  border: "1px solid #6d28d9",
                  color: "#a78bfa",
                  borderRadius: 4,
                  padding: "2px 6px",
                  fontSize: 11,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {skill?.name ?? id}
                <button
                  onClick={() => remove(id)}
                  style={{ background: "none", border: "none", color: "#a78bfa", cursor: "pointer", padding: 0, fontSize: 11 }}
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}
      <select
        value=""
        onChange={(e) => add(e.target.value)}
        style={{ ...inputStyle, color: available.length === 0 ? "#475569" : "white" }}
        disabled={available.length === 0}
      >
        <option value="">{available.length === 0 ? (skillList.length === 0 ? t.noSkillsYet : "모두 추가됨") : `+ ${t.skills} 추가...`}</option>
        {Object.entries(
          available.reduce<Record<string, typeof available>>((acc, s) => {
            const g = s.group || t.ungrouped;
            if (!acc[g]) acc[g] = [];
            acc[g].push(s);
            return acc;
          }, {})
        ).map(([group, items]) => (
          <optgroup key={group} label={group}>
            {items.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.function_count} fn)
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

