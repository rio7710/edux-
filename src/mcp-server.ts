import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
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
} from './tools/render.js'; // Import render tools
import {
  testEchoSchema,
  testEchoHandler,
} from './tools/test.js';

// MCP 서버 인스턴스 생성
const server = new McpServer({
  name: 'edux',
  version: '1.0.0',
});

// 툴 등록: course.upsert
server.tool(
  'course.upsert',
  '코스 생성 또는 수정',
  courseUpsertSchema,
  async (args) => courseUpsertHandler(args)
);

// 툴 등록: course.get
server.tool(
  'course.get',
  '코스 단건 조회 (모듈, 스케줄 포함)',
  courseGetSchema,
  async (args) => courseGetHandler(args)
);

// 툴 등록: instructor.upsert
server.tool(
  'instructor.upsert',
  '강사 생성 또는 수정',
  instructorUpsertSchema,
  async (args) => instructorUpsertHandler(args)
);

// 툴 등록: instructor.get
server.tool(
  'instructor.get',
  '강사 단건 조회',
  instructorGetSchema,
  async (args) => instructorGetHandler(args)
);

// 툴 등록: module.batchSet
server.tool(
  'module.batchSet',
  '코스의 모듈 목록을 일괄 교체 (기존 모듈 삭제 후 재생성)',
  moduleBatchSetSchema,
  async (args) => moduleBatchSetHandler(args)
);

// 툴 등록: schedule.upsert
server.tool(
  'schedule.upsert',
  '수업 일정 생성 또는 수정',
  scheduleUpsertSchema,
  async (args) => scheduleUpsertHandler(args)
);

// 툴 등록: schedule.get
server.tool(
  'schedule.get',
  '일정 단건 조회 (코스·강사 관계 포함)',
  scheduleGetSchema,
  async (args) => scheduleGetHandler(args)
);

// 툴 등록: template.create
server.tool(
  'template.create',
  '새 템플릿 생성',
  templateCreateSchema,
  async (args) => templateCreateHandler(args)
);

// 툴 등록: template.get
server.tool(
  'template.get',
  '템플릿 단건 조회 (버전 이력 포함)',
  templateGetSchema,
  async (args) => templateGetHandler(args)
);

// 툴 등록: template.list
server.tool(
  'template.list',
  '템플릿 목록 조회',
  templateListSchema,
  async (args) => templateListHandler(args)
);

// 툴 등록: template.previewHtml
server.tool(
  'template.previewHtml',
  'Handlebars 템플릿에 데이터를 주입하여 완성된 HTML을 반환',
  templatePreviewHtmlSchema,
  async (args) => templatePreviewHtmlHandler(args)
);

// 툴 등록: render.coursePdf
server.tool(
  'render.coursePdf',
  '코스 데이터 + 템플릿으로 PDF를 생성합니다. (비동기 처리)',
  renderCoursePdfSchema,
  async (args) => renderCoursePdfHandler(args)
);

// 툴 등록: render.schedulePdf
server.tool(
  'render.schedulePdf',
  '일정 데이터 + 템플릿으로 PDF를 생성합니다. (비동기 처리)',
  renderSchedulePdfSchema,
  async (args) => renderSchedulePdfHandler(args)
);

// 툴 등록: test.echo
server.tool(
  'test.echo',
  '간단한 에코 테스트 툴',
  testEchoSchema,
  async (args) => testEchoHandler(args)
);

// Express 서버로 MCP HTTP transport 실행
async function main() {
  const app = express();
  const port = 3001;

  app.use(cors());
  app.use(express.json());

  const transport = new StreamableHTTPServerTransport();
  
  await server.connect(transport);

  app.use((req, res) => transport.handleRequest(req, res));

  app.listen(port, () => {
    console.error(`[edux] MCP server listening on http://localhost:${port}`);
  });
}

main().catch((error) => {
  console.error('[edux] Failed to start server:', error);
  process.exit(1);
});