# Extended Graph Agents

LangGraph에서 영감을 받은 **그래프 기반 멀티 에이전트** Home Assistant 커스텀 컴포넌트입니다.
React Flow 기반의 시각적 편집기로 AI 에이전트 워크플로우를 드래그&드롭으로 구성할 수 있습니다.

## 주요 기능

- **시각적 그래프 편집기**: HA 사이드바에서 노드를 드래그&드롭으로 연결
- **라우터 노드**: LLM 구조화 출력으로 다음 경로를 결정 (순차 또는 병렬 실행 지원)
- **에이전트 노드**: Functions를 갖춘 LLM 에이전트 (툴 호출 루프 자동 처리)
- **다양한 Function 타입**: HA 서비스 호출, Jinja2 템플릿, 스크립트, 웹 요청, Bash, 파일 I/O, SQLite
- **자동 대화 에이전트 등록**: 그래프 저장 시 HA 대화 에이전트로 자동 등록
- **자동화/주기적 실행**: `run_graph` HA 서비스로 HA 자동화와 연동하여 그래프를 스케줄 실행
- **모델 파라미터 설정**: 그래프 전역 / 노드별 temperature, top_p, max_tokens, reasoning_effort 오버라이드
- **한국어 UI 지원**: HA 언어 설정에 따라 UI 자동 전환

---

## 설치

### HACS (권장)

1. HACS → 우측 상단 메뉴 → **사용자 정의 저장소**
2. URL: `https://github.com/Lemon-HACS/extended_graph_agents`, 카테고리: **통합**
3. HACS에서 "Extended Graph Agents" 검색 후 설치
4. Home Assistant 재시작

### 수동 설치

1. `custom_components/extended_graph_agents/` 폴더를 HA의 `config/custom_components/`에 복사
2. Home Assistant 재시작

### 초기 설정

1. **설정 → 기기 및 서비스 → 통합 추가**에서 "Extended Graph Agents" 검색
2. OpenAI API 키 입력 (OpenAI 호환 엔드포인트도 지원)
3. 설치 완료 → 사이드바에 **Graph Agents** 패널 자동 등록

---

## 그래프 만들기 (UI 사용)

### 1단계: 그래프 생성

HA 사이드바의 **Graph Agents** 패널로 이동 후 **+ 새 그래프** 클릭.

### 2단계: 노드 추가

캔버스 좌측 상단 팔레트에서 노드를 **드래그하여 캔버스에 드롭**합니다.

| 노드 타입 | 아이콘 | 용도 |
|-----------|--------|------|
| **라우터** | 🔀 | 사용자 입력을 분석해 다음 경로 결정 |
| **에이전트** | 🤖 | 실제 작업을 수행하는 LLM 에이전트 |

> **시작 노드**: 가장 먼저 추가한 노드가 실행 시작점이 됩니다.

### 3단계: 노드 연결

노드 우측의 **핸들(작은 점)**을 드래그하여 다음 노드와 연결합니다.

**엣지(연결선) 종류:**

| 엣지 스타일 | 의미 |
|------------|------|
| 파란/노란 실선 + 라벨 | 라우터 → 다음 노드 (match 값 표시) |
| 회색 점선 | 일반 노드 → 다음 노드 (Fan-in 연결) |

### 4단계: 노드 설정

노드를 클릭하면 우측에 설정 패널이 열립니다.

**에이전트 노드 설정:**
- **이름**: 노드 식별용 표시 이름
- **모델**: 이 노드에서 사용할 모델 (비워두면 그래프 기본 모델 사용)
- **시스템 프롬프트**: LLM에게 전달할 지시사항 (Jinja2 템플릿 사용 가능)
- **FUNCTIONS**: LLM이 호출할 수 있는 도구 목록
- **SKILLS**: 스킬 이름 목록 (쉼표로 구분)

**라우터 노드 설정:**
- **시스템 프롬프트**: 라우팅 결정을 위한 지시사항
- **출력 키**: LLM 응답 JSON에서 라우팅에 사용할 키 이름 (예: `intent`)
- **라우트**: 캔버스에서 라우터와 다음 노드를 **연결선으로 이어서** 추가합니다.
  연결 후 해당 **연결선(엣지)을 클릭**하면 설정 패널이 열립니다:
  - **매치 값**: 라우팅 조건 값 (`*`는 기본/fallback)
  - **실행 모드**: 순차 (순서대로) 또는 병렬 (동시에)

