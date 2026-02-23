import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  signAccessToken,
  signAccessTokenWithExpiry,
  signRefreshToken,
  verifyRefreshToken,
  verifyToken,
  decodeTokenWithExp,
  type JwtPayload,
} from "../services/jwt.js";
import { createUserMessage } from "../services/message.js";
import { prisma } from "../services/prisma.js";
import { instructorProfileSchema } from "../schemas/instructorProfileSchema.js";

const SALT_ROUNDS = 10;
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
const nullableString = z.string().nullable().optional();

// ─────────────────────────────────────────────────────────────
// 스키마 정의
// ─────────────────────────────────────────────────────────────

export const userRegisterSchema = {
  email: z.string().email().describe("이메일"),
  password: z.string().min(8).describe("비밀번호 (8자 이상, 영문+숫자)"),
  name: z.string().min(1).describe("이름"),
  isInstructorRequested: z.boolean().optional().describe("강사 신청 여부"),
  displayName: nullableString.describe("표시 이름"),
  title: nullableString.describe("직함"),
  bio: nullableString.describe("자기소개"),
  phone: nullableString.describe("전화번호"),
  website: nullableString.describe("웹사이트"),
};

export const userLoginSchema = {
  email: z.string().email().describe("이메일"),
  password: z.string().describe("비밀번호"),
};

export const userMeSchema = {
  token: z.string().describe("액세스 토큰"),
};

export const userGetSchema = {
  token: z.string().describe("액세스 토큰 (관리자만)"),
  userId: z.string().describe("조회할 사용자 ID"),
};

export const userUpdateSchema = {
  token: z.string().describe("액세스 토큰"),
  name: nullableString.describe("이름"),
  phone: nullableString.describe("전화번호"),
  website: nullableString.describe("웹사이트"),
  avatarUrl: nullableString.describe("사용자 프로필 사진 URL"),
  currentPassword: z
    .string()
    .optional()
    .describe("현재 비밀번호 (비밀번호 변경 시 필수)"),
  newPassword: z.string().min(8).optional().describe("새 비밀번호"),
};

export const userDeleteSchema = {
  token: z.string().describe("액세스 토큰"),
  password: z.string().describe("비밀번호 확인"),
};

export const userListSchema = {
  token: z.string().describe("액세스 토큰 (관리자만)"),
  limit: z.number().int().min(1).max(100).optional().describe("최대 조회 개수"),
  offset: z.number().int().min(0).optional().describe("오프셋"),
};

export const userUpdateRoleSchema = {
  token: z.string().describe("액세스 토큰 (관리자만)"),
  userId: z.string().describe("대상 사용자 ID"),
  role: z
    .enum(["admin", "operator", "editor", "instructor", "viewer", "guest"])
    .describe("역할"),
};

export const userUpdateByAdminSchema = {
  token: z.string().describe("액세스 토큰 (관리자만)"),
  userId: z.string().describe("대상 사용자 ID"),
  name: nullableString.describe("이름"),
  role: z
    .enum(["admin", "operator", "editor", "instructor", "viewer", "guest"])
    .optional()
    .describe("역할"),
  isActive: z.boolean().optional().describe("계정 활성화 여부"),
};

export const userRequestInstructorSchema = {
  token: z.string().describe("액세스 토큰"),
  ...instructorProfileSchema,
  avatarUrl: nullableString.describe("강사 사진 URL"),
};

export const userApproveInstructorSchema = {
  token: z.string().describe("액세스 토큰 (관리자만)"),
  userId: z.string().describe("강사 승인 대상 사용자 ID"),
  message: z.string().max(500).optional().describe("승인 메시지"),
};

export const userUpdateInstructorProfileSchema = {
  token: z.string().describe("액세스 토큰"),
  ...instructorProfileSchema,
};

export const userGetInstructorProfileSchema = {
  token: z.string().describe("액세스 토큰"),
};

