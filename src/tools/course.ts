import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requirePermission, evaluatePermission } from "../services/authorization.js";
import { verifyToken } from "../services/jwt.js";
import { createUserMessage } from "../services/message.js";
import { prisma } from "../services/prisma.js";
import { errorResult } from "../services/toolResponse.js";

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
  description: z.string().optional().nullable(),
  durationHours: z.number().int().min(0).optional().nullable(),
  isOnline: z.boolean().optional().nullable(),
  equipment: z.array(z.string()).optional().nullable(),
  goal: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  instructorIds: z.array(z.string()).optional().nullable(),
  token: z.string().optional().describe("인증 토큰 (등록자 추적용)"),
};

export const courseGetSchema = {
  id: z.string().describe("코스 ID"),
  token: z.string().describe("액세스 토큰"),
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
  token: z.string().describe("액세스 토큰"),
};

export const courseListMineSchema = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("최대 조회 개수 (기본 50)"),
  offset: z.number().int().min(0).optional().describe("오프셋 (기본 0)"),
  token: z.string().describe("액세스 토큰"),
};

export const courseDeleteSchema = {
  id: z.string().describe("코스 ID"),
  token: z.string().describe("액세스 토큰"),
};

export const courseShareInviteSchema = {
  token: z.string().describe("액세스 토큰"),
  courseId: z.string().describe("공유할 코스 ID"),
  targetUserId: z.string().describe("공유 대상 사용자 ID"),
};

export const courseShareRespondSchema = {
  token: z.string().describe("액세스 토큰"),
  courseId: z.string().describe("응답할 코스 ID"),
  accept: z.boolean().describe("수락 여부 (true=수락, false=거절)"),
  reason: z.string().max(500).optional().describe("거절/해제 사유"),
};

export const courseShareListReceivedSchema = {
  token: z.string().describe("액세스 토큰"),
  status: z
    .enum(["pending", "accepted", "rejected"])
    .optional()
    .describe("조회할 공유 상태 (기본 pending)"),
};

export const courseShareListForCourseSchema = {
  token: z.string().describe("액세스 토큰"),
  courseId: z.string().describe("코스 ID"),
};

export const courseShareRevokeSchema = {
  token: z.string().describe("액세스 토큰"),
  courseId: z.string().describe("코스 ID"),
  targetUserId: z.string().describe("공유 해제 대상 사용자 ID"),
};

export const courseShareLeaveSchema = {
  token: z.string().describe("액세스 토큰"),
  courseId: z.string().describe("공유 해제할 코스 ID (수신자 본인 기준)"),
};

export const courseShareTargetsSchema = {
  token: z.string().describe("액세스 토큰"),
  query: z.string().optional().describe("검색어 (이름/이메일)"),
  limit: z.number().int().min(1).max(100).optional().describe("최대 조회 수"),
};

function buildCourseVisibilityWhere(
  userId?: string,
  role?: string,
) {
  if (!userId || role === "admin" || role === "operator") {
    return { deletedAt: null as null };
  }
  return {
    deletedAt: null as null,
    OR: [
      { createdBy: userId },
      {
        CourseShares: {
          some: {
            sharedWithUserId: userId,
            status: "accepted" as const,
          },
        },
      },
    ],
  };
}

function canManageCourseByRole(
  role: string | undefined,
  actorUserId: string | undefined,
  ownerUserId: string | null | undefined,
) {
  if (role === "admin" || role === "operator") return true;
  return !!actorUserId && !!ownerUserId && actorUserId === ownerUserId;
}

type Tx = Prisma.TransactionClient;

const AUTO_COURSE_SHARE_GRANT = {
  canMap: true,
  canEdit: false,
  canReshare: false,
} as const;

async function getActiveCourseLectureIds(
  tx: Tx,
  courseId: string,
): Promise<string[]> {
  const links = await tx.courseLecture.findMany({
    where: { courseId, Lecture: { deletedAt: null } },
    select: { lectureId: true },
  });
  return Array.from(new Set(links.map((link) => link.lectureId)));
}

