import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { GraphNode } from "../../types";
import { useGraphStore } from "../../store/graphStore";
import { ValidationBadge } from "./ValidationBadge";

export function RouterNode({ data, selected, id }: NodeProps) {
  const node = data as unknown as GraphNode;
  const highlighted = useGraphStore((s) => s.highlightedNodeIds.has(id));

  return (
    <div
      style={{
        position: "relative",
        background: selected ? "#1e3a5f" : highlighted ? "#1a3560" : "#1a3050",
        border: `2px solid ${selected ? "#60a5fa" : highlighted ? "#93c5fd" : "#3b82f6"}`,
        borderRadius: 10,
        padding: "12px 16px",
        minWidth: 180,
        color: "white",
        boxShadow: selected ? "0 0 0 2px rgba(96,165,250,0.4)" : highlighted ? "0 0 0 3px rgba(147,197,253,0.5)" : "none",
      }}
    >
      <ValidationBadge nodeId={id} />
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: "#60a5fa" }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 18 }}>🔀</span>
        <span style={{ fontWeight: 700, fontSize: 13 }}>ROUTER</span>
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
        {node.name || "Router"}
      </div>

      {node.output_key && (
        <div style={{ fontSize: 11, opacity: 0.7 }}>
          key: <code>{node.output_key}</code>
        </div>
      )}

      {node.values && node.values.length > 0 && (
        <div
          style={{
            marginTop: 6,
            display: "flex",
            flexWrap: "wrap",
            gap: 3,
          }}
        >
          {node.values.map((v) => (
            <span
              key={v}
              style={{
                fontSize: 10,
                background: "rgba(255,255,255,0.1)",
                borderRadius: 4,
                padding: "2px 6px",
              }}
            >
              {v}
            </span>
          ))}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: "#60a5fa" }}
      />
    </div>
  );
}
