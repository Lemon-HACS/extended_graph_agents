import { useCallback, useRef, useEffect } from "react";
import { useLang } from "../../contexts/LangContext";
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

// ReactFlow Panel 내부에서 React 합성 dragStart 이벤트가 안 먹히므로
// 모듈 레벨 변수로 드래그 타입을 추적
let _draggedNodeType: "router" | "regular" | null = null;

interface GraphEditorProps {
  onNodeClick: (nodeId: string) => void;
}

export function GraphEditor({ onNodeClick }: GraphEditorProps) {
  const { currentGraph } = useGraphStore();
  const t = useLang();

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
            {t.noGraphSelected}
          </div>
          <div style={{ fontSize: 14 }}>
            {t.selectOrCreate}
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
      const type = _draggedNodeType;
      _draggedNodeType = null;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addLog(
        type ? "info" : "warn",
        `[drop] nodeType="${type || "(없음)"}" | screen=(${event.clientX},${event.clientY}) | flow=(${Math.round(position.x)},${Math.round(position.y)})`
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
    <div
      style={{ flex: 1, position: "relative", height: "100%", minHeight: 0 }}
    >
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={(_, node) => onNodeClick(node.id)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        style={{ background: "#020817", width: "100%", height: "100%" }}
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
  const t = useLang();
  const routerRef = useRef<HTMLDivElement>(null);
  const agentRef = useRef<HTMLDivElement>(null);

  // ReactFlow Panel 내부에서 React onDragStart가 안 먹히므로
  // native addEventListener로 직접 등록
  useEffect(() => {
    const routerEl = routerRef.current;
    const agentEl = agentRef.current;

    const makeDragStart = (type: "router" | "regular") => (e: DragEvent) => {
      _draggedNodeType = type;
      if (e.dataTransfer) {
        e.dataTransfer.setData("nodeType", type);
        e.dataTransfer.effectAllowed = "move";
      }
      addLog("info", `[dragstart] type="${type}"`);
    };

    const makeDragEnd = (type: string) => (e: DragEvent) => {
      addLog(
        e.dataTransfer?.dropEffect === "none" ? "warn" : "info",
        `[dragend] type="${type}" | dropEffect="${e.dataTransfer?.dropEffect}" (none=드롭 실패)`
      );
    };

    const routerDragStart = makeDragStart("router");
    const routerDragEnd = makeDragEnd("router");
    const agentDragStart = makeDragStart("regular");
    const agentDragEnd = makeDragEnd("regular");

    routerEl?.addEventListener("dragstart", routerDragStart);
    routerEl?.addEventListener("dragend", routerDragEnd);
    agentEl?.addEventListener("dragstart", agentDragStart);
    agentEl?.addEventListener("dragend", agentDragEnd);

    return () => {
      routerEl?.removeEventListener("dragstart", routerDragStart);
      routerEl?.removeEventListener("dragend", routerDragEnd);
      agentEl?.removeEventListener("dragstart", agentDragStart);
      agentEl?.removeEventListener("dragend", agentDragEnd);
    };
  }, [addLog]);

  const paletteItemStyle = (bg: string, border: string): React.CSSProperties => ({
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: 6,
    padding: "8px 14px",
    cursor: "grab",
    color: "white",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    gap: 6,
    userSelect: "none",
  });

  return (
    <div
      className="nodrag nopan"
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
        {t.dragToAdd}
      </div>
      <div ref={routerRef} draggable style={paletteItemStyle("#1a3050", "#3b82f6")}>
        🔀 {t.router}
      </div>
      <div ref={agentRef} draggable style={paletteItemStyle("#162d16", "#22c55e")}>
        🤖 {t.agent}
      </div>
    </div>
  );
}