async function grantAcceptedCourseShareLectures(
  tx: Tx,
  args: {
    courseId: string;
    sharedWithUserId: string;
    sharedByUserId: string;
    sourceRefId: string;
  },
): Promise<number> {
  const lectureIds = await getActiveCourseLectureIds(tx, args.courseId);
  if (lectureIds.length === 0) return 0;

  let syncedCount = 0;
  for (const lectureId of lectureIds) {
    const existing = await tx.lectureGrant.findUnique({
      where: {
        lectureId_userId: {
          lectureId,
          userId: args.sharedWithUserId,
        },
      },
      select: { id: true, sourceType: true, revokedAt: true },
    });

    if (!existing) {
      await tx.lectureGrant.create({
        data: {
          lectureId,
          userId: args.sharedWithUserId,
          grantedByUserId: args.sharedByUserId,
          sourceType: "course_share",
          sourceRefId: args.sourceRefId,
          canMap: AUTO_COURSE_SHARE_GRANT.canMap,
          canEdit: AUTO_COURSE_SHARE_GRANT.canEdit,
          canReshare: AUTO_COURSE_SHARE_GRANT.canReshare,
        },
      });
      syncedCount += 1;
      continue;
    }

    // Explicit manual grants stay authoritative to avoid accidental clobbering.
    if (existing.sourceType === "manual" && existing.revokedAt === null) {
      continue;
    }

    await tx.lectureGrant.update({
      where: { id: existing.id },
      data: {
        grantedByUserId: args.sharedByUserId,
        sourceType: "course_share",
        sourceRefId: args.sourceRefId,
        canMap: AUTO_COURSE_SHARE_GRANT.canMap,
        canEdit: AUTO_COURSE_SHARE_GRANT.canEdit,
        canReshare: AUTO_COURSE_SHARE_GRANT.canReshare,
        revokedAt: null,
      },
    });
    syncedCount += 1;
  }

  return syncedCount;
}

async function revokeAcceptedCourseShareLectures(
  tx: Tx,
  args: {
    courseId: string;
    sharedWithUserId: string;
    sourceRefId: string;
  },
): Promise<{ revokedCount: number; reassignedCount: number }> {
  const lectureIds = await getActiveCourseLectureIds(tx, args.courseId);
  if (lectureIds.length === 0) return { revokedCount: 0, reassignedCount: 0 };

  let revokedCount = 0;
  let reassignedCount = 0;

  for (const lectureId of lectureIds) {
    const grant = await tx.lectureGrant.findFirst({
      where: {
        lectureId,
        userId: args.sharedWithUserId,
        sourceType: "course_share",
        sourceRefId: args.sourceRefId,
        canMap: AUTO_COURSE_SHARE_GRANT.canMap,
        canEdit: AUTO_COURSE_SHARE_GRANT.canEdit,
        canReshare: AUTO_COURSE_SHARE_GRANT.canReshare,
        revokedAt: null,
      },
      select: { id: true },
    });
    if (!grant) continue;

    const fallbackShare = await tx.courseShare.findFirst({
      where: {
        id: { not: args.sourceRefId },
        sharedWithUserId: args.sharedWithUserId,
        status: "accepted",
        Course: {
          deletedAt: null,
          CourseLectures: {
            some: { lectureId },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, sharedByUserId: true },
    });

    if (fallbackShare) {
      await tx.lectureGrant.update({
        where: { id: grant.id },
        data: {
          grantedByUserId: fallbackShare.sharedByUserId,
          sourceType: "course_share",
          sourceRefId: fallbackShare.id,
          canMap: AUTO_COURSE_SHARE_GRANT.canMap,
          canEdit: AUTO_COURSE_SHARE_GRANT.canEdit,
          canReshare: AUTO_COURSE_SHARE_GRANT.canReshare,
          revokedAt: null,
        },
      });
      reassignedCount += 1;
      continue;
    }

    await tx.lectureGrant.update({
      where: { id: grant.id },
      data: { revokedAt: new Date() },
    });
    revokedCount += 1;
  }

  return { revokedCount, reassignedCount };
}

// 핸들러 정의
export async function courseUpsertHandler(args: {
  id?: string;
  title: string;
  description?: string | null;
  durationHours?: number | null;
  isOnline?: boolean | null;
  equipment?: string[] | null;
  goal?: string | null;
  content?: string | null;
  notes?: string | null;
  instructorIds?: string[] | null;
  token?: string;
}) {
  try {
    const courseId = args.id || `c_${randomUUID()}`;
    if (!args.token) {
      return {
        content: [{ type: "text" as const, text: "인증이 필요합니다." }],
        isError: true,
      };
    }
    await requirePermission(
      args.token,
      "course.upsert",
      "코스 생성/수정 권한이 없습니다.",
    );
    let actorUserId: string | undefined;
    let actorRole: string | undefined;
    try {
      const payload = verifyToken(args.token);
      actorUserId = payload.userId;
      actorRole = payload.role;
    } catch {
      return {
        content: [{ type: "text" as const, text: "인증 실패" }],
        isError: true,
      };
    }

    if (args.id) {
      const existingCourse = await prisma.course.findUnique({
        where: { id: args.id, deletedAt: null },
        select: { id: true, createdBy: true },
      });
      if (!existingCourse) {
        return {
          content: [{ type: "text" as const, text: `Course not found: ${args.id}` }],
          isError: true,
        };
      }
      const canManage = canManageCourseByRole(
        actorRole,
        actorUserId,
        existingCourse.createdBy,
      );
      if (!canManage) {
        return {
          content: [{ type: "text" as const, text: "본인 코스만 수정할 수 있습니다." }],
          isError: true,
        };
      }
    }

    const course = await prisma.course.upsert({
      where: { id: courseId },
      create: {
        id: courseId,
        title: args.title,
        description: args.description ?? undefined,
        durationHours: args.durationHours ?? undefined,
        isOnline: args.isOnline ?? undefined,
        equipment: args.equipment ?? [],
        goal: args.goal ?? undefined,
        content: args.content ?? undefined,
        notes: args.notes ?? undefined,
        createdBy: actorUserId,
      },
      update: {
        title: args.title,
        description: args.description ?? undefined,
        durationHours: args.durationHours ?? undefined,
        isOnline: args.isOnline ?? undefined,
        equipment: args.equipment ?? [],
        goal: args.goal ?? undefined,
        content: args.content ?? undefined,
        notes: args.notes ?? undefined,
      },
    });

    if (args.instructorIds !== undefined && args.instructorIds !== null) {
      const uniqueIds = Array.from(new Set(args.instructorIds));
      await prisma.courseInstructor.deleteMany({ where: { courseId } });
      if (uniqueIds.length > 0) {
        await prisma.courseInstructor.createMany({
          data: uniqueIds.map((instructorId) => ({
            courseId,
            instructorId,
          })),
          skipDuplicates: true,
        });
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ id: course.id, title: course.title }),
        },
      ],
    };
  } catch (error) {
    return errorResult("코스 저장 실패", error);
  }
}

