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
  courseListMineSchema,
  courseListMineHandler,
  courseDeleteSchema,
  courseDeleteHandler,
  courseShareInviteSchema,
  courseShareInviteHandler,
  courseShareListReceivedSchema,
  courseShareListReceivedHandler,
  courseShareListForCourseSchema,
  courseShareListForCourseHandler,
  courseShareRevokeSchema,
  courseShareRevokeHandler,
  courseShareTargetsSchema,
  courseShareTargetsHandler,
  courseShareRespondSchema,
  courseShareRespondHandler,
  courseShareLeaveSchema,
  courseShareLeaveHandler,
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
  lectureMapSchema,
  lectureMapHandler,
  lectureGrantListSchema,
  lectureGrantListHandler,
  lectureGrantUpsertSchema,
  lectureGrantUpsertHandler,
  lectureGrantDeleteSchema,
  lectureGrantDeleteHandler,
  lectureGrantListMineSchema,
  lectureGrantListMineHandler,
  lectureGrantLeaveSchema,
  lectureGrantLeaveHandler,
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
  templateUpsertSchema,
  templateUpsertHandler,
  templateDeleteSchema,
  templateDeleteHandler,
} from './tools/template.js';
import {
  renderCoursePdfSchema,
  renderCoursePdfHandler,
  renderInstructorProfilePdfSchema,
  renderInstructorProfilePdfHandler,
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
  userImpersonateSchema,
  userImpersonateHandler,
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
  userGetInstructorProfileSchema,
  getInstructorProfileHandler,
  userUpdateInstructorProfileSchema,
  updateInstructorProfileHandler,
} from './tools/user.js';
import {
  siteSettingGetSchema,
  siteSettingGetHandler,
  siteSettingGetManySchema,
  siteSettingGetManyHandler,
  siteSettingUpsertSchema,
  siteSettingUpsertHandler,
} from './tools/siteSetting.js';
import {
  documentDeleteSchema,
  documentDeleteHandler,
  documentListSchema,
  documentListHandler,
  documentRevokeShareSchema,
  documentRevokeShareHandler,
  documentShareSchema,
  documentShareHandler,
} from './tools/document.js';
import {
  messageListSchema,
  messageListHandler,
  messageMarkAllReadSchema,
  messageMarkAllReadHandler,
  messageDeleteSchema,
  messageDeleteHandler,
  messageMarkReadSchema,
  messageMarkReadHandler,
  messageSeedDummySchema,
  messageSeedDummyHandler,
  messageSendSchema,
  messageSendHandler,
  messageRecipientListSchema,
  messageRecipientListHandler,
  messageUnreadCountSchema,
  messageUnreadCountHandler,
  messageUnreadSummarySchema,
  messageUnreadSummaryHandler,
} from './tools/message.js';
import {
  authzCheckSchema,
  authzCheckHandler,
  groupDeleteSchema,
  groupDeleteHandler,
  groupListSchema,
  groupListHandler,
  groupMemberAddSchema,
  groupMemberAddHandler,
  groupMemberListSchema,
  groupMemberListHandler,
  groupMemberRemoveSchema,
  groupMemberRemoveHandler,
  groupMemberUpdateRoleSchema,
  groupMemberUpdateRoleHandler,
  groupUpsertSchema,
  groupUpsertHandler,
  permissionGrantDeleteSchema,
  permissionGrantDeleteHandler,
  permissionGrantListSchema,
  permissionGrantListHandler,
  permissionGrantUpsertSchema,
  permissionGrantUpsertHandler,
} from './tools/group.js';
import {
  dashboardBootstrapSchema,
  dashboardBootstrapHandler,
} from './tools/dashboard.js';
import { prisma } from './services/prisma.js';
import { signAccessToken, signRefreshToken, type JwtPayload } from './services/jwt.js';

const PORT = process.env.PORT || 7777;
const app = express();
type OAuthProvider = 'google' | 'naver';
const oauthStates = new Map<string, { provider: OAuthProvider; expiresAt: number }>();
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

