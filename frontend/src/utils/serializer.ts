import type { Node, Edge } from "@xyflow/react";
import type { GraphDefinition, GraphNode, GraphEdge, EdgeCondition } from "../types";
import * as yaml from "js-yaml";

// Auto-layout helper
function layoutNodes(
  nodes: GraphNode[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const cols = Math.ceil(Math.sqrt(nodes.length));
  nodes.forEach((node, i) => {
    positions.set(node.id, {
      x: (i % cols) * 300 + 100,
      y: Math.floor(i / cols) * 200 + 100,
    });
  });
  return positions;
}

export function graphToFlow(
  graph: GraphDefinition,
  savedPositions?: Record<string, { x: number; y: number }>
): { nodes: Node[]; edges: Edge[] } {
  const autoPositions = layoutNodes(graph.nodes);

  const flowNodes: Node[] = graph.nodes.map((node) => ({
    id: node.id,
    type:
      node.type === "router"
        ? "routerNode"
        : node.type === "input"
          ? "inputNode"
          : node.type === "output"
            ? "outputNode"
            : node.type === "condition"
              ? "conditionNode"
              : node.type === "merge"
                ? "mergeNode"
                : "regularNode",
    position:
      savedPositions?.[node.id] ??
      autoPositions.get(node.id) ?? { x: 0, y: 0 },
    data: { ...node },
  }));

  const flowEdges: Edge[] = (graph.edges ?? []).map((edge, idx) => {
    const isParallel = edge.mode === "parallel";
    const condition = edge.condition;
    const hasCondition = !!(condition?.variable);
    const label = hasCondition
      ? `${condition!.variable}=${condition!.value}`
      : undefined;

    return {
      id: `${edge.source}->${edge.target}-${idx}`,
      source: edge.source,
      target: edge.target,
      type: "conditionalEdge",
      label,
      data: {
        condition: condition ?? null,
        mode: edge.mode ?? "sequential",
      },
      animated: isParallel,
      style: {
        strokeDasharray: isParallel ? "5,5" : undefined,
      },
    };
  });

  return { nodes: flowNodes, edges: flowEdges };
}

export function flowToGraph(
  graphMeta: Pick<GraphDefinition, "id" | "name" | "description" | "model" | "model_params" | "system_prompt_prefix" | "max_tool_iterations">,
  flowNodes: Node[],
  flowEdges: Edge[]
): GraphDefinition {
  const nodes: GraphNode[] = flowNodes.map((n) => {
    const nodeData = { ...n.data } as unknown as GraphNode;
    nodeData.id = n.id;
    // Strip legacy fields and UI-only fields
    delete (nodeData as any).next;
    delete (nodeData as any).input_from;
    delete (nodeData as any).routes;
    delete (nodeData as any).position;
    return nodeData;
  });

  const edges: GraphEdge[] = flowEdges.map((edge) => {
    const def: GraphEdge = {
      source: edge.source,
      target: edge.target,
    };
    const mode = edge.data?.mode as string | undefined;
    if (mode === "parallel") {
      def.mode = "parallel";
    }
    const condition = edge.data?.condition as EdgeCondition | null | undefined;
    if (condition?.variable) {
      def.condition = condition;
    }
    return def;
  });

  return { ...graphMeta, nodes, edges };
}

export function graphToYaml(graph: GraphDefinition): string {
  const clean = JSON.parse(JSON.stringify(graph));
  clean.nodes.forEach((n: GraphNode) => {
    delete n.position;
    delete (n as any).next;
    delete (n as any).input_from;
    delete (n as any).routes;
  });
  return yaml.dump(clean, { lineWidth: 120, noRefs: true });
}

export function yamlToGraph(yamlStr: string): GraphDefinition {
  return yaml.load(yamlStr) as GraphDefinition;
}