export async function courseListHandler(args: {
  limit?: number;
  offset?: number;
  token: string;
}) {
  try {
    await requirePermission(args.token, "course.list", "코스 목록 조회 권한이 없습니다.");
    const limit = args.limit || 50;
    const offset = args.offset || 0;
    let userId: string | undefined;
    let role: string | undefined;
    try {
      const payload = verifyToken(args.token);
      userId = payload.userId;
      role = payload.role;
    } catch {
      return {
        content: [{ type: "text" as const, text: "인증 실패" }],
        isError: true,
      };
    }
    const where = buildCourseVisibilityWhere(userId, role);

    const [rawCourses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          _count: { select: { CourseLectures: true, Schedules: true } },
        },
      }),
      prisma.course.count({ where }),
    ]);

    const courses = await resolveCreatorNames(rawCourses);
    const ownerMap = new Map(rawCourses.map((c) => [c.id, c.createdBy]));
    const withPermissions = courses.map((course) => {
      const ownerUserId = ownerMap.get((course as any).id);
      const canEdit = canManageCourseByRole(role, userId, ownerUserId);
      return {
        ...course,
        canEdit,
      };
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ courses: withPermissions, total, limit, offset }),
        },
      ],
    };
  } catch (error) {
    return errorResult("코스 목록 조회 실패", error);
  }
}