export const userRefreshTokenSchema = {
  refreshToken: z.string().describe("리프레시 토큰"),
  accessToken: z.string().optional().describe("현재 액세스 토큰"),
};

export const userIssueTestTokenSchema = {
  token: z.string().describe("액세스 토큰 (admin)"),
  minutes: z.number().int().min(1).max(120).describe("테스트 만료 시간(분)"),
};

export const userImpersonateSchema = {
  token: z.string().describe("액세스 토큰 (admin)"),
  targetUserId: z.string().describe("대상 사용자 ID"),
  reason: z.string().optional().describe("전환 사유 (감사 로그용)"),
};

// ─────────────────────────────────────────────────────────────
// 헬퍼 함수
// ─────────────────────────────────────────────────────────────

function validatePassword(password: string): boolean {
  return PASSWORD_REGEX.test(password);
}

function toNullableJsonValue<T>(value: T | null | undefined) {
  if (value === undefined) return undefined;
  return value === null ? Prisma.JsonNull : value;
}

async function verifyAndGetUser(token: string) {
  const payload = verifyToken(token);
  const user = await prisma.user.findUnique({
    where: { id: payload.userId, isActive: true, deletedAt: null },
  });
  return { payload, user };
}

function sanitizeUser(user: {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  website: string | null;
  avatarUrl?: string | null;
  role: string;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    website: user.website,
    avatarUrl: user.avatarUrl ?? null,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

// ─────────────────────────────────────────────────────────────
// 핸들러 정의
// ─────────────────────────────────────────────────────────────

// 1. 회원가입
export async function userRegisterHandler(args: {
  email: string;
  password: string;
  name: string;
  isInstructorRequested?: boolean;
  displayName?: string | null;
  title?: string | null;
  bio?: string | null;
  phone?: string | null;
  website?: string | null;
}) {
  try {
    // 비밀번호 규칙 검사
    if (!validatePassword(args.password)) {
      return {
        content: [
          {
            type: "text" as const,
            text: "비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다.",
          },
        ],
        isError: true,
      };
    }

    // 이메일 중복 검사
    const existingUser = await prisma.user.findUnique({
      where: { email: args.email },
    });
    if (existingUser) {
      return {
        content: [
          { type: "text" as const, text: "이미 사용 중인 이메일입니다." },
        ],
        isError: true,
      };
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(args.password, SALT_ROUNDS);

    // 사용자 생성
    const user = await prisma.user.create({
      data: {
        email: args.email,
        name: args.name,
        phone: args.phone || null,
        website: args.website || null,
        hashedPassword,
        provider: "local",
        role: "viewer",
      },
    });

    // If the user requested instructor signup, create a pending InstructorProfile
    if (args.isInstructorRequested) {
      try {
        await prisma.instructorProfile.create({
          data: {
            userId: user.id,
            displayName: args.displayName || args.name,
            title: args.title,
            bio: args.bio,
            isPending: true,
            isApproved: false,
          },
        });
      } catch {
        // ignore profile create errors, user creation succeeded
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            id: user.id,
            email: user.email,
            name: user.name,
          }),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text" as const, text: `회원가입 실패: ${message}` }],
      isError: true,
    };
  }
}

// 2. 로그인
export async function userLoginHandler(args: {
  email: string;
  password: string;
}) {
  try {
    const user = await prisma.user.findUnique({
      where: { email: args.email, isActive: true, deletedAt: null },
    });

    if (!user || !user.hashedPassword) {
      return {
        content: [
          {
            type: "text" as const,
            text: "이메일 또는 비밀번호가 일치하지 않습니다.",
          },
        ],
        isError: true,
      };
    }

    const isValidPassword = await bcrypt.compare(
      args.password,
      user.hashedPassword,
    );
    if (!isValidPassword) {
      return {
        content: [
          {
            type: "text" as const,
            text: "이메일 또는 비밀번호가 일치하지 않습니다.",
          },
        ],
        isError: true,
      };
    }

    // 마지막 로그인 시간 업데이트
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // JWT 토큰 발급
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            user: sanitizeUser(user),
            accessToken,
            refreshToken,
          }),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text" as const, text: `로그인 실패: ${message}` }],
      isError: true,
    };
  }
}

