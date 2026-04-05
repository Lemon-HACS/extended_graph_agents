#!/bin/bash
# HA 개발 환경 초기 설정 스크립트
# 최초 1회만 실행하면 됨: HA 부팅 → onboarding → integration 등록
set -e

HA_URL="http://localhost:8123"
SECRETS_FILE="/home/lemon/claude-projects/.guides/secrets/.openai.secrets"

# .openai.secrets에서 API 키 읽기
source "$SECRETS_FILE"

echo "=== Extended Graph Agents 개발 환경 셋업 ==="

# 1) HA가 올라올 때까지 대기
echo "[1/4] HA 부팅 대기 중..."
for i in $(seq 1 60); do
    if curl -s "$HA_URL/api/" > /dev/null 2>&1; then
        echo "  HA 응답 확인!"
        break
    fi
    if [ $i -eq 60 ]; then
        echo "  ERROR: HA가 60초 내에 응답하지 않음"
        exit 1
    fi
    sleep 1
done

# 2) Onboarding 완료 (최초 부팅 시)
echo "[2/4] Onboarding 처리 중..."
ONBOARDING_CHECK=$(curl -s "$HA_URL/api/onboarding" || echo "[]")

if echo "$ONBOARDING_CHECK" | grep -q '"user"'; then
    echo "  사용자 생성 중..."
    curl -s -X POST "$HA_URL/api/onboarding/users" \
        -H "Content-Type: application/json" \
        -d '{
            "client_id": "http://localhost:8123/",
            "name": "Dev",
            "username": "dev",
            "password": "dev",
            "language": "ko"
        }' > /tmp/ha_onboarding.json

    AUTH_CODE=$(python3 -c "import json; print(json.load(open('/tmp/ha_onboarding.json'))['auth_code'])")

    # auth_code로 토큰 획득
    curl -s -X POST "$HA_URL/auth/token" \
        -d "grant_type=authorization_code&code=$AUTH_CODE&client_id=http://localhost:8123/" \
        > /tmp/ha_token.json

    ACCESS_TOKEN=$(python3 -c "import json; print(json.load(open('/tmp/ha_token.json'))['access_token'])")
else
    echo "  이미 onboarding 완료됨. 로그인 중..."
    # 기존 계정으로 로그인
    FLOW_RESP=$(curl -s -X POST "$HA_URL/auth/login_flow" \
        -H "Content-Type: application/json" \
        -d '{"client_id": "http://localhost:8123/", "handler": ["homeassistant", null], "redirect_uri": "http://localhost:8123/"}')
    FLOW_ID=$(python3 -c "import json; print(json.load(open('/dev/stdin'))['flow_id'])" <<< "$FLOW_RESP")

    STEP_RESP=$(curl -s -X POST "$HA_URL/auth/login_flow/$FLOW_ID" \
        -H "Content-Type: application/json" \
        -d '{"username": "dev", "password": "dev", "client_id": "http://localhost:8123/"}')
    RESULT=$(python3 -c "import json; print(json.load(open('/dev/stdin'))['result'])" <<< "$STEP_RESP")

    curl -s -X POST "$HA_URL/auth/token" \
        -d "grant_type=authorization_code&code=$RESULT&client_id=http://localhost:8123/" \
        > /tmp/ha_token.json

    ACCESS_TOKEN=$(python3 -c "import json; print(json.load(open('/tmp/ha_token.json'))['access_token'])")
fi

echo "  토큰 획득 완료"

# 3) 나머지 onboarding 단계 완료
echo "[3/4] Onboarding 나머지 단계 완료 중..."
ONBOARDING_CHECK=$(curl -s "$HA_URL/api/onboarding" || echo "[]")

for step in "core_config" "analytics" "integration"; do
    if echo "$ONBOARDING_CHECK" | grep -q "\"$step\""; then
        curl -s -X POST "$HA_URL/api/onboarding/$step" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{"client_id": "http://localhost:8123/"}' > /dev/null 2>&1 || true
        echo "  $step 완료"
    fi
done

# 4) Extended Graph Agents integration 등록
echo "[4/4] Extended Graph Agents integration 등록 중..."

# config flow 시작
FLOW=$(curl -s -X POST "$HA_URL/api/config/config_entries/flow" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"handler": "extended_graph_agents"}')

FLOW_ID=$(python3 -c "import json; print(json.load(open('/dev/stdin'))['flow_id'])" <<< "$FLOW")

# API 키 입력
RESULT=$(curl -s -X POST "$HA_URL/api/config/config_entries/flow/$FLOW_ID" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"api_key\": \"$OPENAI_API_KEY\", \"base_url\": \"https://api.openai.com/v1\"}")

if echo "$RESULT" | grep -q '"result"'; then
    echo "  Integration 등록 완료!"
else
    echo "  Integration 등록 결과: $RESULT"
    echo "  (이미 등록되어 있을 수 있음)"
fi

# 토큰 저장 (이후 스크립트에서 사용)
echo "$ACCESS_TOKEN" > /tmp/ha_dev_token
echo ""
echo "=== 셋업 완료! ==="
echo "  HA URL: $HA_URL"
echo "  계정: dev / dev"
echo "  토큰: /tmp/ha_dev_token"
echo ""
echo "  Playwright로 접속하려면: $HA_URL"
echo "  WebSocket: ws://localhost:8123/api/websocket"