export async function courseListMineHandler(args: {
  limit?: number;
  offset?: number;
  token: string;
}) {
  try {
    await requirePermission(
      args.token,
      "course.listMine",
      "내 코스 목록 조회 권한이 없습니다.",
    );
    const limit = args.limit || 50;
    const offset = args.offset || 0;
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
    if (!userId) {
      return {
        content: [{ type: "text" as const, text: "인증 실패" }],
        isError: true,
      };
    }

    const where = {
      deletedAt: null as null,
      createdBy: userId,
    };
    const [rawCourses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          _count: { select: { CourseLectures: true, Schedules: true } },
        },
      }),
      prisma.course.count({ where }),
    ]);
    const courses = await resolveCreatorNames(rawCourses);
    const withPermissions = courses.map((course) => ({
      ...course,
      canEdit: true,
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ courses: withPermissions, total, limit, offset }),
        },
      ],
    };
  } catch (error) {
    return errorResult("내 코스 목록 조회 실패", error);
  }
}

export async function courseGetHandler(args: { id: string; token: string }) {
  try {
    await requirePermission(args.token, "course.get", "코스 조회 권한이 없습니다.");
    let userId: string | undefined;
    let role: string | undefined;
    try {
      const payload = verifyToken(args.token);
      userId = payload.userId;
      role = payload.role;
    } catch {
      return {
        content: [{ type: "text" as const, text: "인증 실패" }],
        isError: true,
      };
    }
    const course = await prisma.course.findFirst({
      where: {
        id: args.id,
        ...buildCourseVisibilityWhere(userId, role),
      },
      include: {
        CourseLectures: {
          where: { Lecture: { deletedAt: null } },
          include: { Lecture: true },
          orderBy: { order: "asc" },
        },
        Schedules: {
          where: { deletedAt: null },
          include: { Instructor: true },
        },
        CourseInstructors: {
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

    const courseLectures = course.CourseLectures?.map((link) => ({
      ...link.Lecture,
      order: link.order,
    })) || [];

    // 강의들의 등록자도 이름으로 변환
    if (courseLectures.length > 0) {
      const resolvedLectures = await resolveCreatorNames(courseLectures);
      (enrichedCourse as any).Lectures = resolvedLectures;

      // 교육 시간 계산: 강의 목록의 시간 합계 + 기존값 괄호 표시
      const totalLectureHours = resolvedLectures.reduce(
        (sum, lecture) => sum + (lecture.hours || 0),
        0,
      );
      if (totalLectureHours > 0) {
        const originalDuration = enrichedCourse.durationHours || 0;
        (enrichedCourse as any).durationDisplay =
          `${totalLectureHours}(${originalDuration})`;
        (enrichedCourse as any).durationHours = totalLectureHours;
      }
    } else {
      (enrichedCourse as any).Lectures = [];
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

    if (
      enrichedCourse.CourseInstructors &&
      enrichedCourse.CourseInstructors.length > 0
    ) {
      const instructors = enrichedCourse.CourseInstructors
        .map((ci) => ci.Instructor)
        .filter(Boolean);
      const enrichedInstructors = await resolveCreatorNames(instructors);
      (enrichedCourse as any).Instructors = enrichedInstructors;
      (enrichedCourse as any).instructorIds = enrichedInstructors.map(
        (i) => i.id,
      );
    } else {
      (enrichedCourse as any).Instructors = [];
      (enrichedCourse as any).instructorIds = [];
    }
    (enrichedCourse as any).canEdit = canManageCourseByRole(
      role,
      userId,
      course.createdBy,
    );

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(enrichedCourse) },
      ],
    };
  } catch (error) {
    return errorResult("코스 조회 실패", error);
  }
}

export async function courseDeleteHandler(args: { id: string; token: string }) {
  try {
    await requirePermission(args.token, "course.delete", "코스 삭제 권한이 없습니다.");
    const decision = await evaluatePermission({
      token: args.token,
      permissionKey: "course.delete",
    });

    const course = await prisma.course.findFirst({
      where: { id: args.id, deletedAt: null },
      select: { id: true, createdBy: true },
    });

    if (!course) {
      return {
        content: [
          { type: "text" as const, text: `Course not found: ${args.id}` },
        ],
        isError: true,
      };
    }

    const isOwner = !!course.createdBy && course.createdBy === decision.actor.id;
    if (!decision.allowed && !isOwner) {
      return {
        content: [{ type: "text" as const, text: "본인 코스만 삭제할 수 있습니다." }],
        isError: true,
      };
    }

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const acceptedShares = await tx.courseShare.findMany({
        where: { courseId: args.id, status: "accepted" },
        select: { id: true, sharedWithUserId: true },
      });

      let revokedLectureGrantCount = 0;
      let reassignedLectureGrantCount = 0;
      for (const share of acceptedShares) {
        const revokeResult = await revokeAcceptedCourseShareLectures(tx, {
          courseId: args.id,
          sharedWithUserId: share.sharedWithUserId,
          sourceRefId: share.id,
        });
        revokedLectureGrantCount += revokeResult.revokedCount;
        reassignedLectureGrantCount += revokeResult.reassignedCount;
      }

      await tx.course.update({
        where: { id: args.id },
        data: { deletedAt: now },
      });
      await tx.courseLecture.deleteMany({
        where: { courseId: args.id },
      });
      await tx.courseSchedule.updateMany({
        where: { courseId: args.id, deletedAt: null },
        data: { deletedAt: now },
      });
      await tx.courseShare.deleteMany({
        where: { courseId: args.id },
      });
      await tx.courseInstructor.deleteMany({
        where: { courseId: args.id },
      });

      return {
        revokedLectureGrantCount,
        reassignedLectureGrantCount,
      };
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            id: args.id,
            deleted: true,
            revokedLectureGrantCount: result.revokedLectureGrantCount,
            reassignedLectureGrantCount: result.reassignedLectureGrantCount,
          }),
        },
      ],
    };
  } catch (error) {
    return errorResult("코스 삭제 실패", error);
  }
}

