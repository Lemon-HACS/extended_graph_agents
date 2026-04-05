/**
 * GraphListPanel — 저장된 그래프 목록 조회/실행/삭제
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  Play,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  FolderOpen,
} from "lucide-react";
import type { HassConnection } from "../../utils/haApiV2";
import {
  listGraphsV2,
  getGraphV2,
  deleteGraphV2,
  runGraphV2,
} from "../../utils/haApiV2";
import type { GraphSummaryV2, GraphV2, RunResult } from "../../types_v2";
import { GraphFlowView } from "../GraphFlowView";

interface GraphListPanelProps {
  conn: HassConnection;
  language: string;
}

interface GraphDetail {
  graph: GraphV2;
  runResult?: RunResult;
  isRunning?: boolean;
}

export function GraphListPanel({ conn, language }: GraphListPanelProps) {
  const [graphs, setGraphs] = useState<GraphSummaryV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, GraphDetail>>({});
  const [runInput, setRunInput] = useState<Record<string, string>>({});

  const loadGraphs = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listGraphsV2(conn);
      setGraphs(list);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [conn]);

  useEffect(() => {
    loadGraphs();
  }, [loadGraphs]);

  const handleExpand = async (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);

    if (!details[id]) {
      try {
        const graph = await getGraphV2(conn, id);
        setDetails((prev) => ({ ...prev, [id]: { graph } }));
      } catch {
        // ignore
      }
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" 그래프를 삭제하시겠습니까?`)) return;
    try {
      await deleteGraphV2(conn, id);
      setGraphs((prev) => prev.filter((g) => g.id !== id));
      setDetails((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (expanded === id) setExpanded(null);
    } catch {
      // ignore
    }
  };

  const handleRun = async (id: string) => {
    const detail = details[id];
    if (!detail) return;

    const userInput = runInput[id]?.trim() || "안녕하세요";
    setDetails((prev) => ({
      ...prev,
      [id]: { ...prev[id], isRunning: true, runResult: undefined },
    }));

    try {
      const result = await runGraphV2(conn, {
        graph_id: id,
        user_input: userInput,
        language,
      });
      setDetails((prev) => ({
        ...prev,
        [id]: { ...prev[id], runResult: result, isRunning: false },
      }));
    } catch (err: any) {
      setDetails((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          runResult: { trace: [], output: null, error: err.message || String(err) },
          isRunning: false,
        },
      }));
    }
  };

  if (loading) {
    return (
      <div style={styles.center}>
        <Loader2 size={24} style={{ animation: "spin 1s linear infinite", color: "#60a5fa" }} />
      </div>
    );
  }

  if (graphs.length === 0) {
    return (
      <div style={styles.center}>
        <FolderOpen size={48} style={{ color: "#334155" }} />
        <p style={styles.emptyText}>저장된 그래프가 없습니다.</p>
        <p style={styles.emptyHint}>대화 탭에서 AI에게 그래프를 만들어달라고 요청하세요.</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <span style={styles.count}>{graphs.length}개 그래프</span>
        <button style={styles.refreshBtn} onClick={loadGraphs}>
          <RefreshCw size={14} /> 새로고침
        </button>
      </div>

      <div style={styles.list}>
        {graphs.map((g) => {
          const isOpen = expanded === g.id;
          const detail = details[g.id];

          return (
            <div key={g.id} style={styles.card}>
              {/* Card header */}
              <div style={styles.cardHeader} onClick={() => handleExpand(g.id)}>
                <div style={styles.cardLeft}>
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <div>
                    <div style={styles.cardName}>{g.name}</div>
                    <div style={styles.cardMeta}>
                      {g.description && <span>{g.description}</span>}
                      <span style={styles.nodeCount}>{g.node_count}개 노드</span>
                    </div>
                  </div>
                </div>
                <button
                  style={styles.deleteBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(g.id, g.name);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Expanded detail */}
              {isOpen && detail && (
                <div style={styles.detail}>
                  {/* Graph flow visualization */}
                  <div style={styles.section}>
                    <div style={styles.sectionTitle}>그래프 플로우</div>
                    <GraphFlowView graph={detail.graph} height={250} />
                  </div>

                  {/* Node list */}
                  <div style={styles.section}>
                    <div style={styles.sectionTitle}>
                      노드 ({Object.keys(detail.graph.nodes).length}개)
                    </div>
                    <div style={styles.nodeList}>
                      {Object.entries(detail.graph.nodes).map(([name, node]) => (
                        <div key={name} style={styles.nodeTag}>
                          <span style={styles.nodeType}>{node.type}</span>
                          {name}
                          {node.tools && node.tools.length > 0 && (
                            <span style={styles.toolBadge}>{node.tools.length} tools</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Run section */}
                  <div style={styles.section}>
                    <div style={styles.sectionTitle}>실행</div>
                    <div style={styles.runRow}>
                      <input
                        type="text"
                        value={runInput[g.id] ?? ""}
                        onChange={(e) =>
                          setRunInput((prev) => ({ ...prev, [g.id]: e.target.value }))
                        }
                        placeholder="입력 메시지 (기본: 안녕하세요)"
                        style={styles.runInput}
                      />
                      <button
                        style={styles.runBtn}
                        onClick={() => handleRun(g.id)}
                        disabled={detail.isRunning}
                      >
                        {detail.isRunning ? (
                          <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                        ) : (
                          <Play size={14} />
                        )}
                        실행
                      </button>
                    </div>

                    {/* Run result */}
                    {detail.runResult && (
                      <RunResultView result={detail.runResult} />
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RunResultView({ result }: { result: RunResult }) {
  const [showTrace, setShowTrace] = useState(false);
  const hasError = !!result.error;

  return (
    <div style={styles.runResult}>
      <div style={styles.resultHeader}>
        {hasError ? (
          <><XCircle size={14} style={{ color: "#ef4444" }} /> 실행 실패</>
        ) : (
          <><CheckCircle2 size={14} style={{ color: "#22c55e" }} /> 실행 성공</>
        )}
      </div>

      {result.output && (
        <div style={styles.resultOutput}>
          <div style={styles.resultLabel}>출력:</div>
          <div style={styles.resultText}>{result.output}</div>
        </div>
      )}

      {result.error && (
        <div style={{ ...styles.resultOutput, borderColor: "#7f1d1d" }}>
          <div style={{ ...styles.resultLabel, color: "#ef4444" }}>오류:</div>
          <div style={{ ...styles.resultText, color: "#fca5a5" }}>{result.error}</div>
        </div>
      )}

      {result.total_tokens && (
        <div style={styles.tokenInfo}>
          토큰: {result.total_tokens.prompt_tokens} + {result.total_tokens.completion_tokens} = {result.total_tokens.total_tokens}
        </div>
      )}

      {result.trace.length > 0 && (
        <>
          <button style={styles.traceToggle} onClick={() => setShowTrace(!showTrace)}>
            {showTrace ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            실행 트레이스 ({result.trace.length}개 이벤트)
          </button>
          {showTrace && (
            <div style={styles.traceList}>
              {result.trace.map((event, i) => (
                <div key={i} style={styles.traceEvent}>
                  <span style={styles.traceType}>{event.type}</span>
                  <span style={styles.traceNodeId}>{event.node_id || event.tool_name || ""}</span>
                  {event.duration_ms != null && (
                    <span style={styles.traceDuration}>{event.duration_ms}ms</span>
                  )}
                  {event.output && (
                    <div style={styles.traceOutput}>{event.output.slice(0, 300)}</div>
                  )}
                  {event.error && (
                    <div style={{ ...styles.traceOutput, color: "#ef4444" }}>{event.error}</div>
                  )}
                  {event.result && (
                    <div style={styles.traceOutput}>{event.result.slice(0, 300)}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "#0a0a1a",
    color: "#e2e8f0",
  },
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: "12px",
  },
  emptyText: {
    fontSize: "16px",
    color: "#94a3b8",
    margin: 0,
  },
  emptyHint: {
    fontSize: "13px",
    color: "#64748b",
    margin: 0,
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: "1px solid #1e293b",
    background: "#0f172a",
  },
  count: {
    fontSize: "13px",
    color: "#94a3b8",
  },
  refreshBtn: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    background: "none",
    border: "1px solid #334155",
    color: "#94a3b8",
    borderRadius: "6px",
    padding: "4px 10px",
    fontSize: "12px",
    cursor: "pointer",
  },
  list: {
    flex: 1,
    overflowY: "auto",
    padding: "12px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  card: {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "8px",
    overflow: "hidden",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 14px",
    cursor: "pointer",
  },
  cardLeft: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flex: 1,
    minWidth: 0,
  },
  cardName: {
    fontSize: "14px",
    fontWeight: 600,
  },
  cardMeta: {
    display: "flex",
    gap: "8px",
    fontSize: "12px",
    color: "#64748b",
    marginTop: "2px",
  },
  nodeCount: {
    color: "#60a5fa",
  },
  deleteBtn: {
    background: "none",
    border: "none",
    color: "#64748b",
    cursor: "pointer",
    padding: "4px",
    borderRadius: "4px",
    flexShrink: 0,
  },
  detail: {
    borderTop: "1px solid #1e293b",
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  sectionTitle: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  nodeList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
  },
  nodeTag: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    background: "#1e293b",
    borderRadius: "4px",
    padding: "3px 8px",
    fontSize: "12px",
  },
  nodeType: {
    color: "#60a5fa",
    fontWeight: 600,
    fontSize: "10px",
    textTransform: "uppercase",
  },
  toolBadge: {
    color: "#64748b",
    fontSize: "10px",
    marginLeft: "4px",
  },
  edgeList: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  edgeCode: {
    fontFamily: "monospace",
    fontSize: "11px",
    color: "#94a3b8",
    padding: "1px 0",
  },
  runRow: {
    display: "flex",
    gap: "8px",
  },
  runInput: {
    flex: 1,
    background: "#1e293b",
    color: "#e2e8f0",
    border: "1px solid #334155",
    borderRadius: "6px",
    padding: "6px 10px",
    fontSize: "13px",
    outline: "none",
  },
  runBtn: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    background: "#1e3a5f",
    border: "1px solid #3b82f6",
    color: "#60a5fa",
    borderRadius: "6px",
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
  },
  runResult: {
    marginTop: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  resultHeader: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    fontWeight: 600,
  },
  resultOutput: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "6px",
    padding: "8px 10px",
  },
  resultLabel: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#94a3b8",
    marginBottom: "4px",
  },
  resultText: {
    fontSize: "13px",
    lineHeight: "1.5",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  tokenInfo: {
    fontSize: "11px",
    color: "#64748b",
  },
  traceToggle: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    background: "none",
    border: "none",
    color: "#64748b",
    cursor: "pointer",
    fontSize: "12px",
    padding: "2px 0",
  },
  traceList: {
    background: "#0a0f1e",
    border: "1px solid #1e293b",
    borderRadius: "6px",
    padding: "8px",
    maxHeight: "250px",
    overflowY: "auto",
  },
  traceEvent: {
    padding: "3px 0",
    borderBottom: "1px solid #1e293b",
    fontSize: "12px",
  },
  traceType: {
    color: "#60a5fa",
    fontWeight: 600,
    fontSize: "11px",
    marginRight: "6px",
  },
  traceNodeId: {
    color: "#94a3b8",
  },
  traceDuration: {
    color: "#64748b",
    fontSize: "11px",
    marginLeft: "6px",
  },
  traceOutput: {
    color: "#94a3b8",
    fontSize: "11px",
    marginTop: "2px",
    fontFamily: "monospace",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
};
