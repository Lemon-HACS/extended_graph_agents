import { useEffect, useRef, useState } from "react";
import { useGraphStore } from "../../store/graphStore";

const LEVEL_COLOR: Record<string, string> = {
  info: "#94a3b8",
  warn: "#f59e0b",
  error: "#f87171",
};

const LEVEL_PREFIX: Record<string, string> = {
  info: "[INFO]",
  warn: "[WARN]",
  error: "[ERR ]",
};

export function DebugPanel() {
  const { logs, clearLogs } = useGraphStore();
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 새 로그 추가 시 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  const handleCopy = () => {
    const text = logs
      .map((l) => `${l.time} ${LEVEL_PREFIX[l.level]} ${l.message}`)
      .join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      style={{
        width: 380,
        borderLeft: "1px solid #1e293b",
        background: "#0a0f1e",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 12px",
          borderBottom: "1px solid #1e293b",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span style={{ color: "#64748b", fontSize: 11, fontWeight: 600, flex: 1 }}>
          DEBUG LOG ({logs.length})
        </span>
        <button onClick={handleCopy} style={btnStyle}>
          {copied ? "복사됨 ✓" : "복사"}
        </button>
        <button onClick={clearLogs} style={btnStyle}>
          지우기
        </button>
      </div>

      {/* Log list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 0",
          fontFamily: "monospace",
          fontSize: 11,
        }}
      >
        {logs.map((entry) => (
          <div
            key={entry.id}
            style={{
              display: "flex",
              gap: 6,
              padding: "2px 12px",
              lineHeight: "1.6",
            }}
          >
            <span style={{ color: "#334155", flexShrink: 0 }}>{entry.time}</span>
            <span
              style={{
                color: LEVEL_COLOR[entry.level],
                flexShrink: 0,
                fontWeight: 600,
              }}
            >
              {LEVEL_PREFIX[entry.level]}
            </span>
            <span style={{ color: "#cbd5e1", wordBreak: "break-all" }}>
              {entry.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "#1e293b",
  border: "1px solid #334155",
  color: "#94a3b8",
  borderRadius: 4,
  padding: "3px 10px",
  cursor: "pointer",
  fontSize: 11,
};
