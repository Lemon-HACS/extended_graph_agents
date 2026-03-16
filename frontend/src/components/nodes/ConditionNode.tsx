import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { GraphNode } from "../../types";
import { useGraphStore } from "../../store/graphStore";
import { ValidationBadge } from "./ValidationBadge";

export function ConditionNode({ data, selected, id }: NodeProps) {
  const node = data as unknown as GraphNode;
  const highlighted = useGraphStore((s) => s.highlightedNodeIds.has(id));

  return (
    <div
      style={{
        position: "relative",
        background: selected ? "#2d1f00" : highlighted ? "#2a1e00" : "#1f1600",
        border: `2px solid ${selected ? "#fbbf24" : highlighted ? "#f59e0b" : "#d97706"}`,
        borderRadius: 10,
        padding: "12px 16px",
        minWidth: 180,
        color: "white",
        boxShadow: selected ? "0 0 0 2px rgba(251,191,36,0.4)" : highlighted ? "0 0 0 3px rgba(245,158,11,0.5)" : "none",
      }}
    >
      <ValidationBadge nodeId={id} />
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: "#fbbf24" }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 18 }}>⚡</span>
        <span style={{ fontWeight: 700, fontSize: 13 }}>CONDITION</span>
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
        {node.name || "Condition"}
      </div>

      {node.output_key && (
        <div style={{ fontSize: 11, opacity: 0.7 }}>
          key: <code>{node.output_key}</code>
        </div>
      )}

      {node.conditions && node.conditions.length > 0 && (
        <div
          style={{
            marginTop: 6,
            display: "flex",
            flexWrap: "wrap",
            gap: 3,
          }}
        >
          {node.conditions.map((c, i) => (
            <span
              key={i}
              style={{
                fontSize: 10,
                background: "rgba(255,255,255,0.1)",
                borderRadius: 4,
                padding: "2px 6px",
              }}
            >
              {c.value}
            </span>
          ))}
          {node.default && (
            <span
              style={{
                fontSize: 10,
                background: "rgba(217,119,6,0.2)",
                border: "1px solid rgba(217,119,6,0.4)",
                borderRadius: 4,
                padding: "2px 6px",
                color: "#fbbf24",
              }}
            >
              default: {node.default}
            </span>
          )}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: "#fbbf24" }}
      />
    </div>
  );
}
