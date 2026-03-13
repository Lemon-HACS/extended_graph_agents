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

export interface EdgeCondition {
  variable: string;
  value: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  mode?: "sequential" | "parallel";
  condition?: EdgeCondition;
}

export interface OutputSchemaField {
  key: string;
  type: "string" | "number" | "integer" | "boolean";
  description?: string;
  enum?: string[];
}

export interface GraphNode {
  id: string;
  type: "router" | "regular" | "input" | "output";
  name: string;
  model?: string;
  prompt?: string;
  // Router specific
  output_key?: string;
  values?: string[];      // enum options for LLM structured output
  // Regular specific
  functions?: FunctionTool[];
  skills?: string[];
  output_schema?: OutputSchemaField[];  // JSON structured output mode
  // Output node specific
  output_template?: string;
  // UI position (not saved to YAML)
  position?: { x: number; y: number };
}

export interface GraphDefinition {
  id: string;
  name: string;
  description?: string;
  model?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
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