> **Tip**: 라우터 노드를 클릭하면 현재 연결된 라우트 목록에서 매치 값과 실행 모드를 바로 편집할 수 있습니다.

### 5단계: 저장

상단 **저장** 버튼 클릭 → 자동으로 HA 대화 에이전트로 등록됩니다.

---

## 그래프 만들기 (YAML 직접 편집)

그래프 편집기 상단의 **YAML** 버튼으로 현재 그래프의 YAML을 확인하거나,
`config/extended_graph_agents/graphs/` 폴더에 `.yaml` 파일을 직접 만들 수 있습니다.

### 기본 구조

```yaml
id: my_graph           # 고유 ID (파일명과 일치해야 함)
name: 내 그래프        # 표시 이름
description: 설명      # 선택사항
model: gpt-4o          # 기본 모델 (노드에서 개별 오버라이드 가능)

nodes:
  - id: 첫번째_노드    # ← 이 노드가 실행 시작점
    type: router | regular
    # ...
```

---

## 노드 타입 상세

### 🔀 라우터 노드

LLM이 구조화된 JSON으로 답변하고, 그 값에 따라 다음 노드를 결정합니다.

```yaml
- id: classifier
  type: router
  name: 의도 분류기
  model: gpt-4o-mini    # 라우터는 가벼운 모델로도 충분
  prompt: |
    사용자의 요청을 분류하세요.
    요청: {{ user_input }}
  output_key: intent    # LLM이 반환할 JSON의 키 이름
  routes:
    - match: smart_home   # output_key 값이 "smart_home"이면
      next: [home_agent]  # home_agent 실행
      mode: sequential
    - match: research
      next: [web_agent, db_agent]  # 두 노드 동시 실행
      mode: parallel
    - match: "*"          # 위에 해당 없으면 기본 경로
      next: [general_agent]
```

**동작 원리**: 프롬프트를 받은 LLM이 `{"intent": "smart_home"}` 형태의 JSON을 반환하고,
`output_key`인 `intent`의 값으로 라우트를 매칭합니다.

---

### 🤖 에이전트 노드

Functions를 사용해 실제 작업을 수행하는 LLM 에이전트입니다.
툴 호출 → 결과 수신 → 추가 툴 호출 루프를 자동으로 처리합니다 (최대 10회).

```yaml
- id: home_agent
  type: regular
  name: 스마트홈 에이전트
  model: gpt-4o         # 선택사항
  prompt: |
    당신은 스마트홈 제어 어시스턴트입니다.
    사용자 요청: {{ user_input }}
    이전 분석 결과: {{ node_outputs.classifier }}
  functions:
    - spec:             # OpenAI function calling 형식
        name: turn_on_light
        description: 지정한 조명을 켭니다
        parameters:
          type: object
          properties:
            entity_id:
              type: string
              description: 조명 엔티티 ID (예: light.living_room)
          required: [entity_id]
      function:         # 실제 실행 설정
        type: native
        service: light.turn_on
        data:
          entity_id: "{{ entity_id }}"
```

---

## 프롬프트 템플릿 변수

모든 노드의 프롬프트는 **Jinja2 템플릿**이며, 다음 변수를 사용할 수 있습니다:

| 변수 | 설명 |
|------|------|
| `{{ user_input }}` | 사용자의 원본 입력 |
| `{{ node_outputs.노드ID }}` | 특정 노드의 출력 텍스트 |
| `{{ variables.키이름 }}` | 라우터가 설정한 변수 (output_key 값 등) |
| `{{ language }}` | 사용자 언어 코드 (예: `ko`) |
| `{{ state.node_outputs }}` | 전체 노드 출력 딕셔너리 |

---

## Function 타입 상세

### `native` — HA 서비스 호출

```yaml
function:
  type: native
  service: light.turn_on          # domain.service 형식
  data:
    entity_id: "{{ entity_id }}"  # LLM 인수를 Jinja2로 참조
    brightness: 200               # 고정값도 가능
```

`data`에 정의되지 않은 LLM 인수는 서비스 데이터에 자동으로 추가됩니다.

---

### `template` — Jinja2 템플릿 실행

