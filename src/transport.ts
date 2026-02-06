import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

// Import all tool handlers to be registered
import {
  courseUpsertSchema,
  courseUpsertHandler,
  courseGetSchema,
  courseGetHandler,
  courseListSchema,
  courseListHandler,
} from './tools/course.js';
import {
  instructorUpsertSchema,
  instructorUpsertHandler,
  instructorGetSchema,
  instructorGetHandler,
  instructorListSchema,
  instructorListHandler,
} from './tools/instructor.js';
import {
  moduleBatchSetSchema,
  moduleBatchSetHandler,
} from './tools/module.js';
import {
  scheduleUpsertSchema,
  scheduleUpsertHandler,
  scheduleGetSchema,
  scheduleGetHandler,
} from './tools/schedule.js';
import {
  templateCreateSchema,
  templateCreateHandler,
  templateGetSchema,
  templateGetHandler,
  templateListSchema,
  templateListHandler,
  templatePreviewHtmlSchema,
  templatePreviewHtmlHandler,
} from './tools/template.js';
import {
  renderCoursePdfSchema,
  renderCoursePdfHandler,
  renderSchedulePdfSchema,
  renderSchedulePdfHandler,
} from './tools/render.js';
import {
  testEchoSchema,
  testEchoHandler,
} from './tools/test.js';

const PORT = process.env.PORT || 7777;
const app = express();

// Enable CORS for all origins
app.use(cors());
app.use(express.json()); // For parsing application/json

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Factory function to create MCP Server instance per connection
function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'edux-sse',
    version: '1.0.0',
  }, {
    capabilities: {
      tools: {},
    }
  });

  // Register all tools
  server.tool('course.upsert', '코스 생성 또는 수정', courseUpsertSchema, async (args) => courseUpsertHandler(args));
  server.tool('course.get', '코스 단건 조회 (모듈, 스케줄 포함)', courseGetSchema, async (args) => courseGetHandler(args));
  server.tool('course.list', '코스 목록 조회', courseListSchema, async (args) => courseListHandler(args));
  server.tool('instructor.upsert', '강사 생성 또는 수정', instructorUpsertSchema, async (args) => instructorUpsertHandler(args));
  server.tool('instructor.get', '강사 단건 조회', instructorGetSchema, async (args) => instructorGetHandler(args));
  server.tool('instructor.list', '강사 목록 조회', instructorListSchema, async (args) => instructorListHandler(args));
  server.tool('module.batchSet', '코스의 모듈 목록을 일괄 교체', moduleBatchSetSchema, async (args) => moduleBatchSetHandler(args));
  server.tool('schedule.upsert', '수업 일정 생성 또는 수정', scheduleUpsertSchema, async (args) => scheduleUpsertHandler(args));
  server.tool('schedule.get', '일정 단건 조회', scheduleGetSchema, async (args) => scheduleGetHandler(args));
  server.tool('template.create', '새 템플릿 생성', templateCreateSchema, async (args) => templateCreateHandler(args));
  server.tool('template.get', '템플릿 단건 조회', templateGetSchema, async (args) => templateGetHandler(args));
  server.tool('template.list', '템플릿 목록 조회', templateListSchema, async (args) => templateListHandler(args));
  server.tool('template.previewHtml', 'Handlebars 템플릿 미리보기', templatePreviewHtmlSchema, async (args) => templatePreviewHtmlHandler(args));
  server.tool('render.coursePdf', '코스 PDF 생성', renderCoursePdfSchema, async (args) => renderCoursePdfHandler(args));
  server.tool('render.schedulePdf', '일정 PDF 생성', renderSchedulePdfSchema, async (args) => renderSchedulePdfHandler(args));
  server.tool('test.echo', '에코 테스트', testEchoSchema, async (args) => testEchoHandler(args));

  return server;
}


// Serve static PDF files
app.use('/pdf', express.static('public/pdf'));

// Store active sessions: sessionId -> { transport, server }
const sessions: Map<string, { transport: SSEServerTransport; server: McpServer }> = new Map();

// SSE endpoint - client connects here to receive messages
app.get('/sse', async (req, res) => {
  // Create transport - it generates its own sessionId internally
  const transport = new SSEServerTransport('/messages', res);

  // Get the sessionId from transport (generated internally by SSEServerTransport)
  const sessionId = transport.sessionId;

  // Create new MCP server instance for this connection
  const server = createMcpServer();

  // Store session using transport's sessionId
  sessions.set(sessionId, { transport, server });
  console.log(`[SSE] Client connected: ${sessionId}`);

  res.on('close', () => {
    sessions.delete(sessionId);
    console.log(`[SSE] Client disconnected: ${sessionId}`);
  });

  // Connect MCP server to transport
  await server.connect(transport);
});

// Messages endpoint - client sends messages here
app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const session = sessions.get(sessionId);

  if (!session) {
    console.log(`[SSE] Session not found: ${sessionId}`);
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  try {
    // Pass pre-parsed body to handlePostMessage (third parameter)
    await session.transport.handlePostMessage(req, res, req.body);
  } catch (error) {
    console.error('[SSE] Error handling message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`[edux] SSE Server running on http://localhost:${PORT}`);
  console.log(`[edux] Health check: http://localhost:${PORT}/health`);
});