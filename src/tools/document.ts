import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../services/prisma.js';
import { verifyToken } from '../services/jwt.js';

export const documentListSchema = {
  token: z.string().describe('액세스 토큰'),
  page: z.number().int().min(1).default(1).describe('페이지 번호'),
  pageSize: z.number().int().min(1).max(100).default(20).describe('페이지당 항목 수'),
};

export const documentDeleteSchema = {
  token: z.string().describe('액세스 토큰'),
  id: z.string().describe('문서 ID'),
};

export const documentShareSchema = {
  token: z.string().describe('액세스 토큰'),
  id: z.string().describe('문서 ID'),
  regenerate: z.boolean().optional().describe('공유 토큰 재발급 여부'),
};

export const documentRevokeShareSchema = {
  token: z.string().describe('액세스 토큰'),
  id: z.string().describe('문서 ID'),
};

async function getActiveUserId(token: string) {
  const payload = verifyToken(token);
  const user = await prisma.user.findUnique({
    where: { id: payload.userId, isActive: true, deletedAt: null },
    select: { id: true },
  });
  return user?.id || null;
}

async function generateUniqueShareToken(): Promise<string> {
  for (let i = 0; i < 5; i += 1) {
    const token = crypto.randomBytes(16).toString('hex');
    const exists = await prisma.userDocument.findUnique({
      where: { shareToken: token },
      select: { id: true },
    });
    if (!exists) return token;
  }
  throw new Error('Failed to generate share token');
}

export async function documentListHandler(args: {
  token: string;
  page?: number;
  pageSize?: number;
}) {
  try {
    const userId = await getActiveUserId(args.token);
    if (!userId) {
      return {
        content: [{ type: 'text' as const, text: '사용자를 찾을 수 없습니다.' }],
        isError: true,
      };
    }

    const page = args.page || 1;
    const pageSize = args.pageSize || 20;
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [items, total] = await prisma.$transaction([
      prisma.userDocument.findMany({
        where: { userId, isActive: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          Template: { select: { id: true, name: true, type: true } },
          RenderJob: { select: { status: true } },
        },
      }),
      prisma.userDocument.count({ where: { userId, isActive: true } }),
    ]);

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ items, total }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `Failed to list documents: ${message}` }],
      isError: true,
    };
  }
}

export async function documentDeleteHandler(args: { token: string; id: string }) {
  try {
    const userId = await getActiveUserId(args.token);
    if (!userId) {
      return {
        content: [{ type: 'text' as const, text: '사용자를 찾을 수 없습니다.' }],
        isError: true,
      };
    }

    const doc = await prisma.userDocument.findFirst({
      where: { id: args.id, userId },
      select: { id: true },
    });
    if (!doc) {
      return {
        content: [{ type: 'text' as const, text: '문서를 찾을 수 없습니다.' }],
        isError: true,
      };
    }

    await prisma.userDocument.update({
      where: { id: args.id },
      data: { isActive: false },
    });

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ id: args.id }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `Failed to delete document: ${message}` }],
      isError: true,
    };
  }
}

export async function documentShareHandler(args: {
  token: string;
  id: string;
  regenerate?: boolean;
}) {
  try {
    const userId = await getActiveUserId(args.token);
    if (!userId) {
      return {
        content: [{ type: 'text' as const, text: '사용자를 찾을 수 없습니다.' }],
        isError: true,
      };
    }

    const doc = await prisma.userDocument.findFirst({
      where: { id: args.id, userId, isActive: true },
    });
    if (!doc) {
      return {
        content: [{ type: 'text' as const, text: '문서를 찾을 수 없습니다.' }],
        isError: true,
      };
    }

    if (!doc.shareToken || args.regenerate) {
      const token = await generateUniqueShareToken();
      const updated = await prisma.userDocument.update({
        where: { id: doc.id },
        data: { shareToken: token },
      });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ id: updated.id, shareToken: updated.shareToken }) }],
      };
    }

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ id: doc.id, shareToken: doc.shareToken }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `Failed to share document: ${message}` }],
      isError: true,
    };
  }
}

export async function documentRevokeShareHandler(args: { token: string; id: string }) {
  try {
    const userId = await getActiveUserId(args.token);
    if (!userId) {
      return {
        content: [{ type: 'text' as const, text: '사용자를 찾을 수 없습니다.' }],
        isError: true,
      };
    }

    const doc = await prisma.userDocument.findFirst({
      where: { id: args.id, userId, isActive: true },
      select: { id: true },
    });
    if (!doc) {
      return {
        content: [{ type: 'text' as const, text: '문서를 찾을 수 없습니다.' }],
        isError: true,
      };
    }

    await prisma.userDocument.update({
      where: { id: doc.id },
      data: { shareToken: null },
    });

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ id: doc.id, shareToken: null }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `Failed to revoke share: ${message}` }],
      isError: true,
    };
  }
}
