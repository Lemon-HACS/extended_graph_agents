import { useLang } from "../../contexts/LangContext";
import { useSkillStore } from "../../store/skillStore";
import type { SkillDefinition, SkillSummary } from "../../types";
import { deleteSkill, getSkill, listSkills } from "../../utils/haApi";
import type { HassConnection } from "../../utils/haApi";

interface SkillsPanelProps {
  conn: HassConnection;
  isMobile?: boolean;
  sidebarWidth: number;
  onClose?: () => void;
}

export function SkillsPanel({ conn }: SkillsPanelProps) {
  const t = useLang();
  const { skillList, setSkillList, editingSkill, setEditingSkill } = useSkillStore();

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

  const handleSelect = async (summary: SkillSummary) => {
    try {
      const skill = await getSkill(conn, summary.id);
      setEditingSkill(skill);
    } catch (err) {
      alert(`Failed to load skill: ${err}`);
    }
  };

  const handleDelete = async (e: React.MouseEvent, summary: SkillSummary) => {
    e.stopPropagation();
    if (!confirm(t.confirmDeleteSkill(summary.name))) return;
    try {
      await deleteSkill(conn, summary.id);
      if (editingSkill?.id === summary.id) setEditingSkill(null);
      await refreshList();
    } catch (err) {
      alert(`Failed to delete skill: ${err}`);
    }
  };

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
              {items.map((s) => {
                const isActive = editingSkill?.id === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => handleSelect(s)}
                    style={{
                      background: isActive ? "#1e1a3a" : "#0f172a",
                      border: `1px solid ${isActive ? "#6d28d9" : "#1e293b"}`,
                      borderLeft: isActive ? "3px solid #7c3aed" : "1px solid #1e293b",
                      borderRadius: 6,
                      padding: "8px 10px",
                      marginBottom: 4,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: isActive ? "#c4b5fd" : "white", fontSize: 12, fontWeight: 600, marginBottom: 2 }}>
                          🔧 {s.name}
                        </div>
                        <div style={{ color: "#475569", fontSize: 10 }}>
                          {s.function_count} fn{s.description ? ` · ${s.description}` : ""}
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDelete(e, s)}
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
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