export async function courseShareInviteHandler(args: {
  token: string;
  courseId: string;
  targetUserId: string;
}) {
  try {
    await requirePermission(
      args.token,
      "course.shareInvite",
      "코스 공유 초대 권한이 없습니다.",
    );
    const payload = verifyToken(args.token);
    const actor = await prisma.user.findUnique({
      where: { id: payload.userId, isActive: true, deletedAt: null },
      select: { id: true, name: true, role: true },
    });
    if (!actor) {
      return {
        content: [{ type: "text" as const, text: "사용자를 찾을 수 없습니다." }],
        isError: true,
      };
    }
    const course = await prisma.course.findFirst({
      where: { id: args.courseId, deletedAt: null },
      select: { id: true, title: true, createdBy: true },
    });
    if (!course) {
      return {
        content: [{ type: "text" as const, text: `Course not found: ${args.courseId}` }],
        isError: true,
      };
    }
    const canShare =
      actor.role === "admin" ||
      actor.role === "operator" ||
      course.createdBy === actor.id;
    if (!canShare) {
      return {
        content: [{ type: "text" as const, text: "공유 권한이 없습니다." }],
        isError: true,
      };
    }
    if (args.targetUserId === actor.id) {
      return {
        content: [{ type: "text" as const, text: "본인에게는 공유할 수 없습니다." }],
        isError: true,
      };
    }
    const target = await prisma.user.findUnique({
      where: { id: args.targetUserId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!target) {
      return {
        content: [{ type: "text" as const, text: "공유 대상 사용자를 찾을 수 없습니다." }],
        isError: true,
      };
    }
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.courseShare.findUnique({
        where: {
          courseId_sharedWithUserId: {
            courseId: args.courseId,
            sharedWithUserId: args.targetUserId,
          },
        },
        select: { id: true, status: true },
      });

      let revokedLectureGrantCount = 0;
      let reassignedLectureGrantCount = 0;
      if (existing?.status === "accepted") {
        const revokeResult = await revokeAcceptedCourseShareLectures(tx, {
          courseId: args.courseId,
          sharedWithUserId: args.targetUserId,
          sourceRefId: existing.id,
        });
        revokedLectureGrantCount = revokeResult.revokedCount;
        reassignedLectureGrantCount = revokeResult.reassignedCount;
      }

      const share = await tx.courseShare.upsert({
        where: {
          courseId_sharedWithUserId: {
            courseId: args.courseId,
            sharedWithUserId: args.targetUserId,
          },
        },
        update: {
          status: "pending",
          sharedByUserId: actor.id,
          respondedAt: null,
        },
        create: {
          courseId: args.courseId,
          sharedWithUserId: args.targetUserId,
          sharedByUserId: actor.id,
          status: "pending",
        },
      });

      await createUserMessage(tx, {
        recipientUserId: args.targetUserId,
        senderUserId: actor.id,
        category: "course_share",
        title: `[코스 공유 요청] ${course.title}`,
        body: `${actor.name}님이 "${course.title}" 코스를 공유했습니다.`,
        actionType: "course_share_pending",
        actionPayload: {
          courseId: args.courseId,
        },
      });

      return {
        share,
        previousStatus: existing?.status ?? null,
        revokedLectureGrantCount,
        reassignedLectureGrantCount,
      };
    });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
    };
  } catch (error) {
    return errorResult("코스 공유 초대 실패", error);
  }
}

