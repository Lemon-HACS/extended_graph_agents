# Extended Graph Agents

LangGraph에서 영감을 받은 그래프 기반 대화 에이전트 Home Assistant 커스텀 컴포넌트입니다. React Flow UI로 워크플로우를 시각적으로 편집할 수 있습니다.

## 주요 기능

- **그래프 기반 대화 라우팅**: YAML 형식으로 멀티 에이전트 워크플로우 정의
- **라우터 노드**: LLM의 구조화된 출력으로 다음 경로 결정 (순차 또는 병렬 실행)
- **일반 노드**: functions/skills를 미리 등록해 사용하는 LLM 에이전트
- **시각적 편집기**: HA 사이드바에서 접근 가능한 React Flow 기반 드래그&드롭 그래프 편집기
- **다양한 function 타입**: HA 서비스 호출, Jinja2 템플릿, 스크립트, 웹 요청, bash, 파일 I/O, SQLite 쿼리

## 설치

### 수동 설치

1. `custom_components/extended_graph_agents/` 폴더를 HA의 `config/custom_components/` 디렉토리에 복사
2. Home Assistant 재시작
3. **설정 → 기기 및 서비스 → 통합 추가**에서 "Extended Graph Agents" 검색
4. OpenAI API 키 (또는 호환 엔드포인트) 입력

### HACS

이 저장소를 HACS 커스텀 저장소 (통합 타입)로 추가한 후 HACS에서 설치합니다.

## 프론트엔드 빌드

프론트엔드는 React + TypeScript + React Flow 앱으로, 단일 `panel.js` 파일로 빌드됩니다.
**별도 Add-on 불필요** — HA가 직접 정적 파일을 서빙합니다.

```bash
cd frontend
npm install
npm run build
```

빌드 결과물은 `custom_components/extended_graph_agents/www/panel.js`에 자동으로 저장됩니다.

## 그래프 만들기

### UI에서 만들기

1. 통합 설치 및 설정 후 HA 사이드바의 **Graph Agents** 패널로 이동
2. **+ New Graph** 클릭
3. 팔레트에서 **Router** 또는 **Agent** 노드를 캔버스로 드래그
4. 노드의 핸들을 드래그해 연결
5. 노드를 클릭해 오른쪽 패널에서 설정
6. **Save** 클릭해 저장

### YAML 파일로 만들기

`config/extended_graph_agents/graphs/` 폴더에 YAML 파일을 추가합니다. 예시:

```yaml
id: smart_home
name: 스마트홈 어시스턴트
description: 스마트홈 제어와 일반 대화를 분기하는 그래프
model: gpt-4o

nodes:
  - id: classify
    type: router
    name: 의도 분류기
    prompt: |
      이 요청을 'smart_home'(기기 제어, 조명 등) 또는 'general'(그 외)로 분류하세요.
      사용자: {{ state.user_input }}
    output_key: intent
    routes:
      - match: smart_home
        next: [smart_home_agent]
        mode: sequential
      - match: "*"
        next: [general_agent]

  - id: smart_home_agent
    type: regular
    name: 스마트홈 에이전트
    prompt: "당신은 스마트홈 기기를 제어하는 어시스턴트입니다. 사용자: {{ state.user_input }}"
    functions:
      - spec:
          name: turn_on_light
          description: 조명 켜기
          parameters:
            type: object
            properties:
              entity_id: {type: string, description: "조명 엔티티 ID"}
            required: [entity_id]
        function:
          type: native
          service: light.turn_on
          data:
            entity_id: "{{ entity_id }}"
    skills: []

  - id: general_agent
    type: regular
    name: 일반 어시스턴트
    prompt: "당신은 친절한 어시스턴트입니다."
    functions: []
    skills: []
```

## 대화 에이전트 설정

1. **설정 → 기기 및 서비스 → Extended Graph Agents**로 이동
2. **서브엔트리 추가** (+ 버튼) 클릭
3. 이름, 모델, 사용할 그래프 ID 선택 (비워두면 첫 번째 그래프 사용)
4. 생성된 대화 에이전트가 HA 음성/대화 설정에 나타남

## Function 타입

| 타입 | 설명 |
|------|------|
| `native` | HA 서비스 호출 (예: `light.turn_on`) |
| `template` | Jinja2 템플릿 렌더링 |
| `script` | HA 스크립트 시퀀스 실행 |
| `web` | HTTP 요청 / 웹 페이지 스크래핑 |
| `bash` | 셸 명령 실행 (안전 제한 적용) |
| `file` | `extended_graph_agents/` 워크스페이스 내 파일 읽기/쓰기 |
| `sqlite` | HA SQLite DB 쿼리 (기본값: SELECT만 허용) |

## 노드 타입 상세

### 라우터 노드 (Router)

LLM이 구조화된 JSON 출력으로 다음 경로를 결정합니다.

- `output_key`: LLM 출력 JSON에서 라우팅에 사용할 키
- `routes`: 각 값에 대한 다음 노드 목록
  - `match`: 매칭할 값 (`"*"`은 기본/fallback)
  - `next`: 다음 노드 ID 목록
  - `mode`: `sequential`(순차) 또는 `parallel`(병렬)

```yaml
- id: my_router
  type: router
  output_key: intent
  routes:
    - match: smart_home
      next: [smart_home_agent]
      mode: sequential
    - match: research
      next: [web_agent, db_agent]   # 두 노드를 동시에 실행
      mode: parallel
    - match: "*"                    # 기본 경로
      next: [general_agent]
```

### 일반 노드 (Regular)

Functions와 Skills를 갖춘 LLM 에이전트입니다. 툴 호출 루프를 내부적으로 처리합니다.

```yaml
- id: my_agent
  type: regular
  model: gpt-4o          # 선택적 모델 오버라이드
  prompt: |
    당신은 스마트홈 어시스턴트입니다.
    사용자: {{ state.user_input }}
    이전 노드 출력: {{ node_outputs }}
  functions:
    - spec:
        name: function_name
        description: 설명
        parameters: {}   # JSON Schema
      function:
        type: native|template|script|web|bash|file|sqlite
        # 타입별 추가 설정
  skills: []
```

## 프롬프트 템플릿 변수

모든 노드의 프롬프트는 Jinja2 템플릿이며 다음 변수를 사용할 수 있습니다:

| 변수 | 설명 |
|------|------|
| `{{ state.user_input }}` | 사용자의 원본 입력 |
| `{{ state.variables }}` | 이전 노드에서 설정한 변수 딕셔너리 |
| `{{ state.node_outputs }}` | 각 노드의 출력 (`{node_id: output_text}`) |
| `{{ node_outputs }}` | `state.node_outputs`의 단축키 |

## 병렬 실행 예시

라우터가 여러 노드를 동시에 실행하고, 이후 노드에서 결과를 종합할 수 있습니다:

```yaml
nodes:
  - id: router
    type: router
    routes:
      - match: "*"
        next: [web_search, db_query]   # 두 노드 병렬 실행
        mode: parallel

  - id: web_search
    type: regular
    prompt: "웹에서 관련 정보를 검색하세요."
    functions: [...]

  - id: db_query
    type: regular
    prompt: "DB에서 관련 데이터를 조회하세요."
    functions: [...]

  # web_search와 db_query 결과 모두 state.node_outputs에서 참조 가능
```
