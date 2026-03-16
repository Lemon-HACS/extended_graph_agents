import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { GraphNode } from "../../types";
import { useGraphStore } from "../../store/graphStore";
import { ValidationBadge } from "./ValidationBadge";
import { nodeColorStyle } from "./nodeColorUtils";

export function MergeNode({ data, selected, id }: NodeProps) {
  const node = data as unknown as GraphNode;
  const highlighted = useGraphStore((s) => s.highlightedNodeIds.has(id));
  const c = nodeColorStyle(node.color, "#06b6d4", "#0e2a2d");

  const strategyLabel = node.merge_strategy === "template" ? "template"
    : node.merge_strategy === "last" ? "last"
    : "concat";

  return (
    <div
      style={{
        position: "relative",
        background: selected ? c.bgSelected : highlighted ? c.bgHighlighted : c.bg,
        border: `2px solid ${selected ? c.borderSelected : highlighted ? c.borderHighlighted : c.border}`,
        borderRadius: 10,
        padding: "12px 16px",
        minWidth: 180,
        color: "white",
        boxShadow: selected ? `0 0 0 2px ${c.border}66` : highlighted ? `0 0 0 3px ${c.border}80` : "none",
      }}
    >
      <ValidationBadge nodeId={id} />
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: c.border }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 18 }}>🔗</span>
        <span style={{ fontWeight: 700, fontSize: 13 }}>MERGE</span>
        {node.color_label && (
          <span style={{ fontSize: 9, background: `${c.border}33`, border: `1px solid ${c.border}66`, borderRadius: 4, padding: "1px 5px", color: c.border }}>{node.color_label}</span>
        )}
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
        {node.name || "Merge"}
      </div>

      <span
        style={{
          fontSize: 10,
          background: "rgba(6,182,212,0.2)",
          border: "1px solid rgba(6,182,212,0.4)",
          borderRadius: 4,
          padding: "1px 6px",
          color: "#22d3ee",
        }}
      >
        {strategyLabel}
      </span>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: c.border }}
      />
    </div>
  );
}
