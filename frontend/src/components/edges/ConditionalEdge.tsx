import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
} from "@xyflow/react";
import type { EdgeProps } from "@xyflow/react";

export function ConditionalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  style,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isParallel = data?.mode === "parallel";
  const label =
    data?.match === "*" ? "default" : String(data?.match ?? "");

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: isParallel ? "#f59e0b" : "#60a5fa",
          strokeWidth: 2,
          strokeDasharray: isParallel ? "6,3" : undefined,
          ...style,
        }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
              zIndex: 1000,
            }}
            className="nodrag nopan"
          >
            <div
              style={{
                background: isParallel ? "#92400e" : "#1e3a5f",
                color: "white",
                padding: "2px 8px",
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 600,
                border: `1px solid ${isParallel ? "#f59e0b" : "#3b82f6"}`,
                whiteSpace: "nowrap",
              }}
            >
              {isParallel ? "∥ " : ""}
              {label}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