HA 상태값을 조회하거나 계산 결과를 반환할 때 유용합니다.

```yaml
function:
  type: template
  value_template: >
    현재 거실 온도: {{ states('sensor.living_room_temperature') }}°C,
    습도: {{ states('sensor.living_room_humidity') }}%
```

LLM 인수는 템플릿 내에서 직접 변수로 사용할 수 있습니다.

---

### `script` — HA 스크립트 시퀀스

HA 스크립트의 `sequence` 형식을 직접 실행합니다.

```yaml
function:
  type: script
  sequence:
    - service: light.turn_on
      target:
        entity_id: light.living_room
    - delay:
        seconds: 2
    - service: light.turn_off
      target:
        entity_id: light.living_room
```

---

### `web` — HTTP 요청 / 웹 스크래핑

```yaml
function:
  type: web
  url: "https://api.example.com/data/{{ item_id }}"  # Jinja2 템플릿 지원
  method: GET          # GET, POST, PUT 등 (기본: GET)
  headers:
    Authorization: "Bearer my-token"
  payload:             # POST 시 JSON body (선택사항)
    key: value
```

HTML 응답은 태그가 자동으로 제거됩니다. 최대 32,000자까지 반환합니다.

---

### `bash` — 셸 명령 실행

```yaml
function:
  type: bash
  command: "df -h /data"   # 고정 명령
```

LLM이 `command` 인수를 동적으로 결정하게 할 수도 있습니다 (spec에 `command` 파라미터 추가).

> **보안 제한**: `rm -rf`, `mkfs`, `dd if=`, `shutdown`, `reboot` 등 위험 패턴은 차단됩니다.
> 타임아웃 30초, 출력 최대 10,000자.

---

### `file` — 파일 읽기/쓰기

워크스페이스: `config/extended_graph_agents/` (이 경로 밖으로 접근 불가)

```yaml
function:
  type: file
  operation: read      # read | write | append (LLM이 결정하거나 고정)
  path: "notes.txt"    # 워크스페이스 내 상대 경로
```

---

### `sqlite` — SQLite 쿼리

기본값으로 HA의 `home-assistant_v2.db`를 조회합니다.

```yaml
function:
  type: sqlite
  db_path: "/config/home-assistant_v2.db"  # 선택사항 (기본값)
  allow_write: false   # true로 설정하면 INSERT/UPDATE 허용
```

LLM이 `query` 인수로 SQL을 전달합니다. 기본적으로 SELECT/WITH/EXPLAIN만 허용, 최대 100행 반환.

---

## 예시: 스마트홈 멀티 에이전트

의도를 분류한 뒤 스마트홈 제어 또는 일반 대화로 분기하는 그래프입니다.

```yaml
id: smart_home_assistant
name: 스마트홈 어시스턴트
model: gpt-4o

nodes:
  - id: classifier
    type: router
    name: 의도 분류기
    model: gpt-4o-mini
    prompt: |
      다음 사용자 요청을 분류하세요.
      - smart_home: 기기 제어, 조명, 온도, 잠금장치 등 집 관련
      - general: 그 외 일반 대화나 질문
      요청: {{ user_input }}
    output_key: intent
    routes:
      - match: smart_home
        next: [home_agent]
        mode: sequential
      - match: "*"
        next: [general_agent]

  - id: home_agent
    type: regular
    name: 스마트홈 제어
    prompt: |
      당신은 스마트홈 제어 어시스턴트입니다.
      사용자 요청: {{ user_input }}
    functions:
      - spec:
          name: control_light
          description: 조명을 켜거나 끕니다
          parameters:
            type: object
            properties:
              entity_id:
                type: string
                description: 조명 엔티티 ID
              action:
                type: string
                enum: [turn_on, turn_off]
            required: [entity_id, action]
        function:
          type: native
          service: "light.{{ action }}"
          data:
            entity_id: "{{ entity_id }}"
      - spec:
          name: get_sensor
          description: 센서 값을 읽어옵니다
          parameters:
            type: object
            properties:
              entity_id:
                type: string
                description: 센서 엔티티 ID
            required: [entity_id]
        function:
          type: template
          value_template: "{{ states(entity_id) }} {{ state_attr(entity_id, 'unit_of_measurement') }}"
    skills: []

  - id: general_agent
    type: regular
    name: 일반 어시스턴트
    prompt: "당신은 친절한 어시스턴트입니다. 사용자: {{ user_input }}"
    functions: []
    skills: []
```