export async function courseShareRespondHandler(args: {
  token: string;
  courseId: string;
  accept: boolean;
  reason?: string;
}) {
  try {
    await requirePermission(
      args.token,
      "course.shareRespond",
      "코스 공유 응답 권한이 없습니다.",
    );
    const payload = verifyToken(args.token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId, isActive: true, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!user) {
      return {
        content: [{ type: "text" as const, text: "사용자를 찾을 수 없습니다." }],
        isError: true,
      };
    }
    const course = await prisma.course.findFirst({
      where: { id: args.courseId, deletedAt: null },
      select: { id: true, title: true },
    });
    if (!course) {
      return {
        content: [{ type: "text" as const, text: `Course not found: ${args.courseId}` }],
        isError: true,
      };
    }
    const targetStatus = args.accept ? "accepted" : "rejected";
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.courseShare.findUnique({
        where: {
          courseId_sharedWithUserId: {
            courseId: args.courseId,
            sharedWithUserId: user.id,
          },
        },
        select: { id: true, status: true, sharedByUserId: true },
      });
      if (!existing) {
        throw new Error("COURSE_SHARE_NOT_FOUND");
      }

      const share = await tx.courseShare.update({
        where: { id: existing.id },
        data: {
          status: targetStatus,
          respondedAt: new Date(),
        },
      });

      let grantedLectureGrantCount = 0;
      let revokedLectureGrantCount = 0;
      let reassignedLectureGrantCount = 0;
      if (args.accept) {
        grantedLectureGrantCount = await grantAcceptedCourseShareLectures(tx, {
          courseId: args.courseId,
          sharedWithUserId: user.id,
          sharedByUserId: existing.sharedByUserId,
          sourceRefId: existing.id,
        });
      } else {
        const revokeResult = await revokeAcceptedCourseShareLectures(tx, {
          courseId: args.courseId,
          sharedWithUserId: user.id,
          sourceRefId: existing.id,
        });
        revokedLectureGrantCount = revokeResult.revokedCount;
        reassignedLectureGrantCount = revokeResult.reassignedCount;
      }

      const reasonText = args.reason?.trim();
      const body = args.accept
        ? `${user.name}님이 "${course.title}" 코스 공유를 수락했습니다.`
        : `${user.name}님이 "${course.title}" 코스 공유를 거절했습니다.${reasonText ? ` 사유: ${reasonText}` : ""}`;
      await createUserMessage(tx, {
        recipientUserId: existing.sharedByUserId,
        senderUserId: user.id,
        category: "course_share",
        title: `[코스 공유 응답] ${course.title}`,
        body,
        actionType: "course_share_response",
        actionPayload: {
          courseId: args.courseId,
          status: targetStatus,
          reason: reasonText ?? null,
        },
      });

      return {
        share,
        previousStatus: existing.status,
        grantedLectureGrantCount,
        revokedLectureGrantCount,
        reassignedLectureGrantCount,
      };
    });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(updated) }],
    };
  } catch (error) {
    if (error instanceof Error && error.message === "COURSE_SHARE_NOT_FOUND") {
      return {
        content: [{ type: "text" as const, text: "공유 요청을 찾을 수 없습니다." }],
        isError: true,
      };
    }
    return errorResult("코스 공유 응답 실패", error);
  }
}

export async function courseShareListReceivedHandler(args: {
  token: string;
  status?: "pending" | "accepted" | "rejected";
}) {
  try {
    await requirePermission(
      args.token,
      "course.shareListReceived",
      "코스 공유 요청 목록 조회 권한이 없습니다.",
    );
    const payload = verifyToken(args.token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!user) {
      return {
        content: [{ type: "text" as const, text: "사용자를 찾을 수 없습니다." }],
        isError: true,
      };
    }

    const status = args.status || "pending";
    const shares = await prisma.courseShare.findMany({
      where: {
        sharedWithUserId: user.id,
        status,
      },
      orderBy: { createdAt: "desc" },
      include: {
        Course: {
          select: {
            id: true,
            title: true,
            description: true,
            createdBy: true,
          },
        },
        SharedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ shares }) }],
    };
  } catch (error) {
    return errorResult("수신 코스 공유 목록 조회 실패", error);
  }
}

