import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import Handlebars from 'handlebars';
import { verifyToken } from '../services/jwt.js';

Handlebars.registerHelper('plus1', (val: number) => val + 1);

// createdBy ID를 사용자 이름으로 변환하는 헬퍼 함수
async function resolveCreatorNames<T extends { createdBy?: string | null }>(
  items: T[]
): Promise<(T & { createdBy: string })[]> {
  const creatorIds = [...new Set(items.map(i => i.createdBy).filter(Boolean))] as string[];
  if (creatorIds.length === 0) {
    return items.map(i => ({ ...i, createdBy: i.createdBy || '-' }));
  }

  const users = await prisma.user.findMany({
    where: { id: { in: creatorIds } },
    select: { id: true, name: true },
  });
  const userMap = new Map(users.map(u => [u.id, u.name]));

  return items.map(i => ({
    ...i,
    createdBy: i.createdBy ? (userMap.get(i.createdBy) || i.createdBy) : '-',
  }));
}

// 스키마 정의
export const templateCreateSchema = {
  name: z.string().describe('템플릿 이름'),
  type: z.string().describe('템플릿 타입 (instructor_profile | course_intro 등)'),
  html: z.string().describe('Handlebars 템플릿 HTML'),
  css: z.string().describe('템플릿 CSS'),
  token: z.string().optional().describe('인증 토큰 (등록자 추적용)'),
};

export const templateGetSchema = {
  id: z.string().describe('템플릿 ID'),
};

export const templateListSchema = {
  page: z.number().int().min(1).default(1).describe('페이지 번호'),
  pageSize: z.number().int().min(1).max(100).default(20).describe('페이지당 항목 수'),
  type: z.string().optional().describe('템플릿 타입 필터'),
};

export const templatePreviewHtmlSchema = {
  html: z.string().describe('Handlebars 템플릿'),
  css: z.string().describe('CSS'),
  data: z.record(z.any()).describe('템플릿에 주입할 데이터 (course, instructor, schedule 등)'),
};

export const templateDeleteSchema = {
  id: z.string().describe('템플릿 ID'),
  token: z.string().optional().describe('인증 토큰 (관리자/운영자 권한 확인용)'),
};

export const templateUpsertSchema = {
  id: z.string().optional().describe('템플릿 ID (수정 시)'),
  name: z.string().describe('템플릿 이름'),
  type: z.string().describe('템플릿 타입 (instructor_profile | course_intro 등)'),
  html: z.string().describe('Handlebars 템플릿 HTML'),
  css: z.string().describe('템플릿 CSS'),
  changelog: z.string().optional().describe('변경 로그'),
  token: z.string().optional().describe('인증 토큰 (등록자 추적용)'),
};

// 핸들러 정의
export async function templateCreateHandler(args: {
  name: string;
  type: string;
  html: string;
  css: string;
  token?: string;
}) {
  try {
    // 토큰에서 사용자 ID 추출
    let createdBy: string | undefined;
    if (args.token) {
      try {
        const payload = verifyToken(args.token);
        createdBy = payload.userId;
      } catch {
        // 토큰 검증 실패시 무시
      }
    }

    const template = await prisma.template.create({
      data: {
        name: args.name,
        type: args.type,
        html: args.html,
        css: args.css,
        createdBy,
        Versions: {
          create: {
            version: 1,
            html: args.html,
            css: args.css,
            changelog: 'Initial version',
          },
        },
      },
    });

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ id: template.id, name: template.name }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `Failed to create template: ${message}` }],
      isError: true,
    };
  }
}

export async function templateUpsertHandler(args: {
  id?: string;
  name: string;
  type: string;
  html: string;
  css: string;
  changelog?: string;
  token?: string;
}) {
  try {
    let createdBy: string | undefined;
    if (args.token) {
      try {
        const payload = verifyToken(args.token);
        createdBy = payload.userId;
      } catch {
        // ignore token errors
      }
    }

    if (!args.id) {
      const template = await prisma.template.create({
        data: {
          name: args.name,
          type: args.type,
          html: args.html,
          css: args.css,
          createdBy,
          Versions: {
            create: {
              version: 1,
              html: args.html,
              css: args.css,
              changelog: args.changelog || 'Initial version',
            },
          },
        },
      });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ id: template.id, name: template.name }) }],
      };
    }

    const existing = await prisma.template.findUnique({
      where: { id: args.id },
      include: { Versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!existing) {
      return {
        content: [{ type: 'text' as const, text: `Template not found: ${args.id}` }],
        isError: true,
      };
    }

    const nextVersion = (existing.Versions?.[0]?.version || 0) + 1;
    const updated = await prisma.template.update({
      where: { id: args.id },
      data: {
        name: args.name,
        type: args.type,
        html: args.html,
        css: args.css,
        Versions: {
          create: {
            version: nextVersion,
            html: args.html,
            css: args.css,
            changelog: args.changelog || `Updated to v${nextVersion}`,
          },
        },
      },
    });

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ id: updated.id, name: updated.name }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `Failed to upsert template: ${message}` }],
      isError: true,
    };
  }
}

export async function templateGetHandler(args: { id: string }) {
  try {
    const template = await prisma.template.findUnique({
      where: { id: args.id },
      include: {
        Versions: { orderBy: { version: 'desc' } }, // 최신 버전부터 조회
      },
    });

    if (!template) {
      return {
        content: [{ type: 'text' as const, text: `Template not found: ${args.id}` }],
        isError: true,
      };
    }

    const [enrichedTemplate] = await resolveCreatorNames([template]);

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(enrichedTemplate) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `Failed to get template: ${message}` }],
      isError: true,
    };
  }
}

export async function templateListHandler(args: {
  page: number;
  pageSize: number;
  type?: string;
}) {
  try {
    const skip = (args.page - 1) * args.pageSize;
    const take = args.pageSize;
    const where = args.type ? { type: args.type } : undefined;

    const [rawTemplates, total] = await prisma.$transaction([
      prisma.template.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        where,
      }),
      prisma.template.count({ where }),
    ]);

    const items = await resolveCreatorNames(rawTemplates);

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ items, total }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `Failed to list templates: ${message}` }],
      isError: true,
    };
  }
}

export async function templatePreviewHtmlHandler(args: {
  html: string;
  css: string;
  data: Record<string, any>;
}) {
  try {
    const template = Handlebars.compile(args.html);
    const renderedHtml = template(args.data);

    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
          <style>${args.css}</style>
      </head>
      <body>
          ${renderedHtml}
      </body>
      </html>
    `;

    return {
      content: [{ type: 'text' as const, text: fullHtml }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `Failed to preview HTML: ${message}` }],
      isError: true,
    };
  }
}

export async function templateDeleteHandler(args: { id: string; token?: string }) {
  try {
    if (!args.token) {
      return {
        content: [{ type: 'text' as const, text: '권한이 없습니다.' }],
        isError: true,
      };
    }
    const payload = verifyToken(args.token);
    if (payload.role !== 'admin' && payload.role !== 'operator') {
      return {
        content: [{ type: 'text' as const, text: '관리자/운영자만 삭제할 수 있습니다.' }],
        isError: true,
      };
    }

    await prisma.template.delete({ where: { id: args.id } });
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ id: args.id }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `Failed to delete template: ${message}` }],
      isError: true,
    };
  }
}
