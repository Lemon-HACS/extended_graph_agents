/**
 * GraphFlowView — GraphV2를 읽기 전용 플로우차트로 시각화
 *
 * @xyflow/react를 사용하여 노드/엣지를 자동 레이아웃합니다.
 */
import React, { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  Position,
  MarkerType,
  Handle,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { GraphV2, NodeDefV2, EdgeV2 } from "../types_v2";

interface GraphFlowViewProps {
  graph: GraphV2;
  height?: number | string;
}

// ── Node type colors ──
const NODE_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  router: { bg: "#1e1b4b", border: "#6366f1", badge: "#818cf8" },
  agent: { bg: "#0c2a1e", border: "#22c55e", badge: "#4ade80" },
  condition: { bg: "#2a1f00", border: "#eab308", badge: "#facc15" },
  START: { bg: "#1e293b", border: "#3b82f6", badge: "#60a5fa" },
  END: { bg: "#1e293b", border: "#64748b", badge: "#94a3b8" },
};

// ── Custom node component ──
function GraphNode({ data }: { data: { label: string; type: string; toolCount?: number } }) {
  const colors = NODE_COLORS[data.type] || NODE_COLORS.agent;
  const isTerminal = data.type === "START" || data.type === "END";

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div
        style={{
          background: colors.bg,
          border: `2px solid ${colors.border}`,
          borderRadius: isTerminal ? "20px" : "8px",
          padding: isTerminal ? "6px 20px" : "8px 14px",
          minWidth: isTerminal ? 60 : 100,
          textAlign: "center",
        }}
      >
        {!isTerminal && (
          <div
            style={{
              fontSize: "9px",
              fontWeight: 700,
              color: colors.badge,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "3px",
            }}
          >
            {data.type}
          </div>
        )}
        <div
          style={{
            fontSize: isTerminal ? "11px" : "12px",
            fontWeight: 600,
            color: "#e2e8f0",
          }}
        >
          {data.label}
        </div>
        {data.toolCount != null && data.toolCount > 0 && (
          <div style={{ fontSize: "10px", color: "#64748b", marginTop: "2px" }}>
            {data.toolCount} tools
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </>
  );
}

const nodeTypes = { graphNode: GraphNode };

// ── Edge parsing ──

interface ParsedEdge {
  source: string;
  target: string;
  label?: string;
}

function parseEdges(edges: EdgeV2[]): ParsedEdge[] {
  const result: ParsedEdge[] = [];

  for (const edge of edges) {
    if (typeof edge === "string") {
      // "A -> B" or "A -> B, C"
      const parts = edge.split("->").map((s) => s.trim());
      if (parts.length === 2) {
        const source = parts[0];
        const targets = parts[1].split(",").map((t) => t.trim());
        for (const target of targets) {
          result.push({ source, target });
        }
      }
    } else if (typeof edge === "object") {
      // { "router_node": { "route_a": "node_a", "route_b": "node_b" } }
      // or { "router_node": ["node_a", "node_b"] }
      for (const [source, mapping] of Object.entries(edge)) {
        if (typeof mapping === "string") {
          result.push({ source, target: mapping });
        } else if (Array.isArray(mapping)) {
          for (const target of mapping) {
            result.push({ source, target: String(target) });
          }
        } else if (typeof mapping === "object" && mapping !== null) {
          for (const [label, target] of Object.entries(mapping)) {
            result.push({ source, target: String(target), label });
          }
        }
      }
    }
  }

  return result;
}

// ── Auto layout (layered/Sugiyama-style) ──

function autoLayout(
  nodeNames: string[],
  parsedEdges: ParsedEdge[],
): Record<string, { x: number; y: number }> {
  // Build adjacency
  const adj: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};

  for (const name of nodeNames) {
    adj[name] = [];
    inDegree[name] = 0;
  }
  for (const e of parsedEdges) {
    if (adj[e.source] && inDegree[e.target] !== undefined) {
      adj[e.source].push(e.target);
      inDegree[e.target]++;
    }
  }

  // BFS layer assignment
  const layers: Record<string, number> = {};
  const queue: string[] = [];

  // Start from nodes with 0 in-degree
  for (const name of nodeNames) {
    if (inDegree[name] === 0) {
      queue.push(name);
      layers[name] = 0;
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLayer = layers[current];
    for (const next of adj[current] || []) {
      const newLayer = currentLayer + 1;
      if (layers[next] === undefined || layers[next] < newLayer) {
        layers[next] = newLayer;
      }
      inDegree[next]--;
      if (inDegree[next] === 0) {
        queue.push(next);
      }
    }
  }

  // Assign remaining (cycles or isolated)
  for (const name of nodeNames) {
    if (layers[name] === undefined) {
      layers[name] = 0;
    }
  }

  // Group by layer
  const layerGroups: Record<number, string[]> = {};
  for (const [name, layer] of Object.entries(layers)) {
    (layerGroups[layer] ??= []).push(name);
  }

  // Position
  const NODE_W = 160;
  const NODE_H = 100;
  const positions: Record<string, { x: number; y: number }> = {};

  const sortedLayers = Object.keys(layerGroups)
    .map(Number)
    .sort((a, b) => a - b);

  for (const layer of sortedLayers) {
    const nodesInLayer = layerGroups[layer];
    const totalWidth = nodesInLayer.length * NODE_W;
    const startX = -totalWidth / 2 + NODE_W / 2;
    nodesInLayer.forEach((name, i) => {
      positions[name] = {
        x: startX + i * NODE_W,
        y: layer * NODE_H,
      };
    });
  }

  return positions;
}

// ── Main component ──

export function GraphFlowView({ graph, height = 300 }: GraphFlowViewProps) {
  const { flowNodes, flowEdges } = useMemo(() => {
    const graphNodeNames = Object.keys(graph.nodes);
    const parsedEdges = parseEdges(graph.edges);

    // Determine if START/END should be shown
    const hasStart = parsedEdges.some((e) => e.source === "START");
    const hasEnd = parsedEdges.some((e) => e.target === "END");

    const allNames: string[] = [];
    if (hasStart) allNames.push("START");
    allNames.push(...graphNodeNames);
    if (hasEnd) allNames.push("END");

    const positions = autoLayout(allNames, parsedEdges);

    // Build xyflow nodes
    const flowNodes: Node[] = allNames.map((name) => {
      const nodeDef = graph.nodes[name];
      const isTerminal = name === "START" || name === "END";
      return {
        id: name,
        type: "graphNode",
        position: positions[name] || { x: 0, y: 0 },
        data: {
          label: name,
          type: isTerminal ? name : (nodeDef?.type || "agent"),
          toolCount: nodeDef?.tools?.length,
        },
        draggable: false,
        selectable: false,
      };
    });

    // Build xyflow edges
    const flowEdges: Edge[] = parsedEdges
      .filter((e) => positions[e.source] && positions[e.target])
      .map((e, i) => ({
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        label: e.label || undefined,
        type: "smoothstep",
        animated: false,
        style: { stroke: "#475569", strokeWidth: 2 },
        labelStyle: {
          fontSize: 10,
          fill: "#94a3b8",
          fontWeight: 600,
        },
        labelBgStyle: {
          fill: "#0f172a",
          fillOpacity: 0.9,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#475569",
          width: 16,
          height: 16,
        },
      }));

    return { flowNodes, flowEdges };
  }, [graph]);

  return (
    <div style={{ height, width: "100%", background: "#0a0f1e", borderRadius: "6px" }}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
      >
        <Background color="#1e293b" gap={20} size={1} />
        <Controls
          showInteractive={false}
          style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "6px" }}
        />
      </ReactFlow>
    </div>
  );
}
