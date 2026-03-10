import { useCallback, useRef, useState } from "react";
import { useGraphStore } from "../../store/graphStore";
import { useSkillStore } from "../../store/skillStore";
import { useLang } from "../../contexts/LangContext";
import type { GraphNode, FunctionTool } from "../../types";
import { FunctionEditor, Field, inputStyle, addBtnStyle } from "../shared/FunctionEditor";
import { renderTemplate, getStates, type HassConnection, type HassEntityState } from "../../utils/haApi";

interface NodeConfigPanelProps {
  conn: HassConnection;
  onClose: () => void;
  isMobile?: boolean;
  panelWidth?: number;
}

export function NodeConfigPanel({ conn, onClose, isMobile, panelWidth = 380 }: NodeConfigPanelProps) {
  const { flowNodes, flowEdges, selectedNodeId, updateNodeData, updateNodes, updateEdges, deleteNode } = useGraphStore();
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
        {/* Input/Output nodes: minimal config */}
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
              <input
                value={data.model ?? ""}
                onChange={(e) => update("model", e.target.value || undefined)}
                placeholder={t.modelPlaceholder}
                style={inputStyle}
              />
            </Field>

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
  const { flowEdges, flowNodes, updateEdgeData, updateEdges, selectEdge } = useGraphStore();

  // 이 라우터에서 나가는 엣지들만 필터
  const routerEdges = flowEdges.filter((e) => e.source === data.id);

  return (
    <div>
      <Field label={t.outputKey}>
        <input
          value={data.output_key ?? "route"}
          onChange={(e) => update("output_key", e.target.value)}
          style={inputStyle}
        />
      </Field>

      <div style={{ marginTop: 16 }}>
        <div
          style={{
            color: "#94a3b8",
            fontSize: 12,
            marginBottom: 8,
            fontWeight: 600,
          }}
        >
          {t.routes}
        </div>

        {routerEdges.length === 0 ? (
          <div
            style={{
              padding: 12,
              background: "rgba(255,255,255,0.03)",
              borderRadius: 8,
              color: "#475569",
              fontSize: 12,
              lineHeight: 1.6,
              marginBottom: 8,
            }}
          >
            {t.connectInCanvas}
          </div>
        ) : (
          routerEdges.map((edge) => {
            const targetNode = flowNodes.find((n) => n.id === edge.target);
            const targetName =
              ((targetNode?.data as unknown as GraphNode)?.name) || edge.target;
            const match = (edge.data?.match as string) ?? "*";
            const mode = (edge.data?.mode as string) ?? "sequential";

            return (
              <div
                key={edge.id}
                style={{
                  background: "#1e293b",
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 8,
                  cursor: "pointer",
                  border: "1px solid transparent",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.borderColor = "#334155")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.borderColor = "transparent")
                }
              >
                {/* Header: target node name + delete */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#64748b", fontSize: 11 }}>→</span>
                    <span
                      style={{
                        background: "#162d16",
                        border: "1px solid #22c55e",
                        borderRadius: 4,
                        padding: "1px 7px",
                        fontSize: 11,
                        color: "#86efac",
                      }}
                    >
                      {targetName}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      updateEdges(flowEdges.filter((e) => e.id !== edge.id));
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#ef4444",
                      cursor: "pointer",
                      fontSize: 14,
                      lineHeight: 1,
                      padding: 2,
                    }}
                    title="엣지 삭제"
                  >
                    ✕
                  </button>
                </div>

                <Field label={t.matchValue}>
                  <select
                    value={match}
                    onChange={(e) => {
                      updateEdgeData(edge.id, { match: e.target.value });
                      selectEdge(edge.id);
                    }}
                    style={inputStyle}
                  >
                    <option value="*">* (default)</option>
                    {flowNodes
                      .filter((n) => n.id !== data.id)
                      .map((n) => {
                        const nodeName = (n.data as unknown as GraphNode)?.name;
                        return (
                          <option key={n.id} value={n.id}>
                            {nodeName ? `${nodeName} (${n.id})` : n.id}
                          </option>
                        );
                      })}
                  </select>
                </Field>

                <Field label={t.executionMode}>
                  <select
                    value={mode}
                    onChange={(e) =>
                      updateEdgeData(edge.id, { mode: e.target.value })
                    }
                    style={inputStyle}
                  >
                    <option value="sequential">{t.sequential}</option>
                    <option value="parallel">{t.parallel}</option>
                  </select>
                </Field>
              </div>
            );
          })
        )}

        <div
          style={{
            color: "#334155",
            fontSize: 11,
            marginTop: 4,
            textAlign: "center",
          }}
        >
          {t.connectInCanvas}
        </div>
      </div>
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
      <div style={{ marginTop: 16 }}>
        <div
          style={{
            color: "#94a3b8",
            fontSize: 12,
            marginBottom: 8,
            fontWeight: 600,
          }}
        >
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

      <div style={{ marginTop: 16 }}>
        <div
          style={{
            color: "#94a3b8",
            fontSize: 12,
            marginBottom: 8,
            fontWeight: 600,
          }}
        >
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

  const filteredEntities = entities.filter((e) =>
    e.entity_id.toLowerCase().includes(entitySearch.toLowerCase())
  );

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
                    <div style={{ fontSize: 12, color: "#e2e8f0", fontFamily: "monospace" }}>
                      {entity.entity_id}
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

