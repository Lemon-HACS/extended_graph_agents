/**
 * Generates node style colors from an optional custom hex color.
 * Falls back to the node-type defaults when no custom color is set.
 */
export function nodeColorStyle(
  custom: string | undefined,
  defaultBorder: string,
  defaultBg: string,
) {
  if (!custom) {
    return {
      border: defaultBorder,
      borderSelected: lighten(defaultBorder, 40),
      borderHighlighted: lighten(defaultBorder, 60),
      bg: defaultBg,
      bgSelected: lighten(defaultBg, 15),
      bgHighlighted: lighten(defaultBg, 10),
    };
  }
  return {
    border: custom,
    borderSelected: lighten(custom, 40),
    borderHighlighted: lighten(custom, 60),
    bg: custom + "18",
    bgSelected: custom + "28",
    bgHighlighted: custom + "20",
  };
}

function lighten(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = Math.min(255, parseInt(h.slice(0, 2), 16) + amount);
  const g = Math.min(255, parseInt(h.slice(2, 4), 16) + amount);
  const b = Math.min(255, parseInt(h.slice(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
