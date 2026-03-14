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
  tapToAdd: "TAP TO ADD",
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

  // NodeConfigPanel
  nodeConfig: "Node Config",
  deleteNode: "Delete Node",
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
  jsonOutputMode: "JSON Output Mode",
  jsonOutputModeHint: "Forces structured JSON output. Functions are disabled in this mode.",
  outputSchema: "OUTPUT SCHEMA",
  addSchemaField: "+ Add Field",
  schemaFieldKey: "Key",
  schemaFieldType: "Type",
  schemaFieldDesc: "Description (optional)",
  schemaFieldEnum: "Enum values (comma-separated, optional)",

  // PromptField (template helpers)
  jinjaHint: "Jinja2: {{ states('sensor.x') }}, {{ user_input }}, {{ node_outputs['node_id'] }} (raw), {{ variables['node_id.key'] }} (JSON parsed)",
  insertEntity: "Insert Entity",
  previewPrompt: "Preview",
  previewResult: "Preview Result",
  previewError: "Template Error",
  entitySearch: "Search entities...",

  // EdgeConfigPanel
  edgeConfig: "Edge Config",
  edgeFrom: "From",
  edgeTo: "To",
  deleteEdge: "Delete Edge",
  connectInCanvas: "Draw connections in the canvas to add routes",
  conditionVariable: "Condition Variable",
  conditionValue: "Condition Value",
  outputTemplate: "Output Template (optional)",
  outputTemplateHint: "Jinja2 template for final response. Leave blank to use the first incoming node's output.",

  // GraphSettingsPanel
  graphSettings: "Graph Settings",
  defaultModel: "Default Model",
  systemPromptPrefix: "System Prompt Prefix",
  systemPromptPrefixHint: "Prepended to every node's system prompt in this graph.",
  defaultMaxToolIterations: "Default Max Tool Iterations",
  modelParams: "Model Parameters",
  paramTemperature: "Temperature",
  paramTopP: "Top P",
  paramMaxTokens: "Max Tokens",
  paramReasoningEffort: "Reasoning Effort",
  modelPresets: "Presets",

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
  valueTemplate: "value_template",
  functionConfigSection: "Function Config",

  // FunctionEditor - function type display names
  funcTypeNative: "HA Service (native)",
  funcTypeTemplate: "Jinja2 Template (template)",
  funcTypeWeb: "HTTP Request (web)",

  // FunctionEditor - field labels
  nativeService: "Service",
  nativeData: "Data (key → Jinja2 value)",
  webUrl: "URL",
  webMethod: "Method",
  webHeaders: "Headers",

  // FunctionEditor - type usage descriptions
  nativeUsage: "Calls a Home Assistant service. Use for controlling lights, switches, media players, etc.",
  templateUsage: "Returns a Jinja2-rendered value. Use for reading sensor states, computing values, or formatting strings.",
  webUsage: "Makes an HTTP request to an external API. Use for fetching weather data, calling REST APIs, webhooks, etc.",
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
  tapToAdd: "탭하여 추가",
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

  // NodeConfigPanel
  nodeConfig: "노드 설정",
  deleteNode: "노드 삭제",
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
  jsonOutputMode: "JSON 출력 모드",
  jsonOutputModeHint: "LLM 출력을 JSON으로 강제합니다. 이 모드에서는 Functions가 비활성화됩니다.",
  outputSchema: "출력 스키마",
  addSchemaField: "+ 필드 추가",
  schemaFieldKey: "키",
  schemaFieldType: "타입",
  schemaFieldDesc: "설명 (선택)",
  schemaFieldEnum: "Enum 값 (쉼표 구분, 선택)",

  // PromptField (template helpers)
  jinjaHint: "Jinja2: {{ states('sensor.x') }}, {{ user_input }}, {{ node_outputs['노드id'] }} (원본), {{ variables['노드id.키'] }} (JSON 파싱)",
  insertEntity: "엔티티 삽입",
  previewPrompt: "미리보기",
  previewResult: "미리보기 결과",
  previewError: "템플릿 오류",
  entitySearch: "엔티티 검색...",

  // EdgeConfigPanel
  edgeConfig: "엣지 설정",
  edgeFrom: "출발",
  edgeTo: "도착",
  deleteEdge: "엣지 삭제",
  connectInCanvas: "캔버스에서 노드를 연결하여 라우트를 추가하세요",
  conditionVariable: "조건 변수",
  conditionValue: "조건 값",
  outputTemplate: "출력 템플릿 (선택)",
  outputTemplateHint: "최종 응답을 Jinja2 템플릿으로 조합합니다. 비워두면 연결된 첫 번째 노드의 출력을 사용합니다.",

  // GraphSettingsPanel
  graphSettings: "그래프 설정",
  defaultModel: "기본 모델",
  systemPromptPrefix: "시스템 프롬프트 접두사",
  systemPromptPrefixHint: "이 그래프의 모든 노드 시스템 프롬프트 앞에 자동으로 추가됩니다.",
  defaultMaxToolIterations: "기본 최대 도구 반복 횟수",
  modelParams: "모델 파라미터",
  paramTemperature: "Temperature",
  paramTopP: "Top P",
  paramMaxTokens: "Max Tokens",
  paramReasoningEffort: "Reasoning Effort",
  modelPresets: "프리셋",

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
  valueTemplate: "value_template",
  functionConfigSection: "함수 설정",

  // FunctionEditor - function type display names
  funcTypeNative: "HA 서비스 (native)",
  funcTypeTemplate: "Jinja2 템플릿 (template)",
  funcTypeWeb: "HTTP 요청 (web)",

  // FunctionEditor - field labels
  nativeService: "서비스",
  nativeData: "데이터 (키 → Jinja2 값)",
  webUrl: "URL",
  webMethod: "메서드",
  webHeaders: "헤더",

  // FunctionEditor - type usage descriptions
  nativeUsage: "HA 서비스를 호출합니다. 조명 제어, 스위치 토글, 미디어 플레이어 등에 사용하세요.",
  templateUsage: "Jinja2 템플릿으로 값을 반환합니다. 센서 상태 읽기, 값 계산, 문자열 포매팅 등에 사용하세요.",
  webUsage: "외부 API에 HTTP 요청을 보냅니다. 날씨 API, REST 서비스 호출, 웹훅 등에 사용하세요.",
};

export type Translations = typeof en;

export function getTranslations(language: string): Translations {
  return language.startsWith("ko") ? ko : en;
}

export { en as defaultTranslations };
