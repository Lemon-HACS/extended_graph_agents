# Extended Graph Agents - 작업 진행상황

## 개발 환경 세팅
- **상태**: 완료
- **세션**: 2026-04-05 (dev 환경 구축)
- **결과**:
  - Docker dev 환경 (`dev/docker-compose.yml` + fake 엔티티 HA 설정)
  - pytest 프레임워크 (18개 테스트 통과 — graph_loader, graph_state, exceptions)
  - WebSocket 스모크 테스트 스크립트 (`scripts/ws_smoke_test.py`)
  - dev-check 원샷 스크립트 (`scripts/dev-check.sh` — quick/build/full 모드)

## 프로젝트 전면 리팩토링 (대화형 AI 전환)
- **상태**: 진행중 (세션 활성)
- **세션**: 2026-04-05
- **결과**: Phase 1-4 완료

### 완료
- **Phase 1: 새 그래프 포맷** — `graph_v2.py` (LangGraph 스타일, 3 노드 타입, START/END, 인라인 도구, -> 엣지 구문) + 32개 테스트
- **Phase 2: 그래프 엔진 v2** — `engine_v2.py` (새 포맷 실행, dry-run 모드, 병렬 실행) + 8개 테스트
- **Phase 3: WebSocket API v2** — `websocket_api_v2.py` (v2 CRUD, ai_generate, dry-run 지원)
- **Phase 4: 대화형 채팅 UI** — `ChatPanel.tsx` (대화형 메인 인터페이스, 자동 테스트/수정 루프), `types_v2.ts`, `haApiV2.ts`, App.tsx 모드 전환 (chat/advanced), 프론트엔드 빌드 완료
- **v2.0.0: 레거시 전면 제거** — v1 코드 11,700줄 삭제, 번들 538KB→160KB
- **v2.0.1: 핵심 기능 보완** — 그래프 목록/관리 UI (상단 탭), Conversation 플랫폼 v2 (HA Assist 연동)
