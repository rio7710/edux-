// MCP Client for SSE communication with backend
import {
  attachErrorReportId,
  getErrorReportId,
  recordClientErrorReport,
  type ClientErrorPhase,
} from "../utils/errorReport";

type McpResponse = {
  jsonrpc: "2.0";
  id: number;
  result?: {
    content: Array<{ type: "text"; text: string }>;
    isError?: boolean;
  };
  error?: {
    code: number;
    message: string;
  };
};

export type McpRequestStats = {
  pendingCount: number;
  totalStarted: number;
  totalFinished: number;
  lastToolName: string | null;
  lastCompletedAt: number | null;
  completionCount: number;
  activeSinceAt: number | null;
  connectingSinceAt: number | null;
  lastBatchDurationMs: number | null;
  connected: boolean;
  connecting: boolean;
};

const MCP_CONNECT_ERROR_MESSAGE =
  "MCP 서버에 연결할 수 없습니다. 백엔드 서버(http://localhost:7777)를 확인하세요.";
const MCP_CONNECT_TIMEOUT_MS = Number(
  import.meta.env.VITE_MCP_CONNECT_TIMEOUT_MS ?? 20000,
);
const MCP_REQUEST_TIMEOUT_MS = Number(
  import.meta.env.VITE_MCP_REQUEST_TIMEOUT_MS ?? 45000,
);

