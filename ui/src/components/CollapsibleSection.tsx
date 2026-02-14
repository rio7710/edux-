import type { ReactNode } from "react";

type CollapsibleSectionProps = {
  title: string;
  defaultOpen?: boolean;
  summaryStyle?: React.CSSProperties;
  containerStyle?: React.CSSProperties;
  children: ReactNode;
};

export default function CollapsibleSection({
  title,
  defaultOpen = false,
  summaryStyle,
  containerStyle,
  children,
}: CollapsibleSectionProps) {
  return (
    <details open={defaultOpen} style={containerStyle}>
      <summary
        style={{
          cursor: "pointer",
          userSelect: "none",
          ...summaryStyle,
        }}
      >
        {title}
      </summary>
      <div style={{ marginTop: 8 }}>{children}</div>
    </details>
  );
}
