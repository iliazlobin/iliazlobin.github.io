// Older Notion exports set colors directly, overriding Mermaid's shared theme.
// Keep their color groups, but use the same soft fills and thin gray borders.
const fillGroups = {
  "#e8f0fe": ["#d0ebff", "#e3f2fd", "#81d4fa", "#dbeafe", "#dae8fc", "#eef6ff"],
  "#e6f4ea": ["#d3f9d8", "#e8f5e9", "#a5d6a7", "#c5e1a5", "#d4edda", "#d5f5e3", "#d5e8d4", "#e8f0e0", "#d1fae5"],
  "#fef7e0": ["#fff3bf", "#fff3cd", "#ffd54f", "#fff59d", "#fef3c7"],
  "#feefe3": ["#ffe8cc", "#fff3e0", "#ffe0b2", "#ffab91", "#f0e8e0"],
  "#fce8e6": ["#fce4ec", "#f48fb1", "#f5b7b1", "#ffebee", "#fce7f3", "#ffe0e0", "#ffe3e3"],
  "#f3e8fd": ["#e8daef", "#f3e5f5", "#ce93d8", "#b39ddb", "#ede7f6", "#f3f0ff"],
  "#e4f7fb": ["#80cbc4", "#e8f4f8"],
  "#f1f3f4": ["#f5f5f5", "#e8e8e8", "#b0bec5", "#e0e8f0", "#f0f4f8", "#d0d0d0", "#e0e0e0", "#e8edf2", "#f0f0f0", "#f4f4f4"],
  "#ffffff": [],
};
const fills = new Map(Object.entries(fillGroups).flatMap(([fill, legacy]) =>
  [fill, ...legacy].map((color) => [color, fill])
));

export function normalizeDiagramStyles(source) {
  return source.replace(/^(\s*(?:classDef|style)\s+\S+\s+)([^\r\n]+)/gm,
    (line, prefix, styles) => {
      const originalFill = styles.match(/(?:^|,)\s*fill\s*:\s*(#[\da-f]{6})(?=\s*[,;]|$)/i)?.[1].toLowerCase();
      const fill = fills.get(originalFill);
      // Unknown styles are left alone; never guess at a diagram's meaning.
      if (!fill) return line;
      return prefix + styles.replace(/((?:^|,)\s*)(fill|stroke|color|stroke-width)\s*:\s*([^,;]+)/gi,
        (property, separator, name, value) => {
          const key = name.toLowerCase();
          const color = value.trim().toLowerCase();
          if (key === "fill") return `${separator}${name}:${fill}`;
          if (key === "stroke" && /^#[\da-f]{3,6}$/.test(color)) {
            // Matching fill/stroke means a borderless group, as in Bitly.
            return `${separator}${name}:${color === originalFill ? fill : "#9aa0a6"}`;
          }
          if (key === "color" && /^#[\da-f]{3,6}$/.test(color)) {
            return `${separator}${name}:${color === "#3c4043" ? color : "#202124"}`;
          }
          if (key === "stroke-width" && /^\d+(?:\.\d+)?px$/.test(color) && parseFloat(color) > 1) {
            return `${separator}${name}:1px`;
          }
          return property;
        });
    }).replace(/^(\s*rect\s+)rgb\(\s*(240,\s*248,\s*255|255,\s*248,\s*240)\s*\)/gm,
      (_, prefix, rgb) => prefix + (rgb.replace(/\s/g, "") === "240,248,255"
        ? "rgb(232, 240, 254)" : "rgb(254, 239, 227)"));
}
