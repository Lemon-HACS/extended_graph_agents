import { useState } from "react";
import { useLang } from "../../contexts/LangContext";
import { useSkillStore } from "../../store/skillStore";
import { FunctionEditor, Field, inputStyle, addBtnStyle } from "../shared/FunctionEditor";
import type { SkillDefinition, SkillSummary, FunctionTool } from "../../types";
import * as yaml from "js-yaml";
import type { HassConnection } from "../../utils/haApi";
import { getSkill, saveSkill, deleteSkill, listSkills } from "../../utils/haApi";

interface SkillsPanelProps {
  conn: HassConnection;
  isMobile?: boolean;
  sidebarWidth: number;
  onClose?: () => void;
}

export function SkillsPanel({ conn, isMobile, sidebarWidth, onClose }: SkillsPanelProps) {
  const t = useLang();
  const { skillList, setSkillList } = useSkillStore();
  const [editingSkill, setEditingSkill] = useState<SkillDefinition | null>(null);

  const refreshList = async () => {
    const list = await listSkills(conn);
    setSkillList(list);
  };

  const handleNew = () => {
    setEditingSkill({
      id: crypto.randomUUID(),
      name: "New Skill",
      group: "",
      description: "",
      functions: [],
    });
  };

  const handleEdit = async (summary: SkillSummary) => {
    try {
      const skill = await getSkill(conn, summary.id);
      setEditingSkill(skill);
    } catch (err) {
      alert(`Failed to load skill: ${err}`);
    }
  };

  const handleDelete = async (summary: SkillSummary) => {
    if (!confirm(t.confirmDeleteSkill(summary.name))) return;
    try {
      await deleteSkill(conn, summary.id);
      await refreshList();
    } catch (err) {
      alert(`Failed to delete skill: ${err}`);
    }
  };

  const handleSave = async (skill: SkillDefinition) => {
    try {
      await saveSkill(conn, skill);
      await refreshList();
      setEditingSkill(null);
    } catch (err) {
      alert(t.failedToSaveSkill(String(err)));
    }
  };

  // Group skills by group field
  const grouped = skillList.reduce<Record<string, SkillSummary[]>>((acc, s) => {
    const g = s.group || t.ungrouped;
    if (!acc[g]) acc[g] = [];
    acc[g].push(s);
    return acc;
  }, {});

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#0a0f1e",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* New Skill button */}
      <div style={{ padding: "8px 12px", flexShrink: 0 }}>
        <button
          onClick={handleNew}
          style={{
            width: "100%",
            background: "#1e1a3a",
            border: "1px dashed #6d28d9",
            color: "#a78bfa",
            borderRadius: 6,
            padding: "7px 0",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {t.newSkill}
        </button>
      </div>

      {/* Skill list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 8px" }}>
        {skillList.length === 0 ? (
          <div style={{ color: "#475569", fontSize: 12, textAlign: "center", marginTop: 24 }}>
            {t.noSkillsYet}
          </div>
        ) : (
          Object.entries(grouped).map(([group, items]) => (
            <div key={group} style={{ marginBottom: 8 }}>
              <div
                style={{
                  color: "#64748b",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  padding: "4px 4px 2px",
                  textTransform: "uppercase",
                }}
              >
                {group}
              </div>
              {items.map((s) => (
                <SkillItem
                  key={s.id}
                  skill={s}
                  onEdit={() => handleEdit(s)}
                  onDelete={() => handleDelete(s)}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Editor modal */}
      {editingSkill && (
        <SkillEditor
          skill={editingSkill}
          onSave={handleSave}
          onCancel={() => setEditingSkill(null)}
        />
      )}
    </div>
  );
}

function SkillItem({
  skill,
  onEdit,
  onDelete,
}: {
  skill: SkillSummary;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useLang();
  return (
    <div
      style={{
        background: "#0f172a",
        border: "1px solid #1e293b",
        borderRadius: 6,
        padding: "8px 10px",
        marginBottom: 4,
        cursor: "pointer",
      }}
      onClick={onEdit}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "white", fontSize: 12, fontWeight: 600, marginBottom: 2 }}>
            🔧 {skill.name}
          </div>
          <div style={{ color: "#475569", fontSize: 10 }}>
            {skill.function_count} fn{skill.description ? ` · ${skill.description}` : ""}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{
            background: "none",
            border: "none",
            color: "#ef4444",
            cursor: "pointer",
            fontSize: 11,
            flexShrink: 0,
            marginLeft: 8,
          }}
        >
          {t.deleteSkill}
        </button>
      </div>
    </div>
  );
}

