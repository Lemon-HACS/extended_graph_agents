import { useState, useEffect, useCallback } from "react";
import { GraphList } from "./components/panels/GraphList";
import { SkillsPanel } from "./components/panels/SkillsPanel";
import { SkillWorkspace } from "./components/panels/SkillWorkspace";
import { GraphEditor } from "./components/GraphEditor";
import { NodeConfigPanel } from "./components/panels/NodeConfigPanel";
import { EdgeConfigPanel } from "./components/panels/EdgeConfigPanel";
import { GraphSettingsPanel } from "./components/panels/GraphSettingsPanel";
import { useGraphStore } from "./store/graphStore";
import { useSkillStore } from "./store/skillStore";
import { listGraphs, getGraph, saveGraph, deleteGraph, listSkills } from "./utils/haApi";
import type { HassConnection } from "./utils/haApi";
import { graphToYaml } from "./utils/serializer";
import { useWindowSize } from "./hooks/useWindowSize";
import { LangContext, useLang } from "./contexts/LangContext";
import { getTranslations } from "./utils/i18n";

interface AppProps {
  hass: {
    connection: HassConnection;
    auth: { data: { access_token: string } };
    language?: string;
  };
}

export function App({ hass }: AppProps) {
  const t = getTranslations(hass.language ?? "en");
  const [showYaml, setShowYaml] = useState(false);
  const [showGraphSettings, setShowGraphSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarView, setSidebarView] = useState<"graphs" | "skills">("graphs");
  const { setSkillList } = useSkillStore();
  const {
    graphList,
    setGraphList,
    loadGraph,
    newGraph,
    currentGraph,
    selectedNodeId,
    selectedEdgeId,
    selectNode,
    selectEdge,
    isDirty,
    isSaving,
    setIsSaving,
    getCurrentGraphDef,
  } = useGraphStore();

  const { isMobile, isTablet } = useWindowSize();
  const sidebarWidth = isMobile ? 0 : isTablet ? 200 : 240;
  const panelWidth = isMobile ? 0 : isTablet ? 300 : 380;

  // 데스크탑으로 전환 시 사이드바 자동 표시
  useEffect(() => {
    if (!isMobile) setShowSidebar(false);
  }, [isMobile]);


  const conn = hass.connection;

  // Load graph list and skill list on mount
  useEffect(() => {
    listGraphs(conn)
      .then((list) => {
        setGraphList(list);
      })
      .catch(() => {/* ignore */});
    listSkills(conn)
      .then((list) => setSkillList(list))
      .catch(() => {/* skills dir may not exist yet */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn]);

  const handleSelectGraph = useCallback(
    async (id: string) => {
      const graph = await getGraph(conn, id);
      loadGraph(graph);
    },
    [conn, loadGraph]
  );

  const handleNew = useCallback(() => {
    newGraph();
  }, [newGraph]);

  const handleSave = useCallback(async () => {
    const graphDef = getCurrentGraphDef();
    if (!graphDef) return;
    setIsSaving(true);
    try {
      await saveGraph(conn, graphDef);
      const updatedList = await listGraphs(conn);
      setGraphList(updatedList);
    } catch (err) {
      alert(t.failedToSave(String(err)));
    } finally {
      setIsSaving(false);
    }
  }, [conn, getCurrentGraphDef, setGraphList, setIsSaving]);

  // Ctrl+S 단축키로 그래프 저장
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s" && sidebarView === "graphs") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sidebarView, handleSave]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm(t.confirmDelete(id))) return;
      await deleteGraph(conn, id);
      const updatedList = await listGraphs(conn);
      setGraphList(updatedList);
    },
    [conn, setGraphList]
  );

  const currentYaml = showYaml
    ? (() => {
        const def = getCurrentGraphDef();
        return def ? graphToYaml(def) : "";
      })()
    : "";

  return (
    <LangContext.Provider value={t}>
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
        <div
          style={{
            width: isMobile ? "100%" : sidebarWidth,
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid #1e293b",
            background: "#0a0f1e",
            flexShrink: 0,
            ...(isMobile
              ? { position: "absolute", top: 0, left: 0, bottom: 0, zIndex: 50 }
              : {}),
          }}
        >
          {/* Tab nav */}
          <div style={{ display: "flex", borderBottom: "1px solid #1e293b", flexShrink: 0 }}>
            {(["graphs", "skills"] as const).map((view) => (
              <button
                key={view}
                onClick={() => setSidebarView(view)}
                style={{
                  flex: 1,
                  background: "none",
                  border: "none",
                  borderBottom: sidebarView === view ? "2px solid #3b82f6" : "2px solid transparent",
                  color: sidebarView === view ? "#60a5fa" : "#64748b",
                  padding: "8px 0",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {view === "graphs" ? t.graphsTab : t.skillsTab}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            {sidebarView === "graphs" ? (
              <GraphList
                onSelect={handleSelectGraph}
                onNew={handleNew}
                onDelete={handleDelete}
                isMobile={false}
                onClose={() => setShowSidebar(false)}
                sidebarWidth={sidebarWidth}
              />
            ) : (
              <SkillsPanel
                conn={conn}
                sidebarWidth={sidebarWidth}
                onClose={() => setShowSidebar(false)}
              />
            )}
          </div>

          {isMobile && (
            <button
              onClick={() => setShowSidebar(false)}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                fontSize: 18,
                zIndex: 10,
              }}
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Main area */}
      <div
        style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        {sidebarView === "skills" ? (
          <SkillWorkspace
            conn={conn}
            isMobile={isMobile}
            onOpenSidebar={() => setShowSidebar(true)}
          />
        ) : (
          <>
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
                    {showYaml ? t.backToGraph : t.yaml}
                  </button>

                  <button
                    onClick={handleSave}
                    disabled={isSaving || !isDirty}
                    style={{
                      ...primaryBtnStyle(isMobile),
                      opacity: isSaving || !isDirty ? 0.5 : 1,
                    }}
                  >
                    {isSaving ? t.saving : isDirty ? t.save : t.saved}
                  </button>
                </>
              )}

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
                  onNodeClick={(id) => {
                    selectNode(id === selectedNodeId ? null : id);
                  }}
                  onEdgeClick={(id) => {
                    selectEdge(id === selectedEdgeId ? null : id);
                  }}
                  onPaneClick={() => {
                    selectNode(null);
                    selectEdge(null);
                  }}
                />
              )}

              {selectedNodeId && !showYaml && (
                <NodeConfigPanel
                  conn={conn}
                  onClose={() => selectNode(null)}
                  isMobile={isMobile}
                  panelWidth={panelWidth}
                />
              )}

              {selectedEdgeId && !showYaml && !selectedNodeId && (
                <EdgeConfigPanel
                  onClose={() => selectEdge(null)}
                  isMobile={isMobile}
                  panelWidth={panelWidth}
                />
              )}

            </div>
          </>
        )}
      </div>
    </div>
    </LangContext.Provider>
  );
}

function GraphMetaEditor({ isMobile }: { isMobile?: boolean }) {
  const { currentGraph, updateGraphMeta } = useGraphStore();
  const t = useLang();
  if (!currentGraph) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: isMobile ? 1 : undefined }}>
      {!isMobile && (
        <span style={{ color: "#94a3b8", fontSize: 13, flexShrink: 0 }}>{t.graphLabel}</span>
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
