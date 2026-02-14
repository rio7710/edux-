import { randomUUID } from "node:crypto";
import { z } from "zod";
import { verifyToken } from "../services/jwt.js";
import { createUserMessage } from "../services/message.js";
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
  courseId: z.string().describe("코스 ID (연결 대상)"),
  title: z.string().describe("강의 제목"),
  description: z.string().optional().nullable(),
  hours: z.number().min(0).optional().nullable(),
  order: z.number().int().min(0).optional().nullable(),
  token: z.string().optional().describe("인증 토큰 (등록자 추적용)"),
};

export const lectureMapSchema = {
  lectureId: z.string().describe("기존 강의 ID"),
  courseId: z.string().describe("연결할 코스 ID"),
  order: z.number().int().min(0).optional().nullable(),
  token: z.string().describe("인증 토큰"),
};

export const lectureGetSchema = {
  id: z.string().describe("강의 ID"),
  token: z.string().describe("인증 토큰"),
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
  token: z.string().describe("인증 토큰"),
};

export const lectureDeleteSchema = {
  id: z.string().describe("강의 ID"),
  token: z.string().optional().describe("인증 토큰"),
};

export const lectureGrantListSchema = {
  lectureId: z.string().describe("강의 ID"),
  token: z.string().describe("인증 토큰"),
};

export const lectureGrantUpsertSchema = {
  lectureId: z.string().describe("강의 ID"),
  userId: z.string().describe("공유 대상 사용자 ID"),
  canMap: z.boolean().optional().describe("코스 매핑 권한"),
  canEdit: z.boolean().optional().describe("강의 수정 권한"),
  canReshare: z.boolean().optional().describe("재공유 권한"),
  token: z.string().describe("인증 토큰"),
};

export const lectureGrantDeleteSchema = {
  lectureId: z.string().describe("강의 ID"),
  userId: z.string().describe("공유 해제 대상 사용자 ID"),
  token: z.string().describe("인증 토큰"),
};

export const lectureGrantListMineSchema = {
  token: z.string().describe("인증 토큰"),
};

export const lectureGrantLeaveSchema = {
  lectureId: z.string().describe("강의 ID"),
  token: z.string().describe("인증 토큰"),
};

