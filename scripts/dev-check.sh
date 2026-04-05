#!/bin/bash
# dev-check.sh — Claude Code가 코드 수정 후 실행하는 원샷 검증 스크립트
#
# 사용법:
#   scripts/dev-check.sh          # 전체 (빌드+pytest+HA재시작+스모크)
#   scripts/dev-check.sh quick    # pytest만 (HA 재시작 없이)
#   scripts/dev-check.sh ha       # HA 재시작 + 스모크만
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEV_DIR="$PROJECT_DIR/dev"
FRONTEND_DIR="$PROJECT_DIR/frontend"
MODE="${1:-full}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }
info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

echo "========================================"
echo " dev-check ($MODE)"
echo "========================================"

# ── Layer 1: 문법 체크 ──
info "Python 문법 체크..."
find "$PROJECT_DIR/custom_components" -name "*.py" | while read f; do
    python3 -m py_compile "$f" 2>&1 || fail "문법 에러: $f"
done
pass "Python 문법"

# ── Layer 2: pytest ──
info "pytest 실행..."
cd "$PROJECT_DIR"
source .venv/bin/activate 2>/dev/null || true
python3 -m pytest tests/ -x -q 2>&1
PYTEST_EXIT=$?
if [ $PYTEST_EXIT -ne 0 ]; then
    fail "pytest 실패 (exit code: $PYTEST_EXIT)"
fi
pass "pytest"

if [ "$MODE" = "quick" ]; then
    echo ""
    pass "quick 모드 완료"
    exit 0
fi

# ── Layer 3: 프론트엔드 빌드 ──
if [ -d "$FRONTEND_DIR" ]; then
    info "프론트엔드 빌드..."
    cd "$FRONTEND_DIR"
    npm run build 2>&1 | tail -3
    if [ $? -ne 0 ]; then
        fail "프론트엔드 빌드 실패"
    fi
    pass "프론트엔드 빌드"
fi

if [ "$MODE" = "build" ]; then
    echo ""
    pass "build 모드 완료"
    exit 0
fi

# ── Layer 4: HA 컨테이너 재시작 ──
info "HA 컨테이너 재시작..."
cd "$DEV_DIR"

if ! docker compose ps --format json 2>/dev/null | grep -q "ha-dev"; then
    info "HA 컨테이너가 없음. 시작합니다..."
    docker compose up -d 2>&1
    info "초기 부팅 대기 (60초)..."
    sleep 60
    info "초기 셋업 실행..."
    bash "$DEV_DIR/setup.sh"
else
    docker compose restart 2>&1
    info "HA 재시작 대기 (30초)..."
    sleep 30
fi

# HA 상태 확인
for i in $(seq 1 30); do
    if curl -s http://localhost:8123/api/ > /dev/null 2>&1; then
        pass "HA 응답 확인"
        break
    fi
    if [ $i -eq 30 ]; then
        fail "HA가 30초 내에 응답하지 않음"
    fi
    sleep 1
done

# ── Layer 5: 로그 에러 확인 ──
info "HA 로그 에러 확인..."
ERROR_LINES=$(docker logs ha-dev --since 60s 2>&1 | grep -i "error.*extended_graph_agents" || true)
if [ -n "$ERROR_LINES" ]; then
    echo "$ERROR_LINES"
    fail "HA 로그에서 컴포넌트 에러 발견"
fi
pass "HA 로그 정상"

# ── Layer 6: WebSocket 스모크 테스트 ──
info "WebSocket 스모크 테스트..."
cd "$PROJECT_DIR"
python3 scripts/ws_smoke_test.py 2>&1
if [ $? -ne 0 ]; then
    fail "스모크 테스트 실패"
fi

echo ""
echo "========================================"
pass "전체 검증 완료!"
echo "========================================"
