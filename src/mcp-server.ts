import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import express from "express";
import {
    courseDeleteHandler,
    courseDeleteSchema,
    courseGetHandler,
    courseGetSchema,
    courseListHandler,
    courseListMineHandler,
    courseListMineSchema,
    courseListSchema,
    courseShareInviteHandler,
    courseShareInviteSchema,
    courseShareListReceivedHandler,
    courseShareListReceivedSchema,
    courseShareListForCourseHandler,
    courseShareListForCourseSchema,
    courseShareRevokeHandler,
    courseShareRevokeSchema,
    courseShareTargetsHandler,
    courseShareTargetsSchema,
    courseShareRespondHandler,
    courseShareRespondSchema,
    courseShareLeaveHandler,
    courseShareLeaveSchema,
    courseUpsertHandler,
    courseUpsertSchema,
} from "./tools/course.js";
import {
    instructorGetHandler,
    instructorGetSchema,
    instructorGetByUserHandler,
    instructorGetByUserSchema,
    instructorListHandler,
    instructorListSchema,
    instructorUpsertHandler,
    instructorUpsertSchema,
} from "./tools/instructor.js";
import {
    lectureDeleteHandler,
    lectureDeleteSchema,
    lectureGrantDeleteHandler,
    lectureGrantDeleteSchema,
    lectureGrantListMineHandler,
    lectureGrantListMineSchema,
    lectureGrantLeaveHandler,
    lectureGrantLeaveSchema,
    lectureGrantListHandler,
    lectureGrantListSchema,
    lectureGrantUpsertHandler,
    lectureGrantUpsertSchema,
    lectureGetHandler,
    lectureGetSchema,
    lectureListHandler,
    lectureListSchema,
    lectureMapHandler,
    lectureMapSchema,
    lectureUpsertHandler,
    lectureUpsertSchema,
} from "./tools/lecture.js";
import {
    renderCoursePdfHandler,
    renderCoursePdfSchema,
    renderInstructorProfilePdfHandler,
    renderInstructorProfilePdfSchema,
    renderSchedulePdfHandler,
    renderSchedulePdfSchema,
} from "./tools/render.js"; // Import render tools
import {
    tableConfigGetHandler,
    tableConfigGetSchema,
    tableConfigUpsertHandler,
    tableConfigUpsertSchema,
} from "./tools/tableConfig.js";
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
    templateUpsertHandler,
    templateUpsertSchema,
    templateDeleteHandler,
    templateDeleteSchema,
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
    userGetInstructorProfileSchema,
    getInstructorProfileHandler,
    userRequestInstructorSchema,
    userUpdateByAdminHandler,
    userUpdateByAdminSchema,
    userUpdateHandler,
    userUpdateInstructorProfileSchema,
    userUpdateRoleHandler,
    userUpdateRoleSchema,
    userUpdateSchema,
    userRefreshTokenSchema,
    userRefreshTokenHandler,
    userIssueTestTokenSchema,
    userIssueTestTokenHandler,
    userImpersonateSchema,
    userImpersonateHandler,
} from "./tools/user.js";
import {
    siteSettingGetSchema,
    siteSettingGetHandler,
    siteSettingGetManySchema,
    siteSettingGetManyHandler,
    siteSettingUpsertSchema,
    siteSettingUpsertHandler,
} from "./tools/siteSetting.js";
import {
    documentDeleteHandler,
    documentDeleteSchema,
    documentListHandler,
    documentListSchema,
    documentRevokeShareHandler,
    documentRevokeShareSchema,
    documentShareHandler,
    documentShareSchema,
} from "./tools/document.js";
import {
    messageListHandler,
    messageListSchema,
    messageMarkAllReadHandler,
    messageMarkAllReadSchema,
    messageDeleteHandler,
    messageDeleteSchema,
    messageMarkReadHandler,
    messageMarkReadSchema,
    messageSeedDummyHandler,
    messageSeedDummySchema,
    messageSendHandler,
    messageSendSchema,
    messageRecipientListHandler,
    messageRecipientListSchema,
    messageUnreadCountHandler,
    messageUnreadCountSchema,
    messageUnreadSummaryHandler,
    messageUnreadSummarySchema,
} from "./tools/message.js";
import {
    authzCheckHandler,
    authzCheckSchema,
    groupDeleteHandler,
    groupDeleteSchema,
    groupListHandler,
    groupListSchema,
    groupMemberAddHandler,
    groupMemberAddSchema,
    groupMemberListHandler,
    groupMemberListSchema,
    groupMemberRemoveHandler,
    groupMemberRemoveSchema,
    groupMemberUpdateRoleHandler,
    groupMemberUpdateRoleSchema,
    groupUpsertHandler,
    groupUpsertSchema,
    permissionGrantDeleteHandler,
    permissionGrantDeleteSchema,
    permissionGrantListHandler,
    permissionGrantListSchema,
    permissionGrantUpsertHandler,
    permissionGrantUpsertSchema,
} from "./tools/group.js";
import {
    dashboardBootstrapHandler,
    dashboardBootstrapSchema,
} from "./tools/dashboard.js";
import {
    brochureCreateSchema,
    brochureCreateHandler,
    brochureGetSchema,
    brochureGetHandler,
} from "./tools/brochure.js";

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
server.tool(
  "course.listMine",
  "내 코스 목록 조회",
  courseListMineSchema,
  async (args) => courseListMineHandler(args),
);
server.tool(
  "course.delete",
  "코스 삭제 (소프트 삭제)",
  courseDeleteSchema,
  async (args) => courseDeleteHandler(args),
);
server.tool(
  "course.shareInvite",
  "코스 공유 초대 생성",
  courseShareInviteSchema,
  async (args) => courseShareInviteHandler(args),
);
server.tool(
  "course.shareRespond",
  "코스 공유 수락/거절",
  courseShareRespondSchema,
  async (args) => courseShareRespondHandler(args),
);
server.tool(
  "course.shareListReceived",
  "내 코스 공유 요청 목록 조회",
  courseShareListReceivedSchema,
  async (args) => courseShareListReceivedHandler(args),
);
server.tool(
  "course.shareListForCourse",
  "코스별 공유 대상 목록 조회",
  courseShareListForCourseSchema,
  async (args) => courseShareListForCourseHandler(args),
);
server.tool(
  "course.shareRevoke",
  "코스 공유 해제",
  courseShareRevokeSchema,
  async (args) => courseShareRevokeHandler(args),
);
server.tool(
  "course.shareTargets",
  "코스 공유 대상 사용자 목록 조회",
  courseShareTargetsSchema,
  async (args) => courseShareTargetsHandler(args),
);
server.tool(
  "course.shareLeave",
  "공유 수신자가 본인 코스 공유 해제",
  courseShareLeaveSchema,
  async (args) => courseShareLeaveHandler(args),
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

// 툴 등록: instructor.getByUser
server.tool(
  "instructor.getByUser",
  "내 강사 정보 조회",
  instructorGetByUserSchema,
  async (args) => instructorGetByUserHandler(args),
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
server.tool(
  "lecture.map",
  "기존 강의를 코스에 연결",
  lectureMapSchema,
  async (args) => lectureMapHandler(args),
);
server.tool(
  "lecture.grant.list",
  "강의 공유 권한 목록 조회",
  lectureGrantListSchema,
  async (args) => lectureGrantListHandler(args),
);
server.tool(
  "lecture.grant.upsert",
  "강의 공유 권한 생성/수정",
  lectureGrantUpsertSchema,
  async (args) => lectureGrantUpsertHandler(args),
);
server.tool(
  "lecture.grant.delete",
  "강의 공유 권한 해제",
  lectureGrantDeleteSchema,
  async (args) => lectureGrantDeleteHandler(args),
);
server.tool(
  "lecture.grant.listMine",
  "내 강의 공유 권한 목록 조회",
  lectureGrantListMineSchema,
  async (args) => lectureGrantListMineHandler(args),
);
server.tool(
  "lecture.grant.leave",
  "공유 수신자가 본인 강의 공유 해제",
  lectureGrantLeaveSchema,
  async (args) => lectureGrantLeaveHandler(args),
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
server.tool(
  "template.upsert",
  "템플릿 생성 또는 수정",
  templateUpsertSchema,
  async (args) => templateUpsertHandler(args),
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
server.tool(
  "template.delete",
  "템플릿 삭제",
  templateDeleteSchema,
  async (args) => templateDeleteHandler(args),
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
server.tool(
  "render.instructorProfilePdf",
  "강사 프로필 데이터 + 템플릿으로 PDF를 생성합니다. (비동기 처리)",
  renderInstructorProfilePdfSchema,
  async (args) => renderInstructorProfilePdfHandler(args),
);

// 툴 등록: tableConfig.get
server.tool(
  "tableConfig.get",
  "테이블 컬럼 설정 조회",
  tableConfigGetSchema,
  async (args) => tableConfigGetHandler(args),
);

// 툴 등록: tableConfig.upsert
server.tool(
  "tableConfig.upsert",
  "테이블 컬럼 설정 저장",
  tableConfigUpsertSchema,
  async (args) => tableConfigUpsertHandler(args),
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

// 툴 등록: user.refreshToken
server.tool(
  "user.refreshToken",
  "세션 연장 (리프레시 토큰)",
  userRefreshTokenSchema,
  async (args) => {
    console.error("[DEBUG] Registering tool: user.refreshToken");
    return userRefreshTokenHandler(args);
  },
);

// 툴 등록: user.issueTestToken
server.tool(
  "user.issueTestToken",
  "관리자용 테스트 토큰 발급",
  userIssueTestTokenSchema,
  async (args) => {
    console.error("[DEBUG] Registering tool: user.issueTestToken");
    return userIssueTestTokenHandler(args);
  },
);

server.tool(
  "user.impersonate",
  "관리자용 가장 로그인 (개발 전용)",
  userImpersonateSchema,
  async (args) => {
    console.error("[DEBUG] Registering tool: user.impersonate");
    return userImpersonateHandler(args);
  },
);

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
server.tool(
  "user.getInstructorProfile",
  "내 강사 프로파일 조회",
  userGetInstructorProfileSchema,
  async (args) => {
    console.error("[DEBUG] Registering tool: user.getInstructorProfile");
    return getInstructorProfileHandler(args);
  },
);

// 툴 등록: siteSetting.get/upsert
server.tool(
  "siteSetting.get",
  "사이트 설정 조회",
  siteSettingGetSchema,
  async (args) => siteSettingGetHandler(args),
);
server.tool(
  "siteSetting.getMany",
  "사이트 설정 다건 조회",
  siteSettingGetManySchema,
  async (args) => siteSettingGetManyHandler(args),
);
server.tool(
  "siteSetting.upsert",
  "사이트 설정 저장",
  siteSettingUpsertSchema,
  async (args) => siteSettingUpsertHandler(args),
);

// 툴 등록: document
server.tool(
  "document.list",
  "내 문서 목록 조회",
  documentListSchema,
  async (args) => documentListHandler(args),
);
server.tool(
  "document.delete",
  "문서 삭제 (비활성화)",
  documentDeleteSchema,
  async (args) => documentDeleteHandler(args),
);
server.tool(
  "document.share",
  "문서 공유 토큰 생성/재발급",
  documentShareSchema,
  async (args) => documentShareHandler(args),
);
server.tool(
  "document.revokeShare",
  "문서 공유 토큰 해제",
  documentRevokeShareSchema,
  async (args) => documentRevokeShareHandler(args),
);
server.tool(
  "brochure.create",
  "브로셔 패키지 저장",
  brochureCreateSchema,
  async (args) => brochureCreateHandler(args),
);
server.tool(
  "brochure.get",
  "브로셔 패키지 조회",
  brochureGetSchema,
  async (args) => brochureGetHandler(args),
);
server.tool(
  "message.list",
  "내 메시지 목록 조회",
  messageListSchema,
  async (args) => messageListHandler(args),
);
server.tool(
  "message.unreadCount",
  "안 읽은 메시지 개수 조회",
  messageUnreadCountSchema,
  async (args) => messageUnreadCountHandler(args),
);
server.tool(
  "message.unreadSummary",
  "안 읽은 메시지 카테고리 요약 조회",
  messageUnreadSummarySchema,
  async (args) => messageUnreadSummaryHandler(args),
);
server.tool(
  "message.markRead",
  "메시지 읽음 처리",
  messageMarkReadSchema,
  async (args) => messageMarkReadHandler(args),
);
server.tool(
  "message.markAllRead",
  "전체 메시지 읽음 처리",
  messageMarkAllReadSchema,
  async (args) => messageMarkAllReadHandler(args),
);
server.tool(
  "message.delete",
  "메시지 삭제",
  messageDeleteSchema,
  async (args) => messageDeleteHandler(args),
);
server.tool(
  "message.send",
  "메시지 전송",
  messageSendSchema,
  async (args) => messageSendHandler(args),
);
server.tool(
  "message.recipientList",
  "메시지 수신자 목록 조회",
  messageRecipientListSchema,
  async (args) => messageRecipientListHandler(args),
);
server.tool(
  "message.seedDummy",
  "더미 메시지 생성",
  messageSeedDummySchema,
  async (args) => messageSeedDummyHandler(args),
);
server.tool(
  "group.list",
  "그룹 목록 조회",
  groupListSchema,
  async (args) => groupListHandler(args),
);
server.tool(
  "group.upsert",
  "그룹 생성/수정",
  groupUpsertSchema,
  async (args) => groupUpsertHandler(args),
);
server.tool(
  "group.delete",
  "그룹 삭제(소프트 삭제)",
  groupDeleteSchema,
  async (args) => groupDeleteHandler(args),
);
server.tool(
  "group.member.list",
  "그룹 멤버 목록 조회",
  groupMemberListSchema,
  async (args) => groupMemberListHandler(args),
);
server.tool(
  "group.member.add",
  "그룹 멤버 추가",
  groupMemberAddSchema,
  async (args) => groupMemberAddHandler(args),
);
server.tool(
  "group.member.remove",
  "그룹 멤버 삭제",
  groupMemberRemoveSchema,
  async (args) => groupMemberRemoveHandler(args),
);
server.tool(
  "group.member.updateRole",
  "그룹 멤버 역할 변경",
  groupMemberUpdateRoleSchema,
  async (args) => groupMemberUpdateRoleHandler(args),
);
server.tool(
  "permission.grant.list",
  "권한 정책 목록 조회",
  permissionGrantListSchema,
  async (args) => permissionGrantListHandler(args),
);
server.tool(
  "permission.grant.upsert",
  "권한 정책 생성/수정",
  permissionGrantUpsertSchema,
  async (args) => permissionGrantUpsertHandler(args),
);
server.tool(
  "permission.grant.delete",
  "권한 정책 삭제",
  permissionGrantDeleteSchema,
  async (args) => permissionGrantDeleteHandler(args),
);
server.tool(
  "authz.check",
  "권한 평가",
  authzCheckSchema,
  async (args) => authzCheckHandler(args),
);
server.tool(
  "dashboard.bootstrap",
  "대시보드 초기 데이터 일괄 조회",
  dashboardBootstrapSchema,
  async (args) => dashboardBootstrapHandler(args),
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