// 2-1. 세션 연장 (리프레시 토큰 기반)
export async function userRefreshTokenHandler(args: {
  refreshToken: string;
  accessToken?: string;
}) {
  try {
    const payload = verifyRefreshToken(args.refreshToken) as JwtPayload;
    const user = await prisma.user.findUnique({
      where: { id: payload.userId, isActive: true, deletedAt: null },
    });
    if (!user) {
      return {
        content: [{ type: "text" as const, text: "사용자를 찾을 수 없습니다." }],
        isError: true,
      };
    }

    const setting = await prisma.appSetting.findUnique({
      where: { key: "session_extend_minutes" },
    });
    const minutes =
      typeof setting?.value === "number"
        ? setting.value
        : Number((setting?.value as any)?.minutes) || 10;

    const cleanPayload: JwtPayload = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };
    let totalMinutes = minutes;
    if (args.accessToken) {
      const decoded = decodeTokenWithExp(args.accessToken);
      if (decoded?.exp) {
        const remainingSec = Math.max(0, decoded.exp * 1000 - Date.now()) / 1000;
        const remainingMin = Math.ceil(remainingSec / 60);
        totalMinutes = Math.max(1, remainingMin + minutes);
      }
    }

    const accessToken = signAccessTokenWithExpiry(
      cleanPayload,
      `${totalMinutes}m`,
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ accessToken, minutes, totalMinutes }),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text" as const, text: `세션 연장 실패: ${message}` }],
      isError: true,
    };
  }
}

// 2-2. 관리자용 테스트 토큰 발급
export async function userIssueTestTokenHandler(args: {
  token: string;
  minutes: number;
}) {
  try {
    const payload = verifyToken(args.token) as JwtPayload;
    if (payload.role !== "admin") {
      return {
        content: [{ type: "text" as const, text: "관리자 권한이 필요합니다." }],
        isError: true,
      };
    }
    const cleanPayload: JwtPayload = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };
    const accessToken = signAccessTokenWithExpiry(cleanPayload, `${args.minutes}m`);
    return {
      content: [
        { type: "text" as const, text: JSON.stringify({ accessToken, minutes: args.minutes }) },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text" as const, text: `테스트 토큰 발급 실패: ${message}` }],
      isError: true,
    };
  }
}

// 2-3. 관리자용 가장 로그인(개발 전용)
export async function userImpersonateHandler(args: {
  token: string;
  targetUserId: string;
  reason?: string;
}) {
  try {
    const isProd = process.env.NODE_ENV === "production";
    const allowInProd = process.env.ALLOW_IMPERSONATION_IN_PROD === "true";
    if (isProd && !allowInProd) {
      return {
        content: [{ type: "text" as const, text: "운영 환경에서는 가장 로그인이 비활성화되어 있습니다." }],
        isError: true,
      };
    }

    const actorPayload = verifyToken(args.token) as JwtPayload;
    if (actorPayload.role !== "admin") {
      return {
        content: [{ type: "text" as const, text: "관리자 권한이 필요합니다." }],
        isError: true,
      };
    }

    const actor = await prisma.user.findUnique({
      where: { id: actorPayload.userId, isActive: true, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        website: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });
    if (!actor) {
      return {
        content: [{ type: "text" as const, text: "요청 관리자 계정을 찾을 수 없습니다." }],
        isError: true,
      };
    }

    const target = await prisma.user.findUnique({
      where: { id: args.targetUserId, isActive: true, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        website: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });
    if (!target) {
      return {
        content: [{ type: "text" as const, text: "대상 사용자를 찾을 수 없습니다." }],
        isError: true,
      };
    }

    const payload: JwtPayload = {
      userId: target.id,
      email: target.email,
      role: target.role,
    };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    console.warn(
      `[SECURITY][IMPERSONATE] actor=${actor.id}(${actor.email}) target=${target.id}(${target.email}) reason=${args.reason || "-"} at=${new Date().toISOString()}`,
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            user: sanitizeUser(target),
            accessToken,
            refreshToken,
            actor: sanitizeUser(actor),
          }),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text" as const, text: `가장 로그인 실패: ${message}` }],
      isError: true,
    };
  }
}

