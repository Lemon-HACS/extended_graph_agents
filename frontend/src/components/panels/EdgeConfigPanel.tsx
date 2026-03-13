import { useGraphStore } from "../../store/graphStore";
import { useLang } from "../../contexts/LangContext";
import type { GraphNode, EdgeCondition } from "../../types";

interface EdgeConfigPanelProps {
  onClose: () => void;
  isMobile?: boolean;
  panelWidth?: number;
}

export function EdgeConfigPanel({ onClose, isMobile, panelWidth = 380 }: EdgeConfigPanelProps) {
  const { flowEdges, flowNodes, selectedEdgeId, updateEdgeData, updateEdges } = useGraphStore();
  const t = useLang();

  const selectedEdge = flowEdges.find((e) => e.id === selectedEdgeId);
  if (!selectedEdge) return null;

  const sourceNode = flowNodes.find((n) => n.id === selectedEdge.source);
  const targetNode = flowNodes.find((n) => n.id === selectedEdge.target);
  const sourceName = ((sourceNode?.data as unknown as GraphNode)?.name) || selectedEdge.source;
  const targetName = ((targetNode?.data as unknown as GraphNode)?.name) || selectedEdge.target;

  const condition = (selectedEdge.data?.condition as EdgeCondition | null) ?? null;
  const condVariable = condition?.variable ?? "";
  const condValue = condition?.value ?? "";
  const mode = (selectedEdge.data?.mode as string) ?? "sequential";

  const handleConditionChange = (variable: string, value: string) => {
    const newCondition = variable ? { variable, value } : null;
    updateEdgeData(selectedEdge.id, { condition: newCondition });
  };

  const handleDelete = () => {
    updateEdges(flowEdges.filter((e) => e.id !== selectedEdgeId));
    onClose();
  };

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
              height: "60vh",
              zIndex: 30,
              borderRadius: "16px 16px 0 0",
              boxShadow: "0 -4px 24px rgba(0,0,0,0.5)",
            }
          : {}),
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid #1e293b",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 2 }}>
            ↗ EDGE
          </div>
          <div style={{ color: "white", fontWeight: 600 }}>{t.edgeConfig}</div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#94a3b8",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {/* Connection info */}
        <div
          style={{
            background: "#1e293b",
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              background: "#162d16",
              border: "1px solid #22c55e",
              borderRadius: 4,
              padding: "2px 8px",
              fontSize: 12,
              color: "white",
            }}
          >
            {sourceName}
          </span>
          <span style={{ color: "#64748b", fontSize: 16 }}>→</span>
          <span
            style={{
              background: "#162d16",
              border: "1px solid #22c55e",
              borderRadius: 4,
              padding: "2px 8px",
              fontSize: 12,
              color: "white",
            }}
          >
            {targetName}
          </span>
        </div>

        {/* Execution mode */}
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>{t.executionMode}</label>
          <select
            value={mode}
            onChange={(e) => updateEdgeData(selectedEdge.id, { mode: e.target.value })}
            style={inputStyle}
          >
            <option value="sequential">{t.sequential}</option>
            <option value="parallel">{t.parallel}</option>
          </select>
        </div>

        {/* Condition */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t.conditionVariable}</label>
          <input
            value={condVariable}
            onChange={(e) => handleConditionChange(e.target.value, condValue)}
            placeholder="예: route, intent"
            style={{ ...inputStyle, marginBottom: 6 }}
          />
          <label style={labelStyle}>{t.conditionValue}</label>
          <input
            value={condValue}
            onChange={(e) => handleConditionChange(condVariable, e.target.value)}
            placeholder="예: research, smart_home"
            style={inputStyle}
            disabled={!condVariable}
          />
          <div style={{ color: "#475569", fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>
            조건을 비워두면 다른 조건이 매칭되지 않을 때 기본 경로로 사용됩니다.
          </div>
        </div>

        {/* Preview badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: mode === "parallel" ? "#92400e" : condVariable ? "#1e3a5f" : "#1e293b",
            border: `1px solid ${mode === "parallel" ? "#f59e0b" : condVariable ? "#3b82f6" : "#334155"}`,
            borderRadius: 12,
            padding: "3px 10px",
            fontSize: 11,
            color: "white",
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          {mode === "parallel" ? "∥ " : ""}
          {condVariable ? `${condVariable}=${condValue}` : "default"}
        </div>

        {/* Delete */}
        <button
          onClick={handleDelete}
          style={{
            background: "#1e0a0a",
            border: "1px solid #ef4444",
            color: "#ef4444",
            borderRadius: 6,
            padding: "7px 14px",
            cursor: "pointer",
            fontSize: 12,
            width: "100%",
          }}
        >
          {t.deleteEdge}
        </button>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  color: "#94a3b8",
  fontSize: 11,
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 6,
  color: "white",
  padding: "6px 10px",
  fontSize: 13,
  boxSizing: "border-box",
};