export async function courseShareListForCourseHandler(args: {
  token: string;
  courseId: string;
}) {
  try {
    await requirePermission(
      args.token,
      "course.shareListForCourse",
      "코스 공유 대상 목록 조회 권한이 없습니다.",
    );
    const payload = verifyToken(args.token);
    const actor = await prisma.user.findUnique({
      where: { id: payload.userId, isActive: true, deletedAt: null },
      select: { id: true, role: true },
    });
    if (!actor) {
      return {
        content: [{ type: "text" as const, text: "사용자를 찾을 수 없습니다." }],
        isError: true,
      };
    }

    const course = await prisma.course.findFirst({
      where: { id: args.courseId, deletedAt: null },
      select: { id: true, createdBy: true },
    });
    if (!course) {
      return {
        content: [{ type: "text" as const, text: `Course not found: ${args.courseId}` }],
        isError: true,
      };
    }

    const canViewShares =
      actor.role === "admin" ||
      actor.role === "operator" ||
      course.createdBy === actor.id;
    if (!canViewShares) {
      return {
        content: [{ type: "text" as const, text: "공유 목록 조회 권한이 없습니다." }],
        isError: true,
      };
    }

    const shares = await prisma.courseShare.findMany({
      where: { courseId: args.courseId },
      orderBy: { createdAt: "desc" },
      include: {
        SharedWith: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ shares }) }],
    };
  } catch (error) {
    return errorResult("코스 공유 대상 목록 조회 실패", error);
  }
}

export async function courseShareRevokeHandler(args: {
  token: string;
  courseId: string;
  targetUserId: string;
}) {
  try {
    await requirePermission(
      args.token,
      "course.shareRevoke",
      "코스 공유 해제 권한이 없습니다.",
    );
    const payload = verifyToken(args.token);
    const actor = await prisma.user.findUnique({
      where: { id: payload.userId, isActive: true, deletedAt: null },
      select: { id: true, name: true, role: true },
    });
    if (!actor) {
      return {
        content: [{ type: "text" as const, text: "사용자를 찾을 수 없습니다." }],
        isError: true,
      };
    }

    const course = await prisma.course.findFirst({
      where: { id: args.courseId, deletedAt: null },
      select: { id: true, title: true, createdBy: true },
    });
    if (!course) {
      return {
        content: [{ type: "text" as const, text: `Course not found: ${args.courseId}` }],
        isError: true,
      };
    }

    const canManageShares =
      actor.role === "admin" ||
      actor.role === "operator" ||
      course.createdBy === actor.id;
    if (!canManageShares) {
      return {
        content: [{ type: "text" as const, text: "공유 해제 권한이 없습니다." }],
        isError: true,
      };
    }
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.courseShare.findUnique({
        where: {
          courseId_sharedWithUserId: {
            courseId: args.courseId,
            sharedWithUserId: args.targetUserId,
          },
        },
        select: { id: true, status: true },
      });
      if (!existing) {
        return {
          deletedShareCount: 0,
          revokedLectureGrantCount: 0,
          reassignedLectureGrantCount: 0,
          previousStatus: null as "pending" | "accepted" | "rejected" | null,
        };
      }

      const deletedShare = await tx.courseShare.deleteMany({
        where: { id: existing.id },
      });

      let revokedLectureGrantCount = 0;
      let reassignedLectureGrantCount = 0;
      if (existing.status === "accepted") {
        const revokeResult = await revokeAcceptedCourseShareLectures(tx, {
          courseId: args.courseId,
          sharedWithUserId: args.targetUserId,
          sourceRefId: existing.id,
        });
        revokedLectureGrantCount = revokeResult.revokedCount;
        reassignedLectureGrantCount = revokeResult.reassignedCount;
      }

      await createUserMessage(tx, {
        recipientUserId: args.targetUserId,
        senderUserId: actor.id,
        category: "course_share",
        title: `[코스 공유 해제] ${course.title}`,
        body: `${actor.name}님이 "${course.title}" 코스 공유를 해제했습니다.`,
        actionType: "course_share_revoked",
        actionPayload: {
          courseId: args.courseId,
          previousStatus: existing.status,
        },
      });

      return {
        deletedShareCount: deletedShare.count,
        revokedLectureGrantCount,
        reassignedLectureGrantCount,
        previousStatus: existing.status,
      };
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ ok: true, ...result }),
        },
      ],
    };
  } catch (error) {
    return errorResult("코스 공유 해제 실패", error);
  }
}

