import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { useGraphStore } from "../../store/graphStore";

export function OutputNode({ selected, id }: NodeProps) {
  const highlighted = useGraphStore((s) => s.highlightedNodeIds.has(id));

  return (
    <div
      style={{
        background: selected ? "#451a03" : highlighted ? "#3d2010" : "#2c1a02",
        border: `2px solid ${selected ? "#fb923c" : highlighted ? "#fdba74" : "#c2410c"}`,
        borderRadius: 10,
        padding: "12px 16px",
        minWidth: 160,
        color: "white",
        boxShadow: selected ? "0 0 0 2px rgba(251,146,60,0.4)" : highlighted ? "0 0 0 3px rgba(253,186,116,0.5)" : "none",
      }}
    >
      {/* Only target handle — nothing goes OUT from the output node */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: "#fb923c" }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 18 }}>📤</span>
        <span style={{ fontWeight: 700, fontSize: 13, color: "#fb923c" }}>OUTPUT</span>
      </div>
      <div style={{ fontSize: 11, color: "#fdba74", opacity: 0.9 }}>
        최종 응답 출력점
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 10,
          color: "#c2410c",
          background: "rgba(194,65,12,0.15)",
          borderRadius: 4,
          padding: "2px 6px",
        }}
      >
        → 대화 에이전트 응답
      </div>
    </div>
  );
}
