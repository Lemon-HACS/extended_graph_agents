import { useState, useRef, useEffect, useCallback } from "react";
import * as jsYaml from "js-yaml";
import { useGraphStore } from "../../store/graphStore";
import { useSkillStore } from "../../store/skillStore";
import { aiAssist, saveSkill, listSkills } from "../../utils/haApi";
import type { AiAssistScope, AiAssistMessage, AiAutoSkill } from "../../utils/haApi";
import type { HassConnection } from "../../utils/haApi";
import type { GraphNode } from "../../types";
import { graphToYaml, yamlToGraph } from "../../utils/serializer";

const STORAGE_KEY = "ega_ai_graph_chat";
const MODEL_STORAGE_KEY = "ega_ai_assist_model";
const DEFAULT_AI_MODEL = "gpt-5.4";
const AI_MODEL_PRESETS = [
  { label: "GPT-4.1", model: "gpt-4.1" },
  { label: "GPT-5-nano", model: "gpt-5-nano" },
  { label: "GPT-5-mini", model: "gpt-5-mini" },
  { label: "GPT-5.4", model: "gpt-5.4" },
];

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  yaml?: string;
  // auto 스코프 전용
  skills?: AiAutoSkill[];
  graphYaml?: string;
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
  const { setSkillList } = useSkillStore();

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
  // Auto 모드: 마지막 생성된 graph YAML (재생성 시 수정 컨텍스트로 전달)
  const [lastAutoGraphYaml, setLastAutoGraphYaml] = useState<string>("");
  const [includeHaContext, setIncludeHaContext] = useState(false);
  const [aiModel, setAiModel] = useState<string>(() => {
    try { return localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_AI_MODEL; } catch { return DEFAULT_AI_MODEL; }
  });
  const [showModelInput, setShowModelInput] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch {}
  }, [messages]);

  const handleModelChange = (model: string) => {
    setAiModel(model);
    try { localStorage.setItem(MODEL_STORAGE_KEY, model); } catch {}
  };

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
    if ((sc === "graph" || sc === "auto") && currentGraph) {
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
      .map((m) => {
        if (m.role === "assistant" && m.skills !== undefined) {
          // Auto 결과: skills + graph를 히스토리에 포함해서 AI가 수정 맥락 파악 가능
          const skillsText = (m.skills ?? [])
            .map(s => `### Skill: ${s.name} (id: ${s.id})\n\`\`\`yaml\n${s.yaml}\n\`\`\``)
            .join("\n\n");
          const graphText = m.graphYaml
            ? `### Graph\n\`\`\`yaml\n${m.graphYaml}\n\`\`\``
            : "";
          return {
            role: m.role as "user" | "assistant",
            content: `${m.content}\n\n이전에 생성된 내용:\n${skillsText}\n\n${graphText}`,
          };
        }
        return {
          role: m.role as "user" | "assistant",
          content: m.role === "assistant" && m.yaml
            ? `${m.content}\n\n생성된 YAML:\n${m.yaml}`
            : m.content,
        };
      });

    // Auto 모드의 current_yaml: 이전에 생성된 graph YAML (수정 컨텍스트)
    const currentYaml = scope === "auto" ? lastAutoGraphYaml : getCurrentYaml(scope);

    try {
      const result = await aiAssist(
        conn, scope, trimmed, currentYaml, apiHistory, getContext(scope),
        { include_ha_context: scope === "auto" ? true : includeHaContext, language, model: aiModel }
      );
      console.log("[AI Assist] 응답 수신 (scope=%s):", scope, result);

      if (scope === "auto" && result.skills !== undefined) {
        console.log("[AI Auto] 응답 수신:", {
          explanation: result.explanation,
          skillCount: result.skills?.length,
          graphYamlType: typeof result.graph?.yaml,
          graphYamlPreview: typeof result.graph?.yaml === "string"
            ? result.graph.yaml.slice(0, 120)
            : result.graph?.yaml,
        });
        const rawYaml = result.graph?.yaml;
        if (typeof rawYaml !== "string") {
          console.error("[AI Auto] graph.yaml이 문자열이 아님:", rawYaml);
        }
        const newGraphYaml = typeof rawYaml === "string" ? rawYaml : "";
        setLastAutoGraphYaml(newGraphYaml);
        setMessages((prev) => [...prev, {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.explanation,
          skills: result.skills,
          graphYaml: newGraphYaml,
        }]);
      } else {
        setMessages((prev) => [...prev, {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.explanation,
          yaml: result.yaml,
        }]);
      }
    } catch (err) {
      console.error("[AI Assist] 에러 발생:", err);
      if (err && typeof err === "object" && "message" in err) {
        setError(String((err as { message: unknown }).message));
      } else {
        setError(String(err));
      }
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
      if (sc === "graph" || sc === "auto") {
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

  const handleApplySkill = async (skillYaml: string): Promise<boolean> => {
    try {
      const parsed = jsYaml.load(skillYaml) as Record<string, unknown>;
      await saveSkill(conn, parsed as never);
      return true;
    } catch (err) {
      setError(`스킬 저장 실패: ${err}`);
      return false;
    }
  };

  const handleApplyAll = async (skills: AiAutoSkill[], graphYaml: string) => {
    setError(null);
    // 스킬 순차 저장
    for (const skill of skills) {
      await handleApplySkill(skill.yaml);
    }
    // 스킬 목록 갱신
    try {
      const updated = await listSkills(conn);
      setSkillList(updated);
    } catch {}
    // 그래프 적용
    handleApply(graphYaml, "auto");
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

  const scopeWarning = (() => {
    if (scope === "node" && !selectedNodeId) return "캔버스에서 노드를 클릭해서 선택하세요.";
    return null;
  })();

  const scopeLabel = (() => {
    if (scope === "graph") return currentGraph ? `그래프: ${currentGraph.name}` : "그래프";
    if (scope === "auto") return currentGraph ? `전체 생성 (현재: ${currentGraph.name})` : "새 그래프 + 스킬 생성";
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
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e293b", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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

        {/* Model selector */}
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: showModelInput ? 6 : 0 }}>
            <span style={{ color: "#475569", fontSize: 10 }}>모델</span>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flex: 1 }}>
              {AI_MODEL_PRESETS.map((p) => (
                <button
                  key={p.model}
                  onClick={() => { handleModelChange(p.model); setShowModelInput(false); }}
                  style={{
                    padding: "2px 8px",
                    borderRadius: 4,
                    border: aiModel === p.model ? "1px solid #7c3aed" : "1px solid #334155",
                    background: aiModel === p.model ? "#2e1065" : "transparent",
                    color: aiModel === p.model ? "#a78bfa" : "#64748b",
                    cursor: "pointer",
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={() => setShowModelInput(!showModelInput)}
                style={{
                  padding: "2px 8px",
                  borderRadius: 4,
                  border: showModelInput || !AI_MODEL_PRESETS.some(p => p.model === aiModel) ? "1px solid #7c3aed" : "1px solid #334155",
                  background: showModelInput || !AI_MODEL_PRESETS.some(p => p.model === aiModel) ? "#2e1065" : "transparent",
                  color: showModelInput || !AI_MODEL_PRESETS.some(p => p.model === aiModel) ? "#a78bfa" : "#64748b",
                  cursor: "pointer",
                  fontSize: 10,
                }}
                title="직접 입력"
              >
                ✏
              </button>
            </div>
          </div>
          {(showModelInput || !AI_MODEL_PRESETS.some(p => p.model === aiModel)) && (
            <input
              value={aiModel}
              onChange={(e) => handleModelChange(e.target.value)}
              placeholder="모델명 직접 입력 (예: gpt-5.4)"
              style={{
                width: "100%",
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: 6,
                color: "white",
                fontSize: 11,
                padding: "4px 8px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          )}
        </div>
      </div>

      {/* Scope selector */}
      <div style={{ padding: "8px 16px", borderBottom: "1px solid #1e293b", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
          {(["auto", "graph", "node"] as AiAssistScope[]).map((sc) => (
            <button
              key={sc}
              onClick={() => { setScope(sc); setError(null); }}
              style={{
                flex: 1,
                padding: "5px 0",
                background: sc === "auto" && scope === "auto" ? "#1a0a2e" : "none",
                border: "none",
                borderBottom: scope === sc
                  ? `2px solid ${sc === "auto" ? "#f59e0b" : "#a78bfa"}`
                  : "2px solid transparent",
                color: scope === sc
                  ? (sc === "auto" ? "#fbbf24" : "#a78bfa")
                  : "#64748b",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {sc === "auto" ? "✨ Auto" : sc === "graph" ? "Graph" : "Node"}
            </button>
          ))}
        </div>

        {scope === "auto" && (
          <div style={{
            background: "#1a110a",
            border: "1px solid #78350f",
            borderRadius: 6,
            padding: "6px 10px",
            color: "#fbbf24",
            fontSize: 11,
            lineHeight: 1.5,
          }}>
            ✨ <strong>Auto 모드</strong>: HA 엔티티/서비스를 분석해 Skills와 Graph를 한 번에 생성합니다.
          </div>
        )}

        {scope !== "auto" && (
          <>
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
          </>
        )}
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.length === 0 && !isLoading && (
          <div style={{ color: "#334155", fontSize: 12, textAlign: "center", marginTop: 24, lineHeight: 1.8 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>
              {scope === "auto" ? "✨" : "💬"}
            </div>
            {scope === "auto"
              ? <>HA 환경을 분석해 Skills + Graph를 자동 생성합니다.<br /><span style={{ color: "#1e293b" }}>예) "조명과 에어컨을 한 번에 제어하는 에이전트"</span></>
              : <>자연어로 요청하면 AI가 YAML을 생성합니다.<br /><span style={{ color: "#1e293b" }}>예) "조명 제어 에이전트를 만들어줘"</span></>
            }
          </div>
        )}

        {messages.map((msg) => (
          msg.skills !== undefined
            ? <AutoResultBubble
                key={msg.id}
                msg={msg}
                onApplySkill={handleApplySkill}
                onApplyGraph={(yaml) => handleApply(yaml, "auto")}
                onApplyAll={handleApplyAll}
                onCopy={handleCopy}
                onTest={(yaml) => handleTest(yaml, "auto")}
              />
            : <ChatBubble
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
              <LoadingDots mode={scope === "auto" ? "auto" : "normal"} />
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
            placeholder={
              scopeWarning ? "스코프를 먼저 선택하세요"
              : scope === "auto" ? "만들고 싶은 에이전트를 설명하세요..."
              : "요청을 입력하세요... (Enter: 전송, Shift+Enter: 줄바꿈)"
            }
            disabled={!!scopeWarning || isLoading}
            rows={2}
            style={{
              flex: 1,
              background: "#1e293b",
              border: `1px solid ${scope === "auto" ? "#78350f" : "#334155"}`,
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
              background: !input.trim() || isLoading || !!scopeWarning ? "#1e293b"
                : scope === "auto" ? "#451a03" : "#2e1065",
              border: `1px solid ${!input.trim() || isLoading || !!scopeWarning ? "#334155"
                : scope === "auto" ? "#92400e" : "#6d28d9"}`,
              color: !input.trim() || isLoading || !!scopeWarning ? "#475569"
                : scope === "auto" ? "#fbbf24" : "#a78bfa",
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

// ── Auto 결과 버블 ─────────────────────────────────────────────────────────────

interface AutoResultBubbleProps {
  msg: ChatMessage;
  onApplySkill: (yaml: string) => Promise<boolean>;
  onApplyGraph: (yaml: string) => void;
  onApplyAll: (skills: AiAutoSkill[], graphYaml: string) => Promise<void>;
  onCopy: (yaml: string) => void;
  onTest: (yaml: string) => void;
}

function AutoResultBubble({ msg, onApplySkill, onApplyGraph, onApplyAll, onCopy, onTest }: AutoResultBubbleProps) {
  const skills = msg.skills ?? [];
  const graphYaml = msg.graphYaml ?? "";
  const [skillOpen, setSkillOpen] = useState<Record<string, boolean>>({});
  const [graphOpen, setGraphOpen] = useState(false);
  const [appliedSkills, setAppliedSkills] = useState<Record<string, boolean>>({});
  const [appliedGraph, setAppliedGraph] = useState(false);
  const [applyingAll, setApplyingAll] = useState(false);
  const [allApplied, setAllApplied] = useState(false);

  if (msg.role === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{
          background: "#1e3a5f", border: "1px solid #3b82f6",
          borderRadius: "12px 12px 0 12px", padding: "8px 12px",
          color: "#93c5fd", fontSize: 13, maxWidth: "80%",
          whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>
          {msg.content}
        </div>
      </div>
    );
  }

  const handleApplyAll = async () => {
    setApplyingAll(true);
    await onApplyAll(skills, graphYaml);
    setAllApplied(true);
    setApplyingAll(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Explanation */}
      <div style={{
        background: "#0a1f0a", border: "1px solid #1a3a1a",
        borderRadius: "12px 12px 12px 0", padding: "10px 14px", maxWidth: "95%",
      }}>
        <div style={{ color: "#86efac", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {msg.content}
        </div>
      </div>

      {/* Skills */}
      {skills.length > 0 && (
        <div style={{ background: "#0d1a0d", border: "1px solid #14532d", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid #14532d", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: "#4ade80", fontSize: 11, fontWeight: 700 }}>
              🔧 생성된 Skills ({skills.length}개)
            </span>
          </div>
          {skills.map((skill) => (
            <div key={skill.id} style={{ borderBottom: "1px solid #0f2d0f" }}>
              <div style={{ padding: "6px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => setSkillOpen(p => ({ ...p, [skill.id]: !p[skill.id] }))}
                  style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 10, padding: 0 }}
                >
                  {skillOpen[skill.id] ? "▲" : "▼"}
                </button>
                <span style={{ color: "#86efac", fontSize: 12, flex: 1 }}>{skill.name}</span>
                <span style={{ color: "#334155", fontSize: 10 }}>{skill.id}</span>
                <button
                  onClick={async () => {
                    const ok = await onApplySkill(skill.yaml);
                    if (ok) setAppliedSkills(p => ({ ...p, [skill.id]: true }));
                  }}
                  style={{
                    background: appliedSkills[skill.id] ? "#0f2a1a" : "#1e293b",
                    border: `1px solid ${appliedSkills[skill.id] ? "#166534" : "#334155"}`,
                    color: appliedSkills[skill.id] ? "#4ade80" : "#94a3b8",
                    borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 10, fontWeight: 600,
                  }}
                >
                  {appliedSkills[skill.id] ? "✓ 저장됨" : "저장"}
                </button>
                <button
                  onClick={() => onCopy(skill.yaml)}
                  style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 11, padding: "2px 4px" }}
                >
                  📋
                </button>
              </div>
              {skillOpen[skill.id] && (
                <pre style={{
                  margin: "0 12px 8px", background: "#020817", border: "1px solid #1e293b",
                  borderRadius: 6, padding: "8px 10px", color: "#94a3b8",
                  fontSize: 10, fontFamily: "monospace", overflow: "auto", maxHeight: 160, whiteSpace: "pre",
                }}>
                  {skill.yaml}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Graph */}
      {graphYaml && (
        <div style={{ background: "#0a0d1f", border: "1px solid #1e3a8a", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid #1e3a8a", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: "#60a5fa", fontSize: 11, fontWeight: 700 }}>📊 생성된 Graph</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => setGraphOpen(!graphOpen)}
                style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 10, padding: "2px 6px" }}
              >
                YAML {graphOpen ? "숨기기" : "보기"}
              </button>
            </div>
          </div>
          {graphOpen && (
            <pre style={{
              margin: 8, background: "#020817", border: "1px solid #1e293b",
              borderRadius: 6, padding: "8px 10px", color: "#94a3b8",
              fontSize: 10, fontFamily: "monospace", overflow: "auto", maxHeight: 200, whiteSpace: "pre",
            }}>
              {graphYaml}
            </pre>
          )}
          <div style={{ padding: "8px 12px", display: "flex", gap: 6 }}>
            <button
              onClick={() => { onApplyGraph(graphYaml); setAppliedGraph(true); }}
              style={{
                background: appliedGraph ? "#0f2a1a" : "#1e3a5f",
                border: `1px solid ${appliedGraph ? "#166534" : "#3b82f6"}`,
                color: appliedGraph ? "#4ade80" : "#60a5fa",
                borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 11, fontWeight: 600,
              }}
            >
              {appliedGraph ? "✓ 적용됨" : "✅ Graph 적용"}
            </button>
            <button
              onClick={() => onTest(graphYaml)}
              style={{
                background: "#1a1a2e", border: "1px solid #334155", color: "#94a3b8",
                borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11,
              }}
            >
              ▶ Test
            </button>
            <button
              onClick={() => onCopy(graphYaml)}
              style={{
                background: "#1a1a2e", border: "1px solid #334155", color: "#94a3b8",
                borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11,
              }}
            >
              📋 Copy
            </button>
          </div>
        </div>
      )}

      {/* Apply All */}
      {skills.length > 0 && graphYaml && (
        <button
          onClick={handleApplyAll}
          disabled={applyingAll || allApplied}
          style={{
            background: allApplied ? "#0f2a1a" : applyingAll ? "#1a1a2e" : "#451a03",
            border: `1px solid ${allApplied ? "#166534" : applyingAll ? "#334155" : "#92400e"}`,
            color: allApplied ? "#4ade80" : applyingAll ? "#64748b" : "#fbbf24",
            borderRadius: 8, padding: "8px 0", cursor: applyingAll || allApplied ? "not-allowed" : "pointer",
            fontSize: 12, fontWeight: 700, width: "100%",
          }}
        >
          {allApplied ? "✓ 전체 적용 완료" : applyingAll ? "적용 중..." : "⚡ 전체 적용 (Skills 저장 + Graph 적용)"}
        </button>
      )}

      {/* 피드백 힌트 */}
      <div style={{
        background: "#0f172a",
        border: "1px solid #1e293b",
        borderRadius: 6,
        padding: "6px 10px",
        color: "#475569",
        fontSize: 10,
        textAlign: "center",
      }}>
        💬 수정 사항을 아래에 입력하면 결과를 개선해서 재생성합니다
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
                background: "none", border: "none", color: "#64748b",
                cursor: "pointer", fontSize: 11, padding: 0,
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              <span style={{ fontSize: 10 }}>{yamlOpen ? "▲" : "▼"}</span>
              YAML {yamlOpen ? "숨기기" : "보기"}
            </button>
            {yamlOpen && (
              <pre style={{
                marginTop: 6, background: "#020817", border: "1px solid #1e293b",
                borderRadius: 6, padding: "8px 10px", color: "#94a3b8",
                fontSize: 11, fontFamily: "monospace", overflow: "auto",
                maxHeight: 200, whiteSpace: "pre",
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
              borderRadius: 6, padding: "4px 10px", cursor: "pointer",
              fontSize: 11, fontWeight: 600,
            }}
          >
            {applied ? "✓ 적용됨" : "✅ Apply"}
          </button>
          <button
            onClick={() => onTest(msg.yaml!, currentScope)}
            style={{
              background: "#1a1a2e", border: "1px solid #334155", color: "#94a3b8",
              borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11,
            }}
          >
            ▶ Test
          </button>
          <button
            onClick={() => onCopy(msg.yaml!)}
            style={{
              background: "#1a1a2e", border: "1px solid #334155", color: "#94a3b8",
              borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11,
            }}
          >
            📋 Copy
          </button>
        </div>
      )}
    </div>
  );
}

function LoadingDots({ mode = "normal" }: { mode?: "auto" | "normal" }) {
  const isAuto = mode === "auto";
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
      <span style={{ fontSize: 11, color: isAuto ? "#fbbf24" : "#4ade80" }}>
        {isAuto ? "✨ Skills + Graph 생성 중" : "AI 분석 중"}
      </span>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 4, height: 4, borderRadius: "50%",
            background: isAuto ? "#fbbf24" : "#4ade80",
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
