import { z } from 'zod';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../services/prisma.js';
import { requirePermission } from '../services/authorization.js';
import { verifyToken } from '../services/jwt.js';
import { errorResult } from '../services/toolResponse.js';

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

function resolvePdfDiskPath(pdfUrl?: string | null): string | null {
  if (!pdfUrl || !pdfUrl.startsWith('/pdf/')) return null;
  const fileName = path.basename(pdfUrl);
  if (!fileName) return null;
  return path.resolve(process.cwd(), 'public', 'pdf', fileName);
}

async function deletePdfFilesBestEffort(pdfUrls: Array<string | null | undefined>) {
  const filePaths = [...new Set(pdfUrls.map((url) => resolvePdfDiskPath(url)).filter((v): v is string => !!v))];
  await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        await fs.unlink(filePath);
      } catch (error: any) {
        if (error?.code !== 'ENOENT') {
          // non-fatal cleanup error; keep delete operation successful
          // eslint-disable-next-line no-console
          console.warn('[document.delete] failed to remove pdf file:', filePath, error?.message || error);
        }
      }
    }),
  );
}

async function cleanupRenderJobsBestEffort(renderJobIds: string[], userId: string) {
  const uniqueIds = [...new Set(renderJobIds.filter(Boolean))];
  for (const renderJobId of uniqueIds) {
    try {
      const remained = await prisma.userDocument.count({
        where: { renderJobId },
      });
      if (remained === 0) {
        await prisma.renderJob.deleteMany({
          where: { id: renderJobId, userId },
        });
      }
    } catch (error: any) {
      // non-fatal cleanup error; keep delete operation successful
      // eslint-disable-next-line no-console
      console.warn('[document.delete] failed to cleanup renderJob:', renderJobId, error?.message || error);
    }
  }
}

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
    await requirePermission(args.token, 'document.list', '문서 목록 조회 권한이 없습니다.');
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
    return errorResult('문서 목록 조회 실패', error);
  }
}

export async function documentDeleteHandler(args: { token: string; id: string }) {
  try {
    await requirePermission(args.token, 'document.delete', '문서 삭제 권한이 없습니다.');
    const userId = await getActiveUserId(args.token);
    if (!userId) {
      return {
        content: [{ type: 'text' as const, text: '사용자를 찾을 수 없습니다.' }],
        isError: true,
      };
    }

    const doc = await prisma.userDocument.findFirst({
      where: { id: args.id, userId },
      select: { id: true, targetType: true, targetId: true, renderJobId: true, label: true, pdfUrl: true },
    });
    if (!doc) {
      return {
        content: [{ type: 'text' as const, text: '문서를 찾을 수 없습니다.' }],
        isError: true,
      };
    }

    const brochureSetting =
      doc.targetType === 'brochure_package'
        ? await prisma.appSetting.findUnique({
            where: { key: `brochure.package.${doc.targetId}` },
            select: { value: true },
          })
        : null;
    const brochureSettingValue =
      (brochureSetting?.value as { renderBatchToken?: string | null } | undefined) || undefined;
    const renderBatchToken =
      typeof brochureSettingValue?.renderBatchToken === 'string' && brochureSettingValue.renderBatchToken
        ? brochureSettingValue.renderBatchToken
        : null;

    const isBrochureBatchArtifact =
      (doc.targetType === 'course' || doc.targetType === 'instructor_profile') &&
      (doc.label || '').includes('brochure-batch:');

    const pdfUrlsToDelete: string[] = [];
    const renderJobIdsToCleanup: string[] = [];
    let packageDocsSnapshot: Array<{ id: string; renderJobId: string; pdfUrl: string }> = [];
    let artifactDocsSnapshot: Array<{ id: string; renderJobId: string; pdfUrl: string }> = [];

    if (doc.targetType === 'brochure_package') {
      packageDocsSnapshot = await prisma.userDocument.findMany({
        where: {
          userId,
          targetType: 'brochure_package',
          targetId: doc.targetId,
        },
        select: { id: true, renderJobId: true, pdfUrl: true },
      });
      pdfUrlsToDelete.push(...packageDocsSnapshot.map((item) => item.pdfUrl));
      renderJobIdsToCleanup.push(...packageDocsSnapshot.map((item) => item.renderJobId));
    }
    if (doc.targetType === 'brochure_package' && renderBatchToken) {
      artifactDocsSnapshot = await prisma.userDocument.findMany({
        where: {
          userId,
          OR: [{ targetType: 'course' }, { targetType: 'instructor_profile' }],
          label: { contains: renderBatchToken },
        },
        select: { id: true, renderJobId: true, pdfUrl: true },
      });
      pdfUrlsToDelete.push(...artifactDocsSnapshot.map((item) => item.pdfUrl));
      renderJobIdsToCleanup.push(...artifactDocsSnapshot.map((item) => item.renderJobId));
    }

    await prisma.$transaction(async (tx) => {
      if (doc.targetType === 'brochure_package') {
        const packageDocIds = packageDocsSnapshot.map((item) => item.id);
        if (packageDocIds.length > 0) {
          await tx.userDocument.deleteMany({
            where: { id: { in: packageDocIds } },
          });
        }

        await tx.appSetting.deleteMany({
          where: { key: `brochure.package.${doc.targetId}` },
        });

        if (renderBatchToken) {
          const artifactDocIds = artifactDocsSnapshot.map((item) => item.id);
          if (artifactDocIds.length > 0) {
            await tx.userDocument.deleteMany({
              where: { id: { in: artifactDocIds } },
            });
          }
        }
      } else if (isBrochureBatchArtifact) {
        pdfUrlsToDelete.push(doc.pdfUrl);
        renderJobIdsToCleanup.push(doc.renderJobId);
        await tx.userDocument.delete({
          where: { id: doc.id },
        });
      } else {
        await tx.userDocument.update({
          where: { id: args.id },
          data: { isActive: false },
        });
      }
    });

    await deletePdfFilesBestEffort(pdfUrlsToDelete);
    // NOTE: renderJob hard-delete is disabled here because legacy/inactive documents
    // can still reference the same renderJobId and trigger FK failures.
    // Document/PDF cleanup remains authoritative for user-visible deletion.

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ id: args.id }) }],
    };
  } catch (error) {
    return errorResult('문서 삭제 실패', error);
  }
}

export async function documentShareHandler(args: {
  token: string;
  id: string;
  regenerate?: boolean;
}) {
  try {
    await requirePermission(args.token, 'document.share', '문서 공유 권한이 없습니다.');
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
    return errorResult('문서 공유 실패', error);
  }
}

export async function documentRevokeShareHandler(args: { token: string; id: string }) {
  try {
    await requirePermission(
      args.token,
      'document.revokeShare',
      '문서 공유 해제 권한이 없습니다.',
    );
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
    return errorResult('문서 공유 해제 실패', error);
  }
}