// 3. 내 정보 조회
export async function userMeHandler(args: { token: string }) {
  try {
    const { user } = await verifyAndGetUser(args.token);

    if (!user) {
      return {
        content: [
          { type: "text" as const, text: "사용자를 찾을 수 없습니다." },
        ],
        isError: true,
      };
    }

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(sanitizeUser(user)) },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text" as const, text: `인증 실패: ${message}` }],
      isError: true,
    };
  }
}

// 3-1. 사용자 조회 (관리자)
export async function userGetHandler(args: {
  token: string;
  userId: string;
}) {
  try {
    const { payload, user } = await verifyAndGetUser(args.token);

    if (!user) {
      return {
        content: [
          { type: "text" as const, text: "사용자를 찾을 수 없습니다." },
        ],
        isError: true,
      };
    }

    if (payload.role !== "admin") {
      return {
        content: [{ type: "text" as const, text: "관리자 권한이 필요합니다." }],
        isError: true,
      };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: args.userId, deletedAt: null },
    });

    if (!targetUser) {
      return {
        content: [
          { type: "text" as const, text: "대상 사용자를 찾을 수 없습니다." },
        ],
        isError: true,
      };
    }

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(sanitizeUser(targetUser)) },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text" as const, text: `사용자 조회 실패: ${message}` }],
      isError: true,
    };
  }
}

// 4. 정보 수정
export async function userUpdateHandler(args: {
  token: string;
  name?: string | null;
  phone?: string | null;
  website?: string | null;
  avatarUrl?: string | null;
  currentPassword?: string;
  newPassword?: string;
}) {
  try {
    const { user } = await verifyAndGetUser(args.token);

    if (!user) {
      return {
        content: [
          { type: "text" as const, text: "사용자를 찾을 수 없습니다." },
        ],
        isError: true,
      };
    }

    const updateData: {
      name?: string;
      phone?: string | null;
      website?: string | null;
      avatarUrl?: string | null;
      hashedPassword?: string;
    } = {};

    // 이름 변경
    if (args.name) {
      updateData.name = args.name;
    }
    if (args.phone !== undefined) {
      updateData.phone = args.phone;
    }
    if (args.website !== undefined) {
      updateData.website = args.website;
    }
    if (args.avatarUrl !== undefined) {
      updateData.avatarUrl = args.avatarUrl;
    }

    // 비밀번호 변경
    if (args.newPassword) {
      if (!args.currentPassword) {
        return {
          content: [
            {
              type: "text" as const,
              text: "비밀번호 변경 시 현재 비밀번호가 필요합니다.",
            },
          ],
          isError: true,
        };
      }

      if (!user.hashedPassword) {
        return {
          content: [
            {
              type: "text" as const,
              text: "소셜 로그인 사용자는 비밀번호를 변경할 수 없습니다.",
            },
          ],
          isError: true,
        };
      }

      const isValidPassword = await bcrypt.compare(
        args.currentPassword,
        user.hashedPassword,
      );
      if (!isValidPassword) {
        return {
          content: [
            {
              type: "text" as const,
              text: "현재 비밀번호가 일치하지 않습니다.",
            },
          ],
          isError: true,
        };
      }

      if (!validatePassword(args.newPassword)) {
        return {
          content: [
            {
              type: "text" as const,
              text: "비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다.",
            },
          ],
          isError: true,
        };
      }

      updateData.hashedPassword = await bcrypt.hash(
        args.newPassword,
        SALT_ROUNDS,
      );
    }

    if (Object.keys(updateData).length === 0) {
      return {
        content: [{ type: "text" as const, text: "변경할 내용이 없습니다." }],
        isError: true,
      };
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(sanitizeUser(updatedUser)),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text" as const, text: `정보 수정 실패: ${message}` }],
      isError: true,
    };
  }
}

// 5. 회원 탈퇴 (Soft Delete)
export async function userDeleteHandler(args: {
  token: string;
  password: string;
}) {
  try {
    const { user } = await verifyAndGetUser(args.token);

    if (!user) {
      return {
        content: [
          { type: "text" as const, text: "사용자를 찾을 수 없습니다." },
        ],
        isError: true,
      };
    }

    if (!user.hashedPassword) {
      return {
        content: [
          {
            type: "text" as const,
            text: "소셜 로그인 사용자의 탈퇴는 별도 처리가 필요합니다.",
          },
        ],
        isError: true,
      };
    }

    const isValidPassword = await bcrypt.compare(
      args.password,
      user.hashedPassword,
    );
    if (!isValidPassword) {
      return {
        content: [
          { type: "text" as const, text: "비밀번호가 일치하지 않습니다." },
        ],
        isError: true,
      };
    }

    // Soft Delete
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            message: "계정이 비활성화되었습니다.",
            userId: user.id,
          }),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text" as const, text: `회원 탈퇴 실패: ${message}` }],
      isError: true,
    };
  }
}

// 6. 회원 목록 (관리자 전용)
export async function userListHandler(args: {
  token: string;
  limit?: number;
  offset?: number;
}) {
  try {
    const { payload, user } = await verifyAndGetUser(args.token);

    if (!user) {
      return {
        content: [
          { type: "text" as const, text: "사용자를 찾을 수 없습니다." },
        ],
        isError: true,
      };
    }

    if (payload.role !== "admin") {
      return {
        content: [{ type: "text" as const, text: "관리자 권한이 필요합니다." }],
        isError: true,
      };
    }

    const limit = args.limit || 50;
    const offset = args.offset || 0;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
          isActive: true,
          provider: true,
          createdAt: true,
          lastLoginAt: true,
        },
      }),
      prisma.user.count({ where: { deletedAt: null } }),
    ]);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ users, total, limit, offset }),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `회원 목록 조회 실패: ${message}` },
      ],
      isError: true,
    };
  }
}

// 7. 역할 변경 (관리자 전용)
export async function userUpdateRoleHandler(args: {
  token: string;
  userId: string;
  role: "admin" | "operator" | "editor" | "instructor" | "viewer" | "guest";
}) {
  try {
    const { payload, user } = await verifyAndGetUser(args.token);

    if (!user) {
      return {
        content: [
          { type: "text" as const, text: "사용자를 찾을 수 없습니다." },
        ],
        isError: true,
      };
    }

    if (payload.role !== "admin") {
      return {
        content: [{ type: "text" as const, text: "관리자 권한이 필요합니다." }],
        isError: true,
      };
    }

    // 자기 자신의 역할 변경 방지
    if (args.userId === user.id) {
      return {
        content: [
          { type: "text" as const, text: "자신의 역할은 변경할 수 없습니다." },
        ],
        isError: true,
      };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: args.userId, deletedAt: null },
    });

    if (!targetUser) {
      return {
        content: [
          { type: "text" as const, text: "대상 사용자를 찾을 수 없습니다." },
        ],
        isError: true,
      };
    }

    const updatedUser = await prisma.user.update({
      where: { id: args.userId },
      data: { role: args.role },
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            userId: updatedUser.id,
            email: updatedUser.email,
            role: updatedUser.role,
          }),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text" as const, text: `역할 변경 실패: ${message}` }],
      isError: true,
    };
  }
}

// 7-1. 사용자 정보 수정 (관리자 전용)
export async function userUpdateByAdminHandler(args: {
  token: string;
  userId: string;
  name?: string | null;
  role?: "admin" | "operator" | "editor" | "instructor" | "viewer" | "guest";
  isActive?: boolean;
}) {
  try {
    const { payload, user } = await verifyAndGetUser(args.token);

    if (!user) {
      return {
        content: [
          { type: "text" as const, text: "사용자를 찾을 수 없습니다." },
        ],
        isError: true,
      };
    }

    if (payload.role !== "admin") {
      return {
        content: [{ type: "text" as const, text: "관리자 권한이 필요합니다." }],
        isError: true,
      };
    }

    // 자기 자신의 정보는 여기서 수정 불가 (자신의 이름은 userUpdateHandler 사용)
    if (args.userId === user.id) {
      return {
        content: [
          {
            type: "text" as const,
            text: "자신의 정보는 프로필에서 수정하세요.",
          },
        ],
        isError: true,
      };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: args.userId, deletedAt: null },
    });

    if (!targetUser) {
      return {
        content: [
          { type: "text" as const, text: "대상 사용자를 찾을 수 없습니다." },
        ],
        isError: true,
      };
    }

    const updateData: {
      name?: string;
      role?: typeof args.role;
      isActive?: boolean;
    } = {};

    if (args.name) {
      updateData.name = args.name;
    }
    if (args.role !== undefined) {
      updateData.role = args.role;
    }
    if (args.isActive !== undefined) {
      updateData.isActive = args.isActive;
    }

    if (Object.keys(updateData).length === 0) {
      return {
        content: [{ type: "text" as const, text: "변경할 내용이 없습니다." }],
        isError: true,
      };
    }

    const updatedUser = await prisma.user.update({
      where: { id: args.userId },
      data: updateData,
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            role: updatedUser.role,
            isActive: updatedUser.isActive,
          }),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `사용자 정보 수정 실패: ${message}` },
      ],
      isError: true,
    };
  }
}

// 8. 강사 신청 (사용자)
export async function requestInstructorHandler(args: {
  token: string;
  displayName?: string | null;
  title?: string | null;
  bio?: string | null;
  phone?: string | null;
  website?: string | null;
  avatarUrl?: string | null;
  links?: any;
  degrees?: { name: string; school: string; major: string; year: string; fileUrl?: string | null }[] | null;
  careers?: { company: string; role: string; period: string; description?: string | null }[] | null;
  publications?: { title: string; type: string; year?: string | null; publisher?: string | null; url?: string | null }[] | null;
  certifications?: { name: string; issuer?: string | null; date?: string | null; fileUrl?: string | null }[] | null;
  specialties?: string[] | null;
  affiliation?: string | null;
  email?: string | null;
}) {
  try {
    const { user } = await verifyAndGetUser(args.token);
    if (!user) {
      return {
        content: [
          { type: "text" as const, text: "사용자를 찾을 수 없습니다." },
        ],
        isError: true,
      };
    }

    if (
      args.phone !== undefined ||
      args.website !== undefined ||
      args.avatarUrl !== undefined
    ) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          phone: args.phone === undefined ? undefined : args.phone,
          website: args.website === undefined ? undefined : args.website,
          avatarUrl: args.avatarUrl === undefined ? undefined : args.avatarUrl,
        },
      });
    }

    // upsert profile
    const profile = await prisma.instructorProfile.upsert({
      where: { userId: user.id },
      update: {
        displayName: args.displayName || user.name,
        title: args.title,
        bio: args.bio,
        links: args.links === undefined ? undefined : args.links,
        degrees: toNullableJsonValue(args.degrees),
        careers: toNullableJsonValue(args.careers),
        publications: toNullableJsonValue(args.publications),
        certifications: toNullableJsonValue(args.certifications),
        specialties: args.specialties !== undefined && args.specialties !== null ? args.specialties : undefined,
        affiliation: args.affiliation === undefined ? undefined : args.affiliation,
        email: args.email === undefined ? undefined : (args.email || null),
        isPending: true,
      },
      create: {
        userId: user.id,
        displayName: args.displayName || user.name,
        title: args.title,
        bio: args.bio,
        links: args.links === undefined ? undefined : args.links,
        degrees: args.degrees || undefined,
        careers: args.careers || undefined,
        publications: args.publications || undefined,
        certifications: args.certifications || undefined,
        specialties: args.specialties || [],
        affiliation: args.affiliation || undefined,
        email: args.email || undefined,
        isPending: true,
      },
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            profileId: profile.id,
            isPending: profile.isPending,
          }),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text" as const, text: `강사 신청 실패: ${message}` }],
      isError: true,
    };
  }
}

