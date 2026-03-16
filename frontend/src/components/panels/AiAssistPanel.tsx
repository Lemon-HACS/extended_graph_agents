import { useState, useRef, useEffect, useCallback } from "react";
import * as jsYaml from "js-yaml";
import { useGraphStore } from "../../store/graphStore";
import { aiAssist } from "../../utils/haApi";
import type { AiAssistScope, AiAssistMessage } from "../../utils/haApi";
import type { HassConnection } from "../../utils/haApi";
import type { GraphNode } from "../../types";
import { graphToYaml, yamlToGraph } from "../../utils/serializer";

const STORAGE_KEY = "ega_ai_graph_chat";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  yaml?: string;
}

interface Props {
  conn: HassConnection;
  onClose: () => void;
  isMobile?: boolean;
  panelWidth?: number;
  onOpenDebug: () => void;
  language?: string;
}

export function AiAssistPanel({ conn, onClose, isMobile, panelWidth = 380, onOpenDebug, language = "en" }: Props) {
  const {
    currentGraph,
    selectedNodeId,
    flowNodes,
    updateNodeData,
    loadGraphFromAi,
    getCurrentGraphDef,
  } = useGraphStore();

  const [scope, setScope] = useState<AiAssistScope>(
    selectedNodeId ? "node" : "graph"
  );
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeHaContext, setIncludeHaContext] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Persist messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const getCurrentYaml = useCallback((sc: AiAssistScope): string => {
    if (sc === "graph") {
      const def = getCurrentGraphDef();
      return def ? graphToYaml(def) : "";
    }
    if (sc === "node" && selectedNodeId) {
      const node = flowNodes.find((n) => n.id === selectedNodeId);
      return node ? jsYaml.dump(node.data, { lineWidth: 120 }) : "";
    }
    return "";
  }, [getCurrentGraphDef, selectedNodeId, flowNodes]);

  const getContext = useCallback((sc: AiAssistScope): Record<string, string> => {
    if (sc === "graph" && currentGraph) {
      return { graph_id: currentGraph.id, graph_name: currentGraph.name };
    }
    if (sc === "node" && selectedNodeId) {
      const node = flowNodes.find((n) => n.id === selectedNodeId);
      const data = node?.data as GraphNode | undefined;
      return {
        node_id: selectedNodeId,
        node_type: data?.type ?? "",
        node_name: data?.name ?? "",
      };
    }
    return {};
  }, [currentGraph, selectedNodeId, flowNodes]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setError(null);

    const apiHistory: AiAssistMessage[] = messages
      .slice(-10)
      .map((m) => ({
        role: m.role,
        content: m.role === "assistant" && m.yaml
          ? `${m.content}\n\n생성된 YAML:\n${m.yaml}`
          : m.content,
      }));

    try {
      const result = await aiAssist(conn, scope, trimmed, getCurrentYaml(scope), apiHistory, getContext(scope), { include_ha_context: includeHaContext, language });
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: result.explanation, yaml: result.yaml },
      ]);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleApply = (yaml: string, sc: AiAssistScope) => {
    try {
      if (sc === "graph") {
        const graphDef = yamlToGraph(yaml);
        loadGraphFromAi(graphDef);
      } else if (sc === "node" && selectedNodeId) {
        const data = jsYaml.load(yaml) as Record<string, unknown>;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _id, type: _type, ...rest } = data;
        updateNodeData(selectedNodeId, rest);
      }
      setError(null);
    } catch (err) {
      setError(`적용 실패: ${err}`);
    }
  };

  const handleTest = (yaml: string, sc: AiAssistScope) => {
    handleApply(yaml, sc);
    onOpenDebug();
  };

  const handleCopy = (yaml: string) => {
    navigator.clipboard.writeText(yaml).catch(() => {});
  };

  const handleClear = () => {
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  // 스코프 유효성 체크
  const scopeWarning = (() => {
    if (scope === "node" && !selectedNodeId) return "캔버스에서 노드를 클릭해서 선택하세요.";
    return null;
  })();

  const scopeLabel = (() => {
    if (scope === "graph") return currentGraph ? `그래프: ${currentGraph.name}` : "그래프";
    if (scope === "node" && selectedNodeId) {
      const node = flowNodes.find((n) => n.id === selectedNodeId);
      const data = node?.data as GraphNode | undefined;
      return `노드: ${data?.name ?? selectedNodeId}`;
    }
    return null;
  })();

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
              height: "85vh",
              zIndex: 30,
              borderRadius: "16px 16px 0 0",
              boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
            }
          : {}),
      }}
    >
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e293b", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: "#a78bfa", fontSize: 11, marginBottom: 2, fontWeight: 700 }}>✨ AI 생성</div>
          <div style={{ color: "white", fontWeight: 600, fontSize: 14 }}>AI 어시스턴트</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 11, padding: "2px 6px" }}
              title="대화 기록 지우기"
            >
              초기화
            </button>
          )}
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>
      </div>

      {/* Scope selector */}
      <div style={{ padding: "8px 16px", borderBottom: "1px solid #1e293b", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
          {(["graph", "node"] as AiAssistScope[]).map((sc) => (
            <button
              key={sc}
              onClick={() => { setScope(sc); setError(null); }}
              style={{
                flex: 1,
                padding: "5px 0",
                background: "none",
                border: "none",
                borderBottom: scope === sc ? "2px solid #a78bfa" : "2px solid transparent",
                color: scope === sc ? "#a78bfa" : "#64748b",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {sc === "graph" ? "Graph" : "Node"}
            </button>
          ))}
        </div>
        {scopeWarning ? (
          <div style={{ color: "#f59e0b", fontSize: 11 }}>⚠ {scopeWarning}</div>
        ) : scopeLabel ? (
          <div style={{ color: "#64748b", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            📌 {scopeLabel}
          </div>
        ) : null}
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={includeHaContext}
            onChange={(e) => setIncludeHaContext(e.target.checked)}
            style={{ width: 14, height: 14, accentColor: "#a78bfa", cursor: "pointer" }}
          />
          <span style={{ color: "#64748b", fontSize: 11 }}>HA 컨텍스트 포함 (엔티티/서비스 목록)</span>
        </label>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.length === 0 && !isLoading && (
          <div style={{ color: "#334155", fontSize: 12, textAlign: "center", marginTop: 24, lineHeight: 1.8 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✨</div>
            자연어로 요청하면 AI가 YAML을 생성합니다.<br />
            <span style={{ color: "#1e293b" }}>예) "조명 제어 에이전트를 만들어줘"</span>
          </div>
        )}

        {messages.map((msg) => (
          <ChatBubble
            key={msg.id}
            msg={msg}
            currentScope={scope}
            onApply={handleApply}
            onTest={handleTest}
            onCopy={handleCopy}
          />
        ))}

        {isLoading && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <div style={{
              background: "#0a1f0a",
              border: "1px solid #1a3a1a",
              borderRadius: "12px 12px 12px 0",
              padding: "10px 14px",
              color: "#64748b",
              fontSize: 13,
            }}>
              <LoadingDots />
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: "#2d0f0f", border: "1px solid #7f1d1d", borderRadius: 8, padding: "8px 12px", color: "#f87171", fontSize: 12 }}>
            {error}
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input area */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid #1e293b", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={scopeWarning ? "스코프를 먼저 선택하세요" : "요청을 입력하세요... (Enter: 전송, Shift+Enter: 줄바꿈)"}
            disabled={!!scopeWarning || isLoading}
            rows={2}
            style={{
              flex: 1,
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: 8,
              color: "white",
              fontSize: 13,
              padding: "8px 10px",
              resize: "none",
              outline: "none",
              fontFamily: "inherit",
              opacity: scopeWarning ? 0.5 : 1,
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || !!scopeWarning}
            style={{
              background: !input.trim() || isLoading || !!scopeWarning ? "#1e293b" : "#2e1065",
              border: `1px solid ${!input.trim() || isLoading || !!scopeWarning ? "#334155" : "#6d28d9"}`,
              color: !input.trim() || isLoading || !!scopeWarning ? "#475569" : "#a78bfa",
              borderRadius: 8,
              padding: "8px 14px",
              cursor: !input.trim() || isLoading || !!scopeWarning ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 600,
              flexShrink: 0,
              alignSelf: "flex-end",
            }}
          >
            {isLoading ? "..." : "전송"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 채팅 버블 ────────────────────────────────────────────────────────────────

interface ChatBubbleProps {
  msg: ChatMessage;
  currentScope: AiAssistScope;
  onApply: (yaml: string, scope: AiAssistScope) => void;
  onTest: (yaml: string, scope: AiAssistScope) => void;
  onCopy: (yaml: string) => void;
}

function ChatBubble({ msg, currentScope, onApply, onTest, onCopy }: ChatBubbleProps) {
  const [yamlOpen, setYamlOpen] = useState(false);
  const [applied, setApplied] = useState(false);

  if (msg.role === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{
          background: "#1e3a5f",
          border: "1px solid #3b82f6",
          borderRadius: "12px 12px 0 12px",
          padding: "8px 12px",
          color: "#93c5fd",
          fontSize: 13,
          maxWidth: "80%",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}>
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{
        background: "#0a1f0a",
        border: "1px solid #1a3a1a",
        borderRadius: "12px 12px 12px 0",
        padding: "10px 14px",
        maxWidth: "95%",
      }}>
        <div style={{ color: "#86efac", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {msg.content}
        </div>

        {msg.yaml && (
          <div style={{ marginTop: 10 }}>
            <button
              onClick={() => setYamlOpen(!yamlOpen)}
              style={{
                background: "none",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                fontSize: 11,
                padding: 0,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 10 }}>{yamlOpen ? "▲" : "▼"}</span>
              YAML {yamlOpen ? "숨기기" : "보기"}
            </button>
            {yamlOpen && (
              <pre style={{
                marginTop: 6,
                background: "#020817",
                border: "1px solid #1e293b",
                borderRadius: 6,
                padding: "8px 10px",
                color: "#94a3b8",
                fontSize: 11,
                fontFamily: "monospace",
                overflow: "auto",
                maxHeight: 200,
                whiteSpace: "pre",
              }}>
                {msg.yaml}
              </pre>
            )}
          </div>
        )}
      </div>

      {msg.yaml && (
        <div style={{ display: "flex", gap: 6, paddingLeft: 4 }}>
          <button
            onClick={() => { onApply(msg.yaml!, currentScope); setApplied(true); }}
            style={{
              background: applied ? "#0f2a1a" : "#1e3a5f",
              border: `1px solid ${applied ? "#166534" : "#3b82f6"}`,
              color: applied ? "#4ade80" : "#60a5fa",
              borderRadius: 6,
              padding: "4px 10px",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {applied ? "✓ 적용됨" : "✅ Apply"}
          </button>
          <button
            onClick={() => onTest(msg.yaml!, currentScope)}
            style={{
              background: "#1a1a2e",
              border: "1px solid #334155",
              color: "#94a3b8",
              borderRadius: 6,
              padding: "4px 10px",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            ▶ Test
          </button>
          <button
            onClick={() => onCopy(msg.yaml!)}
            style={{
              background: "#1a1a2e",
              border: "1px solid #334155",
              color: "#94a3b8",
              borderRadius: 6,
              padding: "4px 10px",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            📋 Copy
          </button>
        </div>
      )}
    </div>
  );
}

function LoadingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
      <span style={{ fontSize: 11, color: "#4ade80" }}>AI 분석 중</span>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: "#4ade80",
            display: "inline-block",
            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </span>
  );
}
