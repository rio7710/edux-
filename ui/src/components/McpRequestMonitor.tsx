import { useEffect, useMemo, useRef, useState } from "react";
import { Tag, message } from "antd";
import { useLocation } from "react-router-dom";
import { mcpClient, type McpRequestStats } from "../api/mcpClient";
import { useAuth } from "../contexts/AuthContext";

export default function McpRequestMonitor() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const location = useLocation();
  const [stats, setStats] = useState<McpRequestStats>(mcpClient.getRequestStats());
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [collapsed, setCollapsed] = useState(false);
  const lastCompletionRef = useRef<{ count: number; at: number } | null>(null);
  const alertedCompletionCountRef = useRef(0);

  useEffect(() => {
    if (!isAdmin) return;
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 200);
    return () => window.clearInterval(timer);
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    return mcpClient.onRequestStatsChange((next) => {
      setStats(next);

      if (next.completionCount > 0 && next.completionCount !== alertedCompletionCountRef.current) {
        alertedCompletionCountRef.current = next.completionCount;
        if (next.lastCompletedAt) {
          lastCompletionRef.current = {
            count: next.completionCount,
            at: next.lastCompletedAt,
          };
        }
        const durationText =
          typeof next.lastBatchDurationMs === "number"
            ? ` / 소요 ${next.lastBatchDurationMs}ms`
            : "";
        message.success(
          `통신 완료: 시작 ${next.totalStarted}건 / 완료 ${next.totalFinished}건${durationText}`,
          1.2,
        );
      }
    });
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const last = lastCompletionRef.current;
    if (!last) return;
    const movedSoon = Date.now() - last.at < 1500;
    if (!movedSoon) return;
    message.warning("직전 페이지 통신 완료 알림을 놓쳤을 수 있습니다.", 2);
  }, [isAdmin, location.pathname, location.search]);

  const activeCount = useMemo(
    () => stats.pendingCount + (stats.connecting ? 1 : 0),
    [stats.pendingCount, stats.connecting],
  );
  const activeStartedAt = useMemo(() => {
    const starts = [stats.activeSinceAt, stats.connectingSinceAt].filter(
      (value): value is number => typeof value === "number" && value > 0,
    );
    if (starts.length === 0) return null;
    return Math.min(...starts);
  }, [stats.activeSinceAt, stats.connectingSinceAt]);
  const activeElapsedMs = useMemo(() => {
    if (!activeStartedAt) return null;
    return Math.max(0, nowMs - activeStartedAt);
  }, [activeStartedAt, nowMs]);

  if (!isAdmin) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        left: 16,
        bottom: 16,
        zIndex: 2000,
        background: "rgba(15,23,42,0.92)",
        color: "#f8fafc",
        borderRadius: 12,
        border: "1px solid rgba(148,163,184,0.35)",
        padding: "10px 12px",
        minWidth: collapsed ? 180 : 280,
        boxShadow: "0 8px 24px rgba(2,6,23,0.35)",
        fontSize: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ color: "#e2e8f0" }}>MCP 통신 카운터</strong>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Tag color={activeCount > 0 ? "processing" : "success"}>
            {activeCount > 0 ? `진행중 ${activeCount}` : "대기"}
          </Tag>
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            style={{
              border: "1px solid rgba(148,163,184,0.35)",
              background: "rgba(30,41,59,0.8)",
              color: "#e2e8f0",
              borderRadius: 6,
              padding: "1px 6px",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            {collapsed ? "펼치기" : "접기"}
          </button>
        </div>
      </div>
      {!collapsed && <div style={{ marginTop: 6, lineHeight: 1.5 }}>
        <div>연결: {stats.connecting ? "연결중" : stats.connected ? "연결됨" : "미연결"}</div>
        <div>시작/완료: {stats.totalStarted} / {stats.totalFinished}</div>
        <div>
          현재 소요: {typeof activeElapsedMs === "number" ? `${(activeElapsedMs / 1000).toFixed(1)}s` : "-"}
        </div>
        <div>마지막 소요: {typeof stats.lastBatchDurationMs === "number" ? `${stats.lastBatchDurationMs}ms` : "-"}</div>
        <div>마지막 툴: {stats.lastToolName || "-"}</div>
        <div>
          마지막 완료:{" "}
          {stats.lastCompletedAt
            ? new Date(stats.lastCompletedAt).toLocaleTimeString("ko-KR")
            : "-"}
        </div>
      </div>}
    </div>
  );
}
