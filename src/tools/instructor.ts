import { z } from "zod";
import { verifyToken } from "../services/jwt.js";
import { prisma } from "../services/prisma.js";

const nullableString = z.string().nullable().optional();
const nullableStringArray = z.array(z.string()).nullable().optional();

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
export const instructorUpsertSchema = {
  id: z.string().optional().describe("없으면 새로 생성"),
  userId: z.string().optional().describe("연결할 사용자 ID"),
  name: z.string().describe("강사 이름"),
  title: nullableString,
  email: z.string().email().nullable().optional().or(z.literal("")),
  phone: nullableString,
  affiliation: nullableString,
  avatarUrl: z.string().nullable().optional().or(z.literal("")),
  tagline: nullableString,
  bio: nullableString,
  specialties: nullableStringArray,
  certifications: z.array(z.object({
    name: z.string(),
    issuer: nullableString,
    date: nullableString,
    fileUrl: nullableString,
  })).nullable().optional(),
  awards: nullableStringArray,
  links: z.record(z.any()).optional(),
  degrees: z.array(z.object({
    name: z.string(),
    school: z.string(),
    major: z.string(),
    year: z.string(),
    fileUrl: nullableString,
  })).nullable().optional(),
  careers: z.array(z.object({
    company: z.string(),
    role: z.string(),
    period: z.string(),
    description: nullableString,
  })).nullable().optional(),
  publications: z.array(z.object({
    title: z.string(),
    type: z.string(),
    year: nullableString,
    publisher: nullableString,
    url: nullableString,
  })).nullable().optional(),
  token: z.string().optional().describe("인증 토큰 (등록자 추적용)"),
};

export const instructorGetSchema = {
  id: z.string().describe("강사 ID"),
};

export const instructorGetByUserSchema = {
  token: z.string().describe("액세스 토큰"),
};

export const instructorListSchema = {
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
export async function instructorUpsertHandler(args: {
  id?: string;
  userId?: string;
  name: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  affiliation?: string | null;
  avatarUrl?: string | null;
  tagline?: string | null;
  bio?: string | null;
  specialties?: string[] | null;
  certifications?: { name: string; issuer?: string | null; date?: string | null; fileUrl?: string | null }[] | null;
  awards?: string[] | null;
  links?: Record<string, any>;
  degrees?: { name: string; school: string; major: string; year: string; fileUrl?: string | null }[] | null;
  careers?: { company: string; role: string; period: string; description?: string | null }[] | null;
  publications?: { title: string; type: string; year?: string | null; publisher?: string | null; url?: string | null }[] | null;
  token?: string;
}) {
  try {
    const instructorId = args.id || `i_${Date.now()}`;

    // 토큰에서 사용자 ID 추출
    let createdBy: string | undefined;
    let payload: { userId: string; role: string } | undefined;
    if (args.token) {
      try {
        payload = verifyToken(args.token) as { userId: string; role: string };
        createdBy = payload.userId;
      } catch {
        // 토큰 검증 실패시 무시
      }
    }

    const isAdminOperator =
      payload?.role === "admin" || payload?.role === "operator";

    // 강사는 반드시 User와 연결되어야 함
    let resolvedUserId = args.userId;
    if (payload) {
      if (!isAdminOperator) {
        resolvedUserId = payload.userId;
      } else if (!resolvedUserId) {
        return {
          content: [
            {
              type: "text" as const,
              text: "관리자/운영자는 사용자 ID를 선택해야 합니다.",
            },
          ],
          isError: true,
        };
      }
    }

    if (!resolvedUserId) {
      return {
        content: [
          {
            type: "text" as const,
            text: "강사 등록은 사용자 ID가 필요합니다.",
          },
        ],
        isError: true,
      };
    }

    const instructor = await prisma.instructor.upsert({
      where: { id: instructorId },
      create: {
        id: instructorId,
        userId: resolvedUserId,
        name: args.name,
        title: args.title,
        email: args.email,
        affiliation: args.affiliation,
        avatarUrl: args.avatarUrl,
        tagline: args.tagline,
        bio: args.bio,
        specialties: args.specialties || [],
        certifications: args.certifications || undefined,
        awards: args.awards || [],
        links: args.links,
        degrees: args.degrees || undefined,
        careers: args.careers || undefined,
        publications: args.publications || undefined,
        createdBy,
      },
      update: {
        userId: resolvedUserId,
        name: args.name,
        title: args.title,
        email: args.email,
        affiliation: args.affiliation,
        avatarUrl: args.avatarUrl,
        tagline: args.tagline,
        bio: args.bio,
        specialties: args.specialties || [],
        certifications: args.certifications || undefined,
        awards: args.awards || [],
        links: args.links,
        degrees: args.degrees || undefined,
        careers: args.careers || undefined,
        publications: args.publications || undefined,
      },
    });
    if (args.phone !== undefined) {
      await prisma.user.update({
        where: { id: resolvedUserId },
        data: { phone: args.phone },
      });
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ id: instructor.id, name: instructor.name }),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        {
          type: "text" as const,
          text: `Failed to upsert instructor: ${message}`,
        },
      ],
      isError: true,
    };
  }
}

