import { z } from "zod";
import { verifyToken } from "../services/jwt.js";
import { prisma } from "../services/prisma.js";

// createdBy ID를 사용자 이름으로 변환하는 헬퍼 함수
async function resolveCreatorNames<T extends { createdBy?: string | null }>(
  items: T[],
): Promise<(T & { createdBy: string })[]> {
  const creatorIds = [
    ...new Set(items.map((i) => i.createdBy).filter(Boolean)),
  ] as string[];
  if (creatorIds.length === 0) {
    return items.map((i) => ({ ...i, createdBy: i.createdBy || "-" }));
  }

  const users = await prisma.user.findMany({
    where: { id: { in: creatorIds } },
    select: { id: true, name: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  return items.map((i) => ({
    ...i,
    createdBy: i.createdBy ? userMap.get(i.createdBy) || i.createdBy : "-",
  }));
}

// 스키마 정의
export const scheduleUpsertSchema = {
  id: z.string().optional().describe("없으면 새로 생성"),
  courseId: z.string().describe("코스 ID"),
  instructorId: z.string().optional().describe("강사 ID"),
  date: z
    .string()
    .datetime()
    .optional()
    .describe("수업 날짜 및 시간 (ISO 8601 형식)"),
  location: z.string().optional(),
  audience: z.string().optional(),
  remarks: z.string().optional(),
  customFields: z.record(z.any()).optional(), // JSON type in Prisma
  token: z.string().optional().describe("인증 토큰 (등록자 추적용)"),
};

export const scheduleGetSchema = {
  id: z.string().describe("일정 ID"),
};

export const scheduleListSchema = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("최대 조회 개수 (기본 50)"),
  offset: z.number().int().min(0).optional().describe("오프셋 (기본 0)"),
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
  token?: string;
}) {
  try {
    const scheduleId = args.id || `s_${Date.now()}`;
    const scheduleDate = args.date ? new Date(args.date) : undefined;

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

    // Validate courseId and instructorId existence
    const course = await prisma.course.findUnique({
      where: { id: args.courseId, deletedAt: null },
      select: { id: true },
    });
    if (!course) {
      return {
        content: [
          { type: "text" as const, text: `Course not found: ${args.courseId}` },
        ],
        isError: true,
      };
    }

    if (args.instructorId) {
      const instructor = await prisma.instructor.findUnique({
        where: { id: args.instructorId, deletedAt: null },
        select: { id: true },
      });
      if (!instructor) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Instructor not found: ${args.instructorId}`,
            },
          ],
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
        createdBy,
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
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            id: schedule.id,
            courseId: schedule.courseId,
            date: schedule.date?.toISOString(),
          }),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        {
          type: "text" as const,
          text: `Failed to upsert schedule: ${message}`,
        },
      ],
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
        content: [
          { type: "text" as const, text: `Schedule not found: ${args.id}` },
        ],
        isError: true,
      };
    }

    const [enrichedSchedule] = await resolveCreatorNames([schedule]);

    // 강사의 등록자도 이름으로 변환
    if (enrichedSchedule.Instructor) {
      const [enrichedInstructor] = await resolveCreatorNames([
        enrichedSchedule.Instructor,
      ]);
      enrichedSchedule.Instructor = enrichedInstructor;
    }

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(enrichedSchedule) },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `Failed to get schedule: ${message}` },
      ],
      isError: true,
    };
  }
}

export async function scheduleListHandler(args: {
  limit?: number;
  offset?: number;
}) {
  try {
    const limit = args.limit || 50;
    const offset = args.offset || 0;

    const [rawSchedules, total] = await Promise.all([
      prisma.courseSchedule.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: { Instructor: true },
      }),
      prisma.courseSchedule.count({ where: { deletedAt: null } }),
    ]);

    const schedules = await resolveCreatorNames(rawSchedules);

    // 각 스케줄의 강사 등록자도 변환
    for (let schedule of schedules) {
      if (schedule.Instructor) {
        const [enrichedInstructor] = await resolveCreatorNames([
          schedule.Instructor,
        ]);
        schedule.Instructor = enrichedInstructor;
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ schedules, total, limit, offset }),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `Failed to list schedules: ${message}` },
      ],
      isError: true,
    };
  }
}
