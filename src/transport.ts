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
} from './tools/course.js';
import {
  instructorUpsertSchema,
  instructorUpsertHandler,
  instructorGetSchema,
  instructorGetHandler,
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

const PORT = process.env.PORT || 7777;
const app = express();

// Enable CORS for all origins
app.use(cors());
app.use(express.json()); // For parsing application/json

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Create an instance of the MCP Server for SSE mode
const sseMcpServer = new McpServer({
  name: 'edux-sse',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {}, // Enable tools capability
    // Other capabilities as needed
  }
});

// Register all tool handlers with the SSE MCP server
// 툴 등록: course.upsert
sseMcpServer.tool(
  'course.upsert',
  '코스 생성 또는 수정',
  courseUpsertSchema,
  async (args) => courseUpsertHandler(args)
);

// 툴 등록: course.get
sseMcpServer.tool(
  'course.get',
  '코스 단건 조회 (모듈, 스케줄 포함)',
  courseGetSchema,
  async (args) => courseGetHandler(args)
);

// 툴 등록: instructor.upsert
sseMcpServer.tool(
  'instructor.upsert',
  '강사 생성 또는 수정',
  instructorUpsertSchema,
  async (args) => instructorUpsertHandler(args)
);

// 툴 등록: instructor.get
sseMcpServer.tool(
  'instructor.get',
  '강사 단건 조회',
  instructorGetSchema,
  async (args) => instructorGetHandler(args)
);

// 툴 등록: module.batchSet
sseMcpServer.tool(
  'module.batchSet',
  '코스의 모듈 목록을 일괄 교체 (기존 모듈 삭제 후 재생성)',
  moduleBatchSetSchema,
  async (args) => moduleBatchSetHandler(args)
);

// 툴 등록: schedule.upsert
sseMcpServer.tool(
  'schedule.upsert',
  '수업 일정 생성 또는 수정',
  scheduleUpsertSchema,
  async (args) => scheduleUpsertHandler(args)
);

// 툴 등록: schedule.get
sseMcpServer.tool(
  'schedule.get',
  '일정 단건 조회 (코스·강사 관계 포함)',
  scheduleGetSchema,
  async (args) => scheduleGetHandler(args)
);

// 툴 등록: template.create
sseMcpServer.tool(
  'template.create',
  '새 템플릿 생성',
  templateCreateSchema,
  async (args) => templateCreateHandler(args)
);

// 툴 등록: template.get
sseMcpServer.tool(
  'template.get',
  '템플릿 단건 조회 (버전 이력 포함)',
  templateGetSchema,
  async (args) => templateGetHandler(args)
);

// 툴 등록: template.list
sseMcpServer.tool(
  'template.list',
  '템플릿 목록 조회',
  templateListSchema,
  async (args) => templateListHandler(args)
);

// 툴 등록: template.previewHtml
sseMcpServer.tool(
  'template.previewHtml',
  'Handlebars 템플릿에 데이터를 주입하여 완성된 HTML을 반환',
  templatePreviewHtmlSchema,
  async (args) => templatePreviewHtmlHandler(args)
);

// 툴 등록: render.coursePdf
sseMcpServer.tool(
  'render.coursePdf',
  '코스 데이터 + 템플릿으로 PDF를 생성합니다. (비동기 처리)',
  renderCoursePdfSchema,
  async (args) => renderCoursePdfHandler(args)
);

// 툴 등록: render.schedulePdf
sseMcpServer.tool(
  'render.schedulePdf',
  '일정 데이터 + 템플릿으로 PDF를 생성합니다. (비동기 처리)',
  renderSchedulePdfSchema,
  async (args) => renderSchedulePdfHandler(args)
);


// Serve static PDF files
app.use('/pdf', express.static('public/pdf'));

// Store active SSE transports by session
const transports: Map<string, SSEServerTransport> = new Map();

// SSE endpoint - client connects here to receive messages
app.get('/sse', async (req, res) => {
  const sseTransport = new SSEServerTransport('/messages', res);
  const sessionId = Date.now().toString();
  transports.set(sessionId, sseTransport);

  res.on('close', () => {
    transports.delete(sessionId);
    console.log(`[SSE] Client disconnected: ${sessionId}`);
  });

  await sseMcpServer.connect(sseTransport);
  console.log(`[SSE] Client connected: ${sessionId}`);
});

// Messages endpoint - client sends messages here
app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);

  if (!transport) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  try {
    await transport.handlePostMessage(req, res);
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