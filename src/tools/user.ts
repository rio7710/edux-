import { z } from 'zod';
import bcrypt from 'bcrypt';
import { prisma } from '../services/prisma.js';
import { signAccessToken, signRefreshToken, verifyToken, type JwtPayload } from '../services/jwt.js';

const SALT_ROUNDS = 10;
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;

// ─────────────────────────────────────────────────────────────
// 스키마 정의
// ─────────────────────────────────────────────────────────────

export const userRegisterSchema = {
  email: z.string().email().describe('이메일'),
  password: z.string().min(8).describe('비밀번호 (8자 이상, 영문+숫자)'),
  name: z.string().min(1).describe('이름'),
};

export const userLoginSchema = {
  email: z.string().email().describe('이메일'),
  password: z.string().describe('비밀번호'),
};

export const userMeSchema = {
  token: z.string().describe('액세스 토큰'),
};

export const userUpdateSchema = {
  token: z.string().describe('액세스 토큰'),
  name: z.string().optional().describe('이름'),
  currentPassword: z.string().optional().describe('현재 비밀번호 (비밀번호 변경 시 필수)'),
  newPassword: z.string().min(8).optional().describe('새 비밀번호'),
};

export const userDeleteSchema = {
  token: z.string().describe('액세스 토큰'),
  password: z.string().describe('비밀번호 확인'),
};

export const userListSchema = {
  token: z.string().describe('액세스 토큰 (관리자만)'),
  limit: z.number().int().min(1).max(100).optional().describe('최대 조회 개수'),
  offset: z.number().int().min(0).optional().describe('오프셋'),
};

export const userUpdateRoleSchema = {
  token: z.string().describe('액세스 토큰 (관리자만)'),
  userId: z.string().describe('대상 사용자 ID'),
  role: z.enum(['admin', 'editor', 'viewer']).describe('역할'),
};

// ─────────────────────────────────────────────────────────────
// 헬퍼 함수
// ─────────────────────────────────────────────────────────────

function validatePassword(password: string): boolean {
  return PASSWORD_REGEX.test(password);
}

async function verifyAndGetUser(token: string) {
  const payload = verifyToken(token);
  const user = await prisma.user.findUnique({
    where: { id: payload.userId, isActive: true, deletedAt: null },
  });
  return { payload, user };
}

function sanitizeUser(user: { id: string; email: string; name: string; role: string; createdAt: Date; lastLoginAt: Date | null }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

// ─────────────────────────────────────────────────────────────
// 핸들러 정의
// ─────────────────────────────────────────────────────────────

// 1. 회원가입
export async function userRegisterHandler(args: { email: string; password: string; name: string }) {
  try {
    // 비밀번호 규칙 검사
    if (!validatePassword(args.password)) {
      return {
        content: [{ type: 'text' as const, text: '비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다.' }],
        isError: true,
      };
    }

    // 이메일 중복 검사
    const existingUser = await prisma.user.findUnique({ where: { email: args.email } });
    if (existingUser) {
      return {
        content: [{ type: 'text' as const, text: '이미 사용 중인 이메일입니다.' }],
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
        hashedPassword,
        provider: 'local',
        role: 'viewer',
      },
    });

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ id: user.id, email: user.email, name: user.name }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `회원가입 실패: ${message}` }],
      isError: true,
    };
  }
}

// 2. 로그인
export async function userLoginHandler(args: { email: string; password: string }) {
  try {
    const user = await prisma.user.findUnique({
      where: { email: args.email, isActive: true, deletedAt: null },
    });

    if (!user || !user.hashedPassword) {
      return {
        content: [{ type: 'text' as const, text: '이메일 또는 비밀번호가 일치하지 않습니다.' }],
        isError: true,
      };
    }

    const isValidPassword = await bcrypt.compare(args.password, user.hashedPassword);
    if (!isValidPassword) {
      return {
        content: [{ type: 'text' as const, text: '이메일 또는 비밀번호가 일치하지 않습니다.' }],
        isError: true,
      };
    }

    // 마지막 로그인 시간 업데이트
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // JWT 토큰 발급
    const payload: JwtPayload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          user: sanitizeUser(user),
          accessToken,
          refreshToken,
        }),
      }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `로그인 실패: ${message}` }],
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
        content: [{ type: 'text' as const, text: '사용자를 찾을 수 없습니다.' }],
        isError: true,
      };
    }

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(sanitizeUser(user)) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `인증 실패: ${message}` }],
      isError: true,
    };
  }
}

