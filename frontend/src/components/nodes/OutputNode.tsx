import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { GraphNode } from "../../types";
import { useGraphStore } from "../../store/graphStore";
import { ValidationBadge } from "./ValidationBadge";
import { nodeColorStyle } from "./nodeColorUtils";

export function OutputNode({ data, selected, id }: NodeProps) {
  const node = data as unknown as GraphNode;
  const highlighted = useGraphStore((s) => s.highlightedNodeIds.has(id));
  const c = nodeColorStyle(node.color, "#c2410c", "#2c1a02");

  return (
    <div
      style={{
        position: "relative",
        background: selected ? c.bgSelected : highlighted ? c.bgHighlighted : c.bg,
        border: `2px solid ${selected ? c.borderSelected : highlighted ? c.borderHighlighted : c.border}`,
        borderRadius: 10,
        padding: "12px 16px",
        minWidth: 160,
        color: "white",
        boxShadow: selected ? `0 0 0 2px ${c.border}66` : highlighted ? `0 0 0 3px ${c.border}80` : "none",
      }}
    >
      <ValidationBadge nodeId={id} />
      {/* Only target handle — nothing goes OUT from the output node */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: c.border }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 18 }}>📤</span>
        <span style={{ fontWeight: 700, fontSize: 13, color: c.border }}>OUTPUT</span>
      </div>
      <div style={{ fontSize: 11, color: c.borderHighlighted, opacity: 0.9 }}>
        최종 응답 출력점
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 10,
          color: c.border,
          background: `${c.border}26`,
          borderRadius: 4,
          padding: "2px 6px",
        }}
      >
        → 대화 에이전트 응답
      </div>
    </div>
  );
}
