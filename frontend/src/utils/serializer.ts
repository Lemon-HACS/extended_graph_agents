import type { Node, Edge } from "@xyflow/react";
import type { GraphDefinition, GraphNode } from "../types";
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
    type: node.type === "router" ? "routerNode" : "regularNode",
    position:
      savedPositions?.[node.id] ??
      autoPositions.get(node.id) ?? { x: 0, y: 0 },
    data: { ...node },
  }));

  const flowEdges: Edge[] = [];
  graph.nodes.forEach((node) => {
    if (node.type === "router" && node.routes) {
      node.routes.forEach((route, routeIdx) => {
        (route.next ?? []).forEach((targetId, targetIdx) => {
          flowEdges.push({
            id: `${node.id}->${targetId}-r${routeIdx}-t${targetIdx}`,
            source: node.id,
            target: targetId,
            type: "conditionalEdge",
            label:
              route.match === "*" ? "default" : String(route.match),
            data: {
              match: route.match,
              mode: route.mode ?? "sequential",
            },
            animated: route.mode === "parallel",
            style: {
              strokeDasharray:
                route.mode === "parallel" ? "5,5" : undefined,
            },
          });
        });
      });
    }
  });

  return { nodes: flowNodes, edges: flowEdges };
}

export function flowToGraph(
  graphMeta: Pick<GraphDefinition, "id" | "name" | "description" | "model">,
  flowNodes: Node[],
  flowEdges: Edge[]
): GraphDefinition {
  // Rebuild edges into router routes
  const routerEdges: Record<
    string,
    Array<{ match: string; targets: string[]; mode: string }>
  > = {};

  flowEdges.forEach((edge) => {
    const match = (edge.data?.match as string) ?? "*";
    const mode = (edge.data?.mode as string) ?? "sequential";

    if (!routerEdges[edge.source]) {
      routerEdges[edge.source] = [];
    }

    const existing = routerEdges[edge.source].find((r) => r.match === match);
    if (existing) {
      existing.targets.push(edge.target);
    } else {
      routerEdges[edge.source].push({ match, targets: [edge.target], mode });
    }
  });

  const nodes: GraphNode[] = flowNodes.map((n) => {
    const nodeData = { ...n.data } as unknown as GraphNode;
    nodeData.id = n.id;

    if (nodeData.type === "router") {
      // Rebuild routes from edges
      const edgeRoutes = routerEdges[n.id] ?? [];
      nodeData.routes = edgeRoutes.map((r) => ({
        match: r.match,
        next: r.targets,
        mode: r.mode as "sequential" | "parallel",
      }));
    }

    return nodeData;
  });

  return {
    ...graphMeta,
    nodes,
  };
}

export function graphToYaml(graph: GraphDefinition): string {
  // Remove UI-only fields
  const clean = JSON.parse(JSON.stringify(graph));
  clean.nodes.forEach((n: GraphNode) => delete n.position);
  return yaml.dump(clean, { lineWidth: 120, noRefs: true });
}

export function yamlToGraph(yamlStr: string): GraphDefinition {
  return yaml.load(yamlStr) as GraphDefinition;
}
