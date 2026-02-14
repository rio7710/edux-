import { z } from "zod";
import { verifyToken } from "../services/jwt.js";
import { prisma } from "../services/prisma.js";
import { evaluatePermission } from "../services/authorization.js";

export const dashboardBootstrapSchema = {
  token: z.string().describe("액세스 토큰"),
};

type ActiveUser = {
  id: string;
  role: string;
};

async function verifyActiveUser(token: string): Promise<ActiveUser> {
  const payload = verifyToken(token);
  const user = await prisma.user.findUnique({
    where: { id: payload.userId, isActive: true, deletedAt: null },
    select: { id: true, role: true },
  });
  if (!user) {
    throw new Error("ACTIVE_USER_NOT_FOUND");
  }
  return user;
}

function buildCourseVisibilityWhere(userId?: string, role?: string) {
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

async function canUser(token: string, permissionKey: string): Promise<boolean> {
  try {
    const evaluated = await evaluatePermission({ token, permissionKey });
    return !!evaluated?.allowed;
  } catch {
    return false;
  }
}

export async function dashboardBootstrapHandler(args: { token: string }) {
  try {
    const actor = await verifyActiveUser(args.token);
    const [canCourseList, canCourseListMine, canInstructorList, canTemplateList] =
      await Promise.all([
        canUser(args.token, "course.list"),
        canUser(args.token, "course.listMine"),
        canUser(args.token, "instructor.list"),
        canUser(args.token, "template.list"),
      ]);

    const courseWhere = canCourseList
      ? buildCourseVisibilityWhere(actor.id, actor.role)
      : canCourseListMine
        ? { deletedAt: null as null, createdBy: actor.id }
        : null;

    const [courses, instructors, templates, recentMessages, pendingShareCount, lectureGrantCount, unreadGrouped] =
      await Promise.all([
        courseWhere
          ? prisma.course.findMany({
              where: courseWhere,
              orderBy: { createdAt: "desc" },
              take: 50,
              select: {
                id: true,
                title: true,
                createdAt: true,
                updatedAt: true,
              },
            })
          : Promise.resolve([]),
        canInstructorList
          ? prisma.instructor.findMany({
              where: { deletedAt: null },
              orderBy: { createdAt: "desc" },
              take: 50,
              select: {
                id: true,
                name: true,
                createdAt: true,
                updatedAt: true,
              },
            })
          : Promise.resolve([]),
        canTemplateList
          ? prisma.template.findMany({
              where: { deletedAt: null },
              orderBy: { updatedAt: "desc" },
              take: 50,
              select: {
                id: true,
                name: true,
                type: true,
                createdAt: true,
                updatedAt: true,
              },
            })
          : Promise.resolve([]),
        prisma.userMessage.findMany({
          where: {
            recipientUserId: actor.id,
            deletedAt: null,
          },
          orderBy: { createdAt: "desc" },
          take: 6,
          include: {
            Sender: {
              select: { id: true, name: true, email: true },
            },
          },
        }),
        prisma.courseShare.count({
          where: {
            sharedWithUserId: actor.id,
            status: "pending",
            Course: { deletedAt: null },
          },
        }),
        prisma.lectureGrant.count({
          where: {
            userId: actor.id,
            revokedAt: null,
            Lecture: { deletedAt: null },
          },
        }),
        prisma.userMessage.groupBy({
          by: ["category"],
          where: {
            recipientUserId: actor.id,
            deletedAt: null,
            isRead: false,
          },
          _count: { category: true },
        }),
      ]);

    const unreadSummary = {
      total: 0,
      system: 0,
      courseShare: 0,
      lectureGrant: 0,
      instructorApproval: 0,
    };

    unreadGrouped.forEach((row) => {
      const count = row._count.category || 0;
      unreadSummary.total += count;
      if (row.category === "system") unreadSummary.system = count;
      if (row.category === "course_share") unreadSummary.courseShare = count;
      if (row.category === "lecture_grant") unreadSummary.lectureGrant = count;
      if (row.category === "instructor_approval") unreadSummary.instructorApproval = count;
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            courses,
            instructors,
            templates,
            recentMessages,
            pendingShareCount,
            lectureGrantCount,
            unreadSummary,
          }),
        },
      ],
    };
  } catch (error) {
    if (error instanceof Error && error.message === "ACTIVE_USER_NOT_FOUND") {
      return {
        content: [{ type: "text" as const, text: "사용자를 찾을 수 없습니다." }],
        isError: true,
      };
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text" as const, text: `대시보드 초기 데이터 조회 실패: ${message}` }],
      isError: true,
    };
  }
}
