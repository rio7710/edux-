import { Button, Space, Tag, Typography } from "antd";

const { Text } = Typography;

type PlannedFeaturePanelProps = {
  title: string;
  description: string;
  actions?: string[];
};

export default function PlannedFeaturePanel({
  title,
  description,
  actions = [],
}: PlannedFeaturePanelProps) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Text type="secondary">{title}</Text>
        <Tag color="default">미구현</Tag>
      </div>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {description}
      </Text>
      {actions.length > 0 ? (
        <>
          <div style={{ margin: "12px 0" }} />
          <Space direction="vertical" style={{ width: "100%" }}>
            {actions.map((label) => (
              <Button key={label} block disabled>
                {label}
              </Button>
            ))}
          </Space>
        </>
      ) : null}
    </div>
  );
}
