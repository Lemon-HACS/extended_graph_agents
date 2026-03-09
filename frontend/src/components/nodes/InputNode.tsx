import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

export function InputNode({ selected }: NodeProps) {
  return (
    <div
      style={{
        background: selected ? "#2d1b69" : "#1e1150",
        border: `2px solid ${selected ? "#a78bfa" : "#7c3aed"}`,
        borderRadius: 10,
        padding: "12px 16px",
        minWidth: 160,
        color: "white",
        boxShadow: selected ? "0 0 0 2px rgba(167,139,250,0.4)" : "none",
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
