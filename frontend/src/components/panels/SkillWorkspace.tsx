import { useEffect, useState, useRef, useCallback } from "react";
import { useLang } from "../../contexts/LangContext";
import { useSkillStore } from "../../store/skillStore";
import { FunctionEditor, Field, inputStyle, addBtnStyle } from "../shared/FunctionEditor";
import type { SkillDefinition, FunctionTool, TraceEvent } from "../../types";
import { saveSkill, deleteSkill, listSkills, aiAssist, runSkillTest } from "../../utils/haApi";
import type { HassConnection, AiAssistMessage } from "../../utils/haApi";
import * as yaml from "js-yaml";

interface SkillWorkspaceProps {
  conn: HassConnection;
  isMobile?: boolean;
  onOpenSidebar?: () => void;
}

export function SkillWorkspace({ conn, isMobile, onOpenSidebar }: SkillWorkspaceProps) {
  const { editingSkill, setEditingSkill, setSkillList, pendingAiSkillYaml, setPendingAiSkillYaml } = useSkillStore();
  const t = useLang();

  const [draft, setDraft] = useState<SkillDefinition | null>(editingSkill);
  const [tab, setTab] = useState<"visual" | "yaml">("visual");
  const [yamlText, setYamlText] = useState("");
  const [yamlError, setYamlError] = useState("");
  const [saving, setSaving] = useState(false);
  const [rightPanel, setRightPanel] = useState<"none" | "ai" | "test">("none");

  // dirty 감지: draft vs 마지막 저장 상태(editingSkill) 비교
  const isDirty = JSON.stringify(draft) !== JSON.stringify(editingSkill);

  // Sync draft when selected skill changes
  useEffect(() => {
    setDraft(editingSkill);
    if (editingSkill) {
      setYamlText(yaml.dump(editingSkill, { lineWidth: 120, noRefs: true }));
    }
    setTab("visual");
    setYamlError("");
    setRightPanel("none");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingSkill?.id]);

  // AI 어시스턴트가 스킬 YAML을 생성하면 YAML 탭에 반영
  useEffect(() => {
    if (!pendingAiSkillYaml) return;
    setYamlText(pendingAiSkillYaml);
    setTab("yaml");
    setYamlError("");
    setPendingAiSkillYaml(null);
  }, [pendingAiSkillYaml]);

  const update = (patch: Partial<SkillDefinition>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  };

  const switchToYaml = () => {
    if (draft) setYamlText(yaml.dump(draft, { lineWidth: 120, noRefs: true }));
    setYamlError("");
    setTab("yaml");
  };

  const applyYaml = () => {
    try {
      const parsed = yaml.load(yamlText) as SkillDefinition;
      if (!parsed?.id) throw new Error("id field required");
      setDraft(parsed);
      setYamlError("");
      setTab("visual");
    } catch (err) {
      setYamlError(String(err));
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await saveSkill(conn, draft);
      const list = await listSkills(conn);
      setSkillList(list);
      setEditingSkill(draft);
    } catch (err) {
      alert(t.failedToSaveSkill(String(err)));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!draft) return;
    if (!confirm(t.confirmDeleteSkill(draft.name))) return;
    try {
      await deleteSkill(conn, draft.id);
      const list = await listSkills(conn);
      setSkillList(list);
      setEditingSkill(null);
    } catch (err) {
      alert(`Failed to delete skill: ${err}`);
    }
  };

  const functions = draft?.functions ?? [];

  const addFunction = () => {
    const newFunc: FunctionTool = {
      spec: {
        name: `function_${functions.length + 1}`,
        description: "",
        parameters: { type: "object", properties: {}, required: [] },
      },
      function: { type: "native", service: "", data: {} },
    };
    update({ functions: [...functions, newFunc] });
  };

  const updateFunction = (i: number, patch: Partial<FunctionTool>) => {
    update({ functions: functions.map((f, idx) => (idx === i ? { ...f, ...patch } : f)) });
  };

  const removeFunction = (i: number) => {
    update({ functions: functions.filter((_, idx) => idx !== i) });
  };

  const togglePanel = (panel: "ai" | "test") => {
    setRightPanel((prev) => (prev === panel ? "none" : panel));
  };

  // Empty state
  if (!draft) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#334155",
          gap: 12,
        }}
      >
        {isMobile && (
          <button
            onClick={onOpenSidebar}
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: 20,
            }}
          >
            ☰
          </button>
        )}
        <div style={{ fontSize: 40 }}>🔧</div>
        <div style={{ fontSize: 14, color: "#475569" }}>스킬을 선택하거나 새로 만들어보세요.</div>
      </div>
    );
  }

  const panelWidth = 360;

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0, position: "relative" }}>
      {/* Mobile backdrop */}
      {isMobile && rightPanel !== "none" && (
        <div
          onClick={() => setRightPanel("none")}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 40,
          }}
        />
      )}

      {/* Main editor area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
        {/* Header */}
        <div
          style={{
            padding: isMobile ? "8px 12px" : "12px 24px",
            borderBottom: "1px solid #1e293b",
            background: "#0a0f1e",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          {isMobile && (
            <button
              onClick={onOpenSidebar}
              style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 20, flexShrink: 0 }}
            >
              ☰
            </button>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, flexWrap: "wrap" }}>
            <span style={{ color: "#a78bfa", fontSize: 16, flexShrink: 0 }}>🔧</span>
            <input
              value={draft.name}
              onChange={(e) => update({ name: e.target.value })}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: "1px solid #334155",
                color: "white",
                fontSize: 15,
                fontWeight: 700,
                outline: "none",
                minWidth: 120,
                maxWidth: 220,
              }}
            />
            <input
              value={draft.group ?? ""}
              onChange={(e) => update({ group: e.target.value })}
              placeholder={t.skillGroup}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: "1px solid #1e293b",
                color: "#94a3b8",
                fontSize: 12,
                outline: "none",
                minWidth: 80,
                maxWidth: 140,
              }}
            />
            <input
              value={draft.description ?? ""}
              onChange={(e) => update({ description: e.target.value })}
              placeholder={t.skillDescription}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: "1px solid #1e293b",
                color: "#94a3b8",
                fontSize: 12,
                outline: "none",
                flex: 1,
                minWidth: 100,
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => togglePanel("ai")}
              style={{
                background: rightPanel === "ai" ? "#2d1b69" : "#1e293b",
                border: `1px solid ${rightPanel === "ai" ? "#6d28d9" : "#334155"}`,
                color: rightPanel === "ai" ? "#c4b5fd" : "#94a3b8",
                borderRadius: 6,
                padding: "5px 12px",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              ✨ AI 생성
            </button>
            <button
              onClick={() => togglePanel("test")}
              style={{
                background: rightPanel === "test" ? "#1a2a1a" : "#1e293b",
                border: `1px solid ${rightPanel === "test" ? "#22c55e" : "#334155"}`,
                color: rightPanel === "test" ? "#86efac" : "#94a3b8",
                borderRadius: 6,
                padding: "5px 12px",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              ▶ 테스트
            </button>
            <button
              onClick={handleDelete}
              style={{
                background: "#2d1515",
                border: "1px solid #7f1d1d",
                color: "#f87171",
                borderRadius: 6,
                padding: "5px 12px",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              🗑 {t.deleteSkill}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: saving ? "#1e1a3a" : isDirty ? "#2d1b69" : "#1a1a2e",
                border: `1px solid ${isDirty ? "#6d28d9" : "#334155"}`,
                color: isDirty ? "#c4b5fd" : "#475569",
                borderRadius: 6,
                padding: "5px 16px",
                cursor: saving ? "not-allowed" : "pointer",
                fontSize: 12,
                fontWeight: 600,
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "저장 중..." : isDirty ? `${t.saveSkill} *` : t.saveSkill}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #1e293b", flexShrink: 0, background: "#0a0f1e" }}>
          {(["visual", "yaml"] as const).map((tabKey) => (
            <button
              key={tabKey}
              onClick={tabKey === "yaml" ? switchToYaml : () => setTab("visual")}
              style={{
                background: "none",
                border: "none",
                borderBottom: tab === tabKey ? "2px solid #7c3aed" : "2px solid transparent",
                color: tab === tabKey ? "#a78bfa" : "#64748b",
                padding: "8px 20px",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {tabKey === "visual" ? t.visualTab : t.yamlTab}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ color: "#334155", fontSize: 10, padding: "10px 16px", fontFamily: "monospace" }}>
            ID: {draft.id.slice(0, 8)}...
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? 16 : 24, minHeight: 0 }}>
          {tab === "visual" ? (
            <div style={{ maxWidth: 900 }}>
              <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
                {t.functions}
              </div>

              {functions.length === 0 && (
                <div
                  style={{
                    padding: 24,
                    background: "rgba(255,255,255,0.02)",
                    border: "1px dashed #1e293b",
                    borderRadius: 8,
                    color: "#475569",
                    fontSize: 12,
                    textAlign: "center",
                    marginBottom: 12,
                  }}
                >
                  아직 함수가 없습니다. 아래 버튼으로 추가하세요.
                </div>
              )}

              {functions.map((func, i) => (
                <FunctionEditor
                  key={i}
                  index={i}
                  func={func}
                  onChange={(patch) => updateFunction(i, patch)}
                  onRemove={() => removeFunction(i)}
                />
              ))}

              <button onClick={addFunction} style={addBtnStyle}>
                {t.addFunction}
              </button>
            </div>
          ) : (
            <div style={{ maxWidth: 900 }}>
              <textarea
                value={yamlText}
                onChange={(e) => setYamlText(e.target.value)}
                style={{
                  ...inputStyle,
                  fontFamily: "monospace",
                  fontSize: 13,
                  resize: "vertical",
                  minHeight: 400,
                  lineHeight: 1.6,
                }}
                rows={24}
              />
              {yamlError && (
                <div style={{ color: "#ef4444", fontSize: 11, marginTop: 6 }}>{yamlError}</div>
              )}
              <button
                onClick={applyYaml}
                style={{
                  marginTop: 10,
                  background: "#1e293b",
                  border: "1px solid #334155",
                  color: "#94a3b8",
                  borderRadius: 6,
                  padding: "8px 24px",
                  cursor: "pointer",
                  fontSize: 12,
                  width: "100%",
                }}
              >
                {t.applyYaml}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right panel: AI or Test (desktop: side panel, mobile: bottom sheet) */}
      {rightPanel === "ai" && (
        <SkillAiPanel
          conn={conn}
          skill={draft}
          panelWidth={panelWidth}
          isMobile={isMobile}
          onApply={(yamlStr) => {
            setYamlText(yamlStr);
            setTab("yaml");
          }}
          onClose={() => setRightPanel("none")}
        />
      )}
      {rightPanel === "test" && (
        <SkillTestPanel
          conn={conn}
          skill={draft}
          panelWidth={panelWidth}
          isMobile={isMobile}
          isDirty={isDirty}
          onSave={handleSave}
          onClose={() => setRightPanel("none")}
        />
      )}
    </div>
  );
}

// ── Skill AI Panel ────────────────────────────────────────────────────────────

interface SkillAiPanelProps {
  conn: HassConnection;
  skill: SkillDefinition;
  panelWidth: number;
  isMobile?: boolean;
  onApply: (yaml: string) => void;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  yaml?: string;
}

function SkillAiPanel({ conn, skill, panelWidth, isMobile, onApply, onClose }: SkillAiPanelProps) {
  const storageKey = `ega_skill_ai_chat_${skill.id}`;

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Persist messages
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(messages)); } catch {}
  }, [messages, storageKey]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const getCurrentYaml = useCallback(() => {
    try { return yaml.dump(skill, { lineWidth: 120 }); } catch { return ""; }
  }, [skill]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setError(null);

    const apiHistory: AiAssistMessage[] = messages.slice(-10).map((m) => ({
      role: m.role,
      content: m.role === "assistant" && m.yaml ? `${m.content}\n\n생성된 YAML:\n${m.yaml}` : m.content,
    }));

    try {
      const result = await aiAssist(
        conn, "skill", trimmed,
        getCurrentYaml(),
        apiHistory,
        { skill_id: skill.id, skill_name: skill.name }
      );
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

  const handleClear = () => {
    setMessages([]);
    try { localStorage.removeItem(storageKey); } catch {}
  };

  const containerStyle: React.CSSProperties = isMobile
    ? {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: "85vh",
        background: "#0f172a",
        borderTop: "1px solid #1e293b",
        borderRadius: "16px 16px 0 0",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 50,
      }
    : {
        width: panelWidth,
        background: "#0f172a",
        borderLeft: "1px solid #1e293b",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        flexShrink: 0,
      };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e293b", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700 }}>✨ AI 생성</div>
          <div style={{ color: "white", fontWeight: 600, fontSize: 13 }}>스킬 AI 어시스턴트</div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {messages.length > 0 && (
            <button onClick={handleClear} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 11 }}>
              초기화
            </button>
          )}
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>
      </div>

      {/* Chat */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && !isLoading && (
          <div style={{ color: "#334155", fontSize: 12, textAlign: "center", marginTop: 20, lineHeight: 1.8 }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>✨</div>
            스킬 함수를 자연어로 생성하세요.<br />
            <span style={{ color: "#1e293b" }}>예) "조명 ON/OFF 함수 추가해줘"</span>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === "user" ? (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ background: "#1e3a5f", border: "1px solid #3b82f6", borderRadius: "10px 10px 0 10px", padding: "7px 11px", color: "#93c5fd", fontSize: 12, maxWidth: "80%", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {msg.content}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ background: "#0a1f0a", border: "1px solid #1a3a1a", borderRadius: "10px 10px 10px 0", padding: "9px 12px", maxWidth: "95%" }}>
                  <div style={{ color: "#86efac", fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{msg.content}</div>
                  {msg.yaml && (
                    <div style={{ marginTop: 8, display: "flex", gap: 4 }}>
                      <button
                        onClick={() => onApply(msg.yaml!)}
                        style={{ background: "#1e3a5f", border: "1px solid #3b82f6", color: "#60a5fa", borderRadius: 5, padding: "3px 9px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                      >
                        ✅ Apply
                      </button>
                      <button
                        onClick={() => navigator.clipboard.writeText(msg.yaml!).catch(() => {})}
                        style={{ background: "#1a1a2e", border: "1px solid #334155", color: "#94a3b8", borderRadius: 5, padding: "3px 9px", cursor: "pointer", fontSize: 11 }}
                      >
                        📋 Copy
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div style={{ background: "#0a1f0a", border: "1px solid #1a3a1a", borderRadius: "10px 10px 10px 0", padding: "9px 12px", color: "#64748b", fontSize: 12, display: "inline-block" }}>
            AI 분석 중...
          </div>
        )}
        {error && (
          <div style={{ background: "#2d0f0f", border: "1px solid #7f1d1d", borderRadius: 6, padding: "7px 10px", color: "#f87171", fontSize: 11 }}>{error}</div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "10px 14px", borderTop: "1px solid #1e293b", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="스킬 함수 요청... (Enter: 전송)"
            disabled={isLoading}
            rows={2}
            style={{ flex: 1, background: "#1e293b", border: "1px solid #334155", borderRadius: 7, color: "white", fontSize: 12, padding: "7px 9px", resize: "none", outline: "none", fontFamily: "inherit" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            style={{ background: !input.trim() || isLoading ? "#1e293b" : "#2e1065", border: `1px solid ${!input.trim() || isLoading ? "#334155" : "#6d28d9"}`, color: !input.trim() || isLoading ? "#475569" : "#a78bfa", borderRadius: 7, padding: "7px 12px", cursor: !input.trim() || isLoading ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, flexShrink: 0, alignSelf: "flex-end" }}
          >
            {isLoading ? "..." : "전송"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Skill Test Panel ──────────────────────────────────────────────────────────

interface SkillTestPanelProps {
  conn: HassConnection;
  skill: SkillDefinition;
  panelWidth: number;
  isMobile?: boolean;
  isDirty?: boolean;
  onSave: () => Promise<void>;
  onClose: () => void;
}

function SkillTestPanel({ conn, skill, panelWidth, isMobile, isDirty, onSave, onClose }: SkillTestPanelProps) {
  const [userInput, setUserInput] = useState("");
  const [model, setModel] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const traceEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    traceEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [trace]);

  const handleRun = useCallback(async () => {
    if (!userInput.trim() || isRunning) return;
    setIsRunning(true);
    setTrace([]);
    setOutput(null);
    setError(null);
    setHasRun(true);

    try {
      const result = await runSkillTest(conn, skill.id, userInput.trim(), model || undefined);
      setTrace(result.trace);
      setOutput(result.output);
      setError(result.error);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsRunning(false);
    }
  }, [conn, skill.id, userInput, model, isRunning]);

  const testContainerStyle: React.CSSProperties = isMobile
    ? {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: "85vh",
        background: "#0f172a",
        borderTop: "1px solid #1e293b",
        borderRadius: "16px 16px 0 0",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 50,
      }
    : {
        width: panelWidth,
        background: "#0f172a",
        borderLeft: "1px solid #1e293b",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        flexShrink: 0,
      };

  const handleSaveAndRun = async () => {
    await onSave();
    await handleRun();
  };

  return (
    <div style={testContainerStyle}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e293b", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: "#86efac", fontSize: 11, fontWeight: 700 }}>▶ 테스트</div>
          <div style={{ color: "white", fontWeight: 600, fontSize: 13 }}>{skill.name}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 18 }}>✕</button>
      </div>

      {/* 저장 필요 경고 */}
      {isDirty && (
        <div style={{
          padding: "8px 16px",
          background: "#1a1200",
          borderBottom: "1px solid #3a2800",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexShrink: 0,
        }}>
          <span style={{ color: "#fbbf24", fontSize: 11, flex: 1 }}>
            ⚠ 저장되지 않은 변경사항이 있습니다. 테스트는 마지막으로 저장된 버전으로 실행됩니다.
          </span>
          <button
            onClick={handleSaveAndRun}
            disabled={isRunning}
            style={{
              background: "#3a2000",
              border: "1px solid #d97706",
              color: "#fbbf24",
              borderRadius: 5,
              padding: "3px 10px",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            저장 후 실행
          </button>
        </div>
      )}

      {/* Input section */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e293b", flexShrink: 0 }}>
        <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 6, fontWeight: 600 }}>사용자 입력</div>
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleRun(); }}
          placeholder="테스트할 메시지를 입력하세요... (Ctrl+Enter: 실행)"
          rows={3}
          style={{ width: "100%", background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "white", fontSize: 12, padding: "8px 10px", resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="모델 (기본값 사용)"
            style={{ flex: 1, background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "white", fontSize: 11, padding: "5px 8px", outline: "none" }}
          />
          <button
            onClick={handleRun}
            disabled={!userInput.trim() || isRunning}
            style={{
              background: !userInput.trim() || isRunning ? "#1e293b" : "#1a3a1a",
              border: `1px solid ${!userInput.trim() || isRunning ? "#334155" : "#22c55e"}`,
              color: !userInput.trim() || isRunning ? "#475569" : "#4ade80",
              borderRadius: 6,
              padding: "5px 16px",
              cursor: !userInput.trim() || isRunning ? "not-allowed" : "pointer",
              fontSize: 12,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {isRunning ? "실행 중..." : "▶ 실행"}
          </button>
        </div>
      </div>

      {/* Trace & Output */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {!hasRun && (
          <div style={{ color: "#334155", fontSize: 12, textAlign: "center", marginTop: 24 }}>
            메시지를 입력하고 실행하면<br />tool call 과정과 응답이 표시됩니다.
          </div>
        )}

        {trace.map((event, i) => (
          <TraceEventCard key={i} event={event} />
        ))}

        {isRunning && (
          <div style={{ background: "#0a1f0a", border: "1px solid #1a3a1a", borderRadius: 6, padding: "8px 12px", color: "#64748b", fontSize: 11 }}>
            실행 중...
          </div>
        )}

        {output !== null && (
          <div style={{ background: "#0a1520", border: "1px solid #1e3a5f", borderRadius: 6, padding: "10px 12px" }}>
            <div style={{ color: "#60a5fa", fontSize: 10, fontWeight: 700, marginBottom: 4 }}>최종 응답</div>
            <div style={{ color: "#e2e8f0", fontSize: 12, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{output}</div>
          </div>
        )}

        {error && (
          <div style={{ background: "#2d0f0f", border: "1px solid #7f1d1d", borderRadius: 6, padding: "8px 12px", color: "#f87171", fontSize: 11 }}>{error}</div>
        )}

        <div ref={traceEndRef} />
      </div>
    </div>
  );
}

function TraceEventCard({ event }: { event: TraceEvent }) {
  const [open, setOpen] = useState(false);

  if (event.type === "tool_called") {
    return (
      <div style={{ background: "#1a1a0a", border: "1px solid #3a3a1a", borderRadius: 6, padding: "8px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ color: "#fbbf24", fontSize: 10, fontWeight: 700 }}>🔧 </span>
            <span style={{ color: "#fcd34d", fontSize: 12, fontWeight: 600 }}>{event.tool_name}</span>
          </div>
          {event.args && (
            <button onClick={() => setOpen(!open)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 10 }}>
              {open ? "▲" : "▼"} args
            </button>
          )}
        </div>
        {open && event.args && (
          <pre style={{ marginTop: 6, color: "#94a3b8", fontSize: 10, fontFamily: "monospace", overflow: "auto" }}>
            {JSON.stringify(event.args, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  if (event.type === "tool_result") {
    return (
      <div style={{ background: "#0a0f1a", border: "1px solid #1e293b", borderRadius: 6, padding: "8px 12px", marginLeft: 16 }}>
        <div style={{ color: "#64748b", fontSize: 10, marginBottom: 4 }}>결과</div>
        <div style={{ color: "#94a3b8", fontSize: 11, fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
          {typeof event.result === "string" ? event.result.slice(0, 500) : JSON.stringify(event.result)}
        </div>
      </div>
    );
  }

  if (event.type === "node_error") {
    return (
      <div style={{ background: "#2d0f0f", border: "1px solid #7f1d1d", borderRadius: 6, padding: "8px 12px" }}>
        <span style={{ color: "#f87171", fontSize: 11 }}>⚠ {event.error}</span>
      </div>
    );
  }

  return null;
}
