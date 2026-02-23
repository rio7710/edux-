import { Space, Typography } from "antd";
import type { ReactNode } from "react";

const { Text } = Typography;

type MobilePageHintProps = {
  icon: ReactNode;
  title: string;
  description?: string;
};

export default function MobilePageHint({
  icon,
  title,
  description,
}: MobilePageHintProps) {
  return (
    <div
      style={{
        border: "1px solid #dbeafe",
        background: "linear-gradient(90deg, #eff6ff 0%, #f8fbff 100%)",
        borderRadius: 10,
        padding: "8px 10px",
      }}
    >
      <Space size={8} align="start">
        <span style={{ color: "#2563eb", fontSize: 16, lineHeight: "16px", marginTop: 1 }}>
          {icon}
        </span>
        <Space direction="vertical" size={0} style={{ lineHeight: 1.2 }}>
          <Text strong style={{ fontSize: 12, color: "#1e3a8a" }}>
            {title}
          </Text>
          {description ? (
            <Text style={{ fontSize: 11, color: "#334155" }}>{description}</Text>
          ) : null}
        </Space>
      </Space>
    </div>
  );
}
