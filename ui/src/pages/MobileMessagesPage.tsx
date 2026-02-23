import { useEffect, useMemo, useState } from "react";
import { Card, Segmented, Space, Tag, Typography, message } from "antd";
import { BellOutlined } from "@ant-design/icons";
import { api } from "../api/mcpClient";
import { useAuth } from "../contexts/AuthContext";
import MobilePageHint from "../components/MobilePageHint";

const { Text } = Typography;

type FilterType = "all" | "unread" | "notice";
type MessageCategory = "system" | "course_share" | "lecture_grant" | "instructor_approval";

type UserMessage = {
  id: string;
  category: MessageCategory;
  title: string;
  body?: string | null;
  isRead: boolean;
  createdAt?: string;
};

export default function MobileMessagesPage() {
  const { accessToken } = useAuth();
  const [filter, setFilter] = useState<FilterType>("all");
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const loadMessages = async (nextFilter: FilterType) => {
    if (!accessToken) {
      setMessages([]);
      return;
    }
    setLoading(true);
    try {
      const result = (await api.messageList({
        token: accessToken,
        limit: 200,
        status: nextFilter === "unread" ? "unread" : "all",
        category: nextFilter === "notice" ? "system" : undefined,
      })) as { messages?: UserMessage[] };
      setMessages(result?.messages || []);
    } catch (error) {
      message.error(`메시지 조회 실패: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMessages(filter);
  }, [accessToken, filter]);

  const filtered = useMemo(() => {
    if (filter === "unread") {
      return messages.filter((item) => !item.isRead);
    }
    if (filter === "notice") {
      return messages.filter((item) => item.category === "system");
    }
    return messages;
  }, [filter, messages]);

  const handleMarkRead = async (item: UserMessage) => {
    if (!accessToken || item.isRead) return;
    try {
      await api.messageMarkRead({ token: accessToken, messageId: item.id, read: true });
      setMessages((prev) =>
        prev.map((msg) => (msg.id === item.id ? { ...msg, isRead: true } : msg)),
      );
    } catch {
      // do nothing on tap mark-read failure
    }
  };

  return (
    <Space direction="vertical" size={10} style={{ width: "100%" }}>
      <MobilePageHint
        icon={<BellOutlined />}
        title="중요 알림은 탭하면 읽음 처리"
        description="안읽음/공지 필터로 빠르게 확인하세요."
      />
      <Segmented
        block
        value={filter}
        onChange={(value) => setFilter(value as FilterType)}
        options={[
          { label: "전체", value: "all" },
          { label: "안읽음", value: "unread" },
          { label: "공지", value: "notice" },
        ]}
      />
      {filtered.map((item) => (
        <Card
          key={item.id}
          size="small"
          styles={{ body: { padding: 12 } }}
          className="m-card"
          onClick={() => void handleMarkRead(item)}
          style={{ cursor: item.isRead ? "default" : "pointer" }}
        >
          <Space direction="vertical" size={6} style={{ width: "100%" }}>
            <Space style={{ justifyContent: "space-between", width: "100%" }}>
              <Text strong>{item.title}</Text>
              <Space size={6}>
                {item.category === "system" ? <Tag color="orange">공지</Tag> : null}
                <Tag color={item.isRead ? "default" : "red"}>
                  {item.isRead ? "읽음" : "안읽음"}
                </Tag>
              </Space>
            </Space>
            <Text>{item.body || "-"}</Text>
            <Text type="secondary">
              {item.createdAt ? new Date(item.createdAt).toLocaleString("ko-KR") : "-"}
            </Text>
          </Space>
        </Card>
      ))}
      {!loading && filtered.length === 0 ? (
        <Card size="small" className="m-card">
          <Text type="secondary">표시할 메시지가 없습니다.</Text>
        </Card>
      ) : null}
    </Space>
  );
}