async function getLectureAccessContext(
  lectureId: string,
  actorUserId: string,
  actorRole: string,
) {
  const lecture = await prisma.lecture.findUnique({
    where: { id: lectureId, deletedAt: null },
    select: { id: true, title: true, authorId: true, createdBy: true },
  });
  if (!lecture) return null;

  const actorGrant = await prisma.lectureGrant.findFirst({
    where: { lectureId, userId: actorUserId, revokedAt: null },
    select: { canMap: true, canEdit: true, canReshare: true },
  });

  const isOwner =
    lecture.authorId === actorUserId || lecture.createdBy === actorUserId;
  const isAdminLike = actorRole === "admin" || actorRole === "operator";
  const canManageShares = isAdminLike || isOwner || !!actorGrant?.canReshare;

  return { lecture, actorGrant, isOwner, isAdminLike, canManageShares };
}

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

    // 코스 존재 확인
    const course = await prisma.course.findUnique({
      where: { id: args.courseId, deletedAt: null },
      select: { id: true, createdBy: true },
    });
    if (!course) {
      return {
        content: [
          { type: "text" as const, text: `Course not found: ${args.courseId}` },
        ],
        isError: true,
      };
    }
    const canManageCourse =
      actorRole === "admin" ||
      actorRole === "operator" ||
      (course.createdBy && course.createdBy === actorUserId);

    let lecture;
    if (args.id) {
      const existingLecture = await prisma.lecture.findUnique({
        where: { id: args.id, deletedAt: null },
        select: {
          id: true,
          title: true,
          description: true,
          hours: true,
          order: true,
          authorId: true,
          createdBy: true,
        },
      });
      if (!existingLecture) {
        return {
          content: [{ type: "text" as const, text: `Lecture not found: ${args.id}` }],
          isError: true,
        };
      }

      const grant = actorUserId
        ? await prisma.lectureGrant.findFirst({
            where: {
              lectureId: existingLecture.id,
              userId: actorUserId,
              revokedAt: null,
            },
            select: { canEdit: true },
          })
        : null;

      const isLectureOwner =
        !!actorUserId &&
        (existingLecture.authorId === actorUserId ||
          existingLecture.createdBy === actorUserId);
      const canEditLecture = isLectureOwner || !!grant?.canEdit;
      if (!canEditLecture) {
        return {
          content: [{ type: "text" as const, text: "강의 수정 권한이 없습니다." }],
          isError: true,
        };
      }

      lecture = await prisma.lecture.update({
        where: { id: existingLecture.id },
        data: {
          title: args.title,
          description: args.description ?? undefined,
          hours: args.hours ?? undefined,
          order: args.order ?? undefined,
        },
      });
    } else {
      if (!canManageCourse) {
        return {
          content: [{ type: "text" as const, text: "본인 코스만 수정할 수 있습니다." }],
          isError: true,
        };
      }
      const lectureId = `l_${randomUUID()}`;
      lecture = await prisma.lecture.create({
        data: {
          id: lectureId,
          title: args.title,
          description: args.description ?? undefined,
          hours: args.hours ?? undefined,
          order: args.order ?? undefined,
          createdBy: actorUserId,
          authorId: actorUserId,
        },
      });
    }

    await prisma.courseLecture.upsert({
      where: {
        courseId_lectureId: {
          courseId: args.courseId,
          lectureId: lecture.id,
        },
      },
      create: {
        courseId: args.courseId,
        lectureId: lecture.id,
        order: args.order ?? lecture.order ?? 0,
        createdBy: actorUserId,
      },
      update: {
        order: args.order ?? lecture.order ?? 0,
      },
    });

    // 코스 공유 수락자에게는 강의 매핑 권한만 자동 부여(canEdit=false)
    const acceptedShares = await prisma.courseShare.findMany({
      where: { courseId: args.courseId, status: "accepted" },
      select: { id: true, sharedWithUserId: true, sharedByUserId: true },
    });
    if (acceptedShares.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const share of acceptedShares) {
          const existingGrant = await tx.lectureGrant.findUnique({
            where: {
              lectureId_userId: {
                lectureId: lecture.id,
                userId: share.sharedWithUserId,
              },
            },
            select: { id: true, sourceType: true, revokedAt: true },
          });

          if (existingGrant?.sourceType === "manual" && existingGrant.revokedAt === null) {
            continue;
          }

          if (!existingGrant) {
            await tx.lectureGrant.create({
              data: {
                lectureId: lecture.id,
                userId: share.sharedWithUserId,
                grantedByUserId: share.sharedByUserId,
                sourceType: "course_share",
                sourceRefId: share.id,
                canMap: true,
                canEdit: false,
                canReshare: false,
              },
            });
            continue;
          }

          await tx.lectureGrant.update({
            where: { id: existingGrant.id },
            data: {
              grantedByUserId: share.sharedByUserId,
              sourceType: "course_share",
              sourceRefId: share.id,
              canMap: true,
              canEdit: false,
              canReshare: false,
              revokedAt: null,
            },
          });
        }
      });
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            id: lecture.id,
            courseId: args.courseId,
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

