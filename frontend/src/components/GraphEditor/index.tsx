import { useCallback } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  Background,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  BackgroundVariant,
  Panel,
  useReactFlow,
} from "@xyflow/react";
import type { Connection, NodeChange, EdgeChange } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { RouterNode } from "../nodes/RouterNode";
import { RegularNode } from "../nodes/RegularNode";
import { ConditionalEdge } from "../edges/ConditionalEdge";
import { useGraphStore } from "../../store/graphStore";

const nodeTypes = {
  routerNode: RouterNode,
  regularNode: RegularNode,
};

const edgeTypes = {
  conditionalEdge: ConditionalEdge,
};

const defaultEdgeOptions = {
  type: "conditionalEdge",
  data: { match: "*", mode: "sequential" },
};

interface GraphEditorProps {
  onNodeClick: (nodeId: string) => void;
}

export function GraphEditor({ onNodeClick }: GraphEditorProps) {
  const { currentGraph } = useGraphStore();

  if (!currentGraph) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#020817",
        }}
      >
        <div style={{ textAlign: "center", color: "#475569" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🕸️</div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "#64748b",
              marginBottom: 8,
            }}
          >
            No graph selected
          </div>
          <div style={{ fontSize: 14 }}>
            Select a graph from the sidebar or create a new one
          </div>
        </div>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <GraphEditorInner onNodeClick={onNodeClick} />
    </ReactFlowProvider>
  );
}

function GraphEditorInner({ onNodeClick }: GraphEditorProps) {
  const {
    flowNodes,
    flowEdges,
    updateNodes,
    updateEdges,
    addNode,
    addLog,
  } = useGraphStore();

  const { screenToFlowPosition } = useReactFlow();

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      updateNodes(applyNodeChanges(changes, flowNodes));
    },
    [flowNodes, updateNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      updateEdges(applyEdgeChanges(changes, flowEdges));
    },
    [flowEdges, updateEdges]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      const edge = {
        ...params,
        type: "conditionalEdge",
        data: { match: "*", mode: "sequential" },
        id: `${params.source}->${params.target}-${Date.now()}`,
      };
      addLog("info", `엣지 연결: ${params.source} → ${params.target}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updateEdges(addEdge(edge as any, flowEdges));
    },
    [flowEdges, updateEdges, addLog]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const types = Array.from(event.dataTransfer.types);
      const type = event.dataTransfer.getData("nodeType") as "router" | "regular";
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addLog(
        type ? "info" : "warn",
        `[drop] nodeType="${type || "(없음)"}" | dataTransfer.types=[${types.join(",")}] | screen=(${event.clientX},${event.clientY}) | flow=(${Math.round(position.x)},${Math.round(position.y)}) | target=${(event.target as HTMLElement).tagName}.${(event.target as HTMLElement).className.toString().slice(0,40)}`
      );
      if (!type) return;
      addNode(type, position);
    },
    [screenToFlowPosition, addNode, addLog]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  return (
    <div style={{ flex: 1, position: "relative" }}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => onNodeClick(node.id)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onDrop={onDrop}
        onDragOver={onDragOver}
        fitView
        style={{ background: "#020817" }}
        colorMode="dark"
      >
        <Controls style={{ background: "#0f172a", border: "1px solid #1e293b" }} />
        <MiniMap
          style={{ background: "#0a0f1e", border: "1px solid #1e293b" }}
          nodeColor={(n) =>
            n.type === "routerNode" ? "#3b82f6" : "#22c55e"
          }
        />
        <Background variant={BackgroundVariant.Dots} color="#1e293b" gap={20} />

        {/* Node palette */}
        <Panel position="top-left">
          <NodePalette />
        </Panel>
      </ReactFlow>
    </div>
  );
}

function NodePalette() {
  const { addLog } = useGraphStore();

  const onDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData("nodeType", type);
    e.dataTransfer.effectAllowed = "move";
    addLog("info", `[dragstart] type="${type}" | effectAllowed=${e.dataTransfer.effectAllowed}`);
  };

  const onDragEnd = (e: React.DragEvent, type: string) => {
    addLog(
      e.dataTransfer.dropEffect === "none" ? "warn" : "info",
      `[dragend] type="${type}" | dropEffect="${e.dataTransfer.dropEffect}" (none=드롭 실패)`
    );
  };

  return (
    <div
      style={{
        background: "#0f172a",
        border: "1px solid #1e293b",
        borderRadius: 8,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ color: "#64748b", fontSize: 11, marginBottom: 4 }}>
        DRAG TO ADD
      </div>
      <div
        draggable
        onDragStart={(e) => onDragStart(e, "router")}
        onDragEnd={(e) => onDragEnd(e, "router")}
        style={{
          background: "#1a3050",
          border: "1px solid #3b82f6",
          borderRadius: 6,
          padding: "8px 14px",
          cursor: "grab",
          color: "white",
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 6,
          userSelect: "none",
        }}
      >
        🔀 Router
      </div>
      <div
        draggable
        onDragStart={(e) => onDragStart(e, "regular")}
        onDragEnd={(e) => onDragEnd(e, "regular")}
        style={{
          background: "#162d16",
          border: "1px solid #22c55e",
          borderRadius: 6,
          padding: "8px 14px",
          cursor: "grab",
          color: "white",
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 6,
          userSelect: "none",
        }}
      >
        🤖 Agent
      </div>
    </div>
  );
}
