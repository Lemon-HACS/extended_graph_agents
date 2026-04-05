/** v2 그래프 포맷 타입 — LangGraph 스타일 */

export interface ModelParams {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  reasoning_effort?: "low" | "medium" | "high";
}

export interface ToolParam {
  type: string;
  description?: string;
  enum?: string[];
  required?: boolean;
}

export interface ToolDef {
  name: string;
  description?: string;
  // 타입은 어떤 필드가 있는지로 결정
  service?: string;       // native HA service
  template?: string;      // Jinja2 template
  url?: string;           // web request
  params?: Record<string, ToolParam | string>;
  method?: string;
  headers?: Record<string, string>;
  payload?: Record<string, unknown>;
}

export interface ConditionItem {
  when: string;
  value: string;
}

export interface NodeDefV2 {
  type: "router" | "agent" | "condition";
  prompt?: string;
  model?: string;
  model_params?: ModelParams;
  // Router
  routes?: string[];
  // Agent
  tools?: ToolDef[];
  output_schema?: Array<{
    key: string;
    type: string;
    description?: string;
    enum?: string[];
  }>;
  max_tool_iterations?: number;
  // Condition
  conditions?: ConditionItem[];
  default?: string;
}

export type EdgeV2 = string | Record<string, string | Record<string, string> | string[]>;

export interface GraphV2 {
  name: string;
  id?: string;
  description?: string;
  model: string;
  model_params?: ModelParams;
  system_prompt_prefix?: string;
  max_tool_iterations?: number;
  nodes: Record<string, NodeDefV2>;
  edges: EdgeV2[];
}

export interface GraphSummaryV2 {
  id: string;
  name: string;
  description: string;
  node_count: number;
}

export interface TraceEvent {
  type: "node_started" | "node_finished" | "node_error" | "tool_called" | "tool_result";
  node_id?: string;
  node_type?: string;
  node_name?: string;
  output?: string;
  duration_ms?: number;
  variables_set?: Record<string, unknown>;
  token_usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  tool_name?: string;
  args?: Record<string, unknown>;
  result?: string;
  error?: string;
}

export interface RunResult {
  trace: TraceEvent[];
  output: string | null;
  error: string | null;
  total_tokens?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface AiGenerateResult {
  graph: GraphV2;
  explanation: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  // AI가 생성한 그래프 (assistant 메시지에)
  graph?: GraphV2;
  // 실행 결과 (dry-run)
  runResult?: RunResult;
}
