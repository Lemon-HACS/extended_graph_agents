import type { Node, Edge } from "@xyflow/react";
import type { GraphNode } from "../types";

export interface ValidationWarning {
  nodeId?: string;
  severity: "error" | "warning";
  messageKey: string;
}

export function validateGraph(nodes: Node[], edges: Edge[]): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const nodeDataMap = new Map<string, GraphNode>();

  for (const n of nodes) {
    nodeDataMap.set(n.id, n.data as unknown as GraphNode);
  }

  const hasInput = nodes.some((n) => (n.data as unknown as GraphNode).type === "input");
  const hasOutput = nodes.some((n) => (n.data as unknown as GraphNode).type === "output");

  if (!hasInput) {
    warnings.push({ severity: "error", messageKey: "lintNoInput" });
  }
  if (!hasOutput) {
    warnings.push({ severity: "warning", messageKey: "lintNoOutput" });
  }

  const outgoingCount = new Map<string, number>();
  const incomingCount = new Map<string, number>();
  for (const e of edges) {
    outgoingCount.set(e.source, (outgoingCount.get(e.source) ?? 0) + 1);
    incomingCount.set(e.target, (incomingCount.get(e.target) ?? 0) + 1);
  }

  for (const n of nodes) {
    const data = n.data as unknown as GraphNode;
    const out = outgoingCount.get(n.id) ?? 0;
    const inc = incomingCount.get(n.id) ?? 0;

    // Router/Condition without outgoing edges
    if ((data.type === "router" || data.type === "condition") && out === 0) {
      warnings.push({ nodeId: n.id, severity: "error", messageKey: "lintRouterNoOutgoing" });
    }

    // Condition without default
    if (data.type === "condition" && !data.default) {
      warnings.push({ nodeId: n.id, severity: "warning", messageKey: "lintConditionNoDefault" });
    }

    // Isolated node (no edges at all, except input which may start alone)
    if (data.type !== "input" && out === 0 && inc === 0) {
      warnings.push({ nodeId: n.id, severity: "warning", messageKey: "lintIsolatedNode" });
    }

    // Empty prompt on regular/router
    if ((data.type === "regular" || data.type === "router") && !data.prompt?.trim()) {
      warnings.push({ nodeId: n.id, severity: "warning", messageKey: "lintEmptyPrompt" });
    }

    // Router without values
    if (data.type === "router" && (!data.values || data.values.length === 0)) {
      warnings.push({ nodeId: n.id, severity: "warning", messageKey: "lintRouterNoValues" });
    }

    // Merge with fewer than 2 incoming edges
    if (data.type === "merge" && inc < 2) {
      warnings.push({ nodeId: n.id, severity: "warning", messageKey: "lintMergeNoIncoming" });
    }
  }

  // Unreachable nodes (BFS from input)
  if (hasInput) {
    const inputNodeId = nodes.find((n) => (n.data as unknown as GraphNode).type === "input")!.id;
    const reachable = new Set<string>();
    const queue = [inputNodeId];
    reachable.add(inputNodeId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const e of edges) {
        if (e.source === current && !reachable.has(e.target)) {
          reachable.add(e.target);
          queue.push(e.target);
        }
      }
    }

    for (const n of nodes) {
      const data = n.data as unknown as GraphNode;
      if (data.type !== "input" && !reachable.has(n.id)) {
        // Don't double-report if already isolated
        const isIsolated = (outgoingCount.get(n.id) ?? 0) === 0 && (incomingCount.get(n.id) ?? 0) === 0;
        if (!isIsolated) {
          warnings.push({ nodeId: n.id, severity: "warning", messageKey: "lintUnreachable" });
        }
      }
    }
  }

  return warnings;
}