// 9. 강사 승인 (관리자)
export async function approveInstructorHandler(args: {
  token: string;
  userId: string;
  message?: string;
}) {
  try {
    const { payload, user } = await verifyAndGetUser(args.token);
    if (!user) {
      return {
        content: [
          { type: "text" as const, text: "사용자를 찾을 수 없습니다." },
        ],
        isError: true,
      };
    }

    if (payload.role !== "admin") {
      return {
        content: [{ type: "text" as const, text: "관리자 권한이 필요합니다." }],
        isError: true,
      };
    }

    const profile = await prisma.instructorProfile.findUnique({
      where: { userId: args.userId },
      include: { User: true },
    });
    if (!profile) {
      return {
        content: [
          { type: "text" as const, text: "강사 신청 정보를 찾을 수 없습니다." },
        ],
        isError: true,
      };
    }
    // create or update Instructor record based on userId (1:1 mapping)
    let existingInstructor = await prisma.instructor.findFirst({
      where: { userId: args.userId },
    });
    if (!existingInstructor && profile.User?.email) {
      existingInstructor = await prisma.instructor.findFirst({
        where: { email: profile.User.email },
      });
    }

    let instructor;
    if (existingInstructor) {
      const updateData: any = {
        userId: args.userId,
        name:
          profile.User?.name || profile.displayName || existingInstructor.name,
        title: profile.title,
        email: profile.email || profile.User?.email,
        tagline: profile.bio,
        affiliation: profile.affiliation || existingInstructor.affiliation,
        degrees: profile.degrees || existingInstructor.degrees,
        careers: profile.careers || existingInstructor.careers,
        publications: profile.publications || existingInstructor.publications,
        certifications: profile.certifications || existingInstructor.certifications,
        specialties: profile.specialties?.length ? profile.specialties : existingInstructor.specialties,
      };
      if (profile.links) {
        updateData.links = profile.links;
      }
      instructor = await prisma.instructor.update({
        where: { id: existingInstructor.id },
        data: updateData,
      });
    } else {
      const createData: any = {
        userId: args.userId,
        name: profile.User?.name || profile.displayName || "Unknown",
        title: profile.title,
        email: profile.email || profile.User?.email,
        tagline: profile.bio,
        affiliation: profile.affiliation || undefined,
        degrees: profile.degrees || undefined,
        careers: profile.careers || undefined,
        publications: profile.publications || undefined,
        certifications: profile.certifications || undefined,
        specialties: profile.specialties?.length ? profile.specialties : [],
        awards: [],
        createdBy: payload.userId,
      };
      if (profile.links) {
        createData.links = profile.links;
      }
      instructor = await prisma.instructor.create({
        data: createData,
      });
    }

    // mark profile approved
    await prisma.instructorProfile.update({
      where: { userId: args.userId },
      data: { isApproved: true, isPending: false },
    });

    // set user role to instructor
    await prisma.user.update({
      where: { id: args.userId },
      data: { role: "instructor" },
    });

    const note = args.message?.trim();
    await createUserMessage(prisma, {
      recipientUserId: args.userId,
      senderUserId: payload.userId,
      category: "instructor_approval",
      title: "[강사 승인 완료] 강사 권한이 승인되었습니다",
      body: note || "강사 승인 완료. 이제 강사 프로필/코스를 등록할 수 있습니다.",
      actionType: "instructor_approved",
      actionPayload: {
        instructorId: instructor.id,
      },
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ instructorId: instructor.id }),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text" as const, text: `강사 승인 실패: ${message}` }],
      isError: true,
    };
  }
}

