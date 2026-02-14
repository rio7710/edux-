import type { ReactNode } from "react";
import { Card, Typography } from "antd";

const { Title, Text } = Typography;

type AuthCardLayoutProps = {
  title: string;
  subtitle: string;
  width?: number;
  children: ReactNode;
};

export default function AuthCardLayout({
  title,
  subtitle,
  width = 400,
  children,
}: AuthCardLayoutProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f0f2f5",
      }}
    >
      <Card style={{ width, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0 }}>
            {title}
          </Title>
          <Text type="secondary">{subtitle}</Text>
        </div>
        {children}
      </Card>
    </div>
  );
}
