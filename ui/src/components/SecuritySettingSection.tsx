import type { ReactNode } from "react";
import CollapsibleSection from "./CollapsibleSection";

type SecuritySettingSectionProps = {
  title: string;
  toneColor: string;
  children: ReactNode;
};

export default function SecuritySettingSection({
  title,
  toneColor,
  children,
}: SecuritySettingSectionProps) {
  return (
    <CollapsibleSection
      title={title}
      containerStyle={{ padding: "12px 24px 16px" }}
      summaryStyle={{ color: toneColor, fontSize: 13 }}
    >
      {children}
    </CollapsibleSection>
  );
}
