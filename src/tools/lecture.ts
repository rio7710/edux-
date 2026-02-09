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
export const lectureUpsertSchema = {
  id: z.string().optional().describe("없으면 새로 생성"),
  courseId: z.string().describe("코스 ID"),
  title: z.string().describe("강의 제목"),
  description: z.string().optional().nullable(),
  hours: z.number().min(0).optional().nullable(),
  order: z.number().int().min(0).optional().nullable(),
  token: z.string().optional().describe("인증 토큰 (등록자 추적용)"),
};

export const lectureGetSchema = {
  id: z.string().describe("강의 ID"),
};

export const lectureListSchema = {
  courseId: z.string().describe("코스 ID"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("최대 조회 개수 (기본 50)"),
  offset: z.number().int().min(0).optional().describe("오프셋 (기본 0)"),
};

export const lectureDeleteSchema = {
  id: z.string().describe("강의 ID"),
  token: z.string().optional().describe("인증 토큰"),
};

// 핸들러 정의
export async function lectureUpsertHandler(args: {
  id?: string;
  courseId: string;
  title: string;
  description?: string | null;
  hours?: number | null;
  order?: number | null;
  token?: string;
}) {
  try {
    // 코스 존재 확인
    const course = await prisma.course.findUnique({
      where: { id: args.courseId, deletedAt: null },
    });
    if (!course) {
      return {
        content: [
          { type: "text" as const, text: `Course not found: ${args.courseId}` },
        ],
        isError: true,
      };
    }

    const lectureId = args.id || `l_${Date.now()}`;

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

    const lecture = await prisma.lecture.upsert({
      where: { id: lectureId },
      create: {
        id: lectureId,
        courseId: args.courseId,
        title: args.title,
        description: args.description ?? undefined,
        hours: args.hours ?? undefined,
        order: args.order ?? undefined,
        createdBy,
      },
      update: {
        title: args.title,
        description: args.description ?? undefined,
        hours: args.hours ?? undefined,
        order: args.order ?? undefined,
      },
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            id: lecture.id,
            courseId: lecture.courseId,
            title: lecture.title,
          }),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `Failed to upsert lecture: ${message}` },
      ],
      isError: true,
    };
  }
}

export async function lectureGetHandler(args: { id: string }) {
  try {
    const lecture = await prisma.lecture.findUnique({
      where: { id: args.id, deletedAt: null },
      include: { Course: true },
    });

    if (!lecture) {
      return {
        content: [
          { type: "text" as const, text: `Lecture not found: ${args.id}` },
        ],
        isError: true,
      };
    }

    const [enrichedLecture] = await resolveCreatorNames([lecture]);

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(enrichedLecture) },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `Failed to get lecture: ${message}` },
      ],
      isError: true,
    };
  }
}

export async function lectureListHandler(args: {
  courseId: string;
  limit?: number;
  offset?: number;
}) {
  try {
    const limit = args.limit || 50;
    const offset = args.offset || 0;

    const [rawLectures, total] = await Promise.all([
      prisma.lecture.findMany({
        where: { courseId: args.courseId, deletedAt: null },
        orderBy: { order: "asc" },
        take: limit,
        skip: offset,
      }),
      prisma.lecture.count({
        where: { courseId: args.courseId, deletedAt: null },
      }),
    ]);

    const lectures = await resolveCreatorNames(rawLectures);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ lectures, total, limit, offset }),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `Failed to list lectures: ${message}` },
      ],
      isError: true,
    };
  }
}

export async function lectureDeleteHandler(args: {
  id: string;
  token?: string;
}) {
  try {
    const lecture = await prisma.lecture.findUnique({
      where: { id: args.id, deletedAt: null },
    });

    if (!lecture) {
      return {
        content: [
          { type: "text" as const, text: `Lecture not found: ${args.id}` },
        ],
        isError: true,
      };
    }

    await prisma.lecture.update({
      where: { id: args.id },
      data: { deletedAt: new Date() },
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ id: args.id, deleted: true }),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `Failed to delete lecture: ${message}` },
      ],
      isError: true,
    };
  }
}
