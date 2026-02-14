import type { Prisma, UserMessageCategory } from "@prisma/client";
import { z } from "zod";
import { verifyToken } from "../services/jwt.js";
import { createUserMessage, createUserMessages } from "../services/message.js";
import { prisma } from "../services/prisma.js";

const MESSAGE_CATEGORY_VALUES = [
  "system",
  "course_share",
  "lecture_grant",
  "instructor_approval",
] as const;

const MESSAGE_STATUS_VALUES = ["all", "unread", "read"] as const;

export const messageListSchema = {
  token: z.string().describe("인증 토큰"),
  limit: z.number().int().min(1).max(200).optional().describe("최대 조회 개수 (기본 50)"),
  offset: z.number().int().min(0).optional().describe("오프셋 (기본 0)"),
  status: z.enum(MESSAGE_STATUS_VALUES).optional().describe("읽음 상태 필터 (기본 all)"),
  category: z.enum(MESSAGE_CATEGORY_VALUES).optional().describe("카테고리 필터"),
  query: z.string().optional().describe("제목/본문 검색어"),
};

export const messageUnreadCountSchema = {
  token: z.string().describe("인증 토큰"),
  category: z.enum(MESSAGE_CATEGORY_VALUES).optional().describe("카테고리 필터"),
};
export const messageUnreadSummarySchema = {
  token: z.string().describe("인증 토큰"),
};

export const messageMarkReadSchema = {
  token: z.string().describe("인증 토큰"),
  messageId: z.string().describe("메시지 ID"),
  read: z.boolean().optional().describe("읽음 처리 여부 (기본 true, false 불가)"),
};

export const messageMarkAllReadSchema = {
  token: z.string().describe("인증 토큰"),
  category: z.enum(MESSAGE_CATEGORY_VALUES).optional().describe("카테고리 필터"),
};
export const messageDeleteSchema = {
  token: z.string().describe("인증 토큰"),
  messageId: z.string().describe("메시지 ID"),
};

export const messageSendSchema = {
  token: z.string().describe("인증 토큰"),
  recipientUserId: z.string().describe("수신자 사용자 ID"),
  category: z.enum(MESSAGE_CATEGORY_VALUES).optional().describe("메시지 카테고리"),
  title: z.string().min(1).max(200).describe("메시지 제목"),
  body: z.string().max(4000).optional().describe("메시지 본문"),
  actionType: z.string().max(100).optional().describe("후속 액션 타입"),
  actionPayload: z.any().optional().describe("후속 액션 payload(JSON)"),
};

export const messageRecipientListSchema = {
  token: z.string().describe("인증 토큰"),
  query: z.string().optional().describe("이름/이메일 검색어"),
  limit: z.number().int().min(1).max(200).optional().describe("최대 조회 개수 (기본 50)"),
};

export const messageSeedDummySchema = {
  token: z.string().describe("인증 토큰"),
  targetUserId: z.string().optional().describe("대상 사용자 ID (관리자/운영자만 타인 지정 가능)"),
  count: z.number().int().min(1).max(50).optional().describe("생성 개수 (기본 6)"),
};

type ActiveUser = {
  id: string;
  role: string;
  name: string;
  email: string;
};

async function verifyActiveUser(token: string): Promise<ActiveUser> {
  const payload = verifyToken(token);
  const user = await prisma.user.findUnique({
    where: { id: payload.userId, isActive: true, deletedAt: null },
    select: { id: true, role: true, name: true, email: true },
  });
  if (!user) {
    throw new Error("ACTIVE_USER_NOT_FOUND");
  }
  return user;
}

function toMessageWhere(args: {
  userId: string;
  status?: (typeof MESSAGE_STATUS_VALUES)[number];
  category?: UserMessageCategory;
  query?: string;
}): Prisma.UserMessageWhereInput {
  const where: Prisma.UserMessageWhereInput = {
    recipientUserId: args.userId,
    deletedAt: null,
  };

  if (args.status === "unread") {
    where.isRead = false;
  } else if (args.status === "read") {
    where.isRead = true;
  }

  if (args.category) {
    where.category = args.category;
  }

  const query = args.query?.trim();
  if (query) {
    where.OR = [
      { title: { contains: query, mode: "insensitive" } },
      { body: { contains: query, mode: "insensitive" } },
    ];
  }

  return where;
}

function isAdminLike(role: string) {
  return role === "admin" || role === "operator";
}

type DummyTemplate = {
  category: UserMessageCategory;
  title: string;
  body: string;
  actionType?: string;
  actionPayload?: Prisma.InputJsonValue;
};