export async function courseShareTargetsHandler(args: {
  token: string;
  query?: string;
  limit?: number;
}) {
  try {
    await requirePermission(
      args.token,
      "course.shareTargets",
      "코스 공유 대상 조회 권한이 없습니다.",
    );
    const payload = verifyToken(args.token);
    const actor = await prisma.user.findUnique({
      where: { id: payload.userId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!actor) {
      return {
        content: [{ type: "text" as const, text: "사용자를 찾을 수 없습니다." }],
        isError: true,
      };
    }

    const limit = args.limit || 50;
    const query = args.query?.trim();
    const targets = await prisma.user.findMany({
      where: {
        id: { not: actor.id },
        isActive: true,
        deletedAt: null,
        OR: query
          ? [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ]
          : undefined,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ targets }) }],
    };
  } catch (error) {
    return errorResult("코스 공유 대상 사용자 조회 실패", error);
  }
}

export async function courseShareLeaveHandler(args: {
  token: string;
  courseId: string;
}) {
  try {
    await requirePermission(
      args.token,
      "course.shareLeave",
      "코스 공유 해제 권한이 없습니다.",
    );
    const payload = verifyToken(args.token);
    const actor = await prisma.user.findUnique({
      where: { id: payload.userId, isActive: true, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!actor) {
      return {
        content: [{ type: "text" as const, text: "사용자를 찾을 수 없습니다." }],
        isError: true,
      };
    }
    const course = await prisma.course.findFirst({
      where: { id: args.courseId, deletedAt: null },
      select: { id: true, title: true },
    });
    const courseTitle = course?.title ?? args.courseId;
    const {
      deletedShareCount,
      revokedLectureGrantCount,
      reassignedLectureGrantCount,
      previousStatus,
    } =
      await prisma.$transaction(async (tx) => {
        const existing = await tx.courseShare.findUnique({
          where: {
            courseId_sharedWithUserId: {
              courseId: args.courseId,
              sharedWithUserId: actor.id,
            },
          },
          select: { id: true, status: true, sharedByUserId: true },
        });

        if (!existing) {
          return {
            deletedShareCount: 0,
            revokedLectureGrantCount: 0,
            reassignedLectureGrantCount: 0,
            previousStatus: null as "pending" | "accepted" | "rejected" | null,
          };
        }

        const deletedShare = await tx.courseShare.deleteMany({
          where: { id: existing.id },
        });

        let revokedCount = 0;
        let reassignedCount = 0;
        if (existing.status === "accepted") {
          const revokeResult = await revokeAcceptedCourseShareLectures(tx, {
            courseId: args.courseId,
            sharedWithUserId: actor.id,
            sourceRefId: existing.id,
          });
          revokedCount = revokeResult.revokedCount;
          reassignedCount = revokeResult.reassignedCount;
        }

        await createUserMessage(tx, {
          recipientUserId: existing.sharedByUserId,
          senderUserId: actor.id,
          category: "course_share",
          title: `[코스 공유 해제] ${courseTitle}`,
          body: `${actor.name}님이 "${courseTitle}" 코스 공유를 해제했습니다.`,
          actionType: "course_share_left",
          actionPayload: {
            courseId: args.courseId,
            previousStatus: existing.status,
          },
        });

        return {
          deletedShareCount: deletedShare.count,
          revokedLectureGrantCount: revokedCount,
          reassignedLectureGrantCount: reassignedCount,
          previousStatus: existing.status,
        };
      });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            ok: true,
            deletedShareCount,
            revokedLectureGrantCount,
            reassignedLectureGrantCount,
            previousStatus,
          }),
        },
      ],
    };
  } catch (error) {
    return errorResult("코스 공유 해제(수신자) 실패", error);
  }
}