// 10. 강사 프로파일 수정 (자기 자신)
export async function updateInstructorProfileHandler(args: {
  token: string;
  displayName?: string | null;
  title?: string | null;
  bio?: string | null;
  phone?: string | null;
  website?: string | null;
  links?: any;
  degrees?: { name: string; school: string; major: string; year: string; fileUrl?: string | null }[] | null;
  careers?: { company: string; role: string; period: string; description?: string | null }[] | null;
  publications?: { title: string; type: string; year?: string | null; publisher?: string | null; url?: string | null }[] | null;
  certifications?: { name: string; issuer?: string | null; date?: string | null; fileUrl?: string | null }[] | null;
  specialties?: string[] | null;
  affiliation?: string | null;
  email?: string | null;
}) {
  try {
    const { user } = await verifyAndGetUser(args.token);
    if (!user) {
      return {
        content: [
          { type: "text" as const, text: "사용자를 찾을 수 없습니다." },
        ],
        isError: true,
      };
    }

    if (args.phone !== undefined || args.website !== undefined) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          phone: args.phone === undefined ? undefined : args.phone,
          website: args.website === undefined ? undefined : args.website,
        },
      });
    }

    const profile = await prisma.instructorProfile.upsert({
      where: { userId: user.id },
      update: {
        displayName: args.displayName,
        title: args.title,
        bio: args.bio,
        links: args.links === undefined ? undefined : args.links,
        degrees: toNullableJsonValue(args.degrees),
        careers: toNullableJsonValue(args.careers),
        publications: toNullableJsonValue(args.publications),
        certifications: toNullableJsonValue(args.certifications),
        specialties: args.specialties !== undefined && args.specialties !== null ? args.specialties : undefined,
        affiliation: args.affiliation === undefined ? undefined : args.affiliation,
        email: args.email === undefined ? undefined : (args.email || null),
      },
      create: {
        userId: user.id,
        displayName: args.displayName || user.name,
        title: args.title,
        bio: args.bio,
        links: args.links === undefined ? undefined : args.links,
        degrees: args.degrees || undefined,
        careers: args.careers || undefined,
        publications: args.publications || undefined,
        certifications: args.certifications || undefined,
        specialties: args.specialties || [],
        affiliation: args.affiliation || undefined,
        email: args.email || undefined,
        isPending: true,
      },
    });

    return {
      content: [{ type: "text" as const, text: JSON.stringify(profile) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `강사 프로파일 수정 실패: ${message}` },
      ],
      isError: true,
    };
  }
}

export async function getInstructorProfileHandler(args: { token: string }) {
  try {
    const { user } = await verifyAndGetUser(args.token);
    if (!user) {
      return {
        content: [
          { type: "text" as const, text: "사용자를 찾을 수 없습니다." },
        ],
        isError: true,
      };
    }

    const profile = await prisma.instructorProfile.findUnique({
      where: { userId: user.id },
      include: { User: true },
    });

    if (!profile) {
      return {
        content: [{ type: "text" as const, text: "null" }],
      };
    }

    const mergedProfile = {
      ...profile,
      displayName: profile.User?.name || profile.displayName,
      phone: profile.User?.phone ?? null,
      website: profile.User?.website ?? null,
    };

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(mergedProfile) },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `강사 프로파일 조회 실패: ${message}` },
      ],
      isError: true,
    };
  }
}