function buildDummyTemplates(
  indexSeed: number,
  refs?: { courseId?: string; lectureId?: string },
): DummyTemplate[] {
  const seed = indexSeed + 1;
  const courseId = refs?.courseId;
  const lectureId = refs?.lectureId;
  const sharedBy = `관리자지원이-${seed}`;
  return [
    {
      category: "course_share",
      title: "[코스 공유 요청] 2026 리더십 부트캠프",
      body: `${sharedBy}님이 코스 공유를 요청했습니다.`,
      ...(courseId
        ? {
            actionType: "course_share_pending",
            actionPayload: { courseId },
          }
        : {}),
    },
    {
      category: "course_share",
      title: "[코스 공유 응답] 코스 공유가 수락되었습니다",
      body: `${sharedBy}님이 요청한 코스 공유가 수락되었습니다.`,
      ...(courseId
        ? {
            actionType: "course_share_response",
            actionPayload: { courseId, status: "accepted" },
          }
        : {}),
    },
    {
      category: "course_share",
      title: "[코스 공유 해제] 공유가 취소되었습니다",
      body: "관리자에 의해 코스 공유가 해제되었습니다.",
      ...(courseId
        ? {
            actionType: "course_share_revoked",
            actionPayload: { courseId, reason: "권한 정책 변경" },
          }
        : {}),
    },
    {
      category: "lecture_grant",
      title: "[강의 권한 부여] 실습 강의 편집 권한",
      body: "강의 공유 권한이 부여되었습니다. 상세 권한을 확인해 주세요.",
      ...(lectureId
        ? {
            actionType: "lecture_grant_upsert",
            actionPayload: { lectureId, canMap: true, canEdit: true, canReshare: false },
          }
        : {}),
    },
    {
      category: "lecture_grant",
      title: "[강의 권한 해제] 공유 권한이 회수되었습니다",
      body: "정책 변경으로 해당 강의 공유 권한이 해제되었습니다.",
      ...(lectureId
        ? {
            actionType: "lecture_grant_revoke",
            actionPayload: { lectureId, reason: "코스 정리" },
          }
        : {}),
    },
    {
      category: "instructor_approval",
      title: "[강사 승인] 강사 권한이 승인되었습니다",
      body: "강사 승인 완료. 프로필과 코스를 등록할 수 있습니다.",
      actionType: "instructor_approved",
      actionPayload: { approvedAt: new Date().toISOString() },
    },
    {
      category: "system",
      title: "[시스템 공지] 메시지함 기능 점검 안내",
      body: "오늘 22:00~22:30 메시지함 기능 점검이 예정되어 있습니다.",
      actionType: "system_notice",
    },
  ];
}

export async function messageListHandler(args: {
  token: string;
  limit?: number;
  offset?: number;
  status?: (typeof MESSAGE_STATUS_VALUES)[number];
  category?: UserMessageCategory;
  query?: string;
}) {
  try {
    const actor = await verifyActiveUser(args.token);
    const limit = args.limit ?? 50;
    const offset = args.offset ?? 0;
    const where = toMessageWhere({
      userId: actor.id,
      status: args.status ?? "all",
      category: args.category,
      query: args.query,
    });

    const [messages, total, unreadCount] = await Promise.all([
      prisma.userMessage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          Sender: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.userMessage.count({ where }),
      prisma.userMessage.count({
        where: {
          recipientUserId: actor.id,
          deletedAt: null,
          isRead: false,
        },
      }),
    ]);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ messages, total, limit, offset, unreadCount }),
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
      content: [{ type: "text" as const, text: `Failed to list messages: ${message}` }],
      isError: true,
    };
  }
}

export async function messageUnreadCountHandler(args: {
  token: string;
  category?: UserMessageCategory;
}) {
  try {
    const actor = await verifyActiveUser(args.token);
    const count = await prisma.userMessage.count({
      where: {
        recipientUserId: actor.id,
        deletedAt: null,
        isRead: false,
        category: args.category,
      },
    });

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ count }) }],
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
      content: [{ type: "text" as const, text: `Failed to count unread messages: ${message}` }],
      isError: true,
    };
  }
}

export async function messageUnreadSummaryHandler(args: { token: string }) {
  try {
    const actor = await verifyActiveUser(args.token);
    const grouped = await prisma.userMessage.groupBy({
      by: ["category"],
      where: {
        recipientUserId: actor.id,
        deletedAt: null,
        isRead: false,
      },
      _count: { category: true },
    });

    const summary = {
      total: 0,
      system: 0,
      courseShare: 0,
      lectureGrant: 0,
      instructorApproval: 0,
    };
    grouped.forEach((row) => {
      const count = row._count.category || 0;
      summary.total += count;
      if (row.category === "system") summary.system = count;
      if (row.category === "course_share") summary.courseShare = count;
      if (row.category === "lecture_grant") summary.lectureGrant = count;
      if (row.category === "instructor_approval") summary.instructorApproval = count;
    });

    return {
      content: [{ type: "text" as const, text: JSON.stringify(summary) }],
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
      content: [{ type: "text" as const, text: `Failed to load unread summary: ${message}` }],
      isError: true,
    };
  }
}

