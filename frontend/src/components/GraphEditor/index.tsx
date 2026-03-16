import { useCallback, useRef, useEffect, useState } from "react";
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
import type { Connection, NodeChange, EdgeChange, EdgeMouseHandler } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { RouterNode } from "../nodes/RouterNode";
import { RegularNode } from "../nodes/RegularNode";
import { InputNode } from "../nodes/InputNode";
import { OutputNode } from "../nodes/OutputNode";
import { ConditionNode } from "../nodes/ConditionNode";
import { MergeNode } from "../nodes/MergeNode";
import { ConditionalEdge } from "../edges/ConditionalEdge";
import { useGraphStore } from "../../store/graphStore";
import { useWindowSize } from "../../hooks/useWindowSize";
import type { ValidationWarning } from "../../utils/graphValidator";
import type { GraphNode } from "../../types";

const nodeTypes = {
  routerNode: RouterNode,
  regularNode: RegularNode,
  inputNode: InputNode,
  outputNode: OutputNode,
  conditionNode: ConditionNode,
  mergeNode: MergeNode,
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
let _draggedNodeType: "input" | "router" | "regular" | "output" | "condition" | "merge" | null = null;

type PaletteNodeType = "input" | "router" | "regular" | "output" | "condition" | "merge";

const PALETTE_ITEMS: { type: PaletteNodeType; icon: string; bg: string; border: string }[] = [
  { type: "input",     icon: "💬", bg: "#1e1150", border: "#7c3aed" },
  { type: "router",    icon: "🔀", bg: "#1a3050", border: "#3b82f6" },
  { type: "condition", icon: "⚡", bg: "#1f1600", border: "#d97706" },
  { type: "merge",     icon: "🔗", bg: "#0e2a2d", border: "#06b6d4" },
  { type: "regular",   icon: "🤖", bg: "#162d16", border: "#22c55e" },
  { type: "output",    icon: "📤", bg: "#2c1a02", border: "#c2410c" },
];

interface GraphEditorProps {
  onNodeClick: (nodeId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
  onPaneClick?: () => void;
  onOpenAi?: () => void;
}

export function GraphEditor({ onNodeClick, onEdgeClick, onPaneClick, onOpenAi }: GraphEditorProps) {
  const { currentGraph, flowNodes: rootFlowNodes } = useGraphStore();
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

  // Empty graph quickstart
  if (currentGraph && rootFlowNodes.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#020817" }}>
        <EmptyGraphQuickstart onOpenAi={onOpenAi} />
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <GraphEditorInner onNodeClick={onNodeClick} onEdgeClick={onEdgeClick} onPaneClick={onPaneClick} />
    </ReactFlowProvider>
  );
}

function GraphEditorInner({ onNodeClick, onEdgeClick, onPaneClick }: GraphEditorProps) {
  const {
    flowNodes,
    flowEdges,
    updateNodes,
    updateEdges,
    addNode,
    validationWarnings,
  } = useGraphStore();

  const { screenToFlowPosition } = useReactFlow();
  const { isMobile } = useWindowSize();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // replace만 dirty로 표시 (노드 삭제 등 구조 변경 시 발생)
      // position·select·dimensions는 YAML과 무관하므로 제외
      const shouldMarkDirty = changes.some((c) => c.type === "replace" || c.type === "remove");
      updateNodes(applyNodeChanges(changes, flowNodes), shouldMarkDirty);
    },
    [flowNodes, updateNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      updateEdges(applyEdgeChanges(changes, flowEdges));
    },
    [flowEdges, updateEdges]
  );

  const onEdgeClickHandler = useCallback<EdgeMouseHandler>(
    (_, edge) => {
      onEdgeClick?.(edge.id);
    },
    [onEdgeClick]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      const edge = {
        ...params,
        type: "conditionalEdge",
        data: { match: "*", mode: "sequential" },
        id: `${params.source}->${params.target}-${Date.now()}`,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updateEdges(addEdge(edge as any, flowEdges));
    },
    [flowEdges, updateEdges]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = _draggedNodeType;
      _draggedNodeType = null;
      if (!type) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNode(type, position);
    },
    [screenToFlowPosition, addNode]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  // 모바일: 팔레트 아이템 탭 시 뷰포트 중앙에 노드 추가
  const addNodeAtCenter = useCallback((type: PaletteNodeType) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const position = screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    addNode(type, position);
    setIsPaletteOpen(false);
  }, [screenToFlowPosition, addNode]);

  return (
    <div
      ref={containerRef}
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
        onEdgeClick={onEdgeClickHandler}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        deleteKeyCode={["Delete", "Backspace"]}
        fitView
        style={{ background: "#020817", width: "100%", height: "100%" }}
        colorMode="dark"
      >
        <Controls style={{ background: "#0f172a", border: "1px solid #1e293b" }} />
        <MiniMap
          style={{ background: "#0a0f1e", border: "1px solid #1e293b" }}
          nodeColor={(n) => {
            const nd = n.data as unknown as GraphNode;
            if (nd.color) return nd.color;
            return n.type === "routerNode" ? "#3b82f6"
              : n.type === "conditionNode" ? "#d97706"
              : n.type === "mergeNode" ? "#06b6d4"
              : n.type === "inputNode" ? "#7c3aed"
              : n.type === "outputNode" ? "#c2410c"
              : "#22c55e";
          }}
        />
        <Background variant={BackgroundVariant.Dots} color="#1e293b" gap={20} />

        {/* 데스크탑: 기존 드래그 팔레트 */}
        {!isMobile && (
          <Panel position="top-left">
            <DesktopNodePalette />
          </Panel>
        )}

        {/* Validation summary */}
        <Panel position="top-right">
          <ValidationSummary warnings={validationWarnings} onNodeClick={onNodeClick} />
        </Panel>
      </ReactFlow>

      {/* 모바일: 하단 슬라이드업 팔레트 */}
      {isMobile && (
        <>
          {/* 팔레트 시트 */}
          {isPaletteOpen && (
            <>
              {/* 백드롭 */}
              <div
                onClick={() => setIsPaletteOpen(false)}
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 10,
                }}
              />
              {/* 팔레트 시트 */}
              <MobileNodePalette onAdd={addNodeAtCenter} onClose={() => setIsPaletteOpen(false)} />
            </>
          )}

          {/* 열기 버튼 */}
          {!isPaletteOpen && (
            <button
              onClick={() => setIsPaletteOpen(true)}
              style={{
                position: "absolute",
                bottom: 80,
                left: "50%",
                transform: "translateX(-50%)",
                background: "#1e293b",
                border: "1px solid #3b82f6",
                borderRadius: 24,
                color: "#60a5fa",
                fontSize: 14,
                fontWeight: 600,
                padding: "10px 20px",
                cursor: "pointer",
                zIndex: 5,
                display: "flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
              }}
            >
              ＋ 노드 추가
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── 빈 그래프 퀵스타트 ─────────────────────────────────────────────────────

const TEMPLATES: { icon: string; labelKey: string; nodes: Array<{ type: string; name: string; [k: string]: unknown }>; edges: Array<{ source: number; target: number; [k: string]: unknown }> }[] = [
  {
    icon: "💬", labelKey: "templateQA",
    nodes: [
      { type: "input", name: "Input" },
      { type: "regular", name: "Q&A Agent", prompt: "{{ user_input }}" },
      { type: "output", name: "Output" },
    ],
    edges: [{ source: 0, target: 1 }, { source: 1, target: 2 }],
  },
  {
    icon: "🔀", labelKey: "templateRouter",
    nodes: [
      { type: "input", name: "Input" },
      { type: "router", name: "Router", output_key: "route", values: ["general", "technical"], prompt: "{{ user_input }}\n\n사용자 의도를 분류하세요." },
      { type: "regular", name: "General Agent", prompt: "{{ user_input }}" },
      { type: "regular", name: "Technical Agent", prompt: "{{ user_input }}" },
      { type: "output", name: "Output" },
    ],
    edges: [
      { source: 0, target: 1 },
      { source: 1, target: 2, condition: { variable: "route", value: "general" } },
      { source: 1, target: 3, condition: { variable: "route", value: "technical" } },
      { source: 2, target: 4 },
      { source: 3, target: 4 },
    ],
  },
  {
    icon: "⚡", labelKey: "templateCondition",
    nodes: [
      { type: "input", name: "Input" },
      { type: "condition", name: "Check State", output_key: "route", conditions: [{ when: "{{ is_state('light.living_room', 'on') }}", value: "on" }], default: "off" },
      { type: "regular", name: "On Handler", prompt: "조명이 켜져 있습니다. {{ user_input }}" },
      { type: "regular", name: "Off Handler", prompt: "조명이 꺼져 있습니다. {{ user_input }}" },
      { type: "output", name: "Output" },
    ],
    edges: [
      { source: 0, target: 1 },
      { source: 1, target: 2, condition: { variable: "route", value: "on" } },
      { source: 1, target: 3, condition: { variable: "route", value: "off" } },
      { source: 2, target: 4 },
      { source: 3, target: 4 },
    ],
  },
  {
    icon: "🔗", labelKey: "templateMerge",
    nodes: [
      { type: "input", name: "Input" },
      { type: "regular", name: "Search Agent", prompt: "{{ user_input }}에 대해 검색하세요." },
      { type: "regular", name: "Analysis Agent", prompt: "{{ user_input }}에 대해 분석하세요." },
      { type: "merge", name: "Merge Results", merge_strategy: "concat", separator: "\n\n---\n\n" },
      { type: "regular", name: "Summary Agent", prompt: "다음 결과를 요약하세요:\n{{ node_outputs['merge_results'] }}" },
      { type: "output", name: "Output" },
    ],
    edges: [
      { source: 0, target: 1, mode: "parallel" },
      { source: 0, target: 2, mode: "parallel" },
      { source: 1, target: 3 },
      { source: 2, target: 3 },
      { source: 3, target: 4 },
      { source: 4, target: 5 },
    ],
  },
];

function EmptyGraphQuickstart({ onOpenAi }: { onOpenAi?: () => void }) {
  const { currentGraph, loadGraphFromAi } = useGraphStore();
  const t = useLang();

  const applyTemplate = (tmpl: typeof TEMPLATES[number]) => {
    if (!currentGraph) return;
    const nodeIds = tmpl.nodes.map(() => crypto.randomUUID());
    const nodes = tmpl.nodes.map((n, i) => ({
      id: nodeIds[i],
      ...n,
      position: { x: 250, y: i * 180 + 50 },
    }));
    // Fix merge node ID reference in summary prompt
    const edges = tmpl.edges.map((e) => ({
      source: nodeIds[e.source],
      target: nodeIds[e.target],
      ...(e.mode ? { mode: e.mode } : {}),
      ...(e.condition ? { condition: e.condition } : {}),
    }));
    loadGraphFromAi({
      ...currentGraph,
      nodes: nodes as any,
      edges: edges as any,
    });
  };

  return (
    <div style={{ textAlign: "center", padding: 32, maxWidth: 400 }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🚀</div>
      <div style={{ color: "#e2e8f0", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
        {t.quickstartTitle}
      </div>
      <div style={{ color: "#64748b", fontSize: 13, marginBottom: 24 }}>
        {t.quickstartSubtitle}
      </div>

      {onOpenAi && (
        <button
          onClick={onOpenAi}
          style={{
            width: "100%",
            padding: "12px",
            background: "#2e1065",
            border: "1px solid #6d28d9",
            borderRadius: 8,
            color: "#a78bfa",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            marginBottom: 20,
          }}
        >
          ✨ {t.quickstartAi}
        </button>
      )}

      <div style={{ color: "#475569", fontSize: 12, marginBottom: 12 }}>
        {t.quickstartOrTemplate}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {TEMPLATES.map((tmpl, i) => (
          <button
            key={i}
            onClick={() => applyTemplate(tmpl)}
            style={{
              padding: "12px 8px",
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 8,
              color: "#e2e8f0",
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 24 }}>{tmpl.icon}</span>
            <span>{t[tmpl.labelKey as keyof typeof t] as string}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── 데스크탑: 드래그 팔레트 ───────────────────────────────────────────────

function DesktopNodePalette() {
  const t = useLang();
  const inputRef = useRef<HTMLDivElement>(null);
  const routerRef = useRef<HTMLDivElement>(null);
  const conditionRef = useRef<HTMLDivElement>(null);
  const mergeRef = useRef<HTMLDivElement>(null);
  const agentRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // ReactFlow Panel 내부에서 React onDragStart가 안 먹히므로
  // native addEventListener로 직접 등록
  useEffect(() => {
    const inputEl = inputRef.current;
    const routerEl = routerRef.current;
    const conditionEl = conditionRef.current;
    const mergeEl = mergeRef.current;
    const agentEl = agentRef.current;
    const outputEl = outputRef.current;

    const makeDragStart = (type: PaletteNodeType) => (e: DragEvent) => {
      _draggedNodeType = type;
      if (e.dataTransfer) {
        e.dataTransfer.setData("nodeType", type);
        e.dataTransfer.effectAllowed = "move";
      }
    };

    const listeners = [
      { el: inputEl, start: makeDragStart("input") },
      { el: routerEl, start: makeDragStart("router") },
      { el: conditionEl, start: makeDragStart("condition") },
      { el: mergeEl, start: makeDragStart("merge") },
      { el: agentEl, start: makeDragStart("regular") },
      { el: outputEl, start: makeDragStart("output") },
    ];

    listeners.forEach(({ el, start }) => {
      el?.addEventListener("dragstart", start);
    });

    return () => {
      listeners.forEach(({ el, start }) => {
        el?.removeEventListener("dragstart", start);
      });
    };
  }, []);

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
      <div ref={inputRef} draggable style={paletteItemStyle("#1e1150", "#7c3aed")}>
        💬 {t.inputNode}
      </div>
      <div ref={routerRef} draggable style={paletteItemStyle("#1a3050", "#3b82f6")}>
        🔀 {t.router}
      </div>
      <div ref={conditionRef} draggable style={paletteItemStyle("#1f1600", "#d97706")}>
        ⚡ {t.condition}
      </div>
      <div ref={mergeRef} draggable style={paletteItemStyle("#0e2a2d", "#06b6d4")}>
        🔗 {t.merge}
      </div>
      <div ref={agentRef} draggable style={paletteItemStyle("#162d16", "#22c55e")}>
        🤖 {t.agent}
      </div>
      <div ref={outputRef} draggable style={paletteItemStyle("#2c1a02", "#c2410c")}>
        📤 {t.outputNode}
      </div>
    </div>
  );
}

// ─── 모바일: 하단 슬라이드업 팔레트 ─────────────────────────────────────────

interface MobileNodePaletteProps {
  onAdd: (type: PaletteNodeType) => void;
  onClose: () => void;
}

// ─── Validation 요약 패널 ─────────────────────────────────────────────────

function ValidationSummary({ warnings, onNodeClick }: { warnings: ValidationWarning[]; onNodeClick: (id: string) => void }) {
  const t = useLang();
  const [open, setOpen] = useState(false);

  const errors = warnings.filter((w) => w.severity === "error");
  const warns = warnings.filter((w) => w.severity === "warning");

  if (warnings.length === 0) {
    return (
      <div
        className="nodrag nopan"
        style={{
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 8,
          padding: "6px 12px",
          color: "#4ade80",
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        ✓ {t.lintAllGood}
      </div>
    );
  }

  return (
    <div className="nodrag nopan" style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "#0f172a",
          border: `1px solid ${errors.length > 0 ? "#dc2626" : "#d97706"}`,
          borderRadius: 8,
          padding: "6px 12px",
          color: "white",
          fontSize: 12,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {errors.length > 0 && (
          <span style={{ color: "#ef4444" }}>
            {errors.length} {t.lintErrors}
          </span>
        )}
        {warns.length > 0 && (
          <span style={{ color: "#fbbf24" }}>
            {warns.length} {t.lintWarnings}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 4,
            background: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: 8,
            padding: 8,
            minWidth: 260,
            maxHeight: 300,
            overflowY: "auto",
            zIndex: 50,
            boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
          }}
        >
          {warnings.map((w, i) => (
            <div
              key={i}
              onClick={() => {
                if (w.nodeId) {
                  onNodeClick(w.nodeId);
                  setOpen(false);
                }
              }}
              style={{
                padding: "6px 8px",
                fontSize: 11,
                color: w.severity === "error" ? "#fca5a5" : "#fde68a",
                cursor: w.nodeId ? "pointer" : "default",
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
              onMouseOver={(e) => {
                if (w.nodeId) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.05)";
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = "transparent";
              }}
            >
              <span style={{ fontSize: 10 }}>{w.severity === "error" ? "🔴" : "🟡"}</span>
              <span>{t[w.messageKey as keyof typeof t] as string ?? w.messageKey}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 모바일: 하단 슬라이드업 팔레트 ─────────────────────────────────────────

function MobileNodePalette({ onAdd, onClose }: MobileNodePaletteProps) {
  const t = useLang();

  const labels: Record<PaletteNodeType, string> = {
    input: t.inputNode,
    router: t.router,
    condition: t.condition,
    merge: t.merge,
    regular: t.agent,
    output: t.outputNode,
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        background: "#0f172a",
        border: "1px solid #1e293b",
        borderRadius: "16px 16px 0 0",
        padding: "16px 16px 32px",
        zIndex: 20,
        boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
      }}
    >
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ color: "#64748b", fontSize: 12, fontWeight: 600, letterSpacing: "0.05em" }}>
          {t.tapToAdd}
        </span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#64748b",
            fontSize: 18,
            cursor: "pointer",
            lineHeight: 1,
            padding: "4px 8px",
          }}
        >
          ✕
        </button>
      </div>

      {/* 노드 버튼들 */}
      <div style={{ display: "flex", gap: 10 }}>
        {PALETTE_ITEMS.map(({ type, icon, bg, border }) => (
          <button
            key={type}
            onClick={() => onAdd(type)}
            style={{
              flex: 1,
              background: bg,
              border: `1px solid ${border}`,
              borderRadius: 10,
              padding: "14px 4px",
              color: "white",
              fontSize: 11,
              fontWeight: 600,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              minWidth: 0,
            }}
          >
            <span style={{ fontSize: 24 }}>{icon}</span>
            <span style={{ textAlign: "center", lineHeight: 1.2 }}>{labels[type]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
