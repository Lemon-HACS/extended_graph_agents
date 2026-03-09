import { useState, useEffect, useCallback } from "react";
import { GraphList } from "./components/panels/GraphList";
import { GraphEditor } from "./components/GraphEditor";
import { NodeConfigPanel } from "./components/panels/NodeConfigPanel";
import { DebugPanel } from "./components/panels/DebugPanel";
import { useGraphStore } from "./store/graphStore";
import { listGraphs, getGraph, saveGraph, deleteGraph } from "./utils/haApi";
import type { HassConnection } from "./utils/haApi";
import { graphToYaml } from "./utils/serializer";
import { useWindowSize } from "./hooks/useWindowSize";

interface AppProps {
  hass: {
    connection: HassConnection;
    auth: { data: { access_token: string } };
  };
}

export function App({ hass }: AppProps) {
  const [showYaml, setShowYaml] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const {
    graphList,
    setGraphList,
    loadGraph,
    newGraph,
    currentGraph,
    selectedNodeId,
    selectNode,
    isDirty,
    isSaving,
    setIsSaving,
    getCurrentGraphDef,
    addLog,
  } = useGraphStore();

  const { isMobile, isTablet } = useWindowSize();
  const sidebarWidth = isMobile ? 0 : isTablet ? 200 : 240;
  const panelWidth = isMobile ? 0 : isTablet ? 300 : 380;

  // 데스크탑으로 전환 시 사이드바 자동 표시
  useEffect(() => {
    if (!isMobile) setShowSidebar(false);
  }, [isMobile]);

  const conn = hass.connection;

  // Load graph list on mount
  useEffect(() => {
    addLog("info", "그래프 목록 로드 중...");
    listGraphs(conn)
      .then((list) => {
        setGraphList(list);
        addLog("info", `그래프 목록 로드 완료: ${list.length}개`);
      })
      .catch((err) => {
        addLog("error", `그래프 목록 로드 실패: ${String(err)}`);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn]);

  const handleSelectGraph = useCallback(
    async (id: string) => {
      addLog("info", `그래프 선택: ${id}`);
      try {
        const graph = await getGraph(conn, id);
        loadGraph(graph);
      } catch (err) {
        addLog("error", `그래프 로드 실패: ${String(err)}`);
      }
    },
    [conn, loadGraph, addLog]
  );

  const handleNew = useCallback(() => {
    newGraph();
  }, [newGraph]);

  const handleSave = useCallback(async () => {
    const graphDef = getCurrentGraphDef();
    if (!graphDef) return;
    addLog("info", `그래프 저장 시작: "${graphDef.name}"`);
    setIsSaving(true);
    try {
      await saveGraph(conn, graphDef);
      const updatedList = await listGraphs(conn);
      setGraphList(updatedList);
      addLog("info", `그래프 저장 완료: "${graphDef.name}"`);
    } catch (err) {
      addLog("error", `그래프 저장 실패: ${String(err)}`);
      alert("Failed to save graph: " + String(err));
    } finally {
      setIsSaving(false);
    }
  }, [conn, getCurrentGraphDef, setGraphList, setIsSaving, addLog]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm(`Delete graph "${id}"?`)) return;
      addLog("warn", `그래프 삭제: ${id}`);
      try {
        await deleteGraph(conn, id);
        const updatedList = await listGraphs(conn);
        setGraphList(updatedList);
        addLog("info", `그래프 삭제 완료: ${id}`);
      } catch (err) {
        addLog("error", `그래프 삭제 실패: ${String(err)}`);
      }
    },
    [conn, setGraphList, addLog]
  );

  const currentYaml = showYaml
    ? (() => {
        const def = getCurrentGraphDef();
        return def ? graphToYaml(def) : "";
      })()
    : "";

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        background: "#020817",
        color: "white",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Mobile sidebar backdrop */}
      {isMobile && showSidebar && (
        <div
          onClick={() => setShowSidebar(false)}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 40,
          }}
        />
      )}

      {/* Sidebar */}
      {(!isMobile || showSidebar) && (
        <GraphList
          onSelect={handleSelectGraph}
          onNew={handleNew}
          onDelete={handleDelete}
          isMobile={isMobile}
          onClose={() => setShowSidebar(false)}
          sidebarWidth={sidebarWidth}
        />
      )}

      {/* Main area */}
      <div
        style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: isMobile ? "6px 10px" : "8px 16px",
            borderBottom: "1px solid #1e293b",
            background: "#0a0f1e",
            gap: isMobile ? 8 : 12,
            flexShrink: 0,
          }}
        >
          {/* Hamburger (mobile only) */}
          {isMobile && (
            <button
              onClick={() => setShowSidebar(true)}
              style={{
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                fontSize: 20,
                lineHeight: 1,
                padding: "4px",
                flexShrink: 0,
              }}
            >
              ☰
            </button>
          )}

          {currentGraph ? (
            <GraphMetaEditor isMobile={isMobile} />
          ) : (
            <div style={{ flex: 1 }} />
          )}

          <div style={{ flex: 1 }} />

          {currentGraph && (
            <>
              <button
                onClick={() => setShowYaml(!showYaml)}
                style={secondaryBtnStyle(isMobile)}
              >
                {showYaml ? "← Graph" : "YAML"}
              </button>

              <button
                onClick={handleSave}
                disabled={isSaving || !isDirty}
                style={{
                  ...primaryBtnStyle(isMobile),
                  opacity: isSaving || !isDirty ? 0.5 : 1,
                }}
              >
                {isSaving ? "..." : isDirty ? "Save*" : "Saved"}
              </button>
            </>
          )}

          <button
            onClick={() => setShowDebug(!showDebug)}
            style={{
              ...secondaryBtnStyle(isMobile),
              color: showDebug ? "#60a5fa" : "#64748b",
              borderColor: showDebug ? "#3b82f6" : "#334155",
            }}
          >
            {isMobile ? "🐛" : "DEBUG"}
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative", minHeight: 0 }}>
          {showYaml ? (
            <div style={{ flex: 1, padding: 16, overflow: "auto" }}>
              <pre
                style={{
                  background: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: 8,
                  padding: 16,
                  color: "#e2e8f0",
                  fontFamily: "monospace",
                  fontSize: 13,
                  margin: 0,
                }}
              >
                {currentYaml}
              </pre>
            </div>
          ) : (
            <GraphEditor
              onNodeClick={(id) =>
                selectNode(id === selectedNodeId ? null : id)
              }
            />
          )}

          {selectedNodeId && !showYaml && (
            <NodeConfigPanel
              onClose={() => selectNode(null)}
              isMobile={isMobile}
              panelWidth={panelWidth}
            />
          )}

          {showDebug && (
            <DebugPanel isMobile={isMobile} panelWidth={panelWidth} />
          )}
        </div>
      </div>
    </div>
  );
}