export async function lectureGetHandler(args: { id: string; token: string }) {
  try {
    try {
      verifyToken(args.token);
    } catch {
      return {
        content: [{ type: "text" as const, text: "인증 실패" }],
        isError: true,
      };
    }

    const lecture = await prisma.lecture.findUnique({
      where: { id: args.id, deletedAt: null },
      include: {
        CourseLinks: {
          include: { Course: true },
        },
      },
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

export async function lectureMapHandler(args: {
  lectureId: string;
  courseId: string;
  order?: number | null;
  token: string;
}) {
  try {
    const payload = verifyToken(args.token);
    const actorUserId = payload.userId;
    const actorRole = payload.role;

    const course = await prisma.course.findUnique({
      where: { id: args.courseId, deletedAt: null },
      select: { id: true, createdBy: true },
    });
    if (!course) {
      return {
        content: [
          { type: "text" as const, text: `Course not found: ${args.courseId}` },
        ],
        isError: true,
      };
    }
    const canManageCourse =
      actorRole === "admin" ||
      actorRole === "operator" ||
      (course.createdBy && course.createdBy === actorUserId);
    if (!canManageCourse) {
      return {
        content: [{ type: "text" as const, text: "코스 수정 권한이 없습니다." }],
        isError: true,
      };
    }

    const lecture = await prisma.lecture.findUnique({
      where: { id: args.lectureId, deletedAt: null },
      select: { id: true, authorId: true, createdBy: true, order: true },
    });
    if (!lecture) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Lecture not found: ${args.lectureId}`,
          },
        ],
        isError: true,
      };
    }

    const grant = await prisma.lectureGrant.findFirst({
      where: {
        lectureId: lecture.id,
        userId: actorUserId,
        revokedAt: null,
      },
      select: { canMap: true },
    });
    const isLectureOwner =
      lecture.authorId === actorUserId || lecture.createdBy === actorUserId;
    const canMapLecture =
      actorRole === "admin" ||
      actorRole === "operator" ||
      isLectureOwner ||
      !!grant?.canMap;
    if (!canMapLecture) {
      return {
        content: [{ type: "text" as const, text: "강의 매핑 권한이 없습니다." }],
        isError: true,
      };
    }

    const mapped = await prisma.courseLecture.upsert({
      where: {
        courseId_lectureId: {
          courseId: args.courseId,
          lectureId: args.lectureId,
        },
      },
      create: {
        courseId: args.courseId,
        lectureId: args.lectureId,
        order: args.order ?? lecture.order ?? 0,
        createdBy: actorUserId,
      },
      update: {
        order: args.order ?? lecture.order ?? 0,
      },
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            id: mapped.id,
            courseId: mapped.courseId,
            lectureId: mapped.lectureId,
            order: mapped.order,
          }),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `Failed to map lecture: ${message}` },
      ],
      isError: true,
    };
  }
}

export async function lectureListHandler(args: {
  courseId: string;
  limit?: number;
  offset?: number;
  token: string;
}) {
  try {
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

    const [links, total] = await Promise.all([
      prisma.courseLecture.findMany({
        where: { courseId: args.courseId, Lecture: { deletedAt: null } },
        orderBy: { order: "asc" },
        take: limit,
        skip: offset,
        include: { Lecture: true },
      }),
      prisma.courseLecture.count({
        where: { courseId: args.courseId, Lecture: { deletedAt: null } },
      }),
    ]);

    const rawLectures = links.map((link) => ({
      ...link.Lecture,
      order: link.order,
    }));
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

    const lecture = await prisma.lecture.findUnique({
      where: { id: args.id, deletedAt: null },
      include: {
        CourseLinks: {
          include: {
            Course: { select: { id: true, createdBy: true } },
          },
        },
      },
    });

    if (!lecture) {
      return {
        content: [
          { type: "text" as const, text: `Lecture not found: ${args.id}` },
        ],
        isError: true,
      };
    }
    const ownedByActor = lecture.CourseLinks?.some(
      (link) => link.Course?.createdBy && link.Course.createdBy === actorUserId,
    );
    const grant = actorUserId
      ? await prisma.lectureGrant.findFirst({
          where: {
            lectureId: lecture.id,
            userId: actorUserId,
            revokedAt: null,
          },
          select: { canEdit: true },
        })
      : null;
    const canManage =
      actorRole === "admin" ||
      actorRole === "operator" ||
      ownedByActor ||
      !!grant?.canEdit;
    if (!canManage) {
      return {
        content: [{ type: "text" as const, text: "본인 코스만 수정할 수 있습니다." }],
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

export async function lectureGrantListHandler(args: {
  lectureId: string;
  token: string;
}) {
  try {
    const payload = verifyToken(args.token);
    const context = await getLectureAccessContext(
      args.lectureId,
      payload.userId,
      payload.role,
    );
    if (!context) {
      return {
        content: [
          { type: "text" as const, text: `Lecture not found: ${args.lectureId}` },
        ],
        isError: true,
      };
    }
    if (!context.canManageShares) {
      return {
        content: [{ type: "text" as const, text: "강의 공유 권한이 없습니다." }],
        isError: true,
      };
    }

    const grants = await prisma.lectureGrant.findMany({
      where: { lectureId: args.lectureId, revokedAt: null },
      include: {
        User: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ grants }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `Failed to list lecture grants: ${message}` },
      ],
      isError: true,
    };
  }
}

export async function lectureGrantUpsertHandler(args: {
  lectureId: string;
  userId: string;
  canMap?: boolean;
  canEdit?: boolean;
  canReshare?: boolean;
  token: string;
}) {
  try {
    const payload = verifyToken(args.token);
    const context = await getLectureAccessContext(
      args.lectureId,
      payload.userId,
      payload.role,
    );
    if (!context) {
      return {
        content: [
          { type: "text" as const, text: `Lecture not found: ${args.lectureId}` },
        ],
        isError: true,
      };
    }
    if (!context.canManageShares) {
      return {
        content: [{ type: "text" as const, text: "강의 공유 권한이 없습니다." }],
        isError: true,
      };
    }
    if (args.userId === payload.userId) {
      return {
        content: [{ type: "text" as const, text: "본인에게는 공유할 수 없습니다." }],
        isError: true,
      };
    }

    const target = await prisma.user.findFirst({
      where: { id: args.userId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!target) {
      return {
        content: [{ type: "text" as const, text: "공유 대상 사용자를 찾을 수 없습니다." }],
        isError: true,
      };
    }

    const requested = {
      canMap: args.canMap ?? true,
      canEdit: args.canEdit ?? false,
      canReshare: args.canReshare ?? false,
    };
    let next = requested;
    if (!context.isAdminLike && !context.isOwner) {
      next = {
        canMap: requested.canMap && !!context.actorGrant?.canMap,
        canEdit: requested.canEdit && !!context.actorGrant?.canEdit,
        canReshare: requested.canReshare && !!context.actorGrant?.canReshare,
      };
    }

    const previous = await prisma.lectureGrant.findUnique({
      where: {
        lectureId_userId: {
          lectureId: args.lectureId,
          userId: args.userId,
        },
      },
      select: { id: true, revokedAt: true },
    });

    const grant = await prisma.lectureGrant.upsert({
      where: {
        lectureId_userId: {
          lectureId: args.lectureId,
          userId: args.userId,
        },
      },
      update: {
        grantedByUserId: payload.userId,
        sourceType: "manual",
        sourceRefId: null,
        canMap: next.canMap,
        canEdit: next.canEdit,
        canReshare: next.canReshare,
        revokedAt: null,
      },
      create: {
        lectureId: args.lectureId,
        userId: args.userId,
        grantedByUserId: payload.userId,
        sourceType: "manual",
        sourceRefId: null,
        canMap: next.canMap,
        canEdit: next.canEdit,
        canReshare: next.canReshare,
      },
    });

    const actionLabel = !previous || previous.revokedAt ? "부여" : "변경";
    await createUserMessage(prisma, {
      recipientUserId: args.userId,
      senderUserId: payload.userId,
      category: "lecture_grant",
      title: `[강의 공유 권한 ${actionLabel}] ${context.lecture.title}`,
      body: `"${context.lecture.title}" 강의 공유 권한이 ${actionLabel}되었습니다.`,
      actionType: "lecture_grant_upsert",
      actionPayload: {
        lectureId: args.lectureId,
        canMap: grant.canMap,
        canEdit: grant.canEdit,
        canReshare: grant.canReshare,
      },
    });

    return {
      content: [{ type: "text" as const, text: JSON.stringify(grant) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `Failed to upsert lecture grant: ${message}` },
      ],
      isError: true,
    };
  }
}

export async function lectureGrantDeleteHandler(args: {
  lectureId: string;
  userId: string;
  token: string;
}) {
  try {
    const payload = verifyToken(args.token);
    const context = await getLectureAccessContext(
      args.lectureId,
      payload.userId,
      payload.role,
    );
    if (!context) {
      return {
        content: [
          { type: "text" as const, text: `Lecture not found: ${args.lectureId}` },
        ],
        isError: true,
      };
    }

    if (!context.isAdminLike && !context.isOwner) {
      return {
        content: [{ type: "text" as const, text: "강의 공유 해제 권한이 없습니다." }],
        isError: true,
      };
    }

    const revoked = await prisma.lectureGrant.updateMany({
      where: { lectureId: args.lectureId, userId: args.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (revoked.count > 0) {
      await createUserMessage(prisma, {
        recipientUserId: args.userId,
        senderUserId: payload.userId,
        category: "lecture_grant",
        title: `[강의 공유 권한 해제] ${context.lecture.title}`,
        body: `"${context.lecture.title}" 강의 공유 권한이 해제되었습니다.`,
        actionType: "lecture_grant_revoke",
        actionPayload: {
          lectureId: args.lectureId,
        },
      });
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ ok: true, revokedCount: revoked.count }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `Failed to delete lecture grant: ${message}` },
      ],
      isError: true,
    };
  }
}

export async function lectureGrantListMineHandler(args: { token: string }) {
  try {
    const payload = verifyToken(args.token);
    const grants = await prisma.lectureGrant.findMany({
      where: {
        userId: payload.userId,
        revokedAt: null,
        Lecture: { deletedAt: null },
      },
      include: {
        Lecture: {
          select: {
            id: true,
            title: true,
            description: true,
            CourseLinks: {
              include: {
                Course: {
                  select: { id: true, title: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const normalized = grants.map((grant) => ({
      ...grant,
      courses: (grant.Lecture?.CourseLinks || [])
        .map((link) => link.Course)
        .filter(Boolean),
    }));

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ grants: normalized }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `Failed to list my lecture grants: ${message}` },
      ],
      isError: true,
    };
  }
}

export async function lectureGrantLeaveHandler(args: {
  lectureId: string;
  token: string;
}) {
  try {
    const payload = verifyToken(args.token);
    const [actor, lecture, activeGrants] = await Promise.all([
      prisma.user.findUnique({
        where: { id: payload.userId, isActive: true, deletedAt: null },
        select: { id: true, name: true },
      }),
      prisma.lecture.findUnique({
        where: { id: args.lectureId, deletedAt: null },
        select: { id: true, title: true },
      }),
      prisma.lectureGrant.findMany({
        where: {
          lectureId: args.lectureId,
          userId: payload.userId,
          revokedAt: null,
        },
        select: { grantedByUserId: true },
      }),
    ]);

    const result = await prisma.lectureGrant.updateMany({
      where: {
        lectureId: args.lectureId,
        userId: payload.userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    const recipients = Array.from(
      new Set(
        activeGrants
          .map((grant) => grant.grantedByUserId)
          .filter((userId): userId is string => !!userId && userId !== payload.userId),
      ),
    );
    if (recipients.length > 0) {
      const lectureTitle = lecture?.title ?? args.lectureId;
      const actorName = actor?.name ?? payload.userId;
      await Promise.all(
        recipients.map((recipientUserId) =>
          createUserMessage(prisma, {
            recipientUserId,
            senderUserId: payload.userId,
            category: "lecture_grant",
            title: `[강의 공유 권한 해제] ${lectureTitle}`,
            body: `${actorName}님이 "${lectureTitle}" 강의 공유를 해제했습니다.`,
            actionType: "lecture_grant_left",
            actionPayload: {
              lectureId: args.lectureId,
            },
          }),
        ),
      );
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ ok: true, revokedCount: result.count }),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `Failed to leave lecture grant: ${message}` },
      ],
      isError: true,
    };
  }
}
