import { Layout, Button, Space, Typography, Drawer } from "antd";
import {
  BookOutlined,
  FileTextOutlined,
  MessageOutlined,
  UserOutlined,
  MenuOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../api/mcpClient";
import { useEffect } from "react";
import "../mobileApp.css";

const { Header, Content, Footer } = Layout;
const { Text } = Typography;

const footerNavItems = [
  { key: "/m/courses", label: "내 과정", icon: <BookOutlined /> },
  { key: "/m/documents", label: "내 문서함", icon: <FileTextOutlined /> },
  { key: "/m/messages", label: "메시지함", icon: <MessageOutlined /> },
];

const drawerNavItems = [
  ...footerNavItems,
  { key: "/m/profile", label: "내 정보", icon: <UserOutlined /> },
];

type DebugRole = "admin" | "operator" | "editor" | "instructor" | "viewer" | "guest";

export default function MobileUserLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, accessToken, logout, isAuthenticated, isLoading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [noticeIndex, setNoticeIndex] = useState(0);
  const [noticeVisible, setNoticeVisible] = useState(true);
  const [nowLabel, setNowLabel] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [notices, setNotices] = useState<Array<{ id: string; title: string; urgent?: boolean }>>([]);
  const [logoUrl, setLogoUrl] = useState("");
  const debugRole = (user?.role as DebugRole) || "viewer";
  const currentNotice = notices[noticeIndex];

  useEffect(() => {
    if (!accessToken) {
      setLogoUrl("");
      return;
    }
    let cancelled = false;
    const loadLogo = async () => {
      try {
        const result = (await api.siteSettingGetMany(accessToken, ["logo_url"])) as {
          items?: Record<string, unknown>;
        };
        if (cancelled) return;
        const logo = result?.items?.logo_url;
        setLogoUrl(typeof logo === "string" ? logo : "");
      } catch {
        if (!cancelled) {
          setLogoUrl("");
        }
      }
    };
    void loadLogo();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      setUnreadCount(0);
      setNotices([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const [summaryResult, messageResult] = await Promise.all([
          api.messageUnreadSummary({ token: accessToken }) as Promise<{ total?: number }>,
          api.messageList({ token: accessToken, limit: 20, status: "all" }) as Promise<{
            messages?: Array<{ id: string; title: string; category?: string; actionType?: string }>;
          }>,
        ]);
        if (cancelled) return;
        setUnreadCount(summaryResult?.total || 0);
        const systemMessages =
          (messageResult?.messages || []).filter(
            (msg) =>
              msg.category === "system" ||
              msg.actionType === "notice" ||
              msg.title?.includes("공지"),
          ) || [];
        setNotices(
          systemMessages.map((msg) => ({
            id: msg.id,
            title: msg.title,
            urgent: msg.title.includes("긴급"),
          })),
        );
      } catch {
        if (!cancelled) {
          setUnreadCount(0);
          setNotices([]);
        }
      }
    };
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [accessToken]);

  useEffect(() => {
    const formatNow = () => {
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const hh = String(now.getHours()).padStart(2, "0");
      const mi = String(now.getMinutes()).padStart(2, "0");
      setNowLabel(`${mm}/${dd} ${hh}:${mi}`);
    };
    formatNow();
    const timer = window.setInterval(formatNow, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!noticeVisible || notices.length <= 1) return;
    const timer = window.setInterval(() => {
      setNoticeIndex((prev) => (prev + 1) % notices.length);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [noticeVisible, notices.length]);

  if (!isLoading && !isAuthenticated) {
    const redirectTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectTo)}`} replace />;
  }

  return (
    <Layout className="m-shell">
      <Header
        className="m-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          height: 60,
          lineHeight: "60px",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <Space size={8}>
          <Button
            size="middle"
            type="default"
            icon={<MenuOutlined />}
            onClick={() => setMenuOpen(true)}
            style={{ borderRadius: 10 }}
          />
          <img
            src={logoUrl || "/logo.svg"}
            alt="site logo"
            style={{
              width: 24,
              height: 24,
              objectFit: "contain",
              borderRadius: 6,
              display: "block",
              transform: "translateY(1px)",
            }}
          />
          <Text strong style={{ fontSize: 14 }}>
            Edux
          </Text>
        </Space>
        <Space size={8}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {nowLabel}
          </Text>
          <Button
            size="middle"
            type="default"
            onClick={() => navigate("/m/messages")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: "1px solid #dbe2ea",
              borderRadius: 999,
              padding: "0 10px",
              height: 32,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: unreadCount > 0 ? "#ef4444" : "#94a3b8",
                boxShadow: unreadCount > 0 ? "0 0 6px rgba(239,68,68,0.55)" : "none",
                animation: unreadCount > 0 ? "message-lamp-blink 1s ease-in-out infinite" : "none",
              }}
            />
            <Text style={{ fontSize: 12 }}>메시지</Text>
            <Text
              style={{
                minWidth: 16,
                textAlign: "center",
                fontSize: 11,
                color: unreadCount > 0 ? "#991b1b" : "#475569",
              }}
            >
              {unreadCount}
            </Text>
          </Button>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {user?.name || "사용자"}
          </Text>
        </Space>
      </Header>
      {noticeVisible && currentNotice && (
        <div
          style={{
            background: "#fff7ed",
            borderBottom: "1px solid #fed7aa",
            padding: "6px 10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={() => navigate("/m/messages")}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: 6,
              width: "100%",
              color: "#7c2d12",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {currentNotice.urgent ? (
              <span
                style={{
                  fontSize: 10,
                  background: "#ef4444",
                  color: "#fff",
                  borderRadius: 999,
                  padding: "1px 6px",
                  lineHeight: "14px",
                  flexShrink: 0,
                }}
              >
                긴급
              </span>
            ) : null}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {currentNotice.title}
            </span>
          </button>
          <Button
            size="small"
            type="text"
            onClick={() => setNoticeVisible(false)}
            style={{ paddingInline: 4, color: "#9a3412" }}
          >
            닫기
          </Button>
        </div>
      )}
      <Content className="m-content">
        <Outlet context={{ debugRole }} />
      </Content>
      <Footer className="m-bottom-nav" style={{ padding: 8 }}>
        <div
          style={{
            width: "100%",
            display: "grid",
            gridTemplateColumns: `repeat(${footerNavItems.length}, minmax(0, 1fr))`,
            gap: 8,
          }}
        >
          {footerNavItems.map((item) => (
            <Button
              key={item.key}
              type={location.pathname === item.key ? "primary" : "default"}
              icon={item.icon}
              onClick={() => navigate(item.key)}
              style={{
                gap: 6,
              }}
              className="m-footer-btn"
            >
              {item.label}
            </Button>
          ))}
        </div>
      </Footer>
      <Drawer
        title={
          <Space size={8}>
            <img
              src={logoUrl || "/logo.svg"}
              alt="site logo"
              style={{
                width: 20,
                height: 20,
                objectFit: "contain",
                borderRadius: 5,
                display: "block",
                transform: "translateY(1px)",
              }}
            />
            <span>Edux 메뉴</span>
          </Space>
        }
        placement="left"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      >
        <Space direction="vertical" style={{ width: "100%" }} size={8}>
          {drawerNavItems.map((item) => (
            <Button
              key={item.key}
              icon={item.icon}
              type={location.pathname === item.key ? "primary" : "default"}
              onClick={() => {
                navigate(item.key);
                setMenuOpen(false);
              }}
              style={{ width: "100%", justifyContent: "flex-start" }}
            >
              {item.label}
            </Button>
          ))}
          <Button
            danger
            icon={<LogoutOutlined />}
            onClick={() => {
              logout();
              setMenuOpen(false);
              navigate("/login");
            }}
            style={{ width: "100%", justifyContent: "flex-start" }}
          >
            로그아웃
          </Button>
        </Space>
      </Drawer>
    </Layout>
  );
}
