import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import Handlebars from 'handlebars';

// 스키마 정의
export const templateCreateSchema = {
  name: z.string().describe('템플릿 이름'),
  html: z.string().describe('Handlebars 템플릿 HTML'),
  css: z.string().describe('템플릿 CSS'),
  createdBy: z.string().optional().describe('템플릿 생성자'),
};

export const templateGetSchema = {
  id: z.string().describe('템플릿 ID'),
};

export const templateListSchema = {
  page: z.number().int().min(1).default(1).describe('페이지 번호'),
  pageSize: z.number().int().min(1).max(100).default(20).describe('페이지당 항목 수'),
};

export const templatePreviewHtmlSchema = {
  html: z.string().describe('Handlebars 템플릿'),
  css: z.string().describe('CSS'),
  data: z.record(z.any()).describe('템플릿에 주입할 데이터 (course, instructor, schedule 등)'),
};

// 핸들러 정의
export async function templateCreateHandler(args: {
  name: string;
  html: string;
  css: string;
  createdBy?: string;
}) {
  try {
    const template = await prisma.template.create({
      data: {
        name: args.name,
        html: args.html,
        css: args.css,
        createdBy: args.createdBy,
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

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(template) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `Failed to get template: ${message}` }],
      isError: true,
    };
  }
}

export async function templateListHandler(args: { page: number; pageSize: number }) {
  try {
    const skip = (args.page - 1) * args.pageSize;
    const take = args.pageSize;

    const [templates, total] = await prisma.$transaction([
      prisma.template.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.template.count(),
    ]);

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ items: templates, total }) }],
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