---

## 예시: 병렬 조사 후 종합

여러 에이전트가 동시에 조사하고 마지막 에이전트가 결과를 종합하는 그래프입니다.

```yaml
id: research_agent
name: 리서치 에이전트
model: gpt-4o

nodes:
  - id: dispatcher
    type: router
    prompt: "항상 'go'를 반환하세요."
    output_key: task
    routes:
      - match: "*"
        next: [web_researcher, db_researcher]
        mode: parallel   # 두 노드 동시 실행

  - id: web_researcher
    type: regular
    name: 웹 조사
    prompt: "다음을 웹에서 조사하세요: {{ user_input }}"
    functions:
      - spec:
          name: fetch_url
          description: 웹 페이지에서 정보를 가져옵니다
          parameters:
            type: object
            properties:
              url:
                type: string
                description: 조회할 URL
            required: [url]
        function:
          type: web
          url: "{{ url }}"
    skills: []

  - id: db_researcher
    type: regular
    name: DB 조사
    prompt: "HA 이력 DB에서 관련 데이터를 조회하세요: {{ user_input }}"
    functions:
      - spec:
          name: query_ha
          description: Home Assistant DB를 SQL로 쿼리합니다
          parameters:
            type: object
            properties:
              query:
                type: string
                description: SQL SELECT 쿼리
            required: [query]
        function:
          type: sqlite
    skills: []

  - id: summarizer
    type: regular
    name: 종합 정리
    prompt: |
      다음 조사 결과를 종합해 사용자에게 명확하게 답변하세요.

      사용자 질문: {{ user_input }}
      웹 조사 결과: {{ node_outputs.web_researcher }}
      DB 조회 결과: {{ node_outputs.db_researcher }}
    functions: []
    skills: []
```

> `web_researcher`와 `db_researcher`가 병렬로 실행된 후 자동으로 `summarizer`가 실행됩니다.
> 이전 노드들의 출력은 `{{ node_outputs.노드ID }}`로 참조할 수 있습니다.

---

## Fan-in (병렬 브랜치 합류)

병렬로 실행된 여러 에이전트의 결과를 **하나의 노드에서 합치는** 패턴입니다.

### 동작 원리

```
Router → [AgentA, AgentB]  병렬 실행
  AgentA ─┐
           ├─→ MergeAgent  한 번만 실행 (join/barrier)
  AgentB ─┘
```

- Router가 `mode: parallel`로 `AgentA`, `AgentB`를 동시에 실행합니다.
- 각 에이전트 노드에서 **일반 노드 → MergeAgent** 방향으로 엣지를 연결합니다.
- 두 에이전트가 모두 완료된 후, `MergeAgent`가 **한 번만** 실행됩니다.
- `MergeAgent`의 프롬프트에서 `{{ node_outputs.AgentA }}`와 `{{ node_outputs.AgentB }}`로 두 결과를 모두 참조할 수 있습니다.

### UI에서 연결하기

1. Router 노드에서 AgentA, AgentB로 엣지 연결 → 라우트 설정에서 `mode: parallel` 선택
2. AgentA 노드 우측 핸들에서 MergeAgent로 드래그 (회색 점선 엣지로 표시됨)
3. AgentB 노드 우측 핸들에서 MergeAgent로 드래그 (회색 점선 엣지로 표시됨)

### YAML 예시

```yaml
nodes:
  - id: dispatcher
    type: router
    prompt: "항상 'go'를 반환하세요."
    output_key: task
    routes:
      - match: "*"
        next: [agent_a, agent_b]
        mode: parallel    # 두 노드 동시 실행

  - id: agent_a
    type: regular
    name: 에이전트 A
    prompt: "A 관점에서 분석하세요: {{ user_input }}"
    next: [merger]        # Fan-in 대상 지정
    functions: []

  - id: agent_b
    type: regular
    name: 에이전트 B
    prompt: "B 관점에서 분석하세요: {{ user_input }}"
    next: [merger]        # 동일한 합류 노드를 가리킴
    functions: []

  - id: merger
    type: regular
    name: 결과 종합
    prompt: |
      두 에이전트의 분석을 종합하세요.
      A의 분석: {{ node_outputs.agent_a }}
      B의 분석: {{ node_outputs.agent_b }}
    functions: []
```

