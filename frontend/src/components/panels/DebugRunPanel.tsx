import { useState, useRef, useEffect } from "react";
import { useGraphStore } from "../../store/graphStore";
import { runGraph } from "../../utils/haApi";
import type { HassConnection } from "../../utils/haApi";
import type { TraceEvent } from "../../types";

interface Props {
  conn: HassConnection;
  onClose: () => void;
  isMobile?: boolean;
  panelWidth?: number;
}

export function DebugRunPanel({ conn, onClose, isMobile, panelWidth = 380 }: Props) {
  const { currentGraph, setDebugRunning, setDebugResult, debugRunning, debugResult } = useGraphStore();
  const [input, setInput] = useState("");
  const traceEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    traceEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [debugResult]);

  const handleRun = async () => {
    if (!currentGraph || !input.trim() || debugRunning) return;
    setDebugRunning(true);
    setDebugResult(null);
    try {
      const result = await runGraph(conn, currentGraph.id, input.trim());
      setDebugResult(result);
    } catch (err) {
      setDebugResult({ trace: [], output: null, error: String(err) });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") handleRun();
  };

  // Group trace events into node runs
  const nodeRuns = groupTrace(debugResult?.trace ?? []);

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
              height: "80vh",
              zIndex: 30,
              borderRadius: "16px 16px 0 0",
              boxShadow: "0 -4px 24px rgba(0,0,0,0.5)",
            }
          : {}),
      }}
    >
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e293b", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: "#f59e0b", fontSize: 11, marginBottom: 2 }}>🐛 DEBUG</div>
          <div style={{ color: "white", fontWeight: 600, fontSize: 14 }}>Test Run</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 18 }}>✕</button>
      </div>

      {/* Input area */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e293b", flexShrink: 0 }}>
        <div style={{ color: "#64748b", fontSize: 11, marginBottom: 6 }}>USER INPUT <span style={{ color: "#475569" }}>(Ctrl+Enter to run)</span></div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="입력 메시지를 작성하세요..."
          rows={3}
          style={{
            width: "100%",
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 6,
            color: "white",
            fontSize: 13,
            padding: "8px 10px",
            resize: "vertical",
            boxSizing: "border-box",
            outline: "none",
            fontFamily: "inherit",
          }}
        />
        <button
          onClick={handleRun}
          disabled={!input.trim() || debugRunning || !currentGraph}
          style={{
            marginTop: 8,
            width: "100%",
            background: debugRunning ? "#1e293b" : "#1e3a5f",
            border: `1px solid ${debugRunning ? "#334155" : "#3b82f6"}`,
            color: debugRunning ? "#475569" : "#60a5fa",
            borderRadius: 6,
            padding: "8px",
            cursor: debugRunning ? "not-allowed" : "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {debugRunning ? "⏳ 실행 중..." : "▶ Run"}
        </button>
      </div>

      {/* Trace */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        {debugResult === null && !debugRunning && (
          <div style={{ color: "#334155", fontSize: 12, textAlign: "center", marginTop: 24 }}>
            실행 결과가 여기에 표시됩니다.
          </div>
        )}

        {nodeRuns.map((run, i) => (
          <NodeRunCard key={i} run={run} />
        ))}

        {/* Final output */}
        {debugResult && (
          <div style={{ marginTop: 12 }}>
            {debugResult.error && !debugResult.output ? (
              <div style={{ background: "#2d0f0f", border: "1px solid #7f1d1d", borderRadius: 8, padding: 12 }}>
                <div style={{ color: "#f87171", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>EXECUTION ERROR</div>
                <div style={{ color: "#fca5a5", fontSize: 12, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>{debugResult.error}</div>
              </div>
            ) : (
              <div style={{ background: "#0f2a1a", border: "1px solid #166534", borderRadius: 8, padding: 12 }}>
                <div style={{ color: "#4ade80", fontSize: 11, fontWeight: 700, marginBottom: 6 }}>FINAL OUTPUT</div>
                <div style={{ color: "#d1fae5", fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                  {debugResult.output ?? "(empty)"}
                </div>
              </div>
            )}
          </div>
        )}

        <div ref={traceEndRef} />
      </div>
    </div>
  );
}

// ── Node run card ──────────────────────────────────────────────────────────

interface NodeRun {
  node_id: string;
  node_type: string;
  node_name: string;
  duration_ms?: number;
  output?: string;
  error?: string;
  variables_set?: Record<string, unknown>;
  tools: Array<{ tool_name: string; args?: Record<string, unknown>; result?: string }>;
}

function groupTrace(trace: TraceEvent[]): NodeRun[] {
  const runs: NodeRun[] = [];
  const pending = new Map<string, NodeRun>();

  for (const ev of trace) {
    if (ev.type === "node_started" && ev.node_id) {
      pending.set(ev.node_id, {
        node_id: ev.node_id,
        node_type: ev.node_type ?? "unknown",
        node_name: ev.node_name ?? ev.node_id,
        tools: [],
      });
    } else if ((ev.type === "node_finished" || ev.type === "node_error") && ev.node_id) {
      const run = pending.get(ev.node_id);
      if (run) {
        run.duration_ms = ev.duration_ms;
        if (ev.type === "node_finished") {
          run.output = ev.output;
          run.variables_set = ev.variables_set;
        } else {
          run.error = ev.error;
        }
        pending.delete(ev.node_id);
        runs.push(run);
      }
    } else if (ev.type === "tool_called" && ev.node_id) {
      const run = pending.get(ev.node_id);
      if (run) run.tools.push({ tool_name: ev.tool_name ?? "", args: ev.args });
    } else if (ev.type === "tool_result" && ev.node_id) {
      const run = pending.get(ev.node_id);
      if (run) {
        const last = run.tools[run.tools.length - 1];
        if (last && last.tool_name === ev.tool_name) last.result = ev.result;
      }
    }
  }
  // Flush any nodes that didn't finish (shouldn't happen normally)
  for (const run of pending.values()) runs.push(run);

  return runs;
}

function NodeRunCard({ run }: { run: NodeRun }) {
  const [expanded, setExpanded] = useState(true);
  const isError = !!run.error;

  const typeColor: Record<string, string> = {
    input: "#7c3aed",
    router: "#3b82f6",
    regular: "#22c55e",
    output: "#c2410c",
  };
  const color = typeColor[run.node_type] ?? "#64748b";

  return (
    <div style={{ marginBottom: 8, border: `1px solid ${isError ? "#7f1d1d" : "#1e293b"}`, borderRadius: 8, overflow: "hidden" }}>
      {/* Node header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          background: isError ? "#1a0a0a" : "#0a0f1e",
          border: "none",
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ color, fontSize: 10, fontWeight: 700, background: `${color}22`, border: `1px solid ${color}55`, borderRadius: 4, padding: "1px 6px", flexShrink: 0 }}>
          {run.node_type.toUpperCase()}
        </span>
        <span style={{ color: "white", fontSize: 12, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {run.node_name}
        </span>
        {run.duration_ms !== undefined && (
          <span style={{ color: "#475569", fontSize: 11, flexShrink: 0 }}>{run.duration_ms}ms</span>
        )}
        {isError && <span style={{ color: "#f87171", fontSize: 11, flexShrink: 0 }}>ERROR</span>}
        <span style={{ color: "#475569", fontSize: 12 }}>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div style={{ padding: "8px 12px", background: "#080d1a", display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Error */}
          {run.error && (
            <div style={{ color: "#fca5a5", fontSize: 12, fontFamily: "monospace", background: "#2d0f0f", borderRadius: 4, padding: "6px 8px", whiteSpace: "pre-wrap" }}>
              {run.error}
            </div>
          )}

          {/* Tool calls */}
          {run.tools.length > 0 && (
            <div>
              <div style={{ color: "#475569", fontSize: 10, fontWeight: 700, marginBottom: 4 }}>TOOL CALLS ({run.tools.length})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {run.tools.map((tool, i) => (
                  <div key={i} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, padding: "6px 10px" }}>
                    <div style={{ color: "#a78bfa", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>🔧 {tool.tool_name}</div>
                    {tool.args && Object.keys(tool.args).length > 0 && (
                      <div style={{ marginBottom: 4 }}>
                        <div style={{ color: "#475569", fontSize: 10, marginBottom: 2 }}>ARGS</div>
                        <pre style={{ color: "#94a3b8", fontSize: 11, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                          {JSON.stringify(tool.args, null, 2)}
                        </pre>
                      </div>
                    )}
                    {tool.result !== undefined && (
                      <div>
                        <div style={{ color: "#475569", fontSize: 10, marginBottom: 2 }}>RESULT</div>
                        <div style={{ color: "#6ee7b7", fontSize: 11, fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                          {tool.result}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Variables set */}
          {run.variables_set && Object.keys(run.variables_set).length > 0 && (
            <div>
              <div style={{ color: "#475569", fontSize: 10, fontWeight: 700, marginBottom: 4 }}>VARIABLES SET</div>
              <pre style={{ color: "#fbbf24", fontSize: 11, margin: 0, background: "#0f172a", borderRadius: 4, padding: "4px 8px", whiteSpace: "pre-wrap" }}>
                {JSON.stringify(run.variables_set, null, 2)}
              </pre>
            </div>
          )}

          {/* Output */}
          {run.output !== undefined && run.output !== "" && (
            <div>
              <div style={{ color: "#475569", fontSize: 10, fontWeight: 700, marginBottom: 4 }}>OUTPUT</div>
              <div style={{ color: "#e2e8f0", fontSize: 12, whiteSpace: "pre-wrap", lineHeight: 1.5, wordBreak: "break-word" }}>
                {run.output}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
