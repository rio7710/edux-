import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import express from "express";
import {
    courseGetHandler,
    courseGetSchema,
    courseListHandler,
    courseListSchema,
    courseUpsertHandler,
    courseUpsertSchema,
} from "./tools/course.js";
import {
    instructorGetHandler,
    instructorGetSchema,
    instructorListHandler,
    instructorListSchema,
    instructorUpsertHandler,
    instructorUpsertSchema,
} from "./tools/instructor.js";
import {
    lectureDeleteHandler,
    lectureDeleteSchema,
    lectureGetHandler,
    lectureGetSchema,
    lectureListHandler,
    lectureListSchema,
    lectureUpsertHandler,
    lectureUpsertSchema,
} from "./tools/lecture.js";
import {
    renderCoursePdfHandler,
    renderCoursePdfSchema,
    renderSchedulePdfHandler,
    renderSchedulePdfSchema,
} from "./tools/render.js"; // Import render tools
import {
    scheduleGetHandler,
    scheduleGetSchema,
    scheduleListHandler,
    scheduleListSchema,
    scheduleUpsertHandler,
    scheduleUpsertSchema,
} from "./tools/schedule.js";
import {
    templateCreateHandler,
    templateCreateSchema,
    templateGetHandler,
    templateGetSchema,
    templateListHandler,
    templateListSchema,
    templatePreviewHtmlHandler,
    templatePreviewHtmlSchema,
} from "./tools/template.js";
import { testEchoHandler, testEchoSchema } from "./tools/test.js";
import {
    approveInstructorHandler,
    requestInstructorHandler,
    updateInstructorProfileHandler,
    userApproveInstructorSchema,
    userDeleteHandler,
    userDeleteSchema,
    userListHandler,
    userListSchema,
    userLoginHandler,
    userLoginSchema,
    userMeHandler,
    userMeSchema,
    userGetHandler,
    userGetSchema,
    userRegisterHandler,
    userRegisterSchema,
    userRequestInstructorSchema,
    userUpdateByAdminHandler,
    userUpdateByAdminSchema,
    userUpdateHandler,
    userUpdateInstructorProfileSchema,
    userUpdateRoleHandler,
    userUpdateRoleSchema,
    userUpdateSchema,
} from "./tools/user.js";

// MCP 서버 인스턴스 생성
const server = new McpServer({
  name: "edux",
  version: "1.0.0",
});

// 툴 등록: course.upsert
server.tool(
  "course.upsert",
  "코스 생성 또는 수정",
  courseUpsertSchema,
  async (args) => courseUpsertHandler(args),
);

// 툴 등록: course.get
server.tool(
  "course.get",
  "코스 단건 조회 (모듈, 스케줄 포함)",
  courseGetSchema,
  async (args) => courseGetHandler(args),
);

// 툴 등록: course.list
server.tool(
  "course.list",
  "코스 목록 조회 (등록자 이름으로 표시)",
  courseListSchema,
  async (args) => courseListHandler(args),
);

// 툴 등록: instructor.upsert
server.tool(
  "instructor.upsert",
  "강사 생성 또는 수정",
  instructorUpsertSchema,
  async (args) => instructorUpsertHandler(args),
);

// 툴 등록: instructor.get
server.tool(
  "instructor.get",
  "강사 단건 조회",
  instructorGetSchema,
  async (args) => instructorGetHandler(args),
);

// 툴 등록: instructor.list
server.tool(
  "instructor.list",
  "강사 목록 조회 (등록자 이름으로 표시)",
  instructorListSchema,
  async (args) => instructorListHandler(args),
);

// 툴 등록: lecture
server.tool(
  "lecture.upsert",
  "강의 생성 또는 수정",
  lectureUpsertSchema,
  async (args) => lectureUpsertHandler(args),
);
server.tool("lecture.get", "강의 단건 조회", lectureGetSchema, async (args) =>
  lectureGetHandler(args),
);
server.tool(
  "lecture.list",
  "코스별 강의 목록 조회",
  lectureListSchema,
  async (args) => lectureListHandler(args),
);
server.tool(
  "lecture.delete",
  "강의 삭제 (소프트 삭제)",
  lectureDeleteSchema,
  async (args) => lectureDeleteHandler(args),
);

// 툴 등록: schedule.upsert
server.tool(
  "schedule.upsert",
  "수업 일정 생성 또는 수정",
  scheduleUpsertSchema,
  async (args) => scheduleUpsertHandler(args),
);

// 툴 등록: schedule.get
server.tool(
  "schedule.get",
  "일정 단건 조회 (코스·강사 관계 포함)",
  scheduleGetSchema,
  async (args) => scheduleGetHandler(args),
);

// 툴 등록: schedule.list
server.tool(
  "schedule.list",
  "일정 목록 조회 (등록자 이름으로 표시)",
  scheduleListSchema,
  async (args) => scheduleListHandler(args),
);

// 툴 등록: template.create
server.tool(
  "template.create",
  "새 템플릿 생성",
  templateCreateSchema,
  async (args) => templateCreateHandler(args),
);

// 툴 등록: template.get
server.tool(
  "template.get",
  "템플릿 단건 조회 (버전 이력 포함)",
  templateGetSchema,
  async (args) => templateGetHandler(args),
);

