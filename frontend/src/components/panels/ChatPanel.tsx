/**
 * ChatPanel — 대화형 그래프 생성 메인 인터페이스
 *
 * 사용자가 자연어로 요청하면 AI가 그래프를 생성하고,
 * dry-run으로 테스트한 뒤, 문제가 있으면 자동으로 수정합니다.
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Bot,
  User,
  Loader2,
  CheckCircle2,
  XCircle,
  Play,
  Save,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { HassConnection } from "../../utils/haApiV2";
import { aiGenerateV2, runGraphV2, saveGraphV2 } from "../../utils/haApiV2";
import type { ChatMessage, GraphV2, RunResult } from "../../types_v2";
import { GraphFlowView } from "../GraphFlowView";
import {
  loadModelSettings,
  saveModelSettings,
  type ModelSettings,
} from "../../utils/modelSettings";
import { ModelComboBox } from "../ModelComboBox";

interface ChatPanelProps {
  conn: HassConnection;
  language: string;
}

export function ChatPanel({ conn, language }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [autoTest, setAutoTest] = useState(true);
  const [autoFix, setAutoFix] = useState(true);
  const [maxFixAttempts, setMaxFixAttempts] = useState(3);
  const [showAdvancedModel, setShowAdvancedModel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 모델 설정 (localStorage 영속화)
  const [modelSettings, setModelSettings] = useState<ModelSettings>(loadModelSettings);
  const model = modelSettings.model;

  const updateModelSettings = useCallback((patch: Partial<ModelSettings>) => {
    setModelSettings((prev) => {
      const next = { ...prev, ...patch };
      saveModelSettings(next);
      return next;
    });
  }, []);

  // 현재 작업 중인 그래프
  const [currentGraph, setCurrentGraph] = useState<GraphV2 | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = useCallback((msg: Omit<ChatMessage, "id" | "timestamp">) => {
    const newMsg: ChatMessage = {
      ...msg,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, newMsg]);
    return newMsg;
  }, []);

  const updateLastAssistantMessage = useCallback(
    (updater: (msg: ChatMessage) => ChatMessage) => {
      setMessages((prev) => {
        const idx = [...prev].reverse().findIndex((m) => m.role === "assistant");
        if (idx === -1) return prev;
        const realIdx = prev.length - 1 - idx;
        const updated = [...prev];
        updated[realIdx] = updater(updated[realIdx]);
        return updated;
      });
    },
    []
  );

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    addMessage({ role: "user", content: text });
    setIsLoading(true);

    try {
      // 1단계: AI 그래프 생성
      addMessage({
        role: "system",
        content: "🔧 그래프 생성 중...",
      });

      const chatHistory = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      const result = await aiGenerateV2(conn, {
        request: text,
        current_graph: currentGraph || undefined,
        messages: chatHistory,
        language,
        model,
      });

      const graph = result.graph;
      setCurrentGraph(graph);

      // 생성 결과 메시지
      setMessages((prev) =>
        prev.filter((m) => !(m.role === "system" && m.content.includes("생성 중")))
      );
      addMessage({
        role: "assistant",
        content: result.explanation,
        graph,
      });

      // 2단계: 자동 테스트 (dry-run)
      if (autoTest) {
        await runAutoTest(graph, text, 0);
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.filter((m) => !(m.role === "system" && m.content.includes("생성 중")))
      );
      addMessage({
        role: "assistant",
        content: `❌ 오류가 발생했습니다: ${err.message || err}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const runAutoTest = async (graph: GraphV2, testInput: string, attempt: number) => {
    addMessage({
      role: "system",
      content: `🧪 Dry-run 테스트 중... (시도 ${attempt + 1})`,
    });

    try {
      const runResult = await runGraphV2(conn, {
        graph,
        user_input: testInput,
        language,
        dry_run: true,
      });

      // 시스템 메시지 제거
      setMessages((prev) =>
        prev.filter((m) => !(m.role === "system" && m.content.includes("테스트 중")))
      );

      // trace에서 DRY RUN ERROR 검출
      const dryRunErrors = runResult.trace
        .filter((e) => e.result?.includes("[DRY RUN ERROR]") || e.error)
        .map((e) => e.result || e.error || "")
        .filter(Boolean);
      const hasError = !!runResult.error || dryRunErrors.length > 0;
      const errorSummary = runResult.error
        || dryRunErrors.join("\n");

      if (hasError) {
        // 에러 발생 → 자동 수정 시도
        addMessage({
          role: "assistant",
          content: `⚠️ 테스트에서 오류 발견: ${errorSummary}`,
          runResult,
        });

        if (autoFix && attempt < maxFixAttempts) {
          addMessage({
            role: "system",
            content: `🔄 자동 수정 중... (${attempt + 1}/${maxFixAttempts})`,
          });

          try {
            const fixResult = await aiGenerateV2(conn, {
              request: `이전에 생성한 그래프에서 다음 오류가 발생했습니다. 수정해주세요:\n\n오류: ${errorSummary}\n\n실행 트레이스:\n${JSON.stringify(runResult.trace, null, 2)}`,
              current_graph: graph,
              language,
              model,
            });

            setMessages((prev) =>
              prev.filter((m) => !(m.role === "system" && m.content.includes("수정 중")))
            );

            const fixedGraph = fixResult.graph;
            setCurrentGraph(fixedGraph);

            addMessage({
              role: "assistant",
              content: `🔧 수정 완료: ${fixResult.explanation}`,
              graph: fixedGraph,
            });

            // 수정된 그래프로 재테스트
            await runAutoTest(fixedGraph, testInput, attempt + 1);
          } catch (fixErr: any) {
            setMessages((prev) =>
              prev.filter((m) => !(m.role === "system" && m.content.includes("수정 중")))
            );
            addMessage({
              role: "assistant",
              content: `❌ 자동 수정 실패: ${fixErr.message || fixErr}`,
            });
          }
        }
      } else {
        // 테스트 성공
        addMessage({
          role: "assistant",
          content: `✅ 테스트 성공! 출력: "${runResult.output || "(없음)"}"`,
          runResult,
        });
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.filter((m) => !(m.role === "system" && m.content.includes("테스트 중")))
      );
      addMessage({
        role: "assistant",
        content: `⚠️ Dry-run 실행 실패: ${err.message || err}`,
      });
    }
  };

  const handleSaveGraph = async (graph: GraphV2) => {
    try {
      const result = await saveGraphV2(conn, graph);
      addMessage({
        role: "system",
        content: `💾 그래프 "${graph.name}" 저장 완료! (ID: ${result.id})`,
      });
    } catch (err: any) {
      addMessage({
        role: "assistant",
        content: `❌ 저장 실패: ${err.message || err}`,
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div style={styles.container}>
      {/* Settings bar — always visible */}
      <div style={styles.settingsBar}>
        <div style={styles.settingsRow}>
          <label style={styles.settingLabel}>
            AI 모델:
            <ModelComboBox
              value={model}
              onChange={(v) => updateModelSettings({ model: v })}
              style={{ width: "200px" }}
            />
          </label>
          <label style={styles.settingLabel}>
            <input type="checkbox" checked={autoTest} onChange={(e) => setAutoTest(e.target.checked)} />
            자동 테스트
          </label>
          <label style={styles.settingLabel}>
            <input type="checkbox" checked={autoFix} onChange={(e) => setAutoFix(e.target.checked)} />
            자동 수정 ({maxFixAttempts}회)
          </label>
          <button
            style={{ ...styles.settingsToggle, color: showAdvancedModel ? "#60a5fa" : "#64748b" }}
            onClick={() => setShowAdvancedModel(!showAdvancedModel)}
          >
            {showAdvancedModel ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            세부
          </button>
        </div>
        {showAdvancedModel && (
          <div style={styles.settingsRow}>
            <label style={styles.settingLabel}>
              Temperature:
              <input
                type="number" min={0} max={2} step={0.1}
                value={modelSettings.temperature ?? ""}
                onChange={(e) => updateModelSettings({
                  temperature: e.target.value ? Number(e.target.value) : undefined,
                })}
                style={{ ...styles.numberInput, width: "60px" }}
                placeholder="기본"
              />
            </label>
            <label style={styles.settingLabel}>
              Top P:
              <input
                type="number" min={0} max={1} step={0.05}
                value={modelSettings.top_p ?? ""}
                onChange={(e) => updateModelSettings({
                  top_p: e.target.value ? Number(e.target.value) : undefined,
                })}
                style={{ ...styles.numberInput, width: "60px" }}
                placeholder="기본"
              />
            </label>
            <label style={styles.settingLabel}>
              Max Tokens:
              <input
                type="number" min={100} step={100}
                value={modelSettings.max_tokens ?? ""}
                onChange={(e) => updateModelSettings({
                  max_tokens: e.target.value ? Number(e.target.value) : undefined,
                })}
                style={{ ...styles.numberInput, width: "70px" }}
                placeholder="기본"
              />
            </label>
            <label style={styles.settingLabel}>
              Reasoning:
              <select
                value={modelSettings.reasoning_effort ?? ""}
                onChange={(e) => updateModelSettings({
                  reasoning_effort: (e.target.value || undefined) as ModelSettings["reasoning_effort"],
                })}
                style={styles.select}
              >
                <option value="">기본</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.welcome}>
            <Bot size={48} style={{ color: "#60a5fa", opacity: 0.5 }} />
            <h3 style={styles.welcomeTitle}>Graph Agent Builder</h3>
            <p style={styles.welcomeText}>
              원하는 에이전트를 설명하면 AI가 그래프를 생성하고 테스트합니다.
            </p>
            <div style={styles.examples}>
              {[
                "거실 조명과 에어컨을 제어하는 스마트홈 에이전트 만들어줘",
                "사용자 질문을 분류해서 FAQ와 상담원으로 라우팅하는 에이전트",
                "날씨와 시간에 따라 다르게 응답하는 인사 에이전트",
              ].map((ex) => (
                <button
                  key={ex}
                  style={styles.exampleBtn}
                  onClick={() => {
                    setInput(ex);
                    inputRef.current?.focus();
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onSave={handleSaveGraph}
            onRunTest={(graph) => runAutoTest(graph, "테스트 입력", 0)}
          />
        ))}

        {isLoading && (
          <div style={styles.loadingIndicator}>
            <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
            <span>처리 중...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={styles.inputArea}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="원하는 에이전트를 설명하세요... (Shift+Enter: 줄바꿈)"
          style={styles.textarea}
          rows={1}
          disabled={isLoading}
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || isLoading}
          style={{
            ...styles.sendBtn,
            opacity: !input.trim() || isLoading ? 0.5 : 1,
          }}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

// ── Message Bubble Component ──

function MessageBubble({
  message,
  onSave,
  onRunTest,
}: {
  message: ChatMessage;
  onSave: (graph: GraphV2) => void;
  onRunTest: (graph: GraphV2) => void;
}) {
  const [showGraph, setShowGraph] = useState(false);
  const [showTrace, setShowTrace] = useState(false);

  if (message.role === "system") {
    return (
      <div style={styles.systemMsg}>
        {message.content}
      </div>
    );
  }

  const isUser = message.role === "user";

  return (
    <div style={{ ...styles.msgRow, justifyContent: isUser ? "flex-end" : "flex-start" }}>
      {!isUser && (
        <div style={styles.avatar}>
          <Bot size={16} />
        </div>
      )}
      <div style={isUser ? styles.userBubble : styles.assistantBubble}>
        <div style={styles.msgContent}>{message.content}</div>

        {/* 그래프 표시 */}
        {message.graph && (
          <div style={styles.graphSection}>
            <button
              style={styles.collapseBtn}
              onClick={() => setShowGraph(!showGraph)}
            >
              {showGraph ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              그래프: {message.graph.name} ({Object.keys(message.graph.nodes).length}개 노드)
            </button>
            {showGraph && (
              <div style={styles.graphPreview}>
                <GraphFlowView graph={message.graph} height={200} />
              </div>
            )}
            <div style={styles.graphActions}>
              <button style={styles.actionBtn} onClick={() => onSave(message.graph!)}>
                <Save size={14} /> 저장
              </button>
              <button style={styles.actionBtn} onClick={() => onRunTest(message.graph!)}>
                <Play size={14} /> 테스트
              </button>
            </div>
          </div>
        )}

        {/* 실행 결과 표시 */}
        {message.runResult && (
          <div style={styles.traceSection}>
            <button
              style={styles.collapseBtn}
              onClick={() => setShowTrace(!showTrace)}
            >
              {showTrace ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {message.runResult.error ? (
                <><XCircle size={14} style={{ color: "#ef4444" }} /> 실행 실패</>
              ) : (
                <><CheckCircle2 size={14} style={{ color: "#22c55e" }} /> 실행 성공</>
              )}
            </button>
            {showTrace && (
              <div style={styles.traceContent}>
                {message.runResult.trace.map((event, i) => (
                  <div key={i} style={styles.traceEvent}>
                    <span style={styles.traceType}>{event.type}</span>
                    <span>{event.node_id || event.tool_name || ""}</span>
                    {event.output && (
                      <div style={styles.traceOutput}>{event.output.slice(0, 200)}</div>
                    )}
                    {event.error && (
                      <div style={{ ...styles.traceOutput, color: "#ef4444" }}>
                        {event.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {isUser && (
        <div style={{ ...styles.avatar, background: "#3b82f6" }}>
          <User size={16} />
        </div>
      )}
    </div>
  );
}

// ── Styles ──

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "#0a0a1a",
    color: "#e2e8f0",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  settingsBar: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "8px 16px",
    borderBottom: "1px solid #1e293b",
    background: "#0f172a",
    fontSize: "12px",
    flexShrink: 0,
  },
  settingsRow: {
    display: "flex",
    gap: "14px",
    alignItems: "center",
    flexWrap: "wrap" as const,
  },
  settingsToggle: {
    display: "flex",
    alignItems: "center",
    gap: "2px",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "11px",
    padding: "2px 4px",
  },
  numberInput: {
    background: "#1e293b",
    color: "#e2e8f0",
    border: "1px solid #334155",
    borderRadius: "4px",
    padding: "2px 6px",
    fontSize: "12px",
    outline: "none",
  },
  settingLabel: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: "#94a3b8",
  },
  select: {
    background: "#1e293b",
    color: "#e2e8f0",
    border: "1px solid #334155",
    borderRadius: "4px",
    padding: "2px 6px",
    fontSize: "13px",
  },
  messages: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  welcome: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: "12px",
    textAlign: "center" as const,
    opacity: 0.8,
  },
  welcomeTitle: {
    fontSize: "20px",
    fontWeight: 600,
    margin: 0,
    color: "#e2e8f0",
  },
  welcomeText: {
    fontSize: "14px",
    color: "#94a3b8",
    margin: 0,
    maxWidth: "400px",
  },
  examples: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "12px",
    width: "100%",
    maxWidth: "500px",
  },
  exampleBtn: {
    background: "#1e293b",
    color: "#94a3b8",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "13px",
    cursor: "pointer",
    textAlign: "left" as const,
  },
  msgRow: {
    display: "flex",
    gap: "8px",
    alignItems: "flex-start",
  },
  avatar: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    background: "#1e293b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    color: "#94a3b8",
  },
  userBubble: {
    background: "#1e3a5f",
    borderRadius: "12px 12px 4px 12px",
    padding: "10px 14px",
    maxWidth: "80%",
    fontSize: "14px",
    lineHeight: "1.5",
  },
  assistantBubble: {
    background: "#1e293b",
    borderRadius: "12px 12px 12px 4px",
    padding: "10px 14px",
    maxWidth: "85%",
    fontSize: "14px",
    lineHeight: "1.5",
  },
  msgContent: {
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
  },
  systemMsg: {
    textAlign: "center" as const,
    fontSize: "13px",
    color: "#64748b",
    padding: "4px 0",
  },
  graphSection: {
    marginTop: "8px",
    borderTop: "1px solid #334155",
    paddingTop: "8px",
  },
  collapseBtn: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    background: "none",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: "13px",
    padding: "2px 0",
  },
  graphPreview: {
    marginTop: "6px",
    borderRadius: "6px",
    overflow: "hidden",
  },
  graphActions: {
    display: "flex",
    gap: "6px",
    marginTop: "8px",
  },
  actionBtn: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    background: "#334155",
    color: "#e2e8f0",
    border: "none",
    borderRadius: "6px",
    padding: "4px 10px",
    fontSize: "12px",
    cursor: "pointer",
  },
  traceSection: {
    marginTop: "8px",
    borderTop: "1px solid #334155",
    paddingTop: "8px",
  },
  traceContent: {
    marginTop: "6px",
    padding: "8px",
    background: "#0f172a",
    borderRadius: "6px",
    fontSize: "12px",
    maxHeight: "200px",
    overflowY: "auto" as const,
  },
  traceEvent: {
    padding: "2px 0",
    borderBottom: "1px solid #1e293b",
  },
  traceType: {
    color: "#60a5fa",
    fontWeight: 600,
    fontSize: "11px",
    marginRight: "6px",
  },
  traceOutput: {
    color: "#94a3b8",
    fontSize: "11px",
    marginTop: "2px",
    fontFamily: "monospace",
  },
  loadingIndicator: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 16px",
    color: "#64748b",
    fontSize: "13px",
  },
  inputArea: {
    display: "flex",
    alignItems: "flex-end",
    gap: "8px",
    padding: "12px 16px",
    borderTop: "1px solid #1e293b",
    background: "#0f172a",
  },
  textarea: {
    flex: 1,
    background: "#1e293b",
    color: "#e2e8f0",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "10px 14px",
    fontSize: "14px",
    resize: "none" as const,
    outline: "none",
    fontFamily: "inherit",
    maxHeight: "120px",
  },
  sendBtn: {
    background: "#3b82f6",
    color: "white",
    border: "none",
    borderRadius: "50%",
    width: "36px",
    height: "36px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  },
};

// CSS animation for loading spinner
const spinKeyframes = `
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}`;
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = spinKeyframes;
  document.head.appendChild(style);
}
