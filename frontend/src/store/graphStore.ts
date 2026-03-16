import { create } from "zustand";
import type { Node, Edge } from "@xyflow/react";
import type { GraphDefinition, GraphSummary, TraceEvent, DebugRunResult, ExecutionHistoryEntry } from "../types";
import { graphToFlow, flowToGraph } from "../utils/serializer";
import { validateGraph, type ValidationWarning } from "../utils/graphValidator";

// Debounced validation
let _validationTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleValidation(get: () => GraphStore, set: (s: Partial<GraphStore>) => void) {
  if (_validationTimer) clearTimeout(_validationTimer);
  _validationTimer = setTimeout(() => {
    const { flowNodes, flowEdges } = get();
    set({ validationWarnings: validateGraph(flowNodes, flowEdges) });
  }, 300);
}

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

  // Validation
  validationWarnings: ValidationWarning[];

  // Debug
  debugMode: boolean;
  debugRunning: boolean;
  debugResult: DebugRunResult | null;
  highlightedNodeIds: Set<string>;
  executionHistory: ExecutionHistoryEntry[];
  toggleDebugMode: () => void;
  setDebugRunning: (running: boolean) => void;
  setDebugResult: (result: DebugRunResult | null, userInput?: string) => void;
  selectHistoryEntry: (index: number) => void;
  clearHistory: () => void;

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
  addNode: (type: "input" | "router" | "regular" | "output" | "condition" | "merge", position: { x: number; y: number }) => void;
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

  validationWarnings: [],

  debugMode: false,
  debugRunning: false,
  debugResult: null,
  highlightedNodeIds: new Set<string>(),
  executionHistory: [],

  toggleDebugMode: () => set((state) => ({
    debugMode: !state.debugMode,
    debugResult: null,
    highlightedNodeIds: new Set<string>(),
    selectedNodeId: null,
    selectedEdgeId: null,
  })),

  setDebugRunning: (running) => set({ debugRunning: running }),

  setDebugResult: (result, userInput) => {
    const highlighted = new Set<string>();
    if (result?.trace) {
      for (const ev of result.trace) {
        if (ev.type === "node_finished" || ev.type === "node_error") {
          if (ev.node_id) highlighted.add(ev.node_id);
        }
      }
    }

    // Add to history
    const { currentGraph, executionHistory } = get();
    let newHistory = executionHistory;
    if (result && userInput && currentGraph) {
      const entry: ExecutionHistoryEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        input: userInput,
        result,
      };
      newHistory = [...executionHistory, entry].slice(-20); // keep last 20
      try {
        localStorage.setItem(
          `ega-exec-history-${currentGraph.id}`,
          JSON.stringify(newHistory)
        );
      } catch { /* quota exceeded */ }
    }

    set({ debugResult: result, highlightedNodeIds: highlighted, debugRunning: false, executionHistory: newHistory });
  },

  selectHistoryEntry: (index) => {
    const { executionHistory } = get();
    const entry = executionHistory[index];
    if (!entry) return;
    const highlighted = new Set<string>();
    for (const ev of entry.result.trace) {
      if (ev.type === "node_finished" || ev.type === "node_error") {
        if (ev.node_id) highlighted.add(ev.node_id);
      }
    }
    set({ debugResult: entry.result, highlightedNodeIds: highlighted });
  },

  clearHistory: () => {
    const { currentGraph } = get();
    if (currentGraph) {
      localStorage.removeItem(`ega-exec-history-${currentGraph.id}`);
    }
    set({ executionHistory: [] });
  },

  loadGraph: (graph) => {
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

    // Load execution history from localStorage
    let executionHistory: ExecutionHistoryEntry[] = [];
    try {
      const raw = localStorage.getItem(`ega-exec-history-${graph.id}`);
      if (raw) executionHistory = JSON.parse(raw);
    } catch { /* ignore */ }

    set({
      currentGraph: graph,
      flowNodes: nodes,
      flowEdges: edges,
      isDirty: false,
      selectedNodeId: null,
      selectedEdgeId: null,
      executionHistory,
    });
    scheduleValidation(get, set);
  },

  updateNodes: (nodes, markDirty = false) => {
    const { currentGraph, selectedNodeId } = get();
    if (currentGraph) {
      const positions: Record<string, { x: number; y: number }> = {};
      nodes.forEach((n) => {
        positions[n.id] = n.position;
      });
      localStorage.setItem(
        `ega-positions-${currentGraph.id}`,
        JSON.stringify(positions)
      );
    }
    const nodeIds = new Set(nodes.map((n) => n.id));
    const newSelectedNodeId = selectedNodeId && nodeIds.has(selectedNodeId) ? selectedNodeId : null;
    set({ flowNodes: nodes, selectedNodeId: newSelectedNodeId, ...(markDirty ? { isDirty: true } : {}) });
    if (markDirty) scheduleValidation(get, set);
  },

  updateEdges: (edges) => {
    set({ flowEdges: edges, isDirty: true });
    scheduleValidation(get, set);
  },

  updateNodeData: (nodeId, data) => {
    set((state) => ({
      flowNodes: state.flowNodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      ),
      isDirty: true,
    }));
    scheduleValidation(get, set);
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
    scheduleValidation(get, set);
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
      isDirty: true,
      selectedNodeId: null,
      selectedEdgeId: null,
    });
    scheduleValidation(get, set);
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
    scheduleValidation(get, set);
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
      : type === "merge" ? "mergeNode"
      : "regularNode";

    const defaultName =
      type === "router" ? "New Router"
      : type === "input" ? "Input"
      : type === "output" ? "Output"
      : type === "condition" ? "New Condition"
      : type === "merge" ? "New Merge"
      : "New Agent";

    const extraData =
      type === "router" ? { output_key: "route", values: [] }
      : type === "regular" ? { functions: [], skills: [] }
      : type === "condition" ? { output_key: "route", conditions: [], default: "" }
      : type === "merge" ? { merge_strategy: "concat", separator: "\n\n" }
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
    scheduleValidation(get, set);
  },
}));
