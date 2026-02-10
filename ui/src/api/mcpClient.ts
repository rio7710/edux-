// MCP Client for SSE communication with backend

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

class McpClient {
  private eventSource: EventSource | null = null;
  private sessionId: string | null = null;
  private messageId = 0;
  private pendingRequests = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (reason: unknown) => void;
    }
  >();
  private connected = false;
  private onConnectCallbacks: Array<() => void> = [];

  async connect(): Promise<void> {
    if (this.connected) return;

    return new Promise((resolve, reject) => {
      this.eventSource = new EventSource("/sse");

      this.eventSource.onopen = () => {
        console.log("[MCP] SSE connected");
      };

      // Handle endpoint event (MCP SDK sends this as a named event)
      this.eventSource.addEventListener("endpoint", (event: MessageEvent) => {
        const endpointUrl = event.data;
        console.log("[MCP] Received endpoint:", endpointUrl);
        const url = new URL(endpointUrl, window.location.origin);
        this.sessionId = url.searchParams.get("sessionId");
        this.connected = true;
        console.log("[MCP] Session ID:", this.sessionId);
        this.onConnectCallbacks.forEach((cb) => cb());
        resolve();
      });

      // Handle message events (responses from MCP server)
      this.eventSource.addEventListener("message", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);

          if (data.id !== undefined && this.pendingRequests.has(data.id)) {
            const { resolve, reject } = this.pendingRequests.get(data.id)!;
            this.pendingRequests.delete(data.id);

            if (data.error) {
              reject(new Error(data.error.message));
            } else {
              resolve(data.result);
            }
          }
        } catch (e) {
          console.error("[MCP] Failed to parse message:", e);
          // If JSON parsing fails, we cannot determine which request this message was for.
          // Reject all pending requests to prevent them from hanging indefinitely.
          this.pendingRequests.forEach(({ reject }) => {
            reject(
              new Error(
                "Failed to parse server message. The request may not have been processed.",
              ),
            );
          });
          this.pendingRequests.clear();
        }
      });

      this.eventSource.onerror = (error) => {
        console.error("[MCP] SSE error:", error);
        this.connected = false;
        reject(error);
      };
    });
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.connected = false;
    this.sessionId = null;
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
    if (!this.connected || !this.sessionId) {
      await this.connect();
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
      this.pendingRequests.set(id, {
        resolve: (result: unknown) => {
          const mcpResult = result as McpResponse["result"];
          if (mcpResult?.isError) {
            const errorText = mcpResult.content?.[0]?.text || "Unknown error";
            reject(new Error(errorText));
          } else {
            const text = mcpResult?.content?.[0]?.text || "{}";
            try {
              const parsed = JSON.parse(text) as T;
              console.log("[MCP] Tool response:", name, parsed);
              resolve(parsed);
            } catch {
              console.log("[MCP] Tool response (raw):", name, text);
              resolve(text as T);
            }
          }
        },
        reject,
      });

      console.log("[MCP] Tool request:", name, args);
      fetch(`/messages?sessionId=${this.sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      }).catch(reject);
    });
  }
}

export const mcpClient = new McpClient();

// API functions for each tool
export const api = {
  // Course
  courseUpsert: (data: {
    id?: string;
    title: string;
    description?: string;
    durationHours?: number;
    isOnline?: boolean;
    equipment?: string[];
    goal?: string;
    notes?: string;
    instructorIds?: string[];
    token?: string;
  }) => mcpClient.callTool("course.upsert", data),

  courseGet: (id: string) => mcpClient.callTool("course.get", { id }),

  courseList: (limit = 50, offset = 0) =>
    mcpClient.callTool("course.list", { limit, offset }),

  // Instructor
  instructorUpsert: (data: {
    id?: string;
    userId?: string;
    name: string;
    title?: string;
    email?: string;
    phone?: string;
    affiliation?: string;
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

  lectureGet: (id: string) => mcpClient.callTool("lecture.get", { id }),

  lectureList: (courseId: string, limit = 50, offset = 0) =>
    mcpClient.callTool("lecture.list", { courseId, limit, offset }),

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

  scheduleGet: (id: string) => mcpClient.callTool("schedule.get", { id }),

  // Template
  templateCreate: (data: {
    name: string;
    type: string;
    html: string;
    css: string;
    token?: string;
  }) => mcpClient.callTool("template.create", data),

  templateGet: (id: string) => mcpClient.callTool("template.get", { id }),

  templateList: (page = 1, pageSize = 20, type?: string) =>
    mcpClient.callTool("template.list", { page, pageSize, type }),

  templatePreviewHtml: (
    html: string,
    css: string,
    data: Record<string, unknown>,
  ) => mcpClient.callTool("template.previewHtml", { html, css, data }),

  // Render
  renderCoursePdf: (templateId: string, courseId: string) =>
    mcpClient.callTool("render.coursePdf", { templateId, courseId }),

  renderSchedulePdf: (templateId: string, scheduleId: string) =>
    mcpClient.callTool("render.schedulePdf", { templateId, scheduleId }),

  // Test
  testEcho: (message: string) => mcpClient.callTool("test.echo", { message }),

  // User Authentication
  userRegister: (data: {
    email: string;
    password: string;
    name: string;
    isInstructorRequested?: boolean;
  }) => mcpClient.callTool("user.register", data),

  userLogin: (data: { email: string; password: string }) =>
    mcpClient.callTool("user.login", data),

  userMe: (token: string) => mcpClient.callTool("user.me", { token }),

  userGet: (token: string, userId: string) =>
    mcpClient.callTool("user.get", { token, userId }),

  userUpdate: (data: {
    token: string;
    name?: string;
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
    links?: any;
  }) => mcpClient.callTool("user.requestInstructor", data),

  approveInstructor: (data: { token: string; userId: string }) =>
    mcpClient.callTool("user.approveInstructor", data),

  updateInstructorProfile: (data: {
    token: string;
    displayName?: string;
    title?: string;
    bio?: string;
    phone?: string;
    website?: string;
    links?: any;
  }) => mcpClient.callTool("user.updateInstructorProfile", data),

  userUpdateByAdmin: (data: {
    token: string;
    userId: string;
    name?: string;
    role?: "admin" | "operator" | "editor" | "instructor" | "viewer" | "guest";
    isActive?: boolean;
  }) => mcpClient.callTool("user.updateByAdmin", data),

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
