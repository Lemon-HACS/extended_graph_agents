import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { GraphNode } from "../../types";
import { useGraphStore } from "../../store/graphStore";

export function RegularNode({ data, selected, id }: NodeProps) {
  const node = data as unknown as GraphNode;
  const funcCount = node.functions?.length ?? 0;
  const skillCount = node.skills?.length ?? 0;
  const highlighted = useGraphStore((s) => s.highlightedNodeIds.has(id));

  return (
    <div
      style={{
        background: selected ? "#1a3a1a" : highlighted ? "#1a3a2a" : "#162d16",
        border: `2px solid ${selected ? "#4ade80" : highlighted ? "#86efac" : "#22c55e"}`,
        borderRadius: 10,
        padding: "12px 16px",
        minWidth: 180,
        color: "white",
        boxShadow: selected ? "0 0 0 2px rgba(74,222,128,0.4)" : highlighted ? "0 0 0 3px rgba(134,239,172,0.5)" : "none",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: "#4ade80" }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 18 }}>🤖</span>
        <span style={{ fontWeight: 700, fontSize: 13 }}>AGENT</span>
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
        {node.name || "Agent"}
      </div>

      {node.model && (
        <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>
          {node.model}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {funcCount > 0 && (
          <span
            style={{
              fontSize: 10,
              background: "rgba(34,197,94,0.2)",
              borderRadius: 4,
              padding: "1px 6px",
              border: "1px solid rgba(34,197,94,0.4)",
            }}
          >
            {funcCount} fn
          </span>
        )}
        {skillCount > 0 && (
          <span
            style={{
              fontSize: 10,
              background: "rgba(168,85,247,0.2)",
              borderRadius: 4,
              padding: "1px 6px",
              border: "1px solid rgba(168,85,247,0.4)",
            }}
          >
            {skillCount} skill
          </span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: "#4ade80" }}
      />
    </div>
  );
}
