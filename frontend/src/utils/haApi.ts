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

export async function listSkills(conn: HassConnection) {
  const result = (await conn.sendMessagePromise({
    type: `${DOMAIN}/list_skills`,
  })) as { skills: import("../types").SkillSummary[] };
  return result.skills;
}

export async function getSkill(conn: HassConnection, skillId: string) {
  const result = (await conn.sendMessagePromise({
    type: `${DOMAIN}/get_skill`,
    skill_id: skillId,
  })) as { skill: import("../types").SkillDefinition };
  return result.skill;
}

export async function saveSkill(
  conn: HassConnection,
  skill: import("../types").SkillDefinition
) {
  await conn.sendMessagePromise({
    type: `${DOMAIN}/save_skill`,
    skill,
  });
}

export async function deleteSkill(conn: HassConnection, skillId: string) {
  await conn.sendMessagePromise({
    type: `${DOMAIN}/delete_skill`,
    skill_id: skillId,
  });
}

export async function renderTemplate(conn: HassConnection, template: string): Promise<string> {
  const result = (await conn.sendMessagePromise({
    type: `${DOMAIN}/render_template`,
    template,
  })) as { result: string };
  return result.result;
}

export async function runGraph(
  conn: HassConnection,
  graphDef: import("../types").GraphDefinition,
  userInput: string
): Promise<import("../types").DebugRunResult> {
  const result = await conn.sendMessagePromise({
    type: `${DOMAIN}/run_graph`,
    graph: graphDef,
    user_input: userInput,
  }) as import("../types").DebugRunResult;
  return result;
}

export interface HassEntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

// ── AI 어시스턴트 ────────────────────────────────────────────────────────────

export type AiAssistScope = "graph" | "node" | "skill";

export interface AiAssistMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiAssistResult {
  yaml: string;
  explanation: string;
}

export async function aiAssist(
  conn: HassConnection,
  scope: AiAssistScope,
  request: string,
  currentYaml: string,
  messages: AiAssistMessage[],
  context: Record<string, string> = {}
): Promise<AiAssistResult> {
  return await conn.sendMessagePromise({
    type: `${DOMAIN}/ai_assist`,
    scope,
    request,
    current_yaml: currentYaml,
    messages,
    context,
  }) as AiAssistResult;
}

export async function getStates(conn: HassConnection): Promise<HassEntityState[]> {
  const result = (await conn.sendMessagePromise({
    type: "get_states",
  })) as HassEntityState[];
  return result;
}
