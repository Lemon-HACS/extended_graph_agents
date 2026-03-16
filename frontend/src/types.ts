export interface ModelParams {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  reasoning_effort?: "low" | "medium" | "high";
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

export interface ConditionItem {
  when: string;
  value: string;
}

export interface GraphNode {
  id: string;
  type: "router" | "regular" | "input" | "output" | "condition" | "merge";
  name: string;
  model?: string;
  model_params?: ModelParams;
  prompt?: string;
  // Router specific
  output_key?: string;
  values?: string[];      // enum options for LLM structured output
  // Regular specific
  skills?: string[];
  output_schema?: OutputSchemaField[];  // JSON structured output mode
  // Output node specific
  output_template?: string;
  // Condition specific
  conditions?: ConditionItem[];
  default?: string;
  // Merge specific
  merge_strategy?: "concat" | "template" | "last";
  merge_template?: string;
  separator?: string;
  // Color tagging
  color?: string;
  color_label?: string;
  // UI position (not saved to YAML)
  position?: { x: number; y: number };
}

export interface GraphDefinition {
  id: string;
  name: string;
  description?: string;
  model?: string;
  model_params?: ModelParams;
  system_prompt_prefix?: string;
  max_tool_iterations?: number;
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

export interface TraceEvent {
  type: "node_started" | "node_finished" | "node_error" | "tool_called" | "tool_result";
  node_id?: string;
  node_type?: string;
  node_name?: string;
  output?: string;
  duration_ms?: number;
  variables_set?: Record<string, unknown>;
  tool_name?: string;
  args?: Record<string, unknown>;
  result?: string;
  error?: string;
}

export interface DebugRunResult {
  trace: TraceEvent[];
  output: string | null;
  error: string | null;
}