export async function instructorListHandler(args: {
  limit?: number;
  offset?: number;
}) {
  try {
    const limit = args.limit || 50;
    const offset = args.offset || 0;

    const [rawInstructors, total] = await Promise.all([
      prisma.instructor.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          User: {
            select: { phone: true },
          },
        },
      }),
      prisma.instructor.count({ where: { deletedAt: null } }),
    ]);

    const instructors = (await resolveCreatorNames(rawInstructors)).map(
      (inst) => ({
        ...inst,
        phone: inst.User?.phone ?? null,
      }),
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ instructors, total, limit, offset }),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        {
          type: "text" as const,
          text: `Failed to list instructors: ${message}`,
        },
      ],
      isError: true,
    };
  }
}

export async function instructorGetHandler(args: { id: string }) {
  try {
    const instructor = await prisma.instructor.findUnique({
      where: { id: args.id, deletedAt: null },
      include: {
        User: {
          select: { phone: true },
        },
        Schedules: true, // Instructors can have many schedules
        CourseInstructors: {
          include: { Course: true },
        },
      },
    });

    if (!instructor) {
      return {
        content: [
          { type: "text" as const, text: `Instructor not found: ${args.id}` },
        ],
        isError: true,
      };
    }

    const [enrichedInstructor] = await resolveCreatorNames([instructor]);

    // 스케줄들의 등록자도 이름으로 변환
    if (
      enrichedInstructor.Schedules &&
      enrichedInstructor.Schedules.length > 0
    ) {
      enrichedInstructor.Schedules = await resolveCreatorNames(
        enrichedInstructor.Schedules,
      );
    }

    if (
      (enrichedInstructor as any).CourseInstructors &&
      (enrichedInstructor as any).CourseInstructors.length > 0
    ) {
      const courses = (enrichedInstructor as any).CourseInstructors
        .map((ci: any) => ci.Course)
        .filter(Boolean);
      (enrichedInstructor as any).Courses = courses;
    } else {
      (enrichedInstructor as any).Courses = [];
    }
    (enrichedInstructor as any).phone =
      (enrichedInstructor as any).User?.phone ?? null;

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(enrichedInstructor) },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `Failed to get instructor: ${message}` },
      ],
      isError: true,
    };
  }
}

export async function instructorGetByUserHandler(args: { token: string }) {
  try {
    let userId: string | undefined;
    try {
      const payload = verifyToken(args.token);
      userId = payload.userId;
    } catch {
      return {
        content: [{ type: "text" as const, text: "인증 실패" }],
        isError: true,
      };
    }

    const instructor = await prisma.instructor.findFirst({
      where: { userId, deletedAt: null },
      include: {
        User: {
          select: { phone: true },
        },
        Schedules: true,
        CourseInstructors: {
          include: { Course: true },
        },
      },
    });

    if (!instructor) {
      return {
        content: [
          { type: "text" as const, text: "연결된 강사 정보를 찾을 수 없습니다." },
        ],
        isError: true,
      };
    }

    const [enrichedInstructor] = await resolveCreatorNames([instructor]);

    if (
      enrichedInstructor.Schedules &&
      enrichedInstructor.Schedules.length > 0
    ) {
      enrichedInstructor.Schedules = await resolveCreatorNames(
        enrichedInstructor.Schedules,
      );
    }

    if (
      (enrichedInstructor as any).CourseInstructors &&
      (enrichedInstructor as any).CourseInstructors.length > 0
    ) {
      const courses = (enrichedInstructor as any).CourseInstructors
        .map((ci: any) => ci.Course)
        .filter(Boolean);
      (enrichedInstructor as any).Courses = courses;
    } else {
      (enrichedInstructor as any).Courses = [];
    }
    (enrichedInstructor as any).phone =
      (enrichedInstructor as any).User?.phone ?? null;

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(enrichedInstructor) },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `Failed to get instructor: ${message}` },
      ],
      isError: true,
    };
  }
}
