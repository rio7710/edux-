// MCP Client for SSE communication with backend

type McpResponse = {
  jsonrpc: '2.0';
  id: number;
  result?: {
    content: Array<{ type: 'text'; text: string }>;
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
  private pendingRequests = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
  }>();
  private connected = false;
  private onConnectCallbacks: Array<() => void> = [];

  async connect(): Promise<void> {
    if (this.connected) return;

    return new Promise((resolve, reject) => {
      this.eventSource = new EventSource('/sse');

      this.eventSource.onopen = () => {
        console.log('[MCP] SSE connected');
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle session ID from endpoint event
          if (data.endpoint) {
            // Extract sessionId from endpoint URL
            const url = new URL(data.endpoint, window.location.origin);
            this.sessionId = url.searchParams.get('sessionId');
            this.connected = true;
            console.log('[MCP] Session ID:', this.sessionId);
            this.onConnectCallbacks.forEach(cb => cb());
            resolve();
            return;
          }

          // Handle response
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
          console.error('[MCP] Failed to parse message:', e);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('[MCP] SSE error:', error);
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

  async callTool<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
    if (!this.connected || !this.sessionId) {
      await this.connect();
    }

    const id = ++this.messageId;

    const request = {
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name,
        arguments: args,
      },
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve: (result: unknown) => {
          const mcpResult = result as McpResponse['result'];
          if (mcpResult?.isError) {
            const errorText = mcpResult.content?.[0]?.text || 'Unknown error';
            reject(new Error(errorText));
          } else {
            const text = mcpResult?.content?.[0]?.text || '{}';
            try {
              resolve(JSON.parse(text) as T);
            } catch {
              resolve(text as T);
            }
          }
        },
        reject,
      });

      fetch(`/messages?sessionId=${this.sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
  }) => mcpClient.callTool('course.upsert', data),

  courseGet: (id: string) => mcpClient.callTool('course.get', { id }),

  // Instructor
  instructorUpsert: (data: {
    id?: string;
    name: string;
    title?: string;
    email?: string;
    phone?: string;
    affiliation?: string;
    specialties?: string[];
  }) => mcpClient.callTool('instructor.upsert', data),

  instructorGet: (id: string) => mcpClient.callTool('instructor.get', { id }),

  // Module
  moduleBatchSet: (courseId: string, modules: Array<{
    title: string;
    details?: string;
    hours?: number;
    order?: number;
  }>) => mcpClient.callTool('module.batchSet', { courseId, modules }),

  // Schedule
  scheduleUpsert: (data: {
    id?: string;
    courseId: string;
    instructorId?: string;
    date?: string;
    location?: string;
    audience?: string;
    remarks?: string;
  }) => mcpClient.callTool('schedule.upsert', data),

  scheduleGet: (id: string) => mcpClient.callTool('schedule.get', { id }),

  // Template
  templateCreate: (data: {
    name: string;
    html: string;
    css: string;
    createdBy?: string;
  }) => mcpClient.callTool('template.create', data),

  templateGet: (id: string) => mcpClient.callTool('template.get', { id }),

  templateList: (page = 1, pageSize = 20) =>
    mcpClient.callTool('template.list', { page, pageSize }),

  templatePreviewHtml: (html: string, css: string, data: Record<string, unknown>) =>
    mcpClient.callTool('template.previewHtml', { html, css, data }),

  // Render
  renderCoursePdf: (templateId: string, courseId: string) =>
    mcpClient.callTool('render.coursePdf', { templateId, courseId }),

  renderSchedulePdf: (templateId: string, scheduleId: string) =>
    mcpClient.callTool('render.schedulePdf', { templateId, scheduleId }),
};