> **주의**: 여러 병렬 브랜치가 같은 노드를 가리키면 해당 노드는 **한 번만** 실행됩니다.
> 모든 병렬 브랜치 완료 후 `state.node_outputs`에 전체 결과가 누적되므로, 합류 노드에서 자유롭게 참조할 수 있습니다.

---

## 모델 파라미터 설정

그래프 전역 기본값을 설정하고, 특정 노드에서 개별적으로 오버라이드할 수 있습니다.

### 그래프 설정 패널 (⚙️)

상단바의 **⚙️ 아이콘**을 클릭하면 그래프 전역 설정을 열 수 있습니다.

| 설정 | 설명 |
|------|------|
| **기본 모델** | 노드에서 모델을 지정하지 않으면 사용할 기본 모델 |
| **모델 파라미터** | 전체 노드에 적용될 기본 temperature, top_p, max_tokens, reasoning_effort |
| **시스템 프롬프트 접두사** | 모든 노드의 시스템 프롬프트 앞에 자동으로 추가되는 텍스트 |
| **기본 최대 도구 반복 횟수** | 에이전트 노드의 툴 호출 루프 최대 횟수 (기본값: 10) |

### 노드 설정 패널

노드를 클릭하면 우측 설정 패널에서 해당 노드만의 모델과 파라미터를 오버라이드할 수 있습니다.
체크박스를 선택한 파라미터만 오버라이드되며, 비워두면 그래프 전역값을 따릅니다.

### YAML 직접 설정

```yaml
id: my_graph
name: 내 그래프
model: gpt-4.1
model_params:
  temperature: 0.7       # 그래프 기본값
  max_tokens: 4096
system_prompt_prefix: |
  당신은 스마트홈 전문가입니다.
  항상 한국어로 응답하세요.
max_tool_iterations: 5   # 기본값: 10

nodes:
  - id: creative_agent
    type: regular
    name: 창의적 에이전트
    model_params:
      temperature: 1.5   # 이 노드만 오버라이드
    prompt: "..."
```

**우선순위**: 노드 파라미터 > 그래프 파라미터

---

## 자동화 / 주기적 실행

그래프를 대화 에이전트 외에도 **HA 자동화**에서 직접 실행할 수 있습니다.

### `run_graph` 서비스

```yaml
service: extended_graph_agents.run_graph
data:
  graph_id: "내_그래프_id"   # 필수
  input: ""                  # 선택사항, 기본값 ""
```

실행이 끝나면 `extended_graph_agents_execution_finished` 이벤트가 발화됩니다:

```yaml
event_data:
  graph_id: "내_그래프_id"
  user_input: ""
  output: "그래프 실행 결과 텍스트"
  error: null              # 오류 발생 시 오류 메시지
  trace: [...]             # 노드별 실행 트레이스
```

### 예시: 매 1시간마다 실행

```yaml
alias: 정기 상태 점검
trigger:
  - platform: time_pattern
    hours: "/1"
action:
  - service: extended_graph_agents.run_graph
    data:
      graph_id: "status_check_graph"
      input: ""
```

### 예시: 실행 결과를 모바일 앱으로 알림

```yaml
alias: 그래프 결과 알림
trigger:
  - platform: event
    event_type: extended_graph_agents_execution_finished
    event_data:
      graph_id: "status_check_graph"
condition:
  - condition: template
    value_template: "{{ trigger.event.data.error == none }}"
action:
  - service: notify.mobile_app_내폰
    data:
      title: "그래프 실행 완료"
      message: "{{ trigger.event.data.output }}"
```

### 예시: 특정 센서 상태 변화 시 실행

```yaml
alias: 온도 이상 감지 시 그래프 실행
trigger:
  - platform: numeric_state
    entity_id: sensor.living_room_temperature
    above: 30
action:
  - service: extended_graph_agents.run_graph
    data:
      graph_id: "temperature_alert_graph"
      input: "거실 온도가 {{ states('sensor.living_room_temperature') }}°C입니다."
```

---

## 대화 에이전트로 사용하기

그래프를 저장하면 자동으로 HA 대화 에이전트로 등록됩니다.

**음성 어시스턴트에 연결:**

