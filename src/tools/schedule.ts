import { z } from 'zod';
import { prisma } from '../services/prisma.js';

// 스키마 정의
export const scheduleUpsertSchema = {
  id: z.string().optional().describe('없으면 새로 생성'),
  courseId: z.string().describe('코스 ID'),
  instructorId: z.string().optional().describe('강사 ID'),
  date: z.string().datetime().optional().describe('수업 날짜 및 시간 (ISO 8601 형식)'),
  location: z.string().optional(),
  audience: z.string().optional(),
  remarks: z.string().optional(),
  customFields: z.record(z.any()).optional(), // JSON type in Prisma
};

export const scheduleGetSchema = {
  id: z.string().describe('일정 ID'),
};

// 핸들러 정의
export async function scheduleUpsertHandler(args: {
  id?: string;
  courseId: string;
  instructorId?: string;
  date?: string; // ISO 8601 string
  location?: string;
  audience?: string;
  remarks?: string;
  customFields?: Record<string, any>;
}) {
  try {
    const scheduleId = args.id || `s_${Date.now()}`;
    const scheduleDate = args.date ? new Date(args.date) : undefined;

    // Validate courseId and instructorId existence
    const course = await prisma.course.findUnique({
      where: { id: args.courseId, deletedAt: null },
      select: { id: true }
    });
    if (!course) {
      return {
        content: [{ type: 'text' as const, text: `Course not found: ${args.courseId}` }],
        isError: true,
      };
    }

    if (args.instructorId) {
      const instructor = await prisma.instructor.findUnique({
        where: { id: args.instructorId, deletedAt: null },
        select: { id: true }
      });
      if (!instructor) {
        return {
          content: [{ type: 'text' as const, text: `Instructor not found: ${args.instructorId}` }],
          isError: true,
        };
      }
    }

    const schedule = await prisma.courseSchedule.upsert({
      where: { id: scheduleId },
      create: {
        id: scheduleId,
        courseId: args.courseId,
        instructorId: args.instructorId,
        date: scheduleDate,
        location: args.location,
        audience: args.audience,
        remarks: args.remarks,
        customFields: args.customFields,
      },
      update: {
        courseId: args.courseId,
        instructorId: args.instructorId,
        date: scheduleDate,
        location: args.location,
        audience: args.audience,
        remarks: args.remarks,
        customFields: args.customFields,
      },
    });

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ id: schedule.id, courseId: schedule.courseId, date: schedule.date?.toISOString() }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `Failed to upsert schedule: ${message}` }],
      isError: true,
    };
  }
}

export async function scheduleGetHandler(args: { id: string }) {
  try {
    const schedule = await prisma.courseSchedule.findUnique({
      where: { id: args.id, deletedAt: null },
      include: {
        Course: true,
        Instructor: true,
      },
    });

    if (!schedule) {
      return {
        content: [{ type: 'text' as const, text: `Schedule not found: ${args.id}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(schedule) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `Failed to get schedule: ${message}` }],
      isError: true,
    };
  }
}