// Enable CORS for all origins
app.use(cors());
app.use(express.json()); // For parsing application/json

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

const cleanupOAuthStates = () => {
  const now = Date.now();
  for (const [key, value] of oauthStates.entries()) {
    if (value.expiresAt <= now) {
      oauthStates.delete(key);
    }
  }
};

const getBackendBaseUrl = (req: express.Request): string => {
  const configured = process.env.OAUTH_BACKEND_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
  return `${proto}://${req.get('host')}`;
};

const getFrontendBaseUrl = (req: express.Request): string => {
  const configured = process.env.OAUTH_FRONTEND_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  const origin = req.get('origin');
  if (origin) return origin.replace(/\/$/, '');
  return 'http://localhost:5173';
};

const redirectWithSocialError = (req: express.Request, res: express.Response, errorMessage: string) => {
  const target = new URL('/login', getFrontendBaseUrl(req));
  target.searchParams.set('socialError', errorMessage);
  res.redirect(target.toString());
};

const sanitizeUser = (user: {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  website: string | null;
  avatarUrl: string | null;
  role: string;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  phone: user.phone,
  website: user.website,
  avatarUrl: user.avatarUrl,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt,
});

const issueAuthPayload = (user: {
  id: string;
  email: string;
  role: string;
}) => {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
};

const upsertSocialUser = async (args: {
  provider: OAuthProvider;
  providerId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}) => {
  const now = new Date();
  const existingByProvider = await prisma.user.findFirst({
    where: {
      provider: args.provider,
      providerId: args.providerId,
      deletedAt: null,
    },
  });

  if (existingByProvider) {
    return prisma.user.update({
      where: { id: existingByProvider.id },
      data: {
        name: args.name || existingByProvider.name,
        avatarUrl: args.avatarUrl ?? existingByProvider.avatarUrl,
        lastLoginAt: now,
      },
    });
  }

  const existingByEmail = await prisma.user.findUnique({
    where: { email: args.email },
  });

  if (existingByEmail && !existingByEmail.deletedAt) {
    if (
      existingByEmail.provider &&
      existingByEmail.provider !== 'local' &&
      existingByEmail.provider !== args.provider
    ) {
      throw new Error('다른 소셜 계정으로 이미 연결된 이메일입니다.');
    }

    return prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        provider: args.provider,
        providerId: args.providerId,
        name: args.name || existingByEmail.name,
        avatarUrl: args.avatarUrl ?? existingByEmail.avatarUrl,
        lastLoginAt: now,
      },
    });
  }

  return prisma.user.create({
    data: {
      email: args.email,
      name: args.name || args.email.split('@')[0] || '사용자',
      avatarUrl: args.avatarUrl ?? null,
      provider: args.provider,
      providerId: args.providerId,
      role: 'viewer',
      lastLoginAt: now,
    },
  });
};

app.get('/auth/:provider/start', async (req, res) => {
  try {
    const provider = req.params.provider as OAuthProvider;
    if (provider !== 'google' && provider !== 'naver') {
      res.status(400).json({ error: '지원하지 않는 OAuth 제공자입니다.' });
      return;
    }

    cleanupOAuthStates();
    const state = crypto.randomBytes(24).toString('hex');
    oauthStates.set(state, { provider, expiresAt: Date.now() + OAUTH_STATE_TTL_MS });

    const redirectUri = `${getBackendBaseUrl(req)}/auth/${provider}/callback`;
    let authUrl = '';

    if (provider === 'google') {
      const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
      if (!clientId) {
        redirectWithSocialError(req, res, 'GOOGLE_CLIENT_ID가 설정되지 않았습니다.');
        return;
      }
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'openid email profile');
      url.searchParams.set('state', state);
      authUrl = url.toString();
    } else {
      const clientId = process.env.NAVER_CLIENT_ID?.trim();
      if (!clientId) {
        redirectWithSocialError(req, res, 'NAVER_CLIENT_ID가 설정되지 않았습니다.');
        return;
      }
      const url = new URL('https://nid.naver.com/oauth2.0/authorize');
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('state', state);
      authUrl = url.toString();
    }

    res.redirect(authUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OAuth 시작에 실패했습니다.';
    redirectWithSocialError(req, res, message);
  }
});