function GraphMetaEditor({ isMobile }: { isMobile?: boolean }) {
  const { currentGraph, updateGraphMeta } = useGraphStore();
  if (!currentGraph) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: isMobile ? 1 : undefined }}>
      {!isMobile && (
        <span style={{ color: "#94a3b8", fontSize: 13, flexShrink: 0 }}>Graph:</span>
      )}
      <input
        value={currentGraph.name}
        onChange={(e) => updateGraphMeta({ name: e.target.value })}
        style={{
          background: "transparent",
          border: "none",
          color: "white",
          fontSize: isMobile ? 14 : 15,
          fontWeight: 600,
          outline: "none",
          padding: "4px 0",
          minWidth: 0,
          width: isMobile ? "100%" : undefined,
        }}
      />
      {!isMobile && (
        <span style={{ color: "#334155", fontSize: 12, flexShrink: 0 }}>
          ({currentGraph.id})
        </span>
      )}
    </div>
  );
}

const primaryBtnStyle = (isMobile?: boolean): React.CSSProperties => ({
  background: "#1e3a5f",
  border: "1px solid #3b82f6",
  color: "#60a5fa",
  borderRadius: 6,
  padding: isMobile ? "6px 10px" : "7px 16px",
  cursor: "pointer",
  fontSize: isMobile ? 12 : 13,
  fontWeight: 600,
  flexShrink: 0,
});

const secondaryBtnStyle = (isMobile?: boolean): React.CSSProperties => ({
  background: "#1e293b",
  border: "1px solid #334155",
  color: "#94a3b8",
  borderRadius: 6,
  padding: isMobile ? "6px 10px" : "7px 16px",
  cursor: "pointer",
  fontSize: isMobile ? 12 : 13,
  flexShrink: 0,
});
