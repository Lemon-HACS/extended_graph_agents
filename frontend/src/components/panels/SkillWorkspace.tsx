import { useEffect, useState } from "react";
import { useLang } from "../../contexts/LangContext";
import { useSkillStore } from "../../store/skillStore";
import { FunctionEditor, Field, inputStyle, addBtnStyle } from "../shared/FunctionEditor";
import type { SkillDefinition, FunctionTool } from "../../types";
import { saveSkill, deleteSkill, listSkills } from "../../utils/haApi";
import type { HassConnection } from "../../utils/haApi";
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

  // Sync draft when selected skill changes
  useEffect(() => {
    setDraft(editingSkill);
    if (editingSkill) {
      setYamlText(yaml.dump(editingSkill, { lineWidth: 120, noRefs: true }));
    }
    setTab("visual");
    setYamlError("");
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
      setEditingSkill(draft); // sync store so sidebar highlights correctly
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

  return (
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

        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
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
              background: saving ? "#1e1a3a" : "#2d1b69",
              border: "1px solid #6d28d9",
              color: "#c4b5fd",
              borderRadius: 6,
              padding: "5px 16px",
              cursor: saving ? "not-allowed" : "pointer",
              fontSize: 12,
              fontWeight: 600,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "저장 중..." : t.saveSkill}
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
  );
}