1. **설정 → 음성 어시스턴트** (또는 **설정 → 대화**)
2. 사용할 어시스턴트의 **대화 에이전트**를 그래프 이름으로 선택

**자동화에서 사용:**

```yaml
action:
  - service: conversation.process
    data:
      agent_id: conversation.스마트홈_어시스턴트
      text: "거실 불 꺼줘"
```

---

## 개발자용: 프론트엔드 빌드

```bash
cd frontend
npm install
npm run build
```

빌드 결과는 `custom_components/extended_graph_agents/www/panel.js`에 저장됩니다.

---

## 변경 이력

### v1.0.39
- **`run_graph` HA 서비스 추가**: HA 자동화에서 그래프를 직접 실행 가능
  - `graph_id` (필수), `input` (선택) 파라미터 지원
  - 실행 완료 시 `extended_graph_agents_execution_finished` 이벤트 발화 (output, error, trace 포함)
  - `services.yaml` 추가로 HA 개발자 도구 UI에서 서비스 설명 표시

### v1.0.38
- **모델 파라미터 계층 설정**: 그래프 전역 기본값 + 노드별 오버라이드 지원
  - 그래프 설정 패널: 기본 모델 프리셋 버튼, model_params, system_prompt_prefix, max_tool_iterations 추가
  - 노드 설정 패널: 모델 프리셋 버튼, 노드별 model_params 오버라이드 편집기 추가
  - 지원 파라미터: temperature, top_p, max_tokens, reasoning_effort
- **Router 에러 처리 개선**: 빈 응답 및 유효하지 않은 라우트 값에 대한 명확한 에러 메시지

### v1.0.28
- **Fan-in 엣지 UI 개선**: 엣지(연결선) 종류를 시각적으로 구분
  - 라우터 출발 엣지: 파란/노란 실선 + match 라벨 (기존 동작 유지)
  - 일반 노드 출발 엣지 (Fan-in): 회색 점선, 라벨 없음

### v1.0.27
- **Fan-in (Join/Barrier) 로직 구현**: 병렬 브랜치가 같은 노드를 가리키면 한 번만 실행
  - 일반 에이전트 노드에서 다음 노드(`next`) 지정 가능
  - 여러 병렬 브랜치 완료 후 합류 노드가 모든 결과를 컨텍스트로 받아 실행

### v1.0.26
- 노드 삭제 버튼 및 `Delete` 키 단축키 추가

### v1.0.25
- Add Data Field 버그 수정 및 함수 에디터 번역 보완

### v1.0.24
- 함수 에디터 한글 i18n 및 사용 가이드 추가

### v1.0.23
- **함수 비주얼 에디터**: JSON 직접 편집 대신 타입별 폼 UI 제공
  - 파라미터 에디터: 이름/타입/설명/필수 여부/enum 값 리스트로 편집
  - `native`: service + data key-value 에디터
  - `template`: value_template textarea
  - `web`: url, method select, headers key-value
  - `bash`: command textarea
  - `file`: operation select + path
  - `sqlite`: db_path + allow_write 토글
  - `script`: sequence JSON textarea (복잡한 구조 유지)

### v1.0.22
- 사이드바 스킬 탭이 표시되지 않던 레이아웃 버그 수정 (GraphList/SkillsPanel 고정 너비 제거)

### v1.0.21
- **스킬 시스템 추가**: 재사용 가능한 함수 묶음을 스킬로 등록하여 여러 에이전트에서 공유
  - 사이드바에 그래프/스킬 탭 전환 UI 추가
  - 스킬 편집기: Visual 뷰 (폼 기반) + YAML 뷰 동시 지원
  - 그룹별 분류 기능
  - 에이전트 노드 설정에서 드롭다운으로 스킬 선택
  - 실행 시 스킬 함수가 에이전트 함수 목록에 자동 병합 (인라인 함수 우선)

### v1.0.20
- 노드 ID 및 그래프 ID를 UUIDv4로 자동 생성 (수동 편집 불가)
- 라우터 엣지 match 값 입력을 노드 선택 드롭다운으로 변경
- 엣지 라벨에서 노드 ID 대신 노드 이름으로 표시

### v1.0.19
- 라우터/엣지 설정 UX 개선

### v1.0.18
- 명시적 입력/출력 노드 추가
