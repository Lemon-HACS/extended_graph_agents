/**
 * GraphListPanel — 저장된 그래프 목록/상세/편집
 *
 * 리스트 → 선택 → 상세 뷰 (플로우 + YAML 편집 + AI 수정 + 실행)
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Play,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  FolderOpen,
  ArrowLeft,
  Code2,
  Bot,
  Send,
  Save,
  ChevronDown,
  ChevronRight,
  MessageSquare,
} from "lucide-react";
import type { HassConnection } from "../../utils/haApiV2";
import {
  listGraphsV2,
  getGraphV2,
  deleteGraphV2,
  runGraphV2,
  saveGraphV2,
  aiGenerateV2,
} from "../../utils/haApiV2";
import type { GraphSummaryV2, GraphV2, RunResult } from "../../types_v2";
import { GraphFlowView } from "../GraphFlowView";
import yaml from "js-yaml";
import {
  loadModelSettings,
  saveModelSettings,
  type ModelSettings,
} from "../../utils/modelSettings";
import { ModelComboBox } from "../ModelComboBox";
import type { ModelParams } from "../../types_v2";

interface GraphListPanelProps {
  conn: HassConnection;
  language: string;
}

export function GraphListPanel({ conn, language }: GraphListPanelProps) {
  const [graphs, setGraphs] = useState<GraphSummaryV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedGraph, setSelectedGraph] = useState<GraphV2 | null>(null);

  const loadGraphs = useCallback(async () => {
    setLoading(true);
    try {
      setGraphs(await listGraphsV2(conn));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [conn]);

  useEffect(() => { loadGraphs(); }, [loadGraphs]);

  const handleSelect = async (id: string) => {
    setSelectedId(id);
    try {
      const graph = await getGraphV2(conn, id);
      setSelectedGraph(graph);
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" 그래프를 삭제하시겠습니까?`)) return;
    try {
      await deleteGraphV2(conn, id);
      setGraphs((prev) => prev.filter((g) => g.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setSelectedGraph(null);
      }
    } catch { /* ignore */ }
  };

  const handleBack = () => {
    setSelectedId(null);
    setSelectedGraph(null);
    loadGraphs(); // refresh list
  };

  const handleGraphUpdated = (graph: GraphV2) => {
    setSelectedGraph(graph);
  };

  // ── Detail view ──
  if (selectedId && selectedGraph) {
    return (
      <GraphDetailView
        conn={conn}
        language={language}
        graph={selectedGraph}
        onBack={handleBack}
        onDelete={() => handleDelete(selectedId, selectedGraph.name)}
        onGraphUpdated={handleGraphUpdated}
      />
    );
  }

  // ── List view ──
  if (loading) {
    return (
      <div style={S.center}>
        <Loader2 size={24} style={{ animation: "spin 1s linear infinite", color: "#60a5fa" }} />
      </div>
    );
  }

  if (graphs.length === 0) {
    return (
      <div style={S.center}>
        <FolderOpen size={48} style={{ color: "#334155" }} />
        <p style={{ fontSize: "16px", color: "#94a3b8", margin: 0 }}>저장된 그래프가 없습니다.</p>
        <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>대화 탭에서 AI에게 그래프를 만들어달라고 요청하세요.</p>
      </div>
    );
  }

  return (
    <div style={S.listContainer}>
      <div style={S.listToolbar}>
        <span style={{ fontSize: "13px", color: "#94a3b8" }}>{graphs.length}개 그래프</span>
        <button style={S.iconBtn} onClick={loadGraphs}><RefreshCw size={14} /> 새로고침</button>
      </div>
      <div style={S.list}>
        {graphs.map((g) => (
          <div key={g.id} style={S.listCard} onClick={() => handleSelect(g.id)}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600 }}>{g.name}</div>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                {g.description && <span>{g.description} · </span>}
                <span style={{ color: "#60a5fa" }}>{g.node_count}개 노드</span>
              </div>
            </div>
            <button
              style={{ ...S.iconBtn, color: "#64748b" }}
              onClick={(e) => { e.stopPropagation(); handleDelete(g.id, g.name); }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════
// Graph Detail View
// ════════════════════════════════════════

type DetailMode = "flow" | "yaml";

function GraphDetailView({
  conn, language, graph, onBack, onDelete, onGraphUpdated,
}: {
  conn: HassConnection;
  language: string;
  graph: GraphV2;
  onBack: () => void;
  onDelete: () => void;
  onGraphUpdated: (graph: GraphV2) => void;
}) {
  const [mode, setMode] = useState<DetailMode>("flow");
  const [yamlText, setYamlText] = useState("");
  const [yamlDirty, setYamlDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runInput, setRunInput] = useState("");
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [showRun, setShowRun] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(true);
  const [editingModel, setEditingModel] = useState(false);
  const [modelSettings] = useState<ModelSettings>(loadModelSettings);
  const [selectedModel, setSelectedModel] = useState(graph.model || modelSettings.model);
  const [editParams, setEditParams] = useState<ModelParams>(graph.model_params || {});

  // YAML 초기화
  useEffect(() => {
    setYamlText(graphToYaml(graph));
    setYamlDirty(false);
  }, [graph]);

  // 모델 + 파라미터 변경 저장
  const handleSaveModel = async () => {
    setSaving(true);
    try {
      // undefined 값 정리
      const cleanParams: ModelParams = {};
      if (editParams.temperature != null) cleanParams.temperature = editParams.temperature;
      if (editParams.top_p != null) cleanParams.top_p = editParams.top_p;
      if (editParams.max_tokens != null) cleanParams.max_tokens = editParams.max_tokens;
      if (editParams.reasoning_effort) cleanParams.reasoning_effort = editParams.reasoning_effort;

      const updated = { ...graph, model: selectedModel, model_params: cleanParams };
      const result = await saveGraphV2(conn, updated);
      const fetched = await getGraphV2(conn, result.id);
      onGraphUpdated(fetched);
      setEditingModel(false);
    } catch (err: any) {
      alert(`모델 변경 실패: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const updateEditParam = (patch: Partial<ModelParams>) => {
    setEditParams((prev) => ({ ...prev, ...patch }));
  };

  const handleSaveYaml = async () => {
    setSaving(true);
    try {
      const parsed = yamlParse(yamlText);
      if (!parsed || typeof parsed !== "object") {
        alert("유효하지 않은 YAML입니다.");
        setSaving(false);
        return;
      }
      // Preserve ID
      if (graph.id) parsed.id = graph.id;
      const result = await saveGraphV2(conn, parsed as GraphV2);
      const updated = await getGraphV2(conn, result.id);
      onGraphUpdated(updated);
      setYamlDirty(false);
    } catch (err: any) {
      alert(`저장 실패: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const result = await runGraphV2(conn, {
        graph_id: graph.id,
        user_input: runInput.trim() || "안녕하세요",
        language,
      });
      setRunResult(result);
    } catch (err: any) {
      setRunResult({ trace: [], output: null, error: err.message || String(err) });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={S.detailContainer}>
      {/* Header */}
      <div style={S.detailHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
          <button style={S.backBtn} onClick={onBack}><ArrowLeft size={16} /></button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "15px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {graph.name}
            </div>
            {editingModel ? (
              <div style={S.modelEditArea}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <ModelComboBox
                    value={selectedModel}
                    onChange={setSelectedModel}
                    style={{ width: "180px" }}
                  />
                  <button style={{ ...S.miniBtn, color: "#22c55e" }} onClick={handleSaveModel} disabled={saving}>
                    <Save size={10} />
                  </button>
                  <button style={{ ...S.miniBtn, color: "#64748b" }} onClick={() => { setEditingModel(false); setSelectedModel(graph.model); setEditParams(graph.model_params || {}); }}>
                    ✕
                  </button>
                </div>
                <div style={S.paramRow}>
                  <label style={S.paramLabel}>
                    Temp:
                    <input type="number" min={0} max={2} step={0.1}
                      value={editParams.temperature ?? ""} placeholder="기본"
                      onChange={(e) => updateEditParam({ temperature: e.target.value ? Number(e.target.value) : undefined })}
                      style={S.paramInput} />
                  </label>
                  <label style={S.paramLabel}>
                    Top P:
                    <input type="number" min={0} max={1} step={0.05}
                      value={editParams.top_p ?? ""} placeholder="기본"
                      onChange={(e) => updateEditParam({ top_p: e.target.value ? Number(e.target.value) : undefined })}
                      style={S.paramInput} />
                  </label>
                  <label style={S.paramLabel}>
                    Max Tok:
                    <input type="number" min={100} step={100}
                      value={editParams.max_tokens ?? ""} placeholder="기본"
                      onChange={(e) => updateEditParam({ max_tokens: e.target.value ? Number(e.target.value) : undefined })}
                      style={{ ...S.paramInput, width: "60px" }} />
                  </label>
                  <label style={S.paramLabel}>
                    Reasoning:
                    <select
                      value={editParams.reasoning_effort ?? ""}
                      onChange={(e) => updateEditParam({ reasoning_effort: (e.target.value || undefined) as ModelParams["reasoning_effort"] })}
                      style={S.paramSelect}
                    >
                      <option value="">기본</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </label>
                </div>
              </div>
            ) : (
              <div
                style={{ fontSize: "11px", color: "#64748b", cursor: "pointer" }}
                onClick={() => setEditingModel(true)}
                title="클릭하여 모델/파라미터 변경"
              >
                {graph.model}
                {graph.model_params?.reasoning_effort ? ` · reasoning: ${graph.model_params.reasoning_effort}` : ""}
                {graph.model_params?.temperature != null ? ` · temp: ${graph.model_params.temperature}` : ""}
                {" "}· {Object.keys(graph.nodes).length}개 노드
              </div>
            )}
          </div>
        </div>

        {/* Mode tabs */}
        <div style={{ display: "flex", gap: "4px" }}>
          <ModeBtn active={mode === "flow"} onClick={() => setMode("flow")} icon={<FolderOpen size={13} />} label="플로우" />
          <ModeBtn active={mode === "yaml"} onClick={() => setMode("yaml")} icon={<Code2 size={13} />} label="YAML" dirty={yamlDirty} />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "4px", marginLeft: "8px" }}>
          <button
            style={{ ...S.iconBtn, color: showAiPanel ? "#60a5fa" : "#94a3b8", borderColor: showAiPanel ? "#3b82f6" : "#334155" }}
            onClick={() => setShowAiPanel(!showAiPanel)}
          >
            <MessageSquare size={14} /> AI
          </button>
          <button style={S.iconBtn} onClick={() => setShowRun(!showRun)}>
            <Play size={14} /> 실행
          </button>
          <button style={{ ...S.iconBtn, color: "#ef4444" }} onClick={onDelete}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Run bar */}
      {showRun && (
        <div style={S.runBar}>
          <input
            type="text"
            value={runInput}
            onChange={(e) => setRunInput(e.target.value)}
            placeholder="입력 메시지 (기본: 안녕하세요)"
            style={S.runInput}
            onKeyDown={(e) => e.key === "Enter" && handleRun()}
          />
          <button style={S.runBtn} onClick={handleRun} disabled={running}>
            {running ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={14} />}
            실행
          </button>
        </div>
      )}

      {/* Run result */}
      {runResult && showRun && (
        <div style={S.runResultBar}>
          <RunResultView result={runResult} />
        </div>
      )}

      {/* Main content — left: flow/yaml, right: AI chat */}
      <div style={S.detailContent}>
        <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
          {mode === "flow" && (
            <GraphFlowView graph={graph} />
          )}

          {mode === "yaml" && (
            <div style={S.yamlContainer}>
              <textarea
                value={yamlText}
                onChange={(e) => { setYamlText(e.target.value); setYamlDirty(true); }}
                style={S.yamlEditor}
                spellCheck={false}
              />
              {yamlDirty && (
                <div style={S.yamlActions}>
                  <button style={S.saveBtn} onClick={handleSaveYaml} disabled={saving}>
                    <Save size={14} /> {saving ? "저장 중..." : "YAML 저장"}
                  </button>
                  <button style={S.iconBtn} onClick={() => { setYamlText(graphToYaml(graph)); setYamlDirty(false); }}>
                    취소
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* AI side panel — always visible */}
        {showAiPanel && (
          <div style={S.aiSidePanel}>
            <AiModifyPanel
              conn={conn}
              language={language}
              graph={graph}
              onGraphUpdated={onGraphUpdated}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── AI Modify Panel ──

/** 두 그래프를 비교해서 변경된 노드 ID Set 반환 */
function diffGraphNodes(oldGraph: GraphV2, newGraph: GraphV2): Set<string> {
  const changed = new Set<string>();
  const oldNodes = oldGraph.nodes || {};
  const newNodes = newGraph.nodes || {};

  // 추가되거나 변경된 노드
  for (const [id, node] of Object.entries(newNodes)) {
    if (!oldNodes[id] || JSON.stringify(oldNodes[id]) !== JSON.stringify(node)) {
      changed.add(id);
    }
  }
  // 삭제된 노드 (표시용)
  for (const id of Object.keys(oldNodes)) {
    if (!newNodes[id]) changed.add(id);
  }
  return changed;
}

/** 변경 요약 텍스트 생성 */
function describeDiff(oldGraph: GraphV2, newGraph: GraphV2): string {
  const oldNodes = Object.keys(oldGraph.nodes || {});
  const newNodes = Object.keys(newGraph.nodes || {});
  const added = newNodes.filter((n) => !oldNodes.includes(n));
  const removed = oldNodes.filter((n) => !newNodes.includes(n));
  const modified = newNodes.filter(
    (n) => oldNodes.includes(n) && JSON.stringify(oldGraph.nodes[n]) !== JSON.stringify(newGraph.nodes[n])
  );

  const parts: string[] = [];
  if (added.length > 0) parts.push(`추가: ${added.join(", ")}`);
  if (removed.length > 0) parts.push(`삭제: ${removed.join(", ")}`);
  if (modified.length > 0) parts.push(`수정: ${modified.join(", ")}`);
  if (oldGraph.model !== newGraph.model) parts.push(`모델: ${oldGraph.model} → ${newGraph.model}`);
  if (parts.length === 0) return "변경사항 없음";
  return parts.join(" · ");
}

function AiModifyPanel({
  conn, language, graph, onGraphUpdated,
}: {
  conn: HassConnection;
  language: string;
  graph: GraphV2;
  onGraphUpdated: (graph: GraphV2) => void;
}) {
  const [messages, setMessages] = useState<Array<{ role: string; content: string; graph?: GraphV2; changedNodes?: Set<string>; diffSummary?: string }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewGraph, setPreviewGraph] = useState<GraphV2 | null>(null);
  const [previewChanged, setPreviewChanged] = useState<Set<string>>(new Set());
  const endRef = useRef<HTMLDivElement>(null);
  const aiModel = loadModelSettings().model;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    setPreviewGraph(null);

    try {
      const chatHistory = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      const result = await aiGenerateV2(conn, {
        request: text,
        current_graph: graph,
        messages: chatHistory,
        language,
        model: aiModel,
      });

      const changedNodes = result.graph ? diffGraphNodes(graph, result.graph) : new Set<string>();
      const diffSummary = result.graph ? describeDiff(graph, result.graph) : "";

      // 프리뷰에 자동 표시
      if (result.graph) {
        setPreviewGraph(result.graph);
        setPreviewChanged(changedNodes);
      }

      setMessages((prev) => [...prev, {
        role: "assistant",
        content: result.explanation,
        graph: result.graph,
        changedNodes,
        diffSummary,
      }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: `오류: ${err.message || err}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (newGraph: GraphV2) => {
    try {
      if (graph.id) newGraph.id = graph.id;
      const result = await saveGraphV2(conn, newGraph);
      const updated = await getGraphV2(conn, result.id);
      onGraphUpdated(updated);
      setPreviewGraph(null);
      setPreviewChanged(new Set());
      setMessages((prev) => [...prev, { role: "system", content: "✅ 그래프가 업데이트되었습니다." }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: "system", content: `❌ 저장 실패: ${err.message || err}` }]);
    }
  };

  const handleShowPreview = (msg: typeof messages[0]) => {
    if (msg.graph) {
      setPreviewGraph(msg.graph);
      setPreviewChanged(msg.changedNodes || new Set());
    }
  };

  return (
    <div style={S.aiContainer}>
      {/* 프리뷰 영역 */}
      {previewGraph && (
        <div style={S.aiPreview}>
          <div style={S.aiPreviewHeader}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#f59e0b" }}>변경 프리뷰</span>
            <span style={{ fontSize: "10px", color: "#94a3b8" }}>
              {describeDiff(graph, previewGraph)}
            </span>
            <button style={{ ...S.miniBtn, color: "#64748b", marginLeft: "auto" }} onClick={() => { setPreviewGraph(null); setPreviewChanged(new Set()); }}>
              ✕
            </button>
          </div>
          <div style={{ height: "180px" }}>
            <GraphFlowView graph={previewGraph} changedNodes={previewChanged} />
          </div>
        </div>
      )}

      <div style={S.aiMessages}>
        <div style={S.aiHint}>
          현재 그래프를 기반으로 AI에게 수정을 요청하세요.
          <br />예: "프롬프트를 더 구체적으로 수정해줘", "날씨 API 도구를 추가해줘"
        </div>

        {messages.map((msg, i) => (
          <div key={i} style={{
            ...S.aiMsg,
            alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
            background: msg.role === "user" ? "#1e3a5f" : msg.role === "system" ? "transparent" : "#1e293b",
            color: msg.role === "system" ? "#64748b" : "#e2e8f0",
            fontSize: msg.role === "system" ? "12px" : "13px",
            maxWidth: msg.role === "system" ? "100%" : "85%",
            textAlign: msg.role === "system" ? "center" : undefined,
          }}>
            {msg.content}
            {msg.diffSummary && (
              <div style={{ fontSize: "10px", color: "#f59e0b", marginTop: "4px", padding: "3px 6px", background: "#f59e0b15", borderRadius: "4px" }}>
                {msg.diffSummary}
              </div>
            )}
            {msg.graph && (
              <div style={{ display: "flex", gap: "4px", marginTop: "6px" }}>
                <button style={S.applyBtn} onClick={() => handleApply(msg.graph!)}>
                  <Save size={12} /> 적용
                </button>
                <button style={{ ...S.applyBtn, background: "none", borderColor: "#334155", color: "#94a3b8" }} onClick={() => handleShowPreview(msg)}>
                  프리뷰
                </button>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ ...S.aiMsg, alignSelf: "flex-start", background: "#1e293b" }}>
            <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> 수정 중...
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div style={S.aiInputRow}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="수정 요청을 입력하세요..."
          style={S.aiInput}
          disabled={loading}
        />
        <button onClick={handleSubmit} disabled={!input.trim() || loading} style={S.aiSendBtn}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Run Result View ──

function RunResultView({ result }: { result: RunResult }) {
  const [showTrace, setShowTrace] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600 }}>
        {result.error
          ? <><XCircle size={14} style={{ color: "#ef4444" }} /> 실행 실패</>
          : <><CheckCircle2 size={14} style={{ color: "#22c55e" }} /> 실행 성공</>
        }
      </div>
      {result.output && <div style={S.resultBox}>{result.output}</div>}
      {result.error && <div style={{ ...S.resultBox, borderColor: "#7f1d1d", color: "#fca5a5" }}>{result.error}</div>}
      {result.total_tokens && (
        <div style={{ fontSize: "11px", color: "#64748b" }}>
          토큰: {result.total_tokens.prompt_tokens} + {result.total_tokens.completion_tokens} = {result.total_tokens.total_tokens}
        </div>
      )}
      {result.trace.length > 0 && (
        <>
          <button style={S.traceToggle} onClick={() => setShowTrace(!showTrace)}>
            {showTrace ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            트레이스 ({result.trace.length})
          </button>
          {showTrace && (
            <div style={S.traceList}>
              {result.trace.map((ev, i) => (
                <div key={i} style={{ padding: "2px 0", borderBottom: "1px solid #1e293b", fontSize: "11px" }}>
                  <span style={{ color: "#60a5fa", fontWeight: 600, marginRight: "6px" }}>{ev.type}</span>
                  <span style={{ color: "#94a3b8" }}>{ev.node_id || ev.tool_name || ""}</span>
                  {ev.duration_ms != null && <span style={{ color: "#64748b", marginLeft: "4px" }}>{ev.duration_ms}ms</span>}
                  {ev.output && <div style={{ color: "#94a3b8", fontSize: "10px", fontFamily: "monospace", marginTop: "1px" }}>{ev.output.slice(0, 200)}</div>}
                  {ev.error && <div style={{ color: "#ef4444", fontSize: "10px", marginTop: "1px" }}>{ev.error}</div>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Mode button ──

function ModeBtn({ active, onClick, icon, label, dirty }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; dirty?: boolean;
}) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: "4px",
      background: active ? "#1e293b" : "none",
      border: active ? "1px solid #334155" : "1px solid transparent",
      color: active ? "#60a5fa" : "#64748b",
      borderRadius: "6px", padding: "4px 10px", fontSize: "12px", cursor: "pointer", fontWeight: active ? 600 : 400,
    }}>
      {icon} {label}{dirty ? "*" : ""}
    </button>
  );
}

// ── Simple YAML serializer/parser ──
// (JSON ↔ YAML-like, 실제로는 JSON pretty-print로 충분)

function graphToYaml(graph: GraphV2): string {
  const obj: any = { ...graph };
  delete obj.id;
  return yaml.dump(obj, { lineWidth: 120, noRefs: true, sortKeys: false });
}

function yamlParse(text: string): any {
  try {
    return yaml.load(text);
  } catch {
    return null;
  }
}

// ── Styles ──

const S: Record<string, React.CSSProperties> = {
  center: {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", height: "100%", gap: "12px",
  },
  listContainer: {
    display: "flex", flexDirection: "column", height: "100%", background: "#0a0a1a", color: "#e2e8f0",
  },
  listToolbar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 16px", borderBottom: "1px solid #1e293b", background: "#0f172a",
  },
  list: {
    flex: 1, overflowY: "auto", padding: "12px 16px",
    display: "flex", flexDirection: "column", gap: "6px",
  },
  listCard: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 14px", background: "#0f172a", border: "1px solid #1e293b",
    borderRadius: "8px", cursor: "pointer",
  },
  iconBtn: {
    display: "flex", alignItems: "center", gap: "4px",
    background: "none", border: "1px solid #334155", color: "#94a3b8",
    borderRadius: "6px", padding: "4px 10px", fontSize: "12px", cursor: "pointer",
  },
  // Detail view
  detailContainer: {
    display: "flex", flexDirection: "column", height: "100%", background: "#0a0a1a", color: "#e2e8f0",
  },
  detailHeader: {
    display: "flex", alignItems: "center", gap: "8px",
    padding: "8px 12px", borderBottom: "1px solid #1e293b", background: "#0f172a", flexShrink: 0,
    flexWrap: "wrap",
  },
  backBtn: {
    background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: "4px", flexShrink: 0,
  },
  detailContent: {
    flex: 1, overflow: "hidden", display: "flex",
  },
  // Run
  runBar: {
    display: "flex", gap: "8px", padding: "8px 12px",
    borderBottom: "1px solid #1e293b", background: "#0f172a", flexShrink: 0,
  },
  runInput: {
    flex: 1, background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155",
    borderRadius: "6px", padding: "6px 10px", fontSize: "13px", outline: "none",
  },
  runBtn: {
    display: "flex", alignItems: "center", gap: "4px",
    background: "#1e3a5f", border: "1px solid #3b82f6", color: "#60a5fa",
    borderRadius: "6px", padding: "6px 12px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
  },
  runResultBar: {
    padding: "8px 12px", borderBottom: "1px solid #1e293b", background: "#0f172a",
    maxHeight: "250px", overflowY: "auto", flexShrink: 0,
  },
  resultBox: {
    background: "#1e293b", border: "1px solid #334155", borderRadius: "6px",
    padding: "6px 10px", fontSize: "13px", lineHeight: "1.5", whiteSpace: "pre-wrap", wordBreak: "break-word",
  },
  traceToggle: {
    display: "flex", alignItems: "center", gap: "4px",
    background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "12px", padding: "2px 0",
  },
  traceList: {
    background: "#0a0f1e", border: "1px solid #1e293b", borderRadius: "6px",
    padding: "6px", maxHeight: "150px", overflowY: "auto",
  },
  // YAML
  yamlContainer: {
    flex: 1, display: "flex", flexDirection: "column", overflow: "hidden",
  },
  yamlEditor: {
    flex: 1, background: "#0f172a", color: "#e2e8f0", border: "none",
    padding: "16px", fontSize: "13px", fontFamily: "'Fira Code', 'Cascadia Code', monospace",
    lineHeight: "1.6", resize: "none", outline: "none", overflow: "auto",
    tabSize: 2,
  },
  yamlActions: {
    display: "flex", gap: "8px", padding: "8px 12px",
    borderTop: "1px solid #1e293b", background: "#0f172a",
  },
  saveBtn: {
    display: "flex", alignItems: "center", gap: "4px",
    background: "#1e3a5f", border: "1px solid #3b82f6", color: "#60a5fa",
    borderRadius: "6px", padding: "6px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
  },
  // Model editing
  modelEditArea: {
    display: "flex", flexDirection: "column", gap: "4px", marginTop: "2px",
  },
  paramRow: {
    display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap",
  },
  paramLabel: {
    display: "flex", alignItems: "center", gap: "3px", fontSize: "10px", color: "#94a3b8",
  },
  paramInput: {
    background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155",
    borderRadius: "3px", padding: "1px 4px", fontSize: "10px", outline: "none", width: "45px",
  },
  paramSelect: {
    background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155",
    borderRadius: "3px", padding: "1px 4px", fontSize: "10px", outline: "none",
  },
  miniBtn: {
    background: "none", border: "none", cursor: "pointer", padding: "2px", display: "flex",
    alignItems: "center",
  },
  // AI side panel
  aiSidePanel: {
    width: "320px", minWidth: "280px", maxWidth: "400px",
    borderLeft: "1px solid #1e293b", display: "flex", flexDirection: "column",
    overflow: "hidden", flexShrink: 0,
  },
  // AI
  aiContainer: {
    flex: 1, display: "flex", flexDirection: "column", overflow: "hidden",
  },
  aiPreview: {
    borderBottom: "1px solid #1e293b", flexShrink: 0, overflow: "hidden",
  },
  aiPreviewHeader: {
    display: "flex", alignItems: "center", gap: "8px",
    padding: "4px 8px", background: "#0f172a", borderBottom: "1px solid #1e293b",
  },
  aiMessages: {
    flex: 1, overflowY: "auto", padding: "12px 16px",
    display: "flex", flexDirection: "column", gap: "8px",
  },
  aiHint: {
    textAlign: "center", fontSize: "13px", color: "#64748b", padding: "20px 0", lineHeight: "1.6",
  },
  aiMsg: {
    padding: "8px 12px", borderRadius: "8px", lineHeight: "1.5", whiteSpace: "pre-wrap", wordBreak: "break-word",
  },
  applyBtn: {
    display: "flex", alignItems: "center", gap: "4px",
    background: "#1e3a5f", border: "1px solid #3b82f6", color: "#60a5fa",
    borderRadius: "6px", padding: "4px 10px", fontSize: "11px", fontWeight: 600,
    cursor: "pointer", marginTop: "6px",
  },
  aiInputRow: {
    display: "flex", gap: "8px", padding: "12px 16px",
    borderTop: "1px solid #1e293b", background: "#0f172a",
  },
  aiInput: {
    flex: 1, background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155",
    borderRadius: "8px", padding: "8px 12px", fontSize: "13px", outline: "none",
  },
  aiSendBtn: {
    background: "#3b82f6", color: "white", border: "none", borderRadius: "50%",
    width: "34px", height: "34px", display: "flex", alignItems: "center",
    justifyContent: "center", cursor: "pointer", flexShrink: 0,
  },
};
