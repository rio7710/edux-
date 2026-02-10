import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
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
  instructorGetByUserSchema,
  instructorGetByUserHandler,
  instructorListSchema,
  instructorListHandler,
} from './tools/instructor.js';
import {
  lectureUpsertSchema,
  lectureUpsertHandler,
  lectureGetSchema,
  lectureGetHandler,
  lectureListSchema,
  lectureListHandler,
  lectureDeleteSchema,
  lectureDeleteHandler,
} from './tools/lecture.js';
import {
  scheduleUpsertSchema,
  scheduleUpsertHandler,
  scheduleGetSchema,
  scheduleGetHandler,
  scheduleListSchema,
  scheduleListHandler,
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
  tableConfigGetSchema,
  tableConfigGetHandler,
  tableConfigUpsertSchema,
  tableConfigUpsertHandler,
} from './tools/tableConfig.js';
import {
  testEchoSchema,
  testEchoHandler,
} from './tools/test.js';
import {
  userRegisterSchema,
  userRegisterHandler,
  userLoginSchema,
  userLoginHandler,
  userRefreshTokenSchema,
  userRefreshTokenHandler,
  userIssueTestTokenSchema,
  userIssueTestTokenHandler,
  userMeSchema,
  userMeHandler,
  userGetSchema,
  userGetHandler,
  userUpdateSchema,
  userUpdateHandler,
  userDeleteSchema,
  userDeleteHandler,
  userListSchema,
  userListHandler,
  userUpdateRoleSchema,
  userUpdateRoleHandler,
  userUpdateByAdminSchema,
  userUpdateByAdminHandler,
  userRequestInstructorSchema,
  requestInstructorHandler,
  userApproveInstructorSchema,
  approveInstructorHandler,
  userUpdateInstructorProfileSchema,
  updateInstructorProfileHandler,
} from './tools/user.js';
import {
  siteSettingGetSchema,
  siteSettingGetHandler,
  siteSettingUpsertSchema,
  siteSettingUpsertHandler,
} from './tools/siteSetting.js';

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
  server.tool('instructor.getByUser', '내 강사 정보 조회', instructorGetByUserSchema, async (args) => instructorGetByUserHandler(args));
  server.tool('instructor.list', '강사 목록 조회', instructorListSchema, async (args) => instructorListHandler(args));
  server.tool('lecture.upsert', '강의 생성 또는 수정', lectureUpsertSchema, async (args) => lectureUpsertHandler(args));
  server.tool('lecture.get', '강의 단건 조회', lectureGetSchema, async (args) => lectureGetHandler(args));
  server.tool('lecture.list', '코스별 강의 목록 조회', lectureListSchema, async (args) => lectureListHandler(args));
  server.tool('lecture.delete', '강의 삭제 (소프트 삭제)', lectureDeleteSchema, async (args) => lectureDeleteHandler(args));
  server.tool('schedule.upsert', '수업 일정 생성 또는 수정', scheduleUpsertSchema, async (args) => scheduleUpsertHandler(args));
  server.tool('schedule.get', '일정 단건 조회', scheduleGetSchema, async (args) => scheduleGetHandler(args));
  server.tool('schedule.list', '일정 목록 조회', scheduleListSchema, async (args) => scheduleListHandler(args));
  server.tool('template.create', '새 템플릿 생성', templateCreateSchema, async (args) => templateCreateHandler(args));
  server.tool('template.get', '템플릿 단건 조회', templateGetSchema, async (args) => templateGetHandler(args));
  server.tool('template.list', '템플릿 목록 조회', templateListSchema, async (args) => templateListHandler(args));
  server.tool('template.previewHtml', 'Handlebars 템플릿 미리보기', templatePreviewHtmlSchema, async (args) => templatePreviewHtmlHandler(args));
  server.tool('render.coursePdf', '코스 PDF 생성', renderCoursePdfSchema, async (args) => renderCoursePdfHandler(args));
  server.tool('render.schedulePdf', '일정 PDF 생성', renderSchedulePdfSchema, async (args) => renderSchedulePdfHandler(args));
  server.tool('tableConfig.get', '테이블 컬럼 설정 조회', tableConfigGetSchema, async (args) => tableConfigGetHandler(args));
  server.tool('tableConfig.upsert', '테이블 컬럼 설정 저장', tableConfigUpsertSchema, async (args) => tableConfigUpsertHandler(args));
  server.tool('test.echo', '에코 테스트', testEchoSchema, async (args) => testEchoHandler(args));

  // User management tools
  server.tool('user.register', '회원가입', userRegisterSchema, async (args) => userRegisterHandler(args));
  server.tool('user.login', '로그인 (토큰 발급)', userLoginSchema, async (args) => userLoginHandler(args));
  server.tool('user.refreshToken', '세션 연장 (리프레시 토큰)', userRefreshTokenSchema, async (args) => userRefreshTokenHandler(args));
  server.tool('user.issueTestToken', '관리자용 테스트 토큰 발급', userIssueTestTokenSchema, async (args) => userIssueTestTokenHandler(args));
  server.tool('user.me', '내 정보 조회', userMeSchema, async (args) => userMeHandler(args));
  server.tool('user.get', '사용자 정보 조회 (관리자)', userGetSchema, async (args) => userGetHandler(args));
  server.tool('user.update', '내 정보 수정', userUpdateSchema, async (args) => userUpdateHandler(args));
  server.tool('user.delete', '회원 탈퇴 (비활성화)', userDeleteSchema, async (args) => userDeleteHandler(args));
  server.tool('user.list', '회원 목록 조회 (관리자)', userListSchema, async (args) => userListHandler(args));
  server.tool('user.updateRole', '회원 역할 변경 (관리자)', userUpdateRoleSchema, async (args) => userUpdateRoleHandler(args));
  server.tool('user.updateByAdmin', '사용자 정보 수정 (관리자)', userUpdateByAdminSchema, async (args) => userUpdateByAdminHandler(args));
  server.tool('user.requestInstructor', '강사 신청/프로파일 제출', userRequestInstructorSchema, async (args) => requestInstructorHandler(args));
  server.tool('user.approveInstructor', '강사 승인 (관리자)', userApproveInstructorSchema, async (args) => approveInstructorHandler(args));
  server.tool('user.updateInstructorProfile', '내 강사 프로파일 수정', userUpdateInstructorProfileSchema, async (args) => updateInstructorProfileHandler(args));
  server.tool('siteSetting.get', '사이트 설정 조회', siteSettingGetSchema, async (args) => siteSettingGetHandler(args));
  server.tool('siteSetting.upsert', '사이트 설정 저장', siteSettingUpsertSchema, async (args) => siteSettingUpsertHandler(args));

  return server;
}


// Serve static PDF files
app.use('/pdf', express.static('public/pdf'));

// Serve uploaded files
app.use('/uploads', express.static('public/uploads'));

// File upload configuration
const storage = multer.diskStorage({
  destination: 'public/uploads',
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('허용되지 않는 파일 형식입니다. (이미지 또는 PDF만 가능)'));
    }
  },
});

// File upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: '파일이 없습니다.' });
    return;
  }
  res.json({ url: `/uploads/${req.file.filename}` });
});

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
