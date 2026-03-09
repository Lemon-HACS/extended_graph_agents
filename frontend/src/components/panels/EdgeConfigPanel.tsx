import { useGraphStore } from "../../store/graphStore";
import { useLang } from "../../contexts/LangContext";
import type { GraphNode } from "../../types";

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

  const match = (selectedEdge.data?.match as string) ?? "*";
  const mode = (selectedEdge.data?.mode as string) ?? "sequential";
  const isSourceRouter = sourceNode?.type === "routerNode";

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
              background: sourceNode?.type === "routerNode" ? "#1a3050" : "#162d16",
              border: `1px solid ${sourceNode?.type === "routerNode" ? "#3b82f6" : "#22c55e"}`,
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
              background: targetNode?.type === "routerNode" ? "#1a3050" : "#162d16",
              border: `1px solid ${targetNode?.type === "routerNode" ? "#3b82f6" : "#22c55e"}`,
              borderRadius: 4,
              padding: "2px 8px",
              fontSize: 12,
              color: "white",
            }}
          >
            {targetName}
          </span>
        </div>

        {/* Match / Mode — only meaningful for router source */}
        {isSourceRouter ? (
          <>
            <div style={{ marginBottom: 10 }}>
              <label
                style={{
                  display: "block",
                  color: "#94a3b8",
                  fontSize: 11,
                  marginBottom: 4,
                }}
              >
                {t.matchValue}
              </label>
              <input
                value={match}
                onChange={(e) => updateEdgeData(selectedEdge.id, { match: e.target.value })}
                placeholder={t.matchPlaceholder}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <label
                style={{
                  display: "block",
                  color: "#94a3b8",
                  fontSize: 11,
                  marginBottom: 4,
                }}
              >
                {t.executionMode}
              </label>
              <select
                value={mode}
                onChange={(e) => updateEdgeData(selectedEdge.id, { mode: e.target.value })}
                style={inputStyle}
              >
                <option value="sequential">{t.sequential}</option>
                <option value="parallel">{t.parallel}</option>
              </select>
            </div>

            {/* Preview badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: mode === "parallel" ? "#92400e" : "#1e3a5f",
                border: `1px solid ${mode === "parallel" ? "#f59e0b" : "#3b82f6"}`,
                borderRadius: 12,
                padding: "3px 10px",
                fontSize: 11,
                color: "white",
                fontWeight: 600,
                marginBottom: 16,
              }}
            >
              {mode === "parallel" ? "∥ " : ""}
              {match === "*" ? "default" : match}
            </div>
          </>
        ) : (
          <div
            style={{
              padding: 12,
              background: "rgba(255,255,255,0.04)",
              borderRadius: 8,
              color: "#64748b",
              fontSize: 12,
              marginBottom: 16,
            }}
          >
            이 연결은 항상 실행됩니다.
          </div>
        )}

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
