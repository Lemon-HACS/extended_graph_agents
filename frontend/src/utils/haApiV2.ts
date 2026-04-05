/** v2 WebSocket API 함수 */
import type { HassConnection } from "./haApi";
import type { GraphV2, GraphSummaryV2, RunResult, AiGenerateResult } from "../types_v2";

const PREFIX = "extended_graph_agents/v2";

export async function listGraphsV2(conn: HassConnection): Promise<GraphSummaryV2[]> {
  return (await conn.sendMessagePromise({ type: `${PREFIX}/list_graphs` })) as GraphSummaryV2[];
}

export async function getGraphV2(conn: HassConnection, graphId: string): Promise<GraphV2> {
  return (await conn.sendMessagePromise({
    type: `${PREFIX}/get_graph`,
    graph_id: graphId,
  })) as GraphV2;
}

export async function saveGraphV2(
  conn: HassConnection,
  graph: GraphV2
): Promise<{ id: string; success: boolean }> {
  return (await conn.sendMessagePromise({
    type: `${PREFIX}/save_graph`,
    graph,
  })) as { id: string; success: boolean };
}

export async function deleteGraphV2(conn: HassConnection, graphId: string): Promise<void> {
  await conn.sendMessagePromise({
    type: `${PREFIX}/delete_graph`,
    graph_id: graphId,
  });
}

export async function runGraphV2(
  conn: HassConnection,
  params: {
    graph?: GraphV2;
    graph_id?: string;
    user_input: string;
    language?: string;
    dry_run?: boolean;
  }
): Promise<RunResult> {
  return (await conn.sendMessagePromise({
    type: `${PREFIX}/run_graph`,
    ...params,
  })) as RunResult;
}

export async function aiGenerateV2(
  conn: HassConnection,
  params: {
    request: string;
    current_graph?: GraphV2;
    messages?: Array<{ role: string; content: string }>;
    language?: string;
    model?: string;
  }
): Promise<AiGenerateResult> {
  return (await conn.sendMessagePromise({
    type: `${PREFIX}/ai_generate`,
    ...params,
  })) as AiGenerateResult;
}
