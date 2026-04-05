import { useState } from "react";
import { MessageSquare, FolderOpen } from "lucide-react";
import { ChatPanel } from "./components/panels/ChatPanel";
import { GraphListPanel } from "./components/panels/GraphListPanel";
import type { HassConnection } from "./utils/haApiV2";

interface AppProps {
  hass: {
    connection: HassConnection;
    auth: { data: { access_token: string } };
    language?: string;
  };
}

type Tab = "chat" | "graphs";

export function App({ hass }: AppProps) {
  const [tab, setTab] = useState<Tab>("chat");
  const conn = hass.connection;
  const language = hass.language ?? "en";

  return (
    <div style={styles.root}>
      {/* Tab bar */}
      <div style={styles.tabBar}>
        <TabButton
          active={tab === "chat"}
          onClick={() => setTab("chat")}
          icon={<MessageSquare size={15} />}
          label="대화"
        />
        <TabButton
          active={tab === "graphs"}
          onClick={() => setTab("graphs")}
          icon={<FolderOpen size={15} />}
          label="내 그래프"
        />
      </div>

      {/* Panel */}
      <div style={styles.panel}>
        {tab === "chat" ? (
          <ChatPanel conn={conn} language={language} />
        ) : (
          <GraphListPanel conn={conn} language={language} />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.tab,
        borderBottom: active ? "2px solid #3b82f6" : "2px solid transparent",
        color: active ? "#60a5fa" : "#64748b",
        fontWeight: active ? 600 : 400,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    width: "100%",
    background: "#020817",
    color: "white",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    overflow: "hidden",
  },
  tabBar: {
    display: "flex",
    borderBottom: "1px solid #1e293b",
    background: "#0f172a",
    flexShrink: 0,
  },
  tab: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: "none",
    border: "none",
    padding: "10px 20px",
    cursor: "pointer",
    fontSize: 13,
  },
  panel: {
    flex: 1,
    overflow: "hidden",
  },
};
