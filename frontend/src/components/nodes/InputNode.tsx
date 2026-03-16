import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { useGraphStore } from "../../store/graphStore";
import { ValidationBadge } from "./ValidationBadge";

export function InputNode({ selected, id }: NodeProps) {
  const highlighted = useGraphStore((s) => s.highlightedNodeIds.has(id));

  return (
    <div
      style={{
        position: "relative",
        background: selected ? "#2d1b69" : highlighted ? "#2a1f6e" : "#1e1150",
        border: `2px solid ${selected ? "#a78bfa" : highlighted ? "#c4b5fd" : "#7c3aed"}`,
        borderRadius: 10,
        padding: "12px 16px",
        minWidth: 160,
        color: "white",
        boxShadow: selected ? "0 0 0 2px rgba(167,139,250,0.4)" : highlighted ? "0 0 0 3px rgba(196,181,253,0.5)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 18 }}>💬</span>
        <span style={{ fontWeight: 700, fontSize: 13, color: "#a78bfa" }}>INPUT</span>
      </div>
      <div style={{ fontSize: 11, color: "#c4b5fd", opacity: 0.9 }}>
        사용자 메시지 시작점
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 10,
          color: "#7c3aed",
          background: "rgba(124,58,237,0.15)",
          borderRadius: 4,
          padding: "2px 6px",
          fontFamily: "monospace",
        }}
      >
        {"{{ user_input }}"}
      </div>

      {/* Only source handle — nothing connects INTO the input node */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: "#a78bfa" }}
      />
    </div>
  );
}
