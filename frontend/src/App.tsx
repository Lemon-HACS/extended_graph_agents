import { ChatPanel } from "./components/panels/ChatPanel";
import type { HassConnection } from "./utils/haApiV2";

interface AppProps {
  hass: {
    connection: HassConnection;
    auth: { data: { access_token: string } };
    language?: string;
  };
}

export function App({ hass }: AppProps) {
  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        background: "#020817",
        color: "white",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        overflow: "hidden",
      }}
    >
      <ChatPanel
        conn={hass.connection}
        language={hass.language ?? "en"}
      />
    </div>
  );
}
