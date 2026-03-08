// HA WebSocket API interface
export interface HassConnection {
  sendMessagePromise: (msg: Record<string, unknown>) => Promise<unknown>;
  subscribeMessage: (
    callback: (msg: unknown) => void,
    msg: Record<string, unknown>
  ) => () => void;
}

const DOMAIN = "extended_graph_agents";

export async function listGraphs(conn: HassConnection) {
  const result = (await conn.sendMessagePromise({
    type: `${DOMAIN}/list_graphs`,
  })) as { graphs: import("../types").GraphSummary[] };
  return result.graphs;
}

export async function getGraph(conn: HassConnection, graphId: string) {
  const result = (await conn.sendMessagePromise({
    type: `${DOMAIN}/get_graph`,
    graph_id: graphId,
  })) as { graph: import("../types").GraphDefinition };
  return result.graph;
}

export async function saveGraph(
  conn: HassConnection,
  graph: import("../types").GraphDefinition
) {
  await conn.sendMessagePromise({
    type: `${DOMAIN}/save_graph`,
    graph,
  });
}

export async function deleteGraph(conn: HassConnection, graphId: string) {
  await conn.sendMessagePromise({
    type: `${DOMAIN}/delete_graph`,
    graph_id: graphId,
  });
}
