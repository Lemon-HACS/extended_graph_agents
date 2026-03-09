const en = {
  // GraphList
  graphAgents: "Graph Agents",
  newGraph: "+ New Graph",
  noGraphsYet: "No graphs yet.",
  createOneToStart: "Create one to start.",
  nodes: "nodes",

  // GraphEditor
  noGraphSelected: "No graph selected",
  selectOrCreate: "Select a graph from the sidebar or create a new one",
  dragToAdd: "DRAG TO ADD",
  inputNode: "Input",
  router: "Router",
  agent: "Agent",
  outputNode: "Output",

  // App topbar
  graphLabel: "Graph:",
  yaml: "YAML",
  backToGraph: "← Graph",
  save: "Save*",
  saved: "Saved",
  saving: "...",
  debug: "DEBUG",

  // NodeConfigPanel
  nodeConfig: "Node Config",
  nodeId: "Node ID",
  name: "Name",
  modelOptional: "Model (optional)",
  modelPlaceholder: "gpt-4o (inherited from graph)",
  systemPrompt: "System Prompt",
  outputKey: "Output Key",
  routes: "ROUTES",
  route: "Route",
  matchValue: "Match Value",
  matchPlaceholder: "e.g. smart_home or * for default",
  nextNodeIds: "Next Node IDs (comma separated)",
  executionMode: "Execution Mode",
  sequential: "Sequential",
  parallel: "Parallel ∥",
  addRoute: "+ Add Route",
  functions: "FUNCTIONS",
  addFunction: "+ Add Function",
  skills: "SKILLS",
  skillsPlaceholder: "skill1, skill2",
  functionLabel: "Function",
  description: "Description",
  functionType: "Function Type",
  functionConfig: "Function Config (JSON)",

  // Dialogs
  confirmDelete: (id: string) => `Delete graph "${id}"?`,
  failedToSave: (err: string) => `Failed to save graph: ${err}`,
};

const ko: typeof en = {
  // GraphList
  graphAgents: "그래프 에이전트",
  newGraph: "+ 새 그래프",
  noGraphsYet: "그래프가 없습니다.",
  createOneToStart: "새 그래프를 만들어 시작하세요.",
  nodes: "노드",

  // GraphEditor
  noGraphSelected: "그래프가 선택되지 않았습니다",
  selectOrCreate: "사이드바에서 그래프를 선택하거나 새로 만드세요",
  dragToAdd: "드래그하여 추가",
  inputNode: "입력",
  router: "라우터",
  agent: "에이전트",
  outputNode: "출력",

  // App topbar
  graphLabel: "그래프:",
  yaml: "YAML",
  backToGraph: "← 그래프",
  save: "저장*",
  saved: "저장됨",
  saving: "...",
  debug: "디버그",

  // NodeConfigPanel
  nodeConfig: "노드 설정",
  nodeId: "노드 ID",
  name: "이름",
  modelOptional: "모델 (선택사항)",
  modelPlaceholder: "gpt-4o (그래프에서 상속)",
  systemPrompt: "시스템 프롬프트",
  outputKey: "출력 키",
  routes: "라우트",
  route: "라우트",
  matchValue: "매치 값",
  matchPlaceholder: "예: smart_home 또는 * (기본값)",
  nextNodeIds: "다음 노드 ID (쉼표로 구분)",
  executionMode: "실행 모드",
  sequential: "순차",
  parallel: "병렬 ∥",
  addRoute: "+ 라우트 추가",
  functions: "함수",
  addFunction: "+ 함수 추가",
  skills: "스킬",
  skillsPlaceholder: "skill1, skill2",
  functionLabel: "함수",
  description: "설명",
  functionType: "함수 유형",
  functionConfig: "함수 설정 (JSON)",

  // Dialogs
  confirmDelete: (id: string) => `"${id}" 그래프를 삭제하시겠습니까?`,
  failedToSave: (err: string) => `그래프 저장 실패: ${err}`,
};

export type Translations = typeof en;

export function getTranslations(language: string): Translations {
  return language.startsWith("ko") ? ko : en;
}

export { en as defaultTranslations };