// 툴 등록: template.list
server.tool(
  "template.list",
  "템플릿 목록 조회",
  templateListSchema,
  async (args) => templateListHandler(args),
);

// 툴 등록: template.previewHtml
server.tool(
  "template.previewHtml",
  "Handlebars 템플릿에 데이터를 주입하여 완성된 HTML을 반환",
  templatePreviewHtmlSchema,
  async (args) => templatePreviewHtmlHandler(args),
);

// 툴 등록: render.coursePdf
server.tool(
  "render.coursePdf",
  "코스 데이터 + 템플릿으로 PDF를 생성합니다. (비동기 처리)",
  renderCoursePdfSchema,
  async (args) => renderCoursePdfHandler(args),
);

// 툴 등록: render.schedulePdf
server.tool(
  "render.schedulePdf",
  "일정 데이터 + 템플릿으로 PDF를 생성합니다. (비동기 처리)",
  renderSchedulePdfSchema,
  async (args) => renderSchedulePdfHandler(args),
);

// 툴 등록: test.echo
server.tool(
  "test.echo",
  "간단한 에코 테스트 툴",
  testEchoSchema,
  async (args) => testEchoHandler(args),
);

// 툴 등록: user.register
server.tool("user.register", "회원가입", userRegisterSchema, async (args) => {
  console.error("[DEBUG] Registering tool: user.register");
  return userRegisterHandler(args);
});

// 툴 등록: user.login
server.tool("user.login", "로그인", userLoginSchema, async (args) => {
  console.error("[DEBUG] Registering tool: user.login");
  return userLoginHandler(args);
});

// 툴 등록: user.me
server.tool("user.me", "내 정보 조회", userMeSchema, async (args) => {
  console.error("[DEBUG] Registering tool: user.me");
  return userMeHandler(args);
});

// 툴 등록: user.get
server.tool(
  "user.get",
  "사용자 정보 조회 (관리자)",
  userGetSchema,
  async (args) => {
    console.error("[DEBUG] Registering tool: user.get");
    return userGetHandler(args);
  },
);

// 툴 등록: user.update
server.tool("user.update", "내 정보 수정", userUpdateSchema, async (args) => {
  console.error("[DEBUG] Registering tool: user.update");
  return userUpdateHandler(args);
});

// 툴 등록: user.delete
server.tool("user.delete", "회원 탈퇴", userDeleteSchema, async (args) => {
  console.error("[DEBUG] Registering tool: user.delete");
  return userDeleteHandler(args);
});

// 툴 등록: user.list
server.tool(
  "user.list",
  "회원 목록 조회 (관리자)",
  userListSchema,
  async (args) => {
    console.error("[DEBUG] Registering tool: user.list");
    return userListHandler(args);
  },
);

// 툴 등록: user.updateRole
server.tool(
  "user.updateRole",
  "사용자 역할 변경 (관리자)",
  userUpdateRoleSchema,
  async (args) => {
    console.error("[DEBUG] Registering tool: user.updateRole");
    return userUpdateRoleHandler(args);
  },
);

// 툴 등록: user.updateByAdmin
server.tool(
  "user.updateByAdmin",
  "사용자 정보 수정 (관리자: 이름, 역할, 활성화)",
  userUpdateByAdminSchema,
  async (args) => {
    console.error("[DEBUG] Registering tool: user.updateByAdmin");
    return userUpdateByAdminHandler(args);
  },
);

// 툴 등록: user.requestInstructor
server.tool(
  "user.requestInstructor",
  "강사 신청/프로파일 제출",
  userRequestInstructorSchema,
  async (args) => {
    console.error("[DEBUG] Registering tool: user.requestInstructor");
    return requestInstructorHandler(args);
  },
);

// 툴 등록: user.approveInstructor
server.tool(
  "user.approveInstructor",
  "강사 승인 (관리자)",
  userApproveInstructorSchema,
  async (args) => {
    console.error("[DEBUG] Registering tool: user.approveInstructor");
    return approveInstructorHandler(args);
  },
);

// 툴 등록: user.updateInstructorProfile
server.tool(
  "user.updateInstructorProfile",
  "내 강사 프로파일 수정",
  userUpdateInstructorProfileSchema,
  async (args) => {
    console.error("[DEBUG] Registering tool: user.updateInstructorProfile");
    return updateInstructorProfileHandler(args);
  },
);

// Express 서버로 MCP HTTP transport 실행
async function main() {
  const app = express();
  const port = 3001;

  app.use(cors());
  app.use(express.json());

  const transport = new StreamableHTTPServerTransport();

  await server.connect(transport);

  app.get("/health", (req, res) => {
    res.status(200).send("OK");
  });

  app.post("/messages", (req, res) => transport.handleRequest(req, res));
  app.get("/sse", (req, res) => transport.handleRequest(req, res));

  app.listen(port, () => {
    console.error(`[edux] MCP server listening on http://localhost:${port}`);
    console.error(
      `[edux] Health check available at http://localhost:${port}/health`,
    );
  });
}

main().catch((error) => {
  console.error("[edux] Failed to start server:", error);
  process.exit(1);
});