app.get('/auth/:provider/callback', async (req, res) => {
  try {
    const provider = req.params.provider as OAuthProvider;
    if (provider !== 'google' && provider !== 'naver') {
      res.status(400).json({ error: '지원하지 않는 OAuth 제공자입니다.' });
      return;
    }

    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    const oauthError = String(req.query.error || '');

    if (oauthError) {
      redirectWithSocialError(req, res, `소셜 로그인 실패: ${oauthError}`);
      return;
    }

    if (!code || !state) {
      redirectWithSocialError(req, res, 'OAuth 콜백 파라미터가 올바르지 않습니다.');
      return;
    }

    cleanupOAuthStates();
    const savedState = oauthStates.get(state);
    oauthStates.delete(state);
    if (!savedState || savedState.provider !== provider || savedState.expiresAt <= Date.now()) {
      redirectWithSocialError(req, res, 'OAuth state 검증에 실패했습니다.');
      return;
    }

    const redirectUri = `${getBackendBaseUrl(req)}/auth/${provider}/callback`;

    let socialEmail = '';
    let socialName = '';
    let socialId = '';
    let socialAvatar: string | null = null;

    if (provider === 'google') {
      const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
      if (!clientId || !clientSecret) {
        redirectWithSocialError(req, res, 'Google OAuth 설정이 누락되었습니다.');
        return;
      }

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenRes.ok) {
        redirectWithSocialError(req, res, 'Google 토큰 교환에 실패했습니다.');
        return;
      }

      const tokenJson = await tokenRes.json() as { access_token?: string };
      if (!tokenJson.access_token) {
        redirectWithSocialError(req, res, 'Google 액세스 토큰을 받지 못했습니다.');
        return;
      }

      const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      if (!profileRes.ok) {
        redirectWithSocialError(req, res, 'Google 사용자 정보 조회에 실패했습니다.');
        return;
      }
      const profile = await profileRes.json() as {
        sub?: string;
        email?: string;
        name?: string;
        picture?: string;
      };
      socialId = profile.sub || '';
      socialEmail = profile.email || '';
      socialName = profile.name || '';
      socialAvatar = profile.picture || null;
    } else {
      const clientId = process.env.NAVER_CLIENT_ID?.trim();
      const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim();
      if (!clientId || !clientSecret) {
        redirectWithSocialError(req, res, 'Naver OAuth 설정이 누락되었습니다.');
        return;
      }

      const tokenUrl = new URL('https://nid.naver.com/oauth2.0/token');
      tokenUrl.searchParams.set('grant_type', 'authorization_code');
      tokenUrl.searchParams.set('client_id', clientId);
      tokenUrl.searchParams.set('client_secret', clientSecret);
      tokenUrl.searchParams.set('code', code);
      tokenUrl.searchParams.set('state', state);

      const tokenRes = await fetch(tokenUrl.toString());
      if (!tokenRes.ok) {
        redirectWithSocialError(req, res, 'Naver 토큰 교환에 실패했습니다.');
        return;
      }

      const tokenJson = await tokenRes.json() as { access_token?: string };
      if (!tokenJson.access_token) {
        redirectWithSocialError(req, res, 'Naver 액세스 토큰을 받지 못했습니다.');
        return;
      }

      const profileRes = await fetch('https://openapi.naver.com/v1/nid/me', {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      if (!profileRes.ok) {
        redirectWithSocialError(req, res, 'Naver 사용자 정보 조회에 실패했습니다.');
        return;
      }
      const profileJson = await profileRes.json() as {
        response?: {
          id?: string;
          email?: string;
          name?: string;
          nickname?: string;
          profile_image?: string;
        };
      };

      socialId = profileJson.response?.id || '';
      socialEmail = profileJson.response?.email || '';
      socialName = profileJson.response?.name || profileJson.response?.nickname || '';
      socialAvatar = profileJson.response?.profile_image || null;
    }

    if (!socialId) {
      redirectWithSocialError(req, res, '소셜 계정 식별값을 가져오지 못했습니다.');
      return;
    }
    if (!socialEmail) {
      redirectWithSocialError(req, res, '이메일 제공 동의가 필요합니다.');
      return;
    }

    const user = await upsertSocialUser({
      provider,
      providerId: socialId,
      email: socialEmail,
      name: socialName || socialEmail.split('@')[0],
      avatarUrl: socialAvatar,
    });

    const safeUser = sanitizeUser(user);
    const { accessToken, refreshToken } = issueAuthPayload(user);
    const target = new URL('/login', getFrontendBaseUrl(req));
    target.searchParams.set('accessToken', accessToken);
    target.searchParams.set('refreshToken', refreshToken);
    target.searchParams.set(
      'user',
      Buffer.from(JSON.stringify(safeUser), 'utf-8').toString('base64url'),
    );
    res.redirect(target.toString());
  } catch (error) {
    const message = error instanceof Error ? error.message : '소셜 로그인 처리에 실패했습니다.';
    redirectWithSocialError(req, res, message);
  }
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
  server.tool('course.listMine', '내 코스 목록 조회', courseListMineSchema, async (args) => courseListMineHandler(args));
  server.tool('course.delete', '코스 삭제 (소프트 삭제)', courseDeleteSchema, async (args) => courseDeleteHandler(args));
  server.tool('course.shareInvite', '코스 공유 초대 생성', courseShareInviteSchema, async (args) => courseShareInviteHandler(args));
  server.tool('course.shareRespond', '코스 공유 수락/거절', courseShareRespondSchema, async (args) => courseShareRespondHandler(args));
  server.tool('course.shareListReceived', '내 코스 공유 요청 목록 조회', courseShareListReceivedSchema, async (args) => courseShareListReceivedHandler(args));
  server.tool('course.shareListForCourse', '코스별 공유 대상 목록 조회', courseShareListForCourseSchema, async (args) => courseShareListForCourseHandler(args));
  server.tool('course.shareRevoke', '코스 공유 해제', courseShareRevokeSchema, async (args) => courseShareRevokeHandler(args));
  server.tool('course.shareTargets', '코스 공유 대상 사용자 목록 조회', courseShareTargetsSchema, async (args) => courseShareTargetsHandler(args));
  server.tool('course.shareLeave', '공유 수신자가 본인 코스 공유 해제', courseShareLeaveSchema, async (args) => courseShareLeaveHandler(args));
  server.tool('instructor.upsert', '강사 생성 또는 수정', instructorUpsertSchema, async (args) => instructorUpsertHandler(args));
  server.tool('instructor.get', '강사 단건 조회', instructorGetSchema, async (args) => instructorGetHandler(args));
  server.tool('instructor.getByUser', '내 강사 정보 조회', instructorGetByUserSchema, async (args) => instructorGetByUserHandler(args));
  server.tool('instructor.list', '강사 목록 조회', instructorListSchema, async (args) => instructorListHandler(args));
  server.tool('lecture.upsert', '강의 생성 또는 수정', lectureUpsertSchema, async (args) => lectureUpsertHandler(args));
  server.tool('lecture.map', '기존 강의를 코스에 연결', lectureMapSchema, async (args) => lectureMapHandler(args));
  server.tool('lecture.grant.list', '강의 공유 권한 목록 조회', lectureGrantListSchema, async (args) => lectureGrantListHandler(args));
  server.tool('lecture.grant.upsert', '강의 공유 권한 생성/수정', lectureGrantUpsertSchema, async (args) => lectureGrantUpsertHandler(args));
  server.tool('lecture.grant.delete', '강의 공유 권한 해제', lectureGrantDeleteSchema, async (args) => lectureGrantDeleteHandler(args));
  server.tool('lecture.grant.listMine', '내 강의 공유 권한 목록 조회', lectureGrantListMineSchema, async (args) => lectureGrantListMineHandler(args));
  server.tool('lecture.grant.leave', '공유 수신자가 본인 강의 공유 해제', lectureGrantLeaveSchema, async (args) => lectureGrantLeaveHandler(args));
  server.tool('lecture.get', '강의 단건 조회', lectureGetSchema, async (args) => lectureGetHandler(args));
  server.tool('lecture.list', '코스별 강의 목록 조회', lectureListSchema, async (args) => lectureListHandler(args));
  server.tool('lecture.delete', '강의 삭제 (소프트 삭제)', lectureDeleteSchema, async (args) => lectureDeleteHandler(args));
  server.tool('schedule.upsert', '수업 일정 생성 또는 수정', scheduleUpsertSchema, async (args) => scheduleUpsertHandler(args));
  server.tool('schedule.get', '일정 단건 조회', scheduleGetSchema, async (args) => scheduleGetHandler(args));
  server.tool('schedule.list', '일정 목록 조회', scheduleListSchema, async (args) => scheduleListHandler(args));
  server.tool('template.create', '새 템플릿 생성', templateCreateSchema, async (args) => templateCreateHandler(args));
  server.tool('template.upsert', '템플릿 생성 또는 수정', templateUpsertSchema, async (args) => templateUpsertHandler(args));
  server.tool('template.get', '템플릿 단건 조회', templateGetSchema, async (args) => templateGetHandler(args));
  server.tool('template.list', '템플릿 목록 조회', templateListSchema, async (args) => templateListHandler(args));
  server.tool('template.previewHtml', 'Handlebars 템플릿 미리보기', templatePreviewHtmlSchema, async (args) => templatePreviewHtmlHandler(args));
  server.tool('template.delete', '템플릿 삭제', templateDeleteSchema, async (args) => templateDeleteHandler(args));
  server.tool('render.coursePdf', '코스 PDF 생성', renderCoursePdfSchema, async (args) => renderCoursePdfHandler(args));
  server.tool('render.schedulePdf', '일정 PDF 생성', renderSchedulePdfSchema, async (args) => renderSchedulePdfHandler(args));
  server.tool('render.instructorProfilePdf', '강사 프로필 PDF 생성', renderInstructorProfilePdfSchema, async (args) => renderInstructorProfilePdfHandler(args));
  server.tool('tableConfig.get', '테이블 컬럼 설정 조회', tableConfigGetSchema, async (args) => tableConfigGetHandler(args));
  server.tool('tableConfig.upsert', '테이블 컬럼 설정 저장', tableConfigUpsertSchema, async (args) => tableConfigUpsertHandler(args));
  server.tool('test.echo', '에코 테스트', testEchoSchema, async (args) => testEchoHandler(args));

  // User management tools
  server.tool('user.register', '회원가입', userRegisterSchema, async (args) => userRegisterHandler(args));
  server.tool('user.login', '로그인 (토큰 발급)', userLoginSchema, async (args) => userLoginHandler(args));
  server.tool('user.refreshToken', '세션 연장 (리프레시 토큰)', userRefreshTokenSchema, async (args) => userRefreshTokenHandler(args));
  server.tool('user.issueTestToken', '관리자용 테스트 토큰 발급', userIssueTestTokenSchema, async (args) => userIssueTestTokenHandler(args));
  server.tool('user.impersonate', '관리자용 가장 로그인 (개발 전용)', userImpersonateSchema, async (args) => userImpersonateHandler(args));
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
  server.tool('user.getInstructorProfile', '내 강사 프로파일 조회', userGetInstructorProfileSchema, async (args) => getInstructorProfileHandler(args));
  server.tool('siteSetting.get', '사이트 설정 조회', siteSettingGetSchema, async (args) => siteSettingGetHandler(args));
  server.tool('siteSetting.getMany', '사이트 설정 다건 조회', siteSettingGetManySchema, async (args) => siteSettingGetManyHandler(args));
  server.tool('siteSetting.upsert', '사이트 설정 저장', siteSettingUpsertSchema, async (args) => siteSettingUpsertHandler(args));
  server.tool('document.list', '내 문서 목록 조회', documentListSchema, async (args) => documentListHandler(args));
  server.tool('document.delete', '문서 삭제', documentDeleteSchema, async (args) => documentDeleteHandler(args));
  server.tool('document.share', '문서 공유 토큰 생성/재발급', documentShareSchema, async (args) => documentShareHandler(args));
  server.tool('document.revokeShare', '문서 공유 토큰 해제', documentRevokeShareSchema, async (args) => documentRevokeShareHandler(args));
  server.tool('message.list', '내 메시지 목록 조회', messageListSchema, async (args) => messageListHandler(args));
  server.tool('message.unreadCount', '안 읽은 메시지 개수 조회', messageUnreadCountSchema, async (args) => messageUnreadCountHandler(args));
  server.tool('message.unreadSummary', '안 읽은 메시지 카테고리 요약 조회', messageUnreadSummarySchema, async (args) => messageUnreadSummaryHandler(args));
  server.tool('message.markRead', '메시지 읽음 처리', messageMarkReadSchema, async (args) => messageMarkReadHandler(args));
  server.tool('message.markAllRead', '전체 메시지 읽음 처리', messageMarkAllReadSchema, async (args) => messageMarkAllReadHandler(args));
  server.tool('message.delete', '메시지 삭제', messageDeleteSchema, async (args) => messageDeleteHandler(args));
  server.tool('message.send', '메시지 전송', messageSendSchema, async (args) => messageSendHandler(args));
  server.tool('message.recipientList', '메시지 수신자 목록 조회', messageRecipientListSchema, async (args) => messageRecipientListHandler(args));
  server.tool('message.seedDummy', '더미 메시지 생성', messageSeedDummySchema, async (args) => messageSeedDummyHandler(args));
  server.tool('group.list', '그룹 목록 조회', groupListSchema, async (args) => groupListHandler(args));
  server.tool('group.upsert', '그룹 생성/수정', groupUpsertSchema, async (args) => groupUpsertHandler(args));
  server.tool('group.delete', '그룹 삭제(소프트 삭제)', groupDeleteSchema, async (args) => groupDeleteHandler(args));
  server.tool('group.member.list', '그룹 멤버 목록 조회', groupMemberListSchema, async (args) => groupMemberListHandler(args));
  server.tool('group.member.add', '그룹 멤버 추가', groupMemberAddSchema, async (args) => groupMemberAddHandler(args));
  server.tool('group.member.remove', '그룹 멤버 삭제', groupMemberRemoveSchema, async (args) => groupMemberRemoveHandler(args));
  server.tool('group.member.updateRole', '그룹 멤버 역할 변경', groupMemberUpdateRoleSchema, async (args) => groupMemberUpdateRoleHandler(args));
  server.tool('permission.grant.list', '권한 정책 목록 조회', permissionGrantListSchema, async (args) => permissionGrantListHandler(args));
  server.tool('permission.grant.upsert', '권한 정책 생성/수정', permissionGrantUpsertSchema, async (args) => permissionGrantUpsertHandler(args));
  server.tool('permission.grant.delete', '권한 정책 삭제', permissionGrantDeleteSchema, async (args) => permissionGrantDeleteHandler(args));
  server.tool('authz.check', '권한 평가', authzCheckSchema, async (args) => authzCheckHandler(args));
  server.tool('dashboard.bootstrap', '대시보드 초기 데이터 일괄 조회', dashboardBootstrapSchema, async (args) => dashboardBootstrapHandler(args));

  return server;
}


// Serve static PDF files
app.use('/pdf', express.static('public/pdf'));

// Serve uploaded files
app.use('/uploads', express.static('public/uploads'));

// Share endpoint
app.get('/share/:shareToken', async (req, res) => {
  try {
    const doc = await prisma.userDocument.findUnique({
      where: { shareToken: req.params.shareToken },
      select: { pdfUrl: true, isActive: true },
    });
    if (!doc || !doc.isActive) {
      res.status(404).json({ error: '문서를 찾을 수 없습니다.' });
      return;
    }
    res.redirect(doc.pdfUrl);
  } catch (error) {
    res.status(500).json({ error: '공유 링크 처리 실패' });
  }
});

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
