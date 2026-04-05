#!/usr/bin/env python3
"""HA WebSocket API 스모크 테스트.

HA가 실행 중일 때 그래프 CRUD 및 기본 기능을 검증합니다.
사용법: python scripts/ws_smoke_test.py [--token TOKEN] [--url URL]
"""
import argparse
import asyncio
import json
import sys
from pathlib import Path

try:
    import websockets
except ImportError:
    print("ERROR: websockets 패키지가 필요합니다: pip install websockets")
    sys.exit(1)


class HAWebSocketClient:
    """Home Assistant WebSocket 클라이언트."""

    def __init__(self, url: str, token: str):
        self.url = url
        self.token = token
        self.ws = None
        self._msg_id = 0

    async def connect(self):
        self.ws = await websockets.connect(self.url)
        # auth_required 메시지 수신
        msg = json.loads(await self.ws.recv())
        assert msg["type"] == "auth_required", f"Expected auth_required, got: {msg}"

        # 인증
        await self.ws.send(json.dumps({"type": "auth", "access_token": self.token}))
        msg = json.loads(await self.ws.recv())
        if msg["type"] != "auth_ok":
            raise ConnectionError(f"Authentication failed: {msg}")
        print(f"  [OK] 인증 성공 (HA {msg.get('ha_version', '?')})")

    async def call(self, msg_type: str, **kwargs) -> dict:
        self._msg_id += 1
        payload = {"id": self._msg_id, "type": msg_type, **kwargs}
        await self.ws.send(json.dumps(payload))
        resp = json.loads(await self.ws.recv())
        return resp

    async def close(self):
        if self.ws:
            await self.ws.close()


async def run_tests(url: str, token: str):
    """스모크 테스트 실행."""
    client = HAWebSocketClient(url, token)
    passed = 0
    failed = 0
    test_graph_id = "_smoke_test_graph"

    try:
        # 1. 연결
        print("\n[TEST] WebSocket 연결...")
        await client.connect()
        passed += 1

        # 2. 그래프 목록 조회
        print("[TEST] 그래프 목록 조회...")
        resp = await client.call("extended_graph_agents/list_graphs")
        if resp.get("success"):
            print(f"  [OK] 그래프 {len(resp['result'])}개 발견")
            passed += 1
        else:
            print(f"  [FAIL] {resp}")
            failed += 1

        # 3. 그래프 저장
        print("[TEST] 테스트 그래프 저장...")
        test_graph = {
            "id": test_graph_id,
            "name": "스모크 테스트",
            "model": "gpt-4o",
            "nodes": [
                {"id": "input_1", "type": "input"},
                {"id": "agent_1", "type": "regular", "prompt": "Echo: {{ user_input }}"},
                {"id": "output_1", "type": "output"},
            ],
            "edges": [
                {"source": "input_1", "target": "agent_1"},
                {"source": "agent_1", "target": "output_1"},
            ],
        }
        resp = await client.call("extended_graph_agents/save_graph", graph=test_graph)
        if resp.get("success"):
            print("  [OK] 그래프 저장 성공")
            passed += 1
        else:
            print(f"  [FAIL] {resp}")
            failed += 1

        # 4. 그래프 조회
        print("[TEST] 저장된 그래프 조회...")
        resp = await client.call("extended_graph_agents/get_graph", graph_id=test_graph_id)
        if resp.get("success") and resp["result"]["id"] == test_graph_id:
            print(f"  [OK] 그래프 '{resp['result']['name']}' 조회 성공")
            passed += 1
        else:
            print(f"  [FAIL] {resp}")
            failed += 1

        # 5. 그래프 삭제
        print("[TEST] 테스트 그래프 삭제...")
        resp = await client.call("extended_graph_agents/delete_graph", graph_id=test_graph_id)
        if resp.get("success"):
            print("  [OK] 그래프 삭제 성공")
            passed += 1
        else:
            print(f"  [FAIL] {resp}")
            failed += 1

        # 6. 삭제 확인
        print("[TEST] 삭제 확인...")
        resp = await client.call("extended_graph_agents/list_graphs")
        if resp.get("success"):
            ids = [g["id"] for g in resp["result"]]
            if test_graph_id not in ids:
                print("  [OK] 삭제 확인됨")
                passed += 1
            else:
                print("  [FAIL] 그래프가 아직 존재함")
                failed += 1
        else:
            print(f"  [FAIL] {resp}")
            failed += 1

    except Exception as e:
        print(f"  [ERROR] {e}")
        failed += 1
    finally:
        await client.close()

    # 결과 요약
    total = passed + failed
    print(f"\n{'='*40}")
    print(f"스모크 테스트 결과: {passed}/{total} 통과", end="")
    if failed:
        print(f" ({failed}개 실패)")
    else:
        print(" ✓")
    print(f"{'='*40}")

    return failed == 0


def main():
    parser = argparse.ArgumentParser(description="HA WebSocket 스모크 테스트")
    parser.add_argument("--url", default="ws://localhost:8123/api/websocket")
    parser.add_argument("--token", default=None, help="HA 액세스 토큰 (미지정 시 /tmp/ha_dev_token 참조)")
    args = parser.parse_args()

    token = args.token
    if not token:
        token_file = Path("/tmp/ha_dev_token")
        if token_file.exists():
            token = token_file.read_text().strip()
        else:
            print("ERROR: --token을 지정하거나 먼저 dev/setup.sh를 실행하세요")
            sys.exit(1)

    success = asyncio.run(run_tests(args.url, token))
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
