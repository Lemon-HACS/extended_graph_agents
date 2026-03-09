export interface RouteConfig {
  match: string;
  next: string[];
  mode?: "sequential" | "parallel";
}

export interface FunctionSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface FunctionConfig {
  type: string;
  [key: string]: unknown;
}

export interface FunctionTool {
  spec: FunctionSpec;
  function: FunctionConfig;
}

export interface GraphNode {
  id: string;
  type: "router" | "regular" | "input" | "output";
  name: string;
  model?: string;
  prompt?: string;
  // Router specific
  output_key?: string;
  routes?: RouteConfig[];
  // Regular specific
  functions?: FunctionTool[];
  skills?: string[];
  // Input node specific
  next?: string[];
  // Output node specific
  input_from?: string[];
  // UI position (not saved to YAML)
  position?: { x: number; y: number };
}

export interface GraphDefinition {
  id: string;
  name: string;
  description?: string;
  model?: string;
  nodes: GraphNode[];
}

export interface GraphSummary {
  id: string;
  name: string;
  description: string;
  node_count: number;
}

export interface SkillSummary {
  id: string;
  name: string;
  group: string;
  description: string;
  function_count: number;
}

export interface SkillDefinition {
  id: string;
  name: string;
  group?: string;
  description?: string;
  functions: FunctionTool[];
}

export interface ExecutionTrace {
  type: "node_started" | "node_finished" | "graph_finished";
  node_id?: string;
  node_type?: string;
  output?: string;
}
