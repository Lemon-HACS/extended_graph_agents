import { create } from "zustand";
import type { Node, Edge } from "@xyflow/react";
import type { GraphDefinition, GraphSummary, TraceEvent, DebugRunResult } from "../types";
import { graphToFlow, flowToGraph } from "../utils/serializer";

interface GraphStore {
  // Graph list
  graphList: GraphSummary[];
  setGraphList: (list: GraphSummary[]) => void;

  // Current graph
  currentGraph: GraphDefinition | null;
  flowNodes: Node[];
  flowEdges: Edge[];

  // Selected node/edge for config panel
  selectedNodeId: string | null;
  selectedEdgeId: string | null;

  // UI state
  isDirty: boolean;
  isSaving: boolean;

  // Debug
  debugMode: boolean;
  debugRunning: boolean;
  debugResult: DebugRunResult | null;
  highlightedNodeIds: Set<string>;
  toggleDebugMode: () => void;
  setDebugRunning: (running: boolean) => void;
  setDebugResult: (result: DebugRunResult | null) => void;

  // Actions
  loadGraph: (graph: GraphDefinition) => void;
  updateNodes: (nodes: Node[], markDirty?: boolean) => void;
  updateEdges: (edges: Edge[]) => void;
  updateNodeData: (nodeId: string, data: Partial<Record<string, unknown>>) => void;
  updateEdgeData: (edgeId: string, data: Partial<Record<string, unknown>>) => void;
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  setIsSaving: (saving: boolean) => void;
  markSaved: () => void;
  newGraph: () => void;
  loadGraphFromAi: (graph: GraphDefinition) => void;
  getCurrentGraphDef: () => GraphDefinition | null;
  addNode: (type: "input" | "router" | "regular" | "output" | "condition", position: { x: number; y: number }) => void;
  deleteNode: (nodeId: string) => void;
  updateGraphMeta: (meta: Partial<GraphDefinition>) => void;
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  graphList: [],
  setGraphList: (list) => set({ graphList: list }),

  currentGraph: null,
  flowNodes: [],
  flowEdges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  isDirty: false,
  isSaving: false,

  debugMode: false,
  debugRunning: false,
  debugResult: null,
  highlightedNodeIds: new Set<string>(),

  toggleDebugMode: () => set((state) => ({
    debugMode: !state.debugMode,
    debugResult: null,
    highlightedNodeIds: new Set<string>(),
    selectedNodeId: null,
    selectedEdgeId: null,
  })),

  setDebugRunning: (running) => set({ debugRunning: running }),

  setDebugResult: (result) => {
    const highlighted = new Set<string>();
    if (result?.trace) {
      for (const ev of result.trace) {
        if (ev.type === "node_finished" || ev.type === "node_error") {
          if (ev.node_id) highlighted.add(ev.node_id);
        }
      }
    }
    set({ debugResult: result, highlightedNodeIds: highlighted, debugRunning: false });
  },

  loadGraph: (graph) => {
    // Restore saved positions from localStorage
    const savedPositions = (() => {
      try {
        return JSON.parse(
          localStorage.getItem(`ega-positions-${graph.id}`) ?? "{}"
        );
      } catch {
        return {};
      }
    })();

    const { nodes, edges } = graphToFlow(graph, savedPositions);
    set({
      currentGraph: graph,
      flowNodes: nodes,
      flowEdges: edges,
      isDirty: false,
      selectedNodeId: null,
      selectedEdgeId: null,
    });
  },

  updateNodes: (nodes, markDirty = false) => {
    const { currentGraph, selectedNodeId } = get();
    if (currentGraph) {
      // Save positions to localStorage (위치는 YAML에 포함되지 않으므로 dirty 마킹 불필요)
      const positions: Record<string, { x: number; y: number }> = {};
      nodes.forEach((n) => {
        positions[n.id] = n.position;
      });
      localStorage.setItem(
        `ega-positions-${currentGraph.id}`,
        JSON.stringify(positions)
      );
    }
    // Auto-clear selection if selected node was removed
    const nodeIds = new Set(nodes.map((n) => n.id));
    const newSelectedNodeId = selectedNodeId && nodeIds.has(selectedNodeId) ? selectedNodeId : null;
    set({ flowNodes: nodes, selectedNodeId: newSelectedNodeId, ...(markDirty ? { isDirty: true } : {}) });
  },