function SkillEditor({
  skill,
  onSave,
  onCancel,
}: {
  skill: SkillDefinition;
  onSave: (s: SkillDefinition) => void;
  onCancel: () => void;
}) {
  const t = useLang();
  const [draft, setDraft] = useState<SkillDefinition>(skill);
  const [tab, setTab] = useState<"visual" | "yaml">("visual");
  const [yamlText, setYamlText] = useState(() => yaml.dump(skill, { lineWidth: 120, noRefs: true }));
  const [yamlError, setYamlError] = useState("");

  const update = (patch: Partial<SkillDefinition>) => {
    setDraft((d) => ({ ...d, ...patch }));
  };

  const switchToYaml = () => {
    setYamlText(yaml.dump(draft, { lineWidth: 120, noRefs: true }));
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

  const functions = draft.functions ?? [];

  const addFunction = () => {
    const newFunc: FunctionTool = {
      spec: { name: `function_${functions.length + 1}`, description: "", parameters: { type: "object", properties: {}, required: [] } },
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

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#0a0f1e",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #1e293b",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div style={{ color: "white", fontWeight: 600, fontSize: 13 }}>🔧 {draft.name}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => onSave(draft)}
            style={{
              background: "#1e1a3a",
              border: "1px solid #6d28d9",
              color: "#a78bfa",
              borderRadius: 6,
              padding: "5px 12px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {t.saveSkill}
          </button>
          <button
            onClick={onCancel}
            style={{
              background: "none",
              border: "1px solid #334155",
              color: "#94a3b8",
              borderRadius: 6,
              padding: "5px 10px",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #1e293b", flexShrink: 0 }}>
        {(["visual", "yaml"] as const).map((t_) => (
          <button
            key={t_}
            onClick={t_ === "yaml" ? switchToYaml : () => setTab("visual")}
            style={{
              background: "none",
              border: "none",
              borderBottom: tab === t_ ? "2px solid #6d28d9" : "2px solid transparent",
              color: tab === t_ ? "#a78bfa" : "#64748b",
              padding: "8px 16px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {t_ === "visual" ? t.visualTab : t.yamlTab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {tab === "visual" ? (
          <>
            <Field label="ID">
              <input value={draft.id} readOnly style={inputStyle} />
            </Field>
            <Field label={t.skillName}>
              <input
                value={draft.name}
                onChange={(e) => update({ name: e.target.value })}
                style={inputStyle}
              />
            </Field>
            <Field label={t.skillGroup}>
              <input
                value={draft.group ?? ""}
                onChange={(e) => update({ group: e.target.value })}
                placeholder={t.ungrouped}
                style={inputStyle}
              />
            </Field>
            <Field label={t.skillDescription}>
              <input
                value={draft.description ?? ""}
                onChange={(e) => update({ description: e.target.value })}
                style={inputStyle}
              />
            </Field>

            <div style={{ marginTop: 16 }}>
              <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                {t.functions}
              </div>
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
          </>
        ) : (
          <>
            <textarea
              value={yamlText}
              onChange={(e) => setYamlText(e.target.value)}
              style={{
                ...inputStyle,
                fontFamily: "monospace",
                fontSize: 12,
                resize: "vertical",
                minHeight: 300,
              }}
              rows={20}
            />
            {yamlError && (
              <div style={{ color: "#ef4444", fontSize: 11, marginTop: 4 }}>{yamlError}</div>
            )}
            <button
              onClick={applyYaml}
              style={{
                marginTop: 8,
                background: "#1e293b",
                border: "1px solid #334155",
                color: "#94a3b8",
                borderRadius: 6,
                padding: "6px 16px",
                cursor: "pointer",
                fontSize: 12,
                width: "100%",
              }}
            >
              {t.applyYaml}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