// 4. 정보 수정
export async function userUpdateHandler(args: {
  token: string;
  name?: string;
  currentPassword?: string;
  newPassword?: string;
}) {
  try {
    const { user } = await verifyAndGetUser(args.token);

    if (!user) {
      return {
        content: [{ type: 'text' as const, text: '사용자를 찾을 수 없습니다.' }],
        isError: true,
      };
    }

    const updateData: { name?: string; hashedPassword?: string } = {};

    // 이름 변경
    if (args.name) {
      updateData.name = args.name;
    }

    // 비밀번호 변경
    if (args.newPassword) {
      if (!args.currentPassword) {
        return {
          content: [{ type: 'text' as const, text: '비밀번호 변경 시 현재 비밀번호가 필요합니다.' }],
          isError: true,
        };
      }

      if (!user.hashedPassword) {
        return {
          content: [{ type: 'text' as const, text: '소셜 로그인 사용자는 비밀번호를 변경할 수 없습니다.' }],
          isError: true,
        };
      }

      const isValidPassword = await bcrypt.compare(args.currentPassword, user.hashedPassword);
      if (!isValidPassword) {
        return {
          content: [{ type: 'text' as const, text: '현재 비밀번호가 일치하지 않습니다.' }],
          isError: true,
        };
      }

      if (!validatePassword(args.newPassword)) {
        return {
          content: [{ type: 'text' as const, text: '비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다.' }],
          isError: true,
        };
      }

      updateData.hashedPassword = await bcrypt.hash(args.newPassword, SALT_ROUNDS);
    }

    if (Object.keys(updateData).length === 0) {
      return {
        content: [{ type: 'text' as const, text: '변경할 내용이 없습니다.' }],
        isError: true,
      };
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(sanitizeUser(updatedUser)) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `정보 수정 실패: ${message}` }],
      isError: true,
    };
  }
}

// 5. 회원 탈퇴 (Soft Delete)
export async function userDeleteHandler(args: { token: string; password: string }) {
  try {
    const { user } = await verifyAndGetUser(args.token);

    if (!user) {
      return {
        content: [{ type: 'text' as const, text: '사용자를 찾을 수 없습니다.' }],
        isError: true,
      };
    }

    if (!user.hashedPassword) {
      return {
        content: [{ type: 'text' as const, text: '소셜 로그인 사용자의 탈퇴는 별도 처리가 필요합니다.' }],
        isError: true,
      };
    }

    const isValidPassword = await bcrypt.compare(args.password, user.hashedPassword);
    if (!isValidPassword) {
      return {
        content: [{ type: 'text' as const, text: '비밀번호가 일치하지 않습니다.' }],
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
      content: [{ type: 'text' as const, text: JSON.stringify({ message: '계정이 비활성화되었습니다.', userId: user.id }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `회원 탈퇴 실패: ${message}` }],
      isError: true,
    };
  }
}

// 6. 회원 목록 (관리자 전용)
export async function userListHandler(args: { token: string; limit?: number; offset?: number }) {
  try {
    const { payload, user } = await verifyAndGetUser(args.token);

    if (!user) {
      return {
        content: [{ type: 'text' as const, text: '사용자를 찾을 수 없습니다.' }],
        isError: true,
      };
    }

    if (payload.role !== 'admin') {
      return {
        content: [{ type: 'text' as const, text: '관리자 권한이 필요합니다.' }],
        isError: true,
      };
    }

    const limit = args.limit || 50;
    const offset = args.offset || 0;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          email: true,
          name: true,
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
      content: [{ type: 'text' as const, text: JSON.stringify({ users, total, limit, offset }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `회원 목록 조회 실패: ${message}` }],
      isError: true,
    };
  }
}

// 7. 역할 변경 (관리자 전용)
export async function userUpdateRoleHandler(args: { token: string; userId: string; role: 'admin' | 'editor' | 'viewer' }) {
  try {
    const { payload, user } = await verifyAndGetUser(args.token);

    if (!user) {
      return {
        content: [{ type: 'text' as const, text: '사용자를 찾을 수 없습니다.' }],
        isError: true,
      };
    }

    if (payload.role !== 'admin') {
      return {
        content: [{ type: 'text' as const, text: '관리자 권한이 필요합니다.' }],
        isError: true,
      };
    }

    // 자기 자신의 역할 변경 방지
    if (args.userId === user.id) {
      return {
        content: [{ type: 'text' as const, text: '자신의 역할은 변경할 수 없습니다.' }],
        isError: true,
      };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: args.userId, deletedAt: null },
    });

    if (!targetUser) {
      return {
        content: [{ type: 'text' as const, text: '대상 사용자를 찾을 수 없습니다.' }],
        isError: true,
      };
    }

    const updatedUser = await prisma.user.update({
      where: { id: args.userId },
      data: { role: args.role },
    });

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ userId: updatedUser.id, email: updatedUser.email, role: updatedUser.role }),
      }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `역할 변경 실패: ${message}` }],
      isError: true,
    };
  }
}
