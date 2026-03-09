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
    type:
      node.type === "router"
        ? "routerNode"
        : node.type === "input"
          ? "inputNode"
          : node.type === "output"
            ? "outputNode"
            : "regularNode",
    position:
      savedPositions?.[node.id] ??
      autoPositions.get(node.id) ?? { x: 0, y: 0 },
    data: { ...node },
  }));

  const flowEdges: Edge[] = [];

  graph.nodes.forEach((node) => {
    // Router → next nodes (via routes)
    if (node.type === "router" && node.routes) {
      node.routes.forEach((route, routeIdx) => {
        (route.next ?? []).forEach((targetId, targetIdx) => {
          flowEdges.push({
            id: `${node.id}->${targetId}-r${routeIdx}-t${targetIdx}`,
            source: node.id,
            target: targetId,
            type: "conditionalEdge",
            label: route.match === "*" ? "default" : String(route.match),
            data: {
              match: route.match,
              mode: route.mode ?? "sequential",
            },
            animated: route.mode === "parallel",
            style: {
              strokeDasharray: route.mode === "parallel" ? "5,5" : undefined,
            },
          });
        });
      });
    }

    // Input node → next nodes
    if (node.type === "input" && node.next) {
      node.next.forEach((targetId, idx) => {
        flowEdges.push({
          id: `${node.id}->${targetId}-i${idx}`,
          source: node.id,
          target: targetId,
          type: "conditionalEdge",
          data: { match: "*", mode: "sequential" },
        });
      });
    }

    // Regular node → next nodes (fan-in join edges)
    if (node.type === "regular" && node.next && node.next.length > 0) {
      node.next.forEach((targetId, idx) => {
        flowEdges.push({
          id: `${node.id}->${targetId}-rn${idx}`,
          source: node.id,
          target: targetId,
          type: "conditionalEdge",
          data: { match: "*", mode: "sequential" },
          style: { strokeDasharray: "3,3", opacity: 0.7 },
        });
      });
    }

    // Output node ← input_from nodes
    if (node.type === "output" && node.input_from) {
      node.input_from.forEach((sourceId, idx) => {
        flowEdges.push({
          id: `${sourceId}->${node.id}-o${idx}`,
          source: sourceId,
          target: node.id,
          type: "conditionalEdge",
          data: { match: "*", mode: "sequential" },
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
  // Collect outgoing edges per source node
  const outgoingEdges: Record<string, string[]> = {};
  // Collect incoming edges per target node
  const incomingEdges: Record<string, string[]> = {};

  flowEdges.forEach((edge) => {
    if (!outgoingEdges[edge.source]) outgoingEdges[edge.source] = [];
    outgoingEdges[edge.source].push(edge.target);
    if (!incomingEdges[edge.target]) incomingEdges[edge.target] = [];
    incomingEdges[edge.target].push(edge.source);
  });

  // Rebuild router routes from edges
  const routerEdges: Record<
    string,
    Array<{ match: string; targets: string[]; mode: string }>
  > = {};

  flowEdges.forEach((edge) => {
    const sourceNode = flowNodes.find((n) => n.id === edge.source);
    if (sourceNode?.type !== "routerNode") return;

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
      const edgeRoutes = routerEdges[n.id] ?? [];
      nodeData.routes = edgeRoutes.map((r) => ({
        match: r.match,
        next: r.targets,
        mode: r.mode as "sequential" | "parallel",
      }));
    } else if (nodeData.type === "input") {
      // Save outgoing edges as `next`
      const targets = outgoingEdges[n.id] ?? [];
      // Exclude output nodes from next (output node handles its own input_from)
      nodeData.next = targets.filter((targetId) => {
        const targetNode = flowNodes.find((fn) => fn.id === targetId);
        return targetNode?.type !== "outputNode";
      });
    } else if (nodeData.type === "regular") {
      // Save outgoing edges as `next` for fan-in join support
      const targets = outgoingEdges[n.id] ?? [];
      const nextIds = targets.filter((targetId) => {
        const targetNode = flowNodes.find((fn) => fn.id === targetId);
        return targetNode?.type !== "outputNode";
      });
      if (nextIds.length > 0) {
        nodeData.next = nextIds;
      } else {
        delete nodeData.next;
      }
    } else if (nodeData.type === "output") {
      // Save incoming edges as `input_from`
      nodeData.input_from = incomingEdges[n.id] ?? [];
      // Remove `next` field if present
      delete nodeData.next;
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