class McpClient {
  private eventSource: EventSource | null = null;
  private sessionId: string | null = null;
  private messageId = 0;
  private pendingRequests = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (reason: unknown) => void;
      toolName: string;
      args: Record<string, unknown>;
      startedAt: number;
    }
  >();
  private connected = false;
  private onConnectCallbacks: Array<() => void> = [];
  private baseUrl: string;
  private connecting: Promise<void> | null = null;
  private reconnectTimer: number | null = null;
  private endpointHandler: ((event: MessageEvent) => void) | null = null;
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private activeBaseUrl: string;
  private requestStats: McpRequestStats = {
    pendingCount: 0,
    totalStarted: 0,
    totalFinished: 0,
    lastToolName: null,
    lastCompletedAt: null,
    completionCount: 0,
    activeSinceAt: null,
    connectingSinceAt: null,
    lastBatchDurationMs: null,
    connected: false,
    connecting: false,
  };
  private requestStatsListeners = new Set<(stats: McpRequestStats) => void>();

  constructor() {
    const envBase = import.meta.env.VITE_MCP_BASE_URL as string | undefined;
    this.baseUrl = envBase ?? (import.meta.env.DEV ? "http://localhost:7777" : "");
    this.activeBaseUrl = this.baseUrl;
  }

  private logToolError(params: {
    phase: ClientErrorPhase;
    toolName: string;
    args?: Record<string, unknown>;
    requestId?: number;
    httpStatus?: number;
    responseBody?: string;
    error: unknown;
    extra?: Record<string, unknown>;
  }): Error {
    const error =
      params.error instanceof Error
        ? params.error
        : new Error(typeof params.error === "string" ? params.error : "Unknown error");

    const report = recordClientErrorReport({
      phase: params.phase,
      toolName: params.toolName,
      args: params.args,
      requestId: params.requestId,
      sessionId: this.sessionId,
      baseUrl: this.activeBaseUrl,
      httpStatus: params.httpStatus,
      responseBody: params.responseBody,
      error,
      extra: params.extra,
    });

    return attachErrorReportId(error, report.id);
  }

  private emitRequestStats(): void {
    const snapshot = this.getRequestStats();
    this.requestStatsListeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch {
        // ignore observer errors
      }
    });
  }

  private markRequestStart(toolName: string): void {
    if (this.requestStats.pendingCount === 0 && !this.requestStats.activeSinceAt) {
      this.requestStats.activeSinceAt = Date.now();
    }
    this.requestStats.pendingCount += 1;
    this.requestStats.totalStarted += 1;
    this.requestStats.lastToolName = toolName;
    this.emitRequestStats();
  }

  private markRequestFinished(toolName: string): void {
    const previousPending = this.requestStats.pendingCount;
    this.requestStats.pendingCount = Math.max(0, this.requestStats.pendingCount - 1);
    this.requestStats.totalFinished += 1;
    this.requestStats.lastToolName = toolName;
    if (previousPending > 0 && this.requestStats.pendingCount === 0) {
      const endedAt = Date.now();
      if (this.requestStats.activeSinceAt) {
        this.requestStats.lastBatchDurationMs = Math.max(
          0,
          endedAt - this.requestStats.activeSinceAt,
        );
      }
      this.requestStats.activeSinceAt = null;
      this.requestStats.lastCompletedAt = Date.now();
      this.requestStats.completionCount += 1;
    }
    this.emitRequestStats();
  }

  getRequestStats(): McpRequestStats {
    return { ...this.requestStats };
  }

  onRequestStatsChange(callback: (stats: McpRequestStats) => void): () => void {
    this.requestStatsListeners.add(callback);
    callback(this.getRequestStats());
    return () => {
      this.requestStatsListeners.delete(callback);
    };
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.connecting) return this.connecting;
    this.requestStats.connecting = true;
    this.requestStats.connectingSinceAt = Date.now();
    this.emitRequestStats();

    const connectOnce = (baseUrl: string) =>
      new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          this.disconnect();
          reject(new Error("MCP 연결 시간이 초과되었습니다."));
        }, MCP_CONNECT_TIMEOUT_MS);

        const url = baseUrl ? `${baseUrl}/sse` : "/sse";
        this.activeBaseUrl = baseUrl;
        this.eventSource = new EventSource(url);

        this.eventSource.onopen = () => {
          console.log("[MCP] SSE connected");
        };

        // Handle endpoint event (MCP SDK sends this as a named event)
        this.endpointHandler = (event: MessageEvent) => {
          const endpointUrl = event.data;
          console.log("[MCP] Received endpoint:", endpointUrl);
          const endpoint = new URL(endpointUrl, window.location.origin);
          this.sessionId = endpoint.searchParams.get("sessionId");
          this.connected = true;
          this.requestStats.connected = true;
          this.requestStats.connecting = false;
          this.requestStats.connectingSinceAt = null;
          console.log("[MCP] Session ID:", this.sessionId);
          this.onConnectCallbacks.forEach((cb) => cb());
          this.emitRequestStats();
          window.clearTimeout(timeout);
          resolve();
        };
        this.eventSource.addEventListener("endpoint", this.endpointHandler as EventListener);

        // Handle message events (responses from MCP server)
        this.messageHandler = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);

            if (data.id !== undefined && this.pendingRequests.has(data.id)) {
              const { resolve, reject, toolName, args } = this.pendingRequests.get(data.id)!;
              this.pendingRequests.delete(data.id);

              if (data.error) {
                const logged = this.logToolError({
                  phase: "jsonrpc_error",
                  toolName,
                  args,
                  requestId: data.id,
                  error: new Error(data.error.message),
                  extra: {
                    code: typeof data.error?.code === "number" ? data.error.code : undefined,
                  },
                });
                reject(logged);
              } else {
                resolve(data.result);
              }
            }
          } catch (e) {
            console.error("[MCP] Failed to parse message:", e);
            // If JSON parsing fails, we cannot determine which request this message was for.
            // Reject all pending requests to prevent them from hanging indefinitely.
            const rawMessage =
              typeof event.data === "string" ? event.data.slice(0, 1000) : String(event.data);
            this.pendingRequests.forEach(({ reject, toolName, args }, requestId) => {
              const logged = this.logToolError({
                phase: "message_parse",
                toolName,
                args,
                requestId,
                error: new Error(
                  "Failed to parse server message. The request may not have been processed.",
                ),
                extra: { rawMessage },
              });
              reject(logged);
            });
            this.pendingRequests.clear();
          }
        };
        this.eventSource.addEventListener("message", this.messageHandler as EventListener);

        this.eventSource.onerror = (error) => {
          console.error("[MCP] SSE error:", error);
          // If initial connect has not completed yet, fail this attempt.
          if (!this.connected) {
            window.clearTimeout(timeout);
            reject(new Error(MCP_CONNECT_ERROR_MESSAGE));
            return;
          }

          // After a successful connection, SSE can drop on backend restart.
          // Mark session invalid and schedule reconnect without failing callers.
          this.connected = false;
          this.sessionId = null;
          this.requestStats.connected = false;
          this.emitRequestStats();
          this.scheduleReconnect();
        };
      });

    this.connecting = (async () => {
      try {
        await connectOnce(this.baseUrl);
      } catch (err) {
        // Try the alternate route once (direct URL <-> Vite proxy path).
        const fallback = this.baseUrl ? "" : "http://localhost:7777";
        try {
          await connectOnce(fallback);
        } catch {
          throw new Error(MCP_CONNECT_ERROR_MESSAGE);
        }
      } finally {
        this.connecting = null;
        this.requestStats.connecting = false;
        this.requestStats.connectingSinceAt = null;
        this.emitRequestStats();
      }
    })();

    return this.connecting;
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.eventSource) {
      if (this.endpointHandler) {
        this.eventSource.removeEventListener("endpoint", this.endpointHandler as EventListener);
      }
      if (this.messageHandler) {
        this.eventSource.removeEventListener("message", this.messageHandler as EventListener);
      }
      this.eventSource.close();
      this.eventSource = null;
    }
    this.endpointHandler = null;
    this.messageHandler = null;
    this.connected = false;
    this.sessionId = null;
    this.requestStats.connected = false;
    this.requestStats.connecting = false;
    this.requestStats.connectingSinceAt = null;
    this.emitRequestStats();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.connected || this.connecting) return;
      try {
        await this.connect();
      } catch (err) {
        console.error("[MCP] Reconnect failed:", err);
        this.scheduleReconnect();
      }
    }, 1000);
  }

  onConnect(callback: () => void): void {
    if (this.connected) {
      callback();
    } else {
      this.onConnectCallbacks.push(callback);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async callTool<T = unknown>(
    name: string,
    args: Record<string, unknown>,
  ): Promise<T> {
    this.markRequestStart(name);
    let finalized = false;
    const finalize = () => {
      if (finalized) return;
      finalized = true;
      this.markRequestFinished(name);
    };

    if (!this.connected || !this.sessionId) {
      try {
        await this.connect();
      } catch (error) {
        finalize();
        throw this.logToolError({
          phase: "connect",
          toolName: name,
          args,
          error,
        });
      }
    }

    const id = ++this.messageId;

    const request = {
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: {
        name,
        arguments: args,
      },
    };

    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.pendingRequests.delete(id);
        finalize();
        const logged = this.logToolError({
          phase: "request_timeout",
          toolName: name,
          args,
          requestId: id,
          error: new Error("요청 시간이 초과되었습니다."),
        });
        reject(logged);
      }, MCP_REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(id, {
        resolve: (result: unknown) => {
          window.clearTimeout(timeout);
          const mcpResult = result as McpResponse["result"];
          if (mcpResult?.isError) {
            const errorText = mcpResult.content?.[0]?.text || "Unknown error";
            const logged = this.logToolError({
              phase: "tool_result_error",
              toolName: name,
              args,
              requestId: id,
              error: new Error(errorText),
            });
            finalize();
            reject(logged);
          } else {
            const text = mcpResult?.content?.[0]?.text || "{}";
            try {
              const parsed = JSON.parse(text) as T;
              console.log("[MCP] Tool response:", name, parsed);
              finalize();
              resolve(parsed);
            } catch {
              console.log("[MCP] Tool response (raw):", name, text);
              finalize();
              resolve(text as T);
            }
          }
        },
        reject: (reason: unknown) => {
          window.clearTimeout(timeout);
          finalize();
          reject(reason);
        },
        toolName: name,
        args,
        startedAt: Date.now(),
      });

      console.log("[MCP] Tool request:", name, args);
      fetch(`${this.activeBaseUrl}/messages?sessionId=${this.sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      })
        .then(async (res) => {
          if (res.ok) return;
          window.clearTimeout(timeout);
          this.pendingRequests.delete(id);
          if (res.status === 404) {
            this.disconnect();
            try {
              const retried = await this.callTool<T>(name, args);
              finalize();
              resolve(retried);
            } catch (err) {
              if (getErrorReportId(err)) {
                finalize();
                reject(err);
              } else {
                const logged = this.logToolError({
                  phase: "http_error",
                  toolName: name,
                  args,
                  requestId: id,
                  httpStatus: 404,
                  error: err,
                  extra: { retryAfterSessionNotFound: true },
                });
                finalize();
                reject(logged);
              }
            }
            return;
          }
          const text = await res.text().catch(() => "");
          const messageText =
            res.status >= 500 && !text
              ? "MCP 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
              : `MCP request failed (${res.status})${text ? `: ${text}` : ""}`;
          const logged = this.logToolError({
            phase: "http_error",
            toolName: name,
            args,
            requestId: id,
            httpStatus: res.status,
            responseBody: text,
            error: new Error(messageText),
          });
          finalize();
          reject(logged);
        })
        .catch((err) => {
          window.clearTimeout(timeout);
          this.pendingRequests.delete(id);
          if (getErrorReportId(err)) {
            finalize();
            reject(err);
            return;
          }
          const logged = this.logToolError({
            phase: "network_error",
            toolName: name,
            args,
            requestId: id,
            error: err,
          });
          finalize();
          reject(logged);
        });
    });
  }
}

export const mcpClient = new McpClient();

// API functions for each tool
export const api = {
  dashboardBootstrap: (data: { token: string }) =>
    mcpClient.callTool("dashboard.bootstrap", data),

  // Course
  courseUpsert: (data: {
    id?: string;
    title: string;
    description?: string;
    durationHours?: number;
    isOnline?: boolean;
    equipment?: string[];
    goal?: string;
    content?: string;
    notes?: string;
    instructorIds?: string[];
    token?: string;
  }) => mcpClient.callTool("course.upsert", data),

  courseGet: (id: string, token: string) =>
    mcpClient.callTool("course.get", { id, token }),

  courseList: (limit = 50, offset = 0, token: string) =>
    mcpClient.callTool("course.list", { limit, offset, token }),

  courseListMine: (token: string, limit = 50, offset = 0) =>
    mcpClient.callTool("course.listMine", { token, limit, offset }),

  courseDelete: (data: { id: string; token: string }) =>
    mcpClient.callTool("course.delete", data),

  courseShareInvite: (data: { token: string; courseId: string; targetUserId: string }) =>
    mcpClient.callTool("course.shareInvite", data),

  courseShareRespond: (data: {
    token: string;
    courseId: string;
    accept: boolean;
    reason?: string;
  }) =>
    mcpClient.callTool("course.shareRespond", data),

  courseShareListReceived: (data: {
    token: string;
    status?: "pending" | "accepted" | "rejected";
  }) => mcpClient.callTool("course.shareListReceived", data),

  courseShareListForCourse: (data: { token: string; courseId: string }) =>
    mcpClient.callTool("course.shareListForCourse", data),

  courseShareRevoke: (data: { token: string; courseId: string; targetUserId: string }) =>
    mcpClient.callTool("course.shareRevoke", data),

  courseShareLeave: (data: { token: string; courseId: string }) =>
    mcpClient.callTool("course.shareLeave", data),

  courseShareTargets: (data: { token: string; query?: string; limit?: number }) =>
    mcpClient.callTool("course.shareTargets", data),

  // Instructor
  instructorUpsert: (data: {
    id?: string;
    userId?: string;
    name: string;
    title?: string;
    email?: string;
    phone?: string;
    affiliation?: string;
    tagline?: string;
    avatarUrl?: string;
    bio?: string;
    specialties?: string[];
    certifications?: { name: string; issuer?: string; date?: string; fileUrl?: string }[];
    awards?: string[];
    degrees?: { name: string; school: string; major: string; year: string; fileUrl?: string }[];
    careers?: { company: string; role: string; period: string; description?: string }[];
    publications?: { title: string; type: string; year?: string; publisher?: string; url?: string }[];
    token?: string;
  }) => mcpClient.callTool("instructor.upsert", data),

  instructorGet: (id: string) => mcpClient.callTool("instructor.get", { id }),

  instructorGetByUser: (token: string) =>
    mcpClient.callTool("instructor.getByUser", { token }),

  instructorList: (limit = 50, offset = 0) =>
    mcpClient.callTool("instructor.list", { limit, offset }),

  // Lecture
  lectureUpsert: (data: {
    id?: string;
    courseId: string;
    title: string;
    description?: string;
    hours?: number;
    order?: number;
    token?: string;
  }) => mcpClient.callTool("lecture.upsert", data),

  lectureMap: (data: {
    lectureId: string;
    courseId: string;
    order?: number;
    token: string;
  }) => mcpClient.callTool("lecture.map", data),

  lectureGrantList: (data: { lectureId: string; token: string }) =>
    mcpClient.callTool("lecture.grant.list", data),

  lectureGrantUpsert: (data: {
    lectureId: string;
    userId: string;
    canMap?: boolean;
    canEdit?: boolean;
    canReshare?: boolean;
    token: string;
  }) => mcpClient.callTool("lecture.grant.upsert", data),

  lectureGrantDelete: (data: { lectureId: string; userId: string; token: string }) =>
    mcpClient.callTool("lecture.grant.delete", data),

  lectureGrantListMine: (data: { token: string }) =>
    mcpClient.callTool("lecture.grant.listMine", data),

  lectureGrantLeave: (data: { lectureId: string; token: string }) =>
    mcpClient.callTool("lecture.grant.leave", data),

  lectureGet: (id: string, token: string) => mcpClient.callTool("lecture.get", { id, token }),

  lectureList: (courseId: string, limit = 50, offset = 0, token: string) =>
    mcpClient.callTool("lecture.list", { courseId, limit, offset, token }),

  lectureDelete: (id: string, token?: string) =>
    mcpClient.callTool("lecture.delete", { id, token }),

  // Schedule
  scheduleUpsert: (data: {
    id?: string;
    courseId: string;
    instructorId?: string;
    date?: string;
    location?: string;
    audience?: string;
    remarks?: string;
    token?: string;
  }) => mcpClient.callTool("schedule.upsert", data),

  scheduleGet: (id: string, token: string) => mcpClient.callTool("schedule.get", { id, token }),

  // Template
  templateCreate: (data: {
    name: string;
    type: string;
    html: string;
    css: string;
    token: string;
  }) => mcpClient.callTool("template.create", data),

  templateUpsert: (data: {
    id?: string;
    name: string;
    type: string;
    html: string;
    css: string;
    changelog?: string;
    token: string;
  }) => mcpClient.callTool("template.upsert", data),

  templateGet: (id: string, token: string) => mcpClient.callTool("template.get", { id, token }),

  templateList: (page = 1, pageSize = 20, type: string | undefined, token: string) =>
    mcpClient.callTool("template.list", { page, pageSize, type, token }),

  templatePreviewHtml: (
    html: string,
    css: string,
    data: Record<string, unknown>,
  ) => mcpClient.callTool("template.previewHtml", { html, css, data }),

  templateDelete: (data: { id: string; token: string }) =>
    mcpClient.callTool("template.delete", data),

  // Render
  renderCoursePdf: (data: { token: string; templateId: string; courseId: string; label?: string }) =>
    mcpClient.callTool("render.coursePdf", data),

  renderSchedulePdf: (data: { token: string; templateId: string; scheduleId: string; label?: string }) =>
    mcpClient.callTool("render.schedulePdf", data),

  renderInstructorProfilePdf: (data: { token: string; templateId: string; profileId: string; label?: string }) =>
    mcpClient.callTool("render.instructorProfilePdf", data),

  // Test
  testEcho: (message: string) => mcpClient.callTool("test.echo", { message }),

  // User Authentication
  userRegister: (data: {
    email: string;
    password: string;
    name: string;
    isInstructorRequested?: boolean;
    displayName?: string;
    title?: string;
    bio?: string;
    phone?: string;
    website?: string;
  }) => mcpClient.callTool("user.register", data),

  userLogin: (data: { email: string; password: string }) =>
    mcpClient.callTool("user.login", data),

  userRefreshToken: (data: { refreshToken: string; accessToken?: string }) =>
    mcpClient.callTool("user.refreshToken", data),

  userIssueTestToken: (data: { token: string; minutes: number }) =>
    mcpClient.callTool("user.issueTestToken", data),

  userImpersonate: (data: { token: string; targetUserId: string; reason?: string }) =>
    mcpClient.callTool("user.impersonate", data),

  userMe: (token: string) => mcpClient.callTool("user.me", { token }),

  userGet: (token: string, userId: string) =>
    mcpClient.callTool("user.get", { token, userId }),

  userUpdate: (data: {
    token: string;
    name?: string;
    phone?: string | null;
    website?: string | null;
    avatarUrl?: string | null;
    currentPassword?: string;
    newPassword?: string;
  }) => mcpClient.callTool("user.update", data),

  userDelete: (data: { token: string; password: string }) =>
    mcpClient.callTool("user.delete", data),

  userList: (token: string, limit = 50, offset = 0) =>
    mcpClient.callTool("user.list", { token, limit, offset }),

  userUpdateRole: (data: {
    token: string;
    userId: string;
    role: "admin" | "operator" | "editor" | "instructor" | "viewer" | "guest";
  }) => mcpClient.callTool("user.updateRole", data),

  requestInstructor: (data: {
    token: string;
    displayName?: string;
    title?: string;
    bio?: string;
    phone?: string;
    website?: string;
    avatarUrl?: string;
    links?: any;
    degrees?: { name: string; school: string; major: string; year: string; fileUrl?: string }[];
    careers?: { company: string; role: string; period: string; description?: string }[];
    publications?: { title: string; type: string; year?: string; publisher?: string; url?: string }[];
    certifications?: { name: string; issuer?: string; date?: string; fileUrl?: string }[];
    specialties?: string[];
    affiliation?: string;
    email?: string;
  }) => mcpClient.callTool("user.requestInstructor", data),

  approveInstructor: (data: { token: string; userId: string; message?: string }) =>
    mcpClient.callTool("user.approveInstructor", data),

  updateInstructorProfile: (data: {
    token: string;
    displayName?: string;
    title?: string;
    bio?: string;
    phone?: string;
    website?: string;
    links?: any;
    degrees?: { name: string; school: string; major: string; year: string; fileUrl?: string }[];
    careers?: { company: string; role: string; period: string; description?: string }[];
    publications?: { title: string; type: string; year?: string; publisher?: string; url?: string }[];
    certifications?: { name: string; issuer?: string; date?: string; fileUrl?: string }[];
    specialties?: string[];
    affiliation?: string;
    email?: string;
  }) => mcpClient.callTool("user.updateInstructorProfile", data),

  getInstructorProfile: (token: string) =>
    mcpClient.callTool("user.getInstructorProfile", { token }),

  userUpdateByAdmin: (data: {
    token: string;
    userId: string;
    name?: string;
    role?: "admin" | "operator" | "editor" | "instructor" | "viewer" | "guest";
    isActive?: boolean;
  }) => mcpClient.callTool("user.updateByAdmin", data),

  siteSettingGet: (token: string, key: string) =>
    mcpClient.callTool("siteSetting.get", { token, key }),

  siteSettingGetMany: (token: string, keys: string[]) =>
    mcpClient.callTool("siteSetting.getMany", { token, keys }),

  siteSettingUpsert: (data: { token: string; key: string; value: any }) =>
    mcpClient.callTool("siteSetting.upsert", data),

  // Table Config
  tableConfigGet: (token: string, tableKey: string) =>
    mcpClient.callTool("tableConfig.get", { token, tableKey }),

  tableConfigUpsert: (data: {
    token: string;
    tableKey: string;
    columns: Array<{
      columnKey: string;
      label: string;
      customLabel?: string;
      visible: boolean;
      order: number;
      width?: number;
      fixed?: "left" | "right";
    }>;
  }) => mcpClient.callTool("tableConfig.upsert", data),

  // Documents
  documentList: (data: { token: string; page?: number; pageSize?: number }) =>
    mcpClient.callTool("document.list", data),

  documentDelete: (data: { token: string; id: string }) =>
    mcpClient.callTool("document.delete", data),

  documentShare: (data: { token: string; id: string; regenerate?: boolean }) =>
    mcpClient.callTool("document.share", data),

  documentRevokeShare: (data: { token: string; id: string }) =>
    mcpClient.callTool("document.revokeShare", data),

  // Messages
  messageList: (data: {
    token: string;
    limit?: number;
    offset?: number;
    status?: "all" | "unread" | "read";
    category?: "system" | "course_share" | "lecture_grant" | "instructor_approval";
    query?: string;
  }) => mcpClient.callTool("message.list", data),

  messageUnreadCount: (data: {
    token: string;
    category?: "system" | "course_share" | "lecture_grant" | "instructor_approval";
  }) => mcpClient.callTool("message.unreadCount", data),

  messageUnreadSummary: (data: { token: string }) =>
    mcpClient.callTool("message.unreadSummary", data),

  messageMarkRead: (data: { token: string; messageId: string; read?: boolean }) =>
    mcpClient.callTool("message.markRead", data),

  messageMarkAllRead: (data: {
    token: string;
    category?: "system" | "course_share" | "lecture_grant" | "instructor_approval";
  }) => mcpClient.callTool("message.markAllRead", data),

  messageDelete: (data: { token: string; messageId: string }) =>
    mcpClient.callTool("message.delete", data),

  messageSend: (data: {
    token: string;
    recipientUserId: string;
    category?: "system" | "course_share" | "lecture_grant" | "instructor_approval";
    title: string;
    body?: string;
    actionType?: string;
    actionPayload?: unknown;
  }) => mcpClient.callTool("message.send", data),

  messageRecipientList: (data: {
    token: string;
    query?: string;
    limit?: number;
  }) => mcpClient.callTool("message.recipientList", data),

  messageSeedDummy: (data: { token: string; targetUserId?: string; count?: number }) =>
    mcpClient.callTool("message.seedDummy", data),

  // Groups
  groupList: (token: string) => mcpClient.callTool("group.list", { token }),

  groupUpsert: (data: {
    token: string;
    id?: string;
    name: string;
    description?: string;
    isActive?: boolean;
  }) => mcpClient.callTool("group.upsert", data),

  groupDelete: (data: { token: string; id: string }) =>
    mcpClient.callTool("group.delete", data),

  groupMemberList: (data: { token: string; groupId: string }) =>
    mcpClient.callTool("group.member.list", data),

  groupMemberAdd: (data: {
    token: string;
    groupId: string;
    userId: string;
    memberRole?: "owner" | "manager" | "member";
  }) => mcpClient.callTool("group.member.add", data),

  groupMemberRemove: (data: { token: string; groupId: string; userId: string }) =>
    mcpClient.callTool("group.member.remove", data),

  groupMemberUpdateRole: (data: {
    token: string;
    groupId: string;
    userId: string;
    memberRole: "owner" | "manager" | "member";
  }) => mcpClient.callTool("group.member.updateRole", data),

  permissionGrantList: (data: {
    token: string;
    subjectType: "user" | "group" | "role";
    subjectId: string;
  }) => mcpClient.callTool("permission.grant.list", data),

  permissionGrantUpsert: (data: {
    token: string;
    id?: string;
    subjectType: "user" | "group" | "role";
    subjectId: string;
    permissionKey: string;
    effect: "allow" | "deny";
    note?: string;
  }) => mcpClient.callTool("permission.grant.upsert", data),

  permissionGrantDelete: (data: { token: string; id: string }) =>
    mcpClient.callTool("permission.grant.delete", data),

  authzCheck: (data: { token: string; permissionKey: string }) =>
    mcpClient.callTool("authz.check", data),

  // File Upload (REST, not MCP)
  uploadFile: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '업로드 실패' }));
      throw new Error(err.error || '업로드 실패');
    }
    return res.json();
  },
};
