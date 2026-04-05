/**
 * GraphFlowView — GraphV2를 플로우차트로 시각화
 *
 * 노드에 프롬프트 요약, 도구 목록, 라우트/조건 상세 표시.
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
  /** 변경된 노드 ID 목록 — 하이라이트 표시 */
  changedNodes?: Set<string>;
}

// ── Node type colors ──
const NODE_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  router: { bg: "#1e1b4b", border: "#6366f1", badge: "#818cf8" },
  agent: { bg: "#0c2a1e", border: "#22c55e", badge: "#4ade80" },
  condition: { bg: "#2a1f00", border: "#eab308", badge: "#facc15" },
  START: { bg: "#1e293b", border: "#3b82f6", badge: "#60a5fa" },
  END: { bg: "#1e293b", border: "#64748b", badge: "#94a3b8" },
};

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

// ── Custom node component ──
interface GraphNodeData {
  label: string;
  type: string;
  prompt?: string;
  tools?: Array<{ name: string; service?: string; template?: string; url?: string }>;
  routes?: string[];
  conditions?: Array<{ when: string; value: string }>;
  condDefault?: string;
  model?: string;
  changed?: boolean;
}

function GraphNode({ data }: { data: GraphNodeData }) {
  const colors = NODE_COLORS[data.type] || NODE_COLORS.agent;
  const isTerminal = data.type === "START" || data.type === "END";

  const changedStyle = data.changed ? {
    boxShadow: `0 0 12px 3px #f59e0b88`,
    border: `2px solid #f59e0b`,
  } : {};

  if (isTerminal) {
    return (
      <>
        <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
        <div style={{
          background: colors.bg,
          border: `2px solid ${colors.border}`,
          borderRadius: "20px",
          padding: "6px 20px",
          minWidth: 60,
          textAlign: "center",
          ...changedStyle,
        }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#e2e8f0" }}>
            {data.label}
          </div>
        </div>
        <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      </>
    );
  }

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div style={{
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        borderRadius: "8px",
        padding: "8px 12px",
        minWidth: 160,
        maxWidth: 260,
        fontSize: "11px",
        ...changedStyle,
      }}>
        {/* Header: type badge + name */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
          <span style={{
            fontSize: "9px",
            fontWeight: 700,
            color: colors.badge,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            background: `${colors.border}22`,
            padding: "1px 5px",
            borderRadius: "3px",
          }}>
            {data.type}
          </span>
          <span style={{ fontWeight: 600, color: "#e2e8f0", fontSize: "12px" }}>
            {data.label}
          </span>
        </div>

        {/* Model (if set) */}
        {data.model && (
          <div style={{ color: "#64748b", fontSize: "10px", marginBottom: "3px" }}>
            model: {data.model}
          </div>
        )}

        {/* Prompt summary */}
        {data.prompt && (
          <div style={{
            color: "#94a3b8",
            fontSize: "10px",
            lineHeight: "1.4",
            marginBottom: "4px",
            padding: "3px 5px",
            background: "#00000033",
            borderRadius: "3px",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}>
            {truncate(data.prompt, 80)}
          </div>
        )}

        {/* Router: routes */}
        {data.routes && data.routes.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", marginBottom: "3px" }}>
            {data.routes.map((r) => (
              <span key={r} style={{
                fontSize: "9px",
                background: `${colors.border}33`,
                color: colors.badge,
                padding: "1px 5px",
                borderRadius: "3px",
                border: `1px solid ${colors.border}55`,
              }}>
                {r}
              </span>
            ))}
          </div>
        )}

        {/* Condition: conditions list */}
        {data.conditions && data.conditions.length > 0 && (
          <div style={{ marginBottom: "3px" }}>
            {data.conditions.slice(0, 3).map((c, i) => (
              <div key={i} style={{
                fontSize: "9px",
                color: "#94a3b8",
                padding: "1px 0",
              }}>
                <span style={{ color: colors.badge }}>if</span>{" "}
                {truncate(c.when, 30)} → <span style={{ color: "#e2e8f0" }}>{c.value}</span>
              </div>
            ))}
            {data.conditions.length > 3 && (
              <div style={{ fontSize: "9px", color: "#64748b" }}>
                +{data.conditions.length - 3} more
              </div>
            )}
            {data.condDefault && (
              <div style={{ fontSize: "9px", color: "#64748b" }}>
                default → {data.condDefault}
              </div>
            )}
          </div>
        )}

        {/* Agent: tools list */}
        {data.tools && data.tools.length > 0 && (
          <div style={{ borderTop: `1px solid ${colors.border}33`, paddingTop: "3px" }}>
            {data.tools.slice(0, 4).map((t) => (
              <div key={t.name} style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "9px",
                color: "#94a3b8",
                padding: "1px 0",
              }}>
                <span style={{
                  color: t.service ? "#4ade80" : t.template ? "#facc15" : "#60a5fa",
                  fontWeight: 600,
                  fontSize: "8px",
                }}>
                  {t.service ? "SVC" : t.template ? "TPL" : "WEB"}
                </span>
                <span>{t.name}</span>
              </div>
            ))}
            {data.tools.length > 4 && (
              <div style={{ fontSize: "9px", color: "#64748b" }}>
                +{data.tools.length - 4} more
              </div>
            )}
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
      const parts = edge.split("->").map((s) => s.trim());
      if (parts.length === 2) {
        const source = parts[0];
        const targets = parts[1].split(",").map((t) => t.trim());
        for (const target of targets) {
          result.push({ source, target });
        }
      }
    } else if (typeof edge === "object") {
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

// ── Auto layout ──

function autoLayout(
  nodeNames: string[],
  parsedEdges: ParsedEdge[],
): Record<string, { x: number; y: number }> {
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

  const layers: Record<string, number> = {};
  const queue: string[] = [];

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

  for (const name of nodeNames) {
    if (layers[name] === undefined) layers[name] = 0;
  }

  const layerGroups: Record<number, string[]> = {};
  for (const [name, layer] of Object.entries(layers)) {
    (layerGroups[layer] ??= []).push(name);
  }

  const NODE_W = 280;
  const NODE_H = 160;
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

export function GraphFlowView({ graph, height = "100%", changedNodes }: GraphFlowViewProps) {
  const { flowNodes, flowEdges } = useMemo(() => {
    const graphNodeNames = Object.keys(graph.nodes);
    const parsedEdges = parseEdges(graph.edges);

    const hasStart = parsedEdges.some((e) => e.source === "START");
    const hasEnd = parsedEdges.some((e) => e.target === "END");

    const allNames: string[] = [];
    if (hasStart) allNames.push("START");
    allNames.push(...graphNodeNames);
    if (hasEnd) allNames.push("END");

    const positions = autoLayout(allNames, parsedEdges);

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
          prompt: nodeDef?.prompt,
          tools: nodeDef?.tools?.map((t) => ({
            name: t.name,
            service: t.service,
            template: t.template,
            url: t.url,
          })),
          routes: nodeDef?.routes,
          conditions: nodeDef?.conditions,
          condDefault: nodeDef?.default,
          model: nodeDef?.model,
          changed: changedNodes?.has(name) || false,
        } satisfies GraphNodeData,
        draggable: false,
        selectable: false,
      };
    });

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
        labelStyle: { fontSize: 10, fill: "#94a3b8", fontWeight: 600 },
        labelBgStyle: { fill: "#0f172a", fillOpacity: 0.9 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#475569",
          width: 16,
          height: 16,
        },
      }));

    return { flowNodes, flowEdges };
  }, [graph, changedNodes]);

  return (
    <div style={{ height, width: "100%", background: "#0a0f1e", borderRadius: "6px" }}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
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
