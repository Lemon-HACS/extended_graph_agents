import { useGraphStore } from "../../store/graphStore";
import type { GraphSummary } from "../../types";

interface GraphListProps {
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  isMobile?: boolean;
  onClose?: () => void;
  sidebarWidth?: number;
}

export function GraphList({
  onSelect,
  onNew,
  onDelete,
  isMobile,
  onClose,
  sidebarWidth = 240,
}: GraphListProps) {
  const { graphList, currentGraph } = useGraphStore();

  return (
    <div
      style={{
        width: sidebarWidth,
        background: "#0a0f1e",
        borderRight: "1px solid #1e293b",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        ...(isMobile
          ? {
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: 280,
              zIndex: 50,
              boxShadow: "4px 0 24px rgba(0,0,0,0.5)",
            }
          : {}),
      }}
    >
      <div style={{ padding: 16, borderBottom: "1px solid #1e293b" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              color: "white",
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            Graph Agents
          </div>
          {isMobile && onClose && (
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                fontSize: 20,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ✕
            </button>
          )}
        </div>
        <button
          onClick={onNew}
          style={{
            background: "#1e3a5f",
            border: "1px solid #3b82f6",
            color: "#60a5fa",
            borderRadius: 6,
            padding: "7px 14px",
            cursor: "pointer",
            width: "100%",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          + New Graph
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {graphList.length === 0 && (
          <div
            style={{
              padding: 16,
              color: "#475569",
              fontSize: 13,
              textAlign: "center",
            }}
          >
            No graphs yet.
            <br />
            Create one to start.
          </div>
        )}
        {graphList.map((g) => (
          <GraphItem
            key={g.id}
            graph={g}
            isActive={currentGraph?.id === g.id}
            onSelect={() => {
              onSelect(g.id);
              if (isMobile && onClose) onClose();
            }}
            onDelete={() => onDelete(g.id)}
          />
        ))}
      </div>
    </div>
  );
}

function GraphItem({
  graph,
  isActive,
  onSelect,
  onDelete,
}: {
  graph: GraphSummary;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        padding: "10px 16px",
        cursor: "pointer",
        borderBottom: "1px solid #1e293b",
        background: isActive ? "#1e293b" : "transparent",
        borderLeft: isActive ? "3px solid #3b82f6" : "3px solid transparent",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              color: isActive ? "white" : "#cbd5e1",
              fontWeight: 600,
              fontSize: 13,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {graph.name}
          </div>
          <div style={{ color: "#475569", fontSize: 11, marginTop: 2 }}>
            {graph.node_count} nodes
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{
            background: "none",
            border: "none",
            color: "#475569",
            cursor: "pointer",
            fontSize: 14,
            padding: "0 0 0 8px",
            flexShrink: 0,
          }}
        >
          🗑
        </button>
      </div>
    </div>
  );
}
