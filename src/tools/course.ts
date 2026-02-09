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
export const courseUpsertSchema = {
  id: z.string().optional().describe("없으면 새로 생성"),
  title: z.string().describe("코스 제목"),
  description: z.string().optional(),
  durationHours: z.number().int().min(0).optional(),
  isOnline: z.boolean().optional(),
  equipment: z.array(z.string()).optional(),
  goal: z.string().optional(),
  notes: z.string().optional(),
  token: z.string().optional().describe("인증 토큰 (등록자 추적용)"),
};

export const courseGetSchema = {
  id: z.string().describe("코스 ID"),
};

export const courseListSchema = {
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
export async function courseUpsertHandler(args: {
  id?: string;
  title: string;
  description?: string;
  durationHours?: number;
  isOnline?: boolean;
  equipment?: string[];
  goal?: string;
  notes?: string;
  token?: string;
}) {
  try {
    const courseId = args.id || `c_${Date.now()}`;

    // 토큰에서 사용자 ID 추출
    let createdBy: string | undefined;
    if (args.token) {
      try {
        const payload = verifyToken(args.token);
        createdBy = payload.userId;
      } catch {
        // 토큰 검증 실패시 무시 (선택적 기능)
      }
    }

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
        createdBy,
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
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ id: course.id, title: course.title }),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `Failed to upsert course: ${message}` },
      ],
      isError: true,
    };
  }
}

export async function courseListHandler(args: {
  limit?: number;
  offset?: number;
}) {
  try {
    const limit = args.limit || 50;
    const offset = args.offset || 0;

    const [rawCourses, total] = await Promise.all([
      prisma.course.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          _count: { select: { Lectures: true, Schedules: true } },
        },
      }),
      prisma.course.count({ where: { deletedAt: null } }),
    ]);

    const courses = await resolveCreatorNames(rawCourses);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ courses, total, limit, offset }),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `Failed to list courses: ${message}` },
      ],
      isError: true,
    };
  }
}

export async function courseGetHandler(args: { id: string }) {
  try {
    const course = await prisma.course.findUnique({
      where: { id: args.id, deletedAt: null },
      include: {
        Lectures: { where: { deletedAt: null }, orderBy: { order: "asc" } },
        Schedules: {
          where: { deletedAt: null },
          include: { Instructor: true },
        },
      },
    });

    if (!course) {
      return {
        content: [
          { type: "text" as const, text: `Course not found: ${args.id}` },
        ],
        isError: true,
      };
    }

    const [enrichedCourse] = await resolveCreatorNames([course]);

    // 강의들의 등록자도 이름으로 변환
    if (enrichedCourse.Lectures && enrichedCourse.Lectures.length > 0) {
      enrichedCourse.Lectures = await resolveCreatorNames(
        enrichedCourse.Lectures,
      );

      // 교육 시간 계산: 강의 목록의 시간 합계 + 기존값 괄호 표시
      const totalLectureHours = enrichedCourse.Lectures.reduce(
        (sum, lecture) => sum + (lecture.hours || 0),
        0,
      );
      if (totalLectureHours > 0) {
        const originalDuration = enrichedCourse.durationHours || 0;
        (enrichedCourse as any).durationHours =
          `${totalLectureHours}(${originalDuration})`;
      }
    }

    // 일정들의 등록자와 강사 등록자도 변환
    if (enrichedCourse.Schedules && enrichedCourse.Schedules.length > 0) {
      enrichedCourse.Schedules = await resolveCreatorNames(
        enrichedCourse.Schedules,
      );
      for (let schedule of enrichedCourse.Schedules) {
        if (schedule.Instructor) {
          const [enrichedInstructor] = await resolveCreatorNames([
            schedule.Instructor,
          ]);
          schedule.Instructor = enrichedInstructor;
        }
      }
    }

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(enrichedCourse) },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `Failed to get course: ${message}` },
      ],
      isError: true,
    };
  }
}