  updateEdges: (edges) => set({ flowEdges: edges, isDirty: true }),

  updateNodeData: (nodeId, data) => {
    set((state) => ({
      flowNodes: state.flowNodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      ),
      isDirty: true,
    }));
  },

  updateEdgeData: (edgeId, data) => {
    set((state) => ({
      flowEdges: state.flowEdges.map((e) =>
        e.id === edgeId ? { ...e, data: { ...e.data, ...data } } : e
      ),
      isDirty: true,
    }));
  },

  selectNode: (nodeId) => {
    set({ selectedNodeId: nodeId, selectedEdgeId: null });
  },

  selectEdge: (edgeId) => {
    set({ selectedEdgeId: edgeId, selectedNodeId: null });
  },

  setIsSaving: (saving) => set({ isSaving: saving }),
  markSaved: () => set({ isDirty: false, isSaving: false }),

  newGraph: () => {
    const id = crypto.randomUUID();
    const graph: GraphDefinition = {
      id,
      name: "New Graph",
      description: "",
      model: "gpt-4o",
      nodes: [],
      edges: [],
    };
    const { nodes, edges } = graphToFlow(graph);
    set({
      currentGraph: graph,
      flowNodes: nodes,
      flowEdges: edges,
      isDirty: true,
      selectedNodeId: null,
    });
  },

  loadGraphFromAi: (graph) => {
    const savedPositions = (() => {
      try {
        return JSON.parse(localStorage.getItem(`ega-positions-${graph.id}`) ?? "{}");
      } catch { return {}; }
    })();
    const { nodes, edges } = graphToFlow(graph, savedPositions);
    set({
      currentGraph: graph,
      flowNodes: nodes,
      flowEdges: edges,
      isDirty: true,   // loadGraph와 달리 AI 적용은 저장 전 상태
      selectedNodeId: null,
      selectedEdgeId: null,
    });
  },

  getCurrentGraphDef: () => {
    const { currentGraph, flowNodes, flowEdges } = get();
    if (!currentGraph) return null;
    return flowToGraph(
      {
        id: currentGraph.id,
        name: currentGraph.name,
        description: currentGraph.description,
        model: currentGraph.model,
        model_params: currentGraph.model_params,
        system_prompt_prefix: currentGraph.system_prompt_prefix,
        max_tool_iterations: currentGraph.max_tool_iterations,
      },
      flowNodes,
      flowEdges
    );
  },

  deleteNode: (nodeId) => {
    set((state) => ({
      flowNodes: state.flowNodes.filter((n) => n.id !== nodeId),
      flowEdges: state.flowEdges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      isDirty: true,
    }));
  },

  updateGraphMeta: (meta) => {
    set((state) => ({
      currentGraph: state.currentGraph ? { ...state.currentGraph, ...meta } : null,
      isDirty: true,
    }));
  },

  addNode: (type, position) => {
    const id = crypto.randomUUID();

    const flowType =
      type === "router" ? "routerNode"
      : type === "input" ? "inputNode"
      : type === "output" ? "outputNode"
      : type === "condition" ? "conditionNode"
      : "regularNode";

    const defaultName =
      type === "router" ? "New Router"
      : type === "input" ? "Input"
      : type === "output" ? "Output"
      : type === "condition" ? "New Condition"
      : "New Agent";

    const extraData =
      type === "router" ? { output_key: "route", values: [] }
      : type === "regular" ? { functions: [], skills: [] }
      : type === "condition" ? { output_key: "route", conditions: [], default: "" }
      : {};

    const newNode: Node = {
      id,
      type: flowType,
      position,
      data: {
        id,
        type,
        name: defaultName,
        ...extraData,
      },
    };
    set((state) => ({
      flowNodes: [...state.flowNodes, newNode],
      isDirty: true,
    }));
  },
}));
