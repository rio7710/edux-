import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requirePermission } from "../services/authorization.js";
import { verifyToken } from "../services/jwt.js";
import { prisma } from "../services/prisma.js";
import { errorResult } from "../services/toolResponse.js";

const nullableString = z.string().nullable().optional();
const nullableStringArray = z.array(z.string()).nullable().optional();

function toNullableJsonValue<T>(
  value: T | null | undefined,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

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
  token: z.string().describe("인증 토큰"),
};

export const instructorGetByUserSchema = {
  token: z.string().describe("액세스 토큰"),
};

export const instructorListSchema = {
  token: z.string().describe("인증 토큰"),
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
    if (!args.token) {
      return {
        content: [{ type: "text" as const, text: "인증이 필요합니다." }],
        isError: true,
      };
    }
    await requirePermission(
      args.token,
      "instructor.upsert",
      "강사 생성/수정 권한이 없습니다.",
    );

    const instructorId = args.id || `i_${randomUUID()}`;

    let payload: { userId: string; role: string };
    try {
      payload = verifyToken(args.token) as { userId: string; role: string };
    } catch {
      return {
        content: [{ type: "text" as const, text: "인증 실패" }],
        isError: true,
      };
    }

    const actor = await prisma.user.findFirst({
      where: { id: payload.userId, isActive: true, deletedAt: null },
      select: { id: true, role: true },
    });
    if (!actor) {
      return {
        content: [{ type: "text" as const, text: "사용자를 찾을 수 없습니다." }],
        isError: true,
      };
    }

    const createdBy = actor.id;
    const isAdminOperator =
      actor.role === "admin" || actor.role === "operator";

    // 강사는 반드시 User와 연결되어야 함
    const resolvedUserId = isAdminOperator ? args.userId : actor.id;
    if (isAdminOperator && !resolvedUserId) {
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

    if (args.id) {
      const existing = await prisma.instructor.findFirst({
        where: { id: args.id, deletedAt: null },
        select: { id: true, userId: true },
      });
      if (!existing) {
        return {
          content: [
            { type: "text" as const, text: `Instructor not found: ${args.id}` },
          ],
          isError: true,
        };
      }
      if (!isAdminOperator && existing.userId !== actor.id) {
        return {
          content: [{ type: "text" as const, text: "본인 강사 정보만 수정할 수 있습니다." }],
          isError: true,
        };
      }
    }

    const targetUser = await prisma.user.findFirst({
      where: { id: resolvedUserId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!targetUser) {
      return {
        content: [{ type: "text" as const, text: "연결할 사용자를 찾을 수 없습니다." }],
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
        specialties: args.specialties ?? [],
        certifications: toNullableJsonValue(args.certifications),
        awards: args.awards ?? [],
        links: args.links,
        degrees: toNullableJsonValue(args.degrees),
        careers: toNullableJsonValue(args.careers),
        publications: toNullableJsonValue(args.publications),
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
        specialties:
          args.specialties === undefined ? undefined : args.specialties || [],
        certifications: toNullableJsonValue(args.certifications),
        awards: args.awards === undefined ? undefined : args.awards || [],
        links: args.links,
        degrees: toNullableJsonValue(args.degrees),
        careers: toNullableJsonValue(args.careers),
        publications: toNullableJsonValue(args.publications),
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
    return errorResult("강사 저장 실패", error);
  }
}

export async function instructorListHandler(args: {
  token: string;
  limit?: number;
  offset?: number;
}) {
  try {
    await requirePermission(
      args.token,
      "instructor.list",
      "강사 목록 조회 권한이 없습니다.",
    );
    try {
      verifyToken(args.token);
    } catch {
      return {
        content: [{ type: "text" as const, text: "인증 실패" }],
        isError: true,
      };
    }

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
    return errorResult("강사 목록 조회 실패", error);
  }
}

export async function instructorGetHandler(args: { id: string; token: string }) {
  try {
    await requirePermission(
      args.token,
      "instructor.get",
      "강사 조회 권한이 없습니다.",
    );
    try {
      verifyToken(args.token);
    } catch {
      return {
        content: [{ type: "text" as const, text: "인증 실패" }],
        isError: true,
      };
    }

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
    return errorResult("강사 조회 실패", error);
  }
}

export async function instructorGetByUserHandler(args: { token: string }) {
  try {
    await requirePermission(
      args.token,
      "instructor.getByUser",
      "내 강사 정보 조회 권한이 없습니다.",
    );
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
    return errorResult("내 강사 정보 조회 실패", error);
  }
}
