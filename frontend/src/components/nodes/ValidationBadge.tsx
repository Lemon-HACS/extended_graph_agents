import { useGraphStore } from "../../store/graphStore";
import { useLang } from "../../contexts/LangContext";
import type { Translations } from "../../utils/i18n";

export function ValidationBadge({ nodeId }: { nodeId: string }) {
  const warnings = useGraphStore((s) => s.validationWarnings);
  const t = useLang();
  const nodeWarnings = warnings.filter((w) => w.nodeId === nodeId);

  if (nodeWarnings.length === 0) return null;

  const hasError = nodeWarnings.some((w) => w.severity === "error");
  const tooltip = nodeWarnings.map((w) => t[w.messageKey as keyof Translations] as string ?? w.messageKey).join("\n");

  return (
    <div
      title={tooltip}
      style={{
        position: "absolute",
        top: -6,
        right: -6,
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: hasError ? "#dc2626" : "#d97706",
        color: "white",
        fontSize: 10,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "2px solid #0f172a",
        zIndex: 10,
      }}
    >
      {nodeWarnings.length}
    </div>
  );
}
