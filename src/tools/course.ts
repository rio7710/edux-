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
  description: z.string().optional().nullable(),
  durationHours: z.number().int().min(0).optional().nullable(),
  isOnline: z.boolean().optional().nullable(),
  equipment: z.array(z.string()).optional().nullable(),
  goal: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  instructorIds: z.array(z.string()).optional().nullable(),
  token: z.string().optional().describe("인증 토큰 (등록자 추적용)"),
};

export const courseGetSchema = {
  id: z.string().describe("코스 ID"),
  token: z.string().optional().describe("액세스 토큰 (본인/공유 필터)"),
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
  token: z.string().optional().describe("액세스 토큰 (본인/공유 필터)"),
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

// 핸들러 정의
export async function courseUpsertHandler(args: {
  id?: string;
  title: string;
  description?: string | null;
  durationHours?: number | null;
  isOnline?: boolean | null;
  equipment?: string[] | null;
  goal?: string | null;
  notes?: string | null;
  instructorIds?: string[] | null;
  token?: string;
}) {
  try {
    const courseId = args.id || `c_${Date.now()}`;
    if (!args.token) {
      return {
        content: [{ type: "text" as const, text: "인증이 필요합니다." }],
        isError: true,
      };
    }
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
  token?: string;
}) {
  try {
    const limit = args.limit || 50;
    const offset = args.offset || 0;
    let userId: string | undefined;
    let role: string | undefined;
    if (args.token) {
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
    }
    const where = buildCourseVisibilityWhere(userId, role);

    const [rawCourses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          _count: { select: { Lectures: true, Schedules: true } },
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
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `Failed to list courses: ${message}` },
      ],
      isError: true,
    };
  }
}

export async function courseGetHandler(args: { id: string; token?: string }) {
  try {
    let userId: string | undefined;
    let role: string | undefined;
    if (args.token) {
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
    }
    const course = await prisma.course.findFirst({
      where: {
        id: args.id,
        ...buildCourseVisibilityWhere(userId, role),
      },
      include: {
        Lectures: { where: { deletedAt: null }, orderBy: { order: "asc" } },
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
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `Failed to get course: ${message}` },
      ],
      isError: true,
    };
  }
}

export async function courseShareInviteHandler(args: {
  token: string;
  courseId: string;
  targetUserId: string;
}) {
  try {
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
    const share = await prisma.courseShare.upsert({
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
    return {
      content: [{ type: "text" as const, text: JSON.stringify(share) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `Failed to invite course share: ${message}` },
      ],
      isError: true,
    };
  }
}

export async function courseShareRespondHandler(args: {
  token: string;
  courseId: string;
  accept: boolean;
}) {
  try {
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
    const existing = await prisma.courseShare.findUnique({
      where: {
        courseId_sharedWithUserId: {
          courseId: args.courseId,
          sharedWithUserId: user.id,
        },
      },
      select: { id: true },
    });
    if (!existing) {
      return {
        content: [{ type: "text" as const, text: "공유 요청을 찾을 수 없습니다." }],
        isError: true,
      };
    }
    const updated = await prisma.courseShare.update({
      where: { id: existing.id },
      data: {
        status: args.accept ? "accepted" : "rejected",
        respondedAt: new Date(),
      },
    });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(updated) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `Failed to respond course share: ${message}` },
      ],
      isError: true,
    };
  }
}

export async function courseShareListReceivedHandler(args: {
  token: string;
  status?: "pending" | "accepted" | "rejected";
}) {
  try {
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
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `Failed to list received course shares: ${message}` },
      ],
      isError: true,
    };
  }
}

export async function courseShareListForCourseHandler(args: {
  token: string;
  courseId: string;
}) {
  try {
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
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `Failed to list course shares: ${message}` },
      ],
      isError: true,
    };
  }
}

export async function courseShareRevokeHandler(args: {
  token: string;
  courseId: string;
  targetUserId: string;
}) {
  try {
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

    await prisma.courseShare.deleteMany({
      where: {
        courseId: args.courseId,
        sharedWithUserId: args.targetUserId,
      },
    });

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ ok: true }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `Failed to revoke course share: ${message}` },
      ],
      isError: true,
    };
  }
}

export async function courseShareTargetsHandler(args: {
  token: string;
  query?: string;
  limit?: number;
}) {
  try {
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
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `Failed to list share targets: ${message}` },
      ],
      isError: true,
    };
  }
}
