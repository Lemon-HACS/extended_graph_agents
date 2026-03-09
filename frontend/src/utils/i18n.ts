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

  // EdgeConfigPanel
  edgeConfig: "Edge Config",
  edgeFrom: "From",
  edgeTo: "To",
  deleteEdge: "Delete Edge",
  connectInCanvas: "Draw connections in the canvas to add routes",

  // Dialogs
  confirmDelete: (id: string) => `Delete graph "${id}"?`,
  failedToSave: (err: string) => `Failed to save graph: ${err}`,

  // Sidebar tabs
  graphsTab: "Graphs",
  skillsTab: "Skills",

  // SkillsPanel
  newSkill: "+ New Skill",
  noSkillsYet: "No skills yet.",
  ungrouped: "Ungrouped",
  skillName: "Skill Name",
  skillGroup: "Group",
  skillDescription: "Description",
  saveSkill: "Save Skill",
  deleteSkill: "Delete",
  visualTab: "Visual",
  yamlTab: "YAML",
  applyYaml: "Apply YAML",
  confirmDeleteSkill: (name: string) => `Delete skill "${name}"?`,
  failedToSaveSkill: (err: string) => `Failed to save skill: ${err}`,

  // FunctionEditor - common
  parameters: "Parameters",
  addParameter: "+ Add Parameter",
  paramNamePlaceholder: "param_name",
  paramDescPlaceholder: "Parameter description",
  paramRequired: "required",
  enumValuesPlaceholder: 'enum values (comma separated, e.g. "on, off")',
  addDataField: "+ Add Data Field",
  addHeader: "+ Add Header",
  allowWrite: "Allow Write (INSERT / UPDATE / DELETE)",
  sequenceJson: "Sequence (JSON)",

  // FunctionEditor - field labels
  nativeService: "Service",
  nativeData: "Data (key → Jinja2 value)",
  webUrl: "URL",
  webMethod: "Method",
  webHeaders: "Headers",
  fileOperation: "Operation",
  filePath: "Path",
  sqliteDbPath: "DB Path",

  // FunctionEditor - type usage descriptions
  nativeUsage: "Calls a Home Assistant service. Use for controlling lights, switches, media players, etc.",
  templateUsage: "Returns a Jinja2-rendered value. Use for reading sensor states, computing values, or formatting strings.",
  webUsage: "Makes an HTTP request to an external API. Use for fetching weather data, calling REST APIs, webhooks, etc.",
  bashUsage: "Runs a shell command on the HA host. Use for file management, system info, or custom scripts.",
  fileUsage: "Reads or writes a file on the HA host. Use for persistent notes, logs, or configuration data.",
  sqliteUsage: "Executes an SQL query on a SQLite database. Use for reading HA history or custom data tables.",
  scriptUsage: "Runs a Home Assistant script sequence (YAML action list). Use for multi-step automations.",
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

  // EdgeConfigPanel
  edgeConfig: "엣지 설정",
  edgeFrom: "출발",
  edgeTo: "도착",
  deleteEdge: "엣지 삭제",
  connectInCanvas: "캔버스에서 노드를 연결하여 라우트를 추가하세요",

  // Dialogs
  confirmDelete: (id: string) => `"${id}" 그래프를 삭제하시겠습니까?`,
  failedToSave: (err: string) => `그래프 저장 실패: ${err}`,

  // Sidebar tabs
  graphsTab: "그래프",
  skillsTab: "스킬",

  // SkillsPanel
  newSkill: "+ 새 스킬",
  noSkillsYet: "스킬이 없습니다.",
  ungrouped: "미분류",
  skillName: "스킬 이름",
  skillGroup: "그룹",
  skillDescription: "설명",
  saveSkill: "스킬 저장",
  deleteSkill: "삭제",
  visualTab: "비주얼",
  yamlTab: "YAML",
  applyYaml: "YAML 적용",
  confirmDeleteSkill: (name: string) => `"${name}" 스킬을 삭제하시겠습니까?`,
  failedToSaveSkill: (err: string) => `스킬 저장 실패: ${err}`,

  // FunctionEditor - common
  parameters: "파라미터",
  addParameter: "+ 파라미터 추가",
  paramNamePlaceholder: "파라미터명",
  paramDescPlaceholder: "파라미터 설명",
  paramRequired: "필수",
  enumValuesPlaceholder: '열거값 (쉼표 구분, 예: "on, off")',
  addDataField: "+ 데이터 필드 추가",
  addHeader: "+ 헤더 추가",
  allowWrite: "쓰기 허용 (INSERT / UPDATE / DELETE)",
  sequenceJson: "시퀀스 (JSON)",

  // FunctionEditor - field labels
  nativeService: "서비스",
  nativeData: "데이터 (키 → Jinja2 값)",
  webUrl: "URL",
  webMethod: "메서드",
  webHeaders: "헤더",
  fileOperation: "동작",
  filePath: "경로",
  sqliteDbPath: "DB 경로",

  // FunctionEditor - type usage descriptions
  nativeUsage: "HA 서비스를 호출합니다. 조명 제어, 스위치 토글, 미디어 플레이어 등에 사용하세요.",
  templateUsage: "Jinja2 템플릿으로 값을 반환합니다. 센서 상태 읽기, 값 계산, 문자열 포매팅 등에 사용하세요.",
  webUsage: "외부 API에 HTTP 요청을 보냅니다. 날씨 API, REST 서비스 호출, 웹훅 등에 사용하세요.",
  bashUsage: "HA 호스트에서 쉘 명령어를 실행합니다. 파일 관리, 시스템 정보 조회, 커스텀 스크립트 등에 사용하세요.",
  fileUsage: "HA 호스트의 파일을 읽거나 씁니다. 메모 저장, 로그 기록, 설정 파일 관리 등에 사용하세요.",
  sqliteUsage: "SQLite DB에 SQL 쿼리를 실행합니다. HA 히스토리 조회나 커스텀 데이터 테이블 접근 등에 사용하세요.",
  scriptUsage: "HA 스크립트 시퀀스(YAML 액션 목록)를 실행합니다. 여러 단계의 자동화에 사용하세요.",
};

export type Translations = typeof en;

export function getTranslations(language: string): Translations {
  return language.startsWith("ko") ? ko : en;
}

export { en as defaultTranslations };
