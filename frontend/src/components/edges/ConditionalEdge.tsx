import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
} from "@xyflow/react";
import type { EdgeProps } from "@xyflow/react";
import type { EdgeCondition } from "../../types";

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

  const condition = data?.condition as EdgeCondition | null;
  const isParallel = data?.mode === "parallel";
  const hasCondition = !!(condition?.variable);

  // Plain pass-through: no condition, not parallel
  if (!hasCondition && !isParallel) {
    return (
      <>
        <BaseEdge
          path={edgePath}
          markerEnd={markerEnd}
          style={{
            stroke: "#475569",
            strokeWidth: 1.5,
            strokeDasharray: "4,3",
            opacity: 0.6,
            ...style,
          }}
        />
      </>
    );
  }

  const label = hasCondition
    ? `${condition!.variable}=${condition!.value}`
    : "∥";

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
    </>
  );
}
