import { z } from 'zod';
import { prisma } from '../services/prisma.js';

// 스키마 정의
export const courseUpsertSchema = {
  id: z.string().optional().describe('없으면 새로 생성'),
  title: z.string().describe('코스 제목'),
  description: z.string().optional(),
  durationHours: z.number().int().min(0).optional(),
  isOnline: z.boolean().optional(),
  equipment: z.array(z.string()).optional(),
  goal: z.string().optional(),
  notes: z.string().optional(),
};

export const courseGetSchema = {
  id: z.string().describe('코스 ID'),
};

export const courseListSchema = {
  limit: z.number().int().min(1).max(100).optional().describe('최대 조회 개수 (기본 50)'),
  offset: z.number().int().min(0).optional().describe('오프셋 (기본 0)'),
};

// 핸들러 정의
export async function courseUpsertHandler(args: {
  id?: string;
  title: string;
  description?: string;
  durationHours?: number;
  isOnline?: boolean;
  equipment?: string[];
  goal?: string;
  notes?: string;
}) {
  try {
    const courseId = args.id || `c_${Date.now()}`;

    const course = await prisma.course.upsert({
      where: { id: courseId },
      create: {
        id: courseId,
        title: args.title,
        description: args.description,
        durationHours: args.durationHours,
        isOnline: args.isOnline,
        equipment: args.equipment || [],
        goal: args.goal,
        notes: args.notes,
      },
      update: {
        title: args.title,
        description: args.description,
        durationHours: args.durationHours,
        isOnline: args.isOnline,
        equipment: args.equipment || [],
        goal: args.goal,
        notes: args.notes,
      },
    });

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ id: course.id, title: course.title }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `Failed to upsert course: ${message}` }],
      isError: true,
    };
  }
}

export async function courseListHandler(args: { limit?: number; offset?: number }) {
  try {
    const limit = args.limit || 50;
    const offset = args.offset || 0;

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          _count: { select: { Modules: true, Schedules: true } },
        },
      }),
      prisma.course.count({ where: { deletedAt: null } }),
    ]);

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ courses, total, limit, offset }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `Failed to list courses: ${message}` }],
      isError: true,
    };
  }
}

export async function courseGetHandler(args: { id: string }) {
  try {
    const course = await prisma.course.findUnique({
      where: { id: args.id, deletedAt: null },
      include: {
        Modules: { orderBy: { order: 'asc' } },
        Schedules: { where: { deletedAt: null }, include: { Instructor: true } },
      },
    });

    if (!course) {
      return {
        content: [{ type: 'text' as const, text: `Course not found: ${args.id}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(course) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `Failed to get course: ${message}` }],
      isError: true,
    };
  }
}