export async function messageMarkReadHandler(args: {
  token: string;
  messageId: string;
  read?: boolean;
}) {
  try {
    const actor = await verifyActiveUser(args.token);
    const read = args.read ?? true;
    if (!read) {
      return {
        content: [
          {
            type: "text" as const,
            text: "메시지는 읽음에서 안읽음으로 되돌릴 수 없습니다.",
          },
        ],
        isError: true,
      };
    }
    const updated = await prisma.userMessage.updateMany({
      where: {
        id: args.messageId,
        recipientUserId: actor.id,
        deletedAt: null,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      content: [
        { type: "text" as const, text: JSON.stringify({ ok: true, updatedCount: updated.count }) },
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
      content: [{ type: "text" as const, text: `Failed to mark message read: ${message}` }],
      isError: true,
    };
  }
}

export async function messageMarkAllReadHandler(args: {
  token: string;
  category?: UserMessageCategory;
}) {
  try {
    const actor = await verifyActiveUser(args.token);
    const updated = await prisma.userMessage.updateMany({
      where: {
        recipientUserId: actor.id,
        deletedAt: null,
        isRead: false,
        category: args.category,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      content: [
        { type: "text" as const, text: JSON.stringify({ ok: true, updatedCount: updated.count }) },
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
      content: [{ type: "text" as const, text: `Failed to mark all messages read: ${message}` }],
      isError: true,
    };
  }
}

export async function messageDeleteHandler(args: {
  token: string;
  messageId: string;
}) {
  try {
    const actor = await verifyActiveUser(args.token);
    const updated = await prisma.userMessage.updateMany({
      where: {
        id: args.messageId,
        recipientUserId: actor.id,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return {
      content: [
        { type: "text" as const, text: JSON.stringify({ ok: true, deletedCount: updated.count }) },
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
      content: [{ type: "text" as const, text: `Failed to delete message: ${message}` }],
      isError: true,
    };
  }
}

export async function messageSendHandler(args: {
  token: string;
  recipientUserId: string;
  category?: UserMessageCategory;
  title: string;
  body?: string;
  actionType?: string;
  actionPayload?: unknown;
}) {
  try {
    const actor = await verifyActiveUser(args.token);

    const recipient = await prisma.user.findUnique({
      where: { id: args.recipientUserId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!recipient) {
      return {
        content: [{ type: "text" as const, text: "수신자를 찾을 수 없습니다." }],
        isError: true,
      };
    }

    const created = await createUserMessage(prisma, {
      recipientUserId: args.recipientUserId,
      senderUserId: actor.id,
      category: args.category ?? "system",
      title: args.title.trim(),
      body: args.body?.trim(),
      actionType: args.actionType?.trim(),
      actionPayload: (args.actionPayload ?? null) as Prisma.InputJsonValue | null,
    });

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ message: created }) }],
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
      content: [{ type: "text" as const, text: `Failed to send message: ${message}` }],
      isError: true,
    };
  }
}

export async function messageRecipientListHandler(args: {
  token: string;
  query?: string;
  limit?: number;
}) {
  try {
    const actor = await verifyActiveUser(args.token);
    const limit = args.limit ?? 50;
    const query = args.query?.trim();
    const where: Prisma.UserWhereInput = {
      isActive: true,
      deletedAt: null,
      id: { not: actor.id },
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const recipients = await prisma.user.findMany({
      where,
      take: limit,
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ recipients, limit }),
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
      content: [
        { type: "text" as const, text: `Failed to list message recipients: ${message}` },
      ],
      isError: true,
    };
  }
}

export async function messageSeedDummyHandler(args: {
  token: string;
  targetUserId?: string;
  count?: number;
}) {
  try {
    const actor = await verifyActiveUser(args.token);
    const targetUserId = args.targetUserId ?? actor.id;
    if (targetUserId !== actor.id && !isAdminLike(actor.role)) {
      return {
        content: [{ type: "text" as const, text: "타 사용자 더미 생성 권한이 없습니다." }],
        isError: true,
      };
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!target) {
      return {
        content: [{ type: "text" as const, text: "대상 사용자를 찾을 수 없습니다." }],
        isError: true,
      };
    }

    const count = args.count ?? 6;
    const [sampleCourse, sampleLecture] = await Promise.all([
      prisma.course.findFirst({
        where: { deletedAt: null },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.lecture.findFirst({
        where: { deletedAt: null },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const templates = buildDummyTemplates(Math.floor(Math.random() * 1000), {
      courseId: sampleCourse?.id,
      lectureId: sampleLecture?.id,
    });
    const inputs = Array.from({ length: count }).map((_, index) => {
      const template = templates[index % templates.length];
      return {
        recipientUserId: targetUserId,
        senderUserId: actor.id,
        category: template.category,
        title: template.title,
        body: template.body,
        actionType: template.actionType ?? "system_notice",
        actionPayload: template.actionPayload,
      };
    });

    const createdCount = await createUserMessages(prisma, inputs);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ ok: true, targetUserId, createdCount }),
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
      content: [{ type: "text" as const, text: `Failed to seed dummy messages: ${message}` }],
      isError: true,
    };
  }
}
