import { create } from "zustand";
import type { Node, Edge } from "@xyflow/react";
import type { GraphDefinition, GraphSummary } from "../types";
import { graphToFlow, flowToGraph } from "../utils/serializer";

interface GraphStore {
  // Graph list
  graphList: GraphSummary[];
  setGraphList: (list: GraphSummary[]) => void;

  // Current graph
  currentGraph: GraphDefinition | null;
  flowNodes: Node[];
  flowEdges: Edge[];

  // Selected node for config panel
  selectedNodeId: string | null;

  // UI state
  isDirty: boolean;
  isSaving: boolean;

  // Actions
  loadGraph: (graph: GraphDefinition) => void;
  updateNodes: (nodes: Node[]) => void;
  updateEdges: (edges: Edge[]) => void;
  updateNodeData: (nodeId: string, data: Partial<Record<string, unknown>>) => void;
  selectNode: (nodeId: string | null) => void;
  setIsSaving: (saving: boolean) => void;
  newGraph: () => void;
  getCurrentGraphDef: () => GraphDefinition | null;
  addNode: (type: "router" | "regular", position: { x: number; y: number }) => void;
  updateGraphMeta: (meta: Partial<Pick<GraphDefinition, "name" | "description" | "model">>) => void;
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  graphList: [],
  setGraphList: (list) => set({ graphList: list }),

  currentGraph: null,
  flowNodes: [],
  flowEdges: [],
  selectedNodeId: null,
  isDirty: false,
  isSaving: false,

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
    });
  },

  updateNodes: (nodes) => {
    const { currentGraph } = get();
    if (currentGraph) {
      // Save positions to localStorage
      const positions: Record<string, { x: number; y: number }> = {};
      nodes.forEach((n) => {
        positions[n.id] = n.position;
      });
      localStorage.setItem(
        `ega-positions-${currentGraph.id}`,
        JSON.stringify(positions)
      );
    }
    set({ flowNodes: nodes, isDirty: true });
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

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  setIsSaving: (saving) => set({ isSaving: saving }),

  newGraph: () => {
    const id = `graph_${Date.now()}`;
    const graph: GraphDefinition = {
      id,
      name: "New Graph",
      description: "",
      model: "gpt-4o",
      nodes: [],
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

  getCurrentGraphDef: () => {
    const { currentGraph, flowNodes, flowEdges } = get();
    if (!currentGraph) return null;
    return flowToGraph(
      {
        id: currentGraph.id,
        name: currentGraph.name,
        description: currentGraph.description,
        model: currentGraph.model,
      },
      flowNodes,
      flowEdges
    );
  },

  updateGraphMeta: (meta) => {
    set((state) => ({
      currentGraph: state.currentGraph ? { ...state.currentGraph, ...meta } : null,
      isDirty: true,
    }));
  },

  addNode: (type, position) => {
    const id = `${type}_${Date.now()}`;
    const newNode: Node = {
      id,
      type: type === "router" ? "routerNode" : "regularNode",
      position,
      data: {
        id,
        type,
        name: type === "router" ? "New Router" : "New Agent",
        prompt: "",
        ...(type === "router"
          ? { output_key: "route", routes: [] }
          : { functions: [], skills: [] }),
      },
    };
    set((state) => ({
      flowNodes: [...state.flowNodes, newNode],
      isDirty: true,
    }));
  },
}));
