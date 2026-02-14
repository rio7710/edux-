import type { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../services/prisma.js";
import { evaluatePermission, requirePermission } from "../services/authorization.js";

const memberRoleSchema = z.enum(["owner", "manager", "member"]);
const permissionEffectSchema = z.enum(["allow", "deny"]);
const permissionSubjectTypeSchema = z.enum(["user", "group", "role"]);
const roleSchema = z.enum([
  "admin",
  "operator",
  "editor",
  "instructor",
  "viewer",
  "guest",
]);

function textResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
  };
}

function errorResult(prefix: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return {
    content: [{ type: "text" as const, text: `${prefix}: ${message}` }],
    isError: true,
  };
}

async function ensureGroupExists(groupId: string) {
  const group = await prisma.group.findFirst({
    where: { id: groupId, deletedAt: null, isActive: true },
  });
  if (!group) {
    throw new Error("유효한 그룹을 찾을 수 없습니다.");
  }
  return group;
}

export const groupListSchema = {
  token: z.string().describe("액세스 토큰"),
};

export const groupUpsertSchema = {
  token: z.string().describe("액세스 토큰"),
  id: z.string().optional().describe("그룹 ID (수정 시)"),
  name: z.string().min(1).describe("그룹 이름"),
  description: z.string().optional().describe("그룹 설명"),
  isActive: z.boolean().optional().describe("그룹 활성 상태"),
};

export const groupDeleteSchema = {
  token: z.string().describe("액세스 토큰"),
  id: z.string().describe("그룹 ID"),
};

export const groupMemberListSchema = {
  token: z.string().describe("액세스 토큰"),
  groupId: z.string().describe("그룹 ID"),
};

export const groupMemberAddSchema = {
  token: z.string().describe("액세스 토큰"),
  groupId: z.string().describe("그룹 ID"),
  userId: z.string().describe("사용자 ID"),
  memberRole: memberRoleSchema.optional().describe("그룹 멤버 역할"),
};

export const groupMemberRemoveSchema = {
  token: z.string().describe("액세스 토큰"),
  groupId: z.string().describe("그룹 ID"),
  userId: z.string().describe("사용자 ID"),
};

export const groupMemberUpdateRoleSchema = {
  token: z.string().describe("액세스 토큰"),
  groupId: z.string().describe("그룹 ID"),
  userId: z.string().describe("사용자 ID"),
  memberRole: memberRoleSchema.describe("그룹 멤버 역할"),
};

export const permissionGrantListSchema = {
  token: z.string().describe("액세스 토큰"),
  subjectType: permissionSubjectTypeSchema.describe("대상 타입"),
  subjectId: z.string().describe("대상 ID (role이면 역할명)"),
};

export const permissionGrantUpsertSchema = {
  token: z.string().describe("액세스 토큰"),
  id: z.string().optional().describe("권한 그랜트 ID (수정 시)"),
  subjectType: permissionSubjectTypeSchema.describe("대상 타입"),
  subjectId: z.string().describe("대상 ID (role이면 역할명)"),
  permissionKey: z.string().min(1).describe("권한 키"),
  effect: permissionEffectSchema.describe("allow/deny"),
  note: z.string().optional().describe("메모"),
};

export const permissionGrantDeleteSchema = {
  token: z.string().describe("액세스 토큰"),
  id: z.string().describe("권한 그랜트 ID"),
};

export const authzCheckSchema = {
  token: z.string().describe("액세스 토큰"),
  permissionKey: z.string().min(1).describe("권한 키"),
};

export async function groupListHandler(args: { token: string }) {
  try {
    await requirePermission(args.token, "group.manage", "그룹 관리 권한이 필요합니다.");

    const groups = await prisma.group.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        Members: {
          where: { deletedAt: null },
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return textResult({
      items: groups.map((group) => ({
        ...group,
        memberCount: group.Members.length,
      })),
      total: groups.length,
    });
  } catch (error) {
    return errorResult("그룹 목록 조회 실패", error);
  }
}

export async function groupUpsertHandler(args: {
  token: string;
  id?: string;
  name: string;
  description?: string;
  isActive?: boolean;
}) {
  try {
    const actor = await requirePermission(
      args.token,
      "group.manage",
      "그룹 관리 권한이 필요합니다.",
    );

    if (args.id) {
      const existing = await prisma.group.findFirst({
        where: { id: args.id, deletedAt: null },
      });
      if (!existing) {
        throw new Error("수정할 그룹을 찾을 수 없습니다.");
      }
      const updated = await prisma.group.update({
        where: { id: args.id },
        data: {
          name: args.name.trim(),
          description: args.description?.trim() || null,
          isActive: args.isActive ?? existing.isActive,
        },
      });
      return textResult(updated);
    }

    const created = await prisma.group.create({
      data: {
        name: args.name.trim(),
        description: args.description?.trim() || null,
        isActive: args.isActive ?? true,
        createdBy: actor.id,
      },
    });
    return textResult(created);
  } catch (error) {
    return errorResult("그룹 저장 실패", error);
  }
}

export async function groupDeleteHandler(args: { token: string; id: string }) {
  try {
    await requirePermission(args.token, "group.manage", "그룹 관리 권한이 필요합니다.");

    const existing = await prisma.group.findFirst({
      where: { id: args.id, deletedAt: null },
    });
    if (!existing) {
      throw new Error("삭제할 그룹을 찾을 수 없습니다.");
    }

    const now = new Date();
    await prisma.$transaction([
      prisma.group.update({
        where: { id: args.id },
        data: { deletedAt: now, isActive: false },
      }),
      prisma.groupMember.updateMany({
        where: { groupId: args.id, deletedAt: null },
        data: { deletedAt: now },
      }),
      prisma.permissionGrant.updateMany({
        where: { groupId: args.id, deletedAt: null },
        data: { deletedAt: now },
      }),
    ]);

    return textResult({ id: args.id, deleted: true });
  } catch (error) {
    return errorResult("그룹 삭제 실패", error);
  }
}

export async function groupMemberListHandler(args: {
  token: string;
  groupId: string;
}) {
  try {
    await requirePermission(
      args.token,
      "group.member.manage",
      "그룹 멤버 관리 권한이 필요합니다.",
    );
    await ensureGroupExists(args.groupId);

    const members = await prisma.groupMember.findMany({
      where: { groupId: args.groupId, deletedAt: null },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return textResult({
      items: members,
      total: members.length,
    });
  } catch (error) {
    return errorResult("그룹 멤버 조회 실패", error);
  }
}

export async function groupMemberAddHandler(args: {
  token: string;
  groupId: string;
  userId: string;
  memberRole?: "owner" | "manager" | "member";
}) {
  try {
    await requirePermission(
      args.token,
      "group.member.manage",
      "그룹 멤버 관리 권한이 필요합니다.",
    );
    await ensureGroupExists(args.groupId);

    const user = await prisma.user.findFirst({
      where: { id: args.userId, deletedAt: null, isActive: true },
    });
    if (!user) {
      throw new Error("추가할 사용자를 찾을 수 없습니다.");
    }

    const existing = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: args.groupId,
          userId: args.userId,
        },
      },
    });

    if (existing && !existing.deletedAt) {
      throw new Error("이미 그룹에 포함된 사용자입니다.");
    }

    const member = existing
      ? await prisma.groupMember.update({
          where: { id: existing.id },
          data: {
            memberRole: args.memberRole ?? "member",
            deletedAt: null,
          },
        })
      : await prisma.groupMember.create({
          data: {
            groupId: args.groupId,
            userId: args.userId,
            memberRole: args.memberRole ?? "member",
          },
        });

    return textResult(member);
  } catch (error) {
    return errorResult("그룹 멤버 추가 실패", error);
  }
}

export async function groupMemberRemoveHandler(args: {
  token: string;
  groupId: string;
  userId: string;
}) {
  try {
    await requirePermission(
      args.token,
      "group.member.manage",
      "그룹 멤버 관리 권한이 필요합니다.",
    );
    await ensureGroupExists(args.groupId);

    const existing = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: args.groupId,
          userId: args.userId,
        },
      },
    });
    if (!existing || existing.deletedAt) {
      throw new Error("삭제할 그룹 멤버를 찾을 수 없습니다.");
    }

    const updated = await prisma.groupMember.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    return textResult(updated);
  } catch (error) {
    return errorResult("그룹 멤버 삭제 실패", error);
  }
}

export async function groupMemberUpdateRoleHandler(args: {
  token: string;
  groupId: string;
  userId: string;
  memberRole: "owner" | "manager" | "member";
}) {
  try {
    await requirePermission(
      args.token,
      "group.member.manage",
      "그룹 멤버 관리 권한이 필요합니다.",
    );
    await ensureGroupExists(args.groupId);

    const existing = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: args.groupId,
          userId: args.userId,
        },
      },
    });
    if (!existing || existing.deletedAt) {
      throw new Error("수정할 그룹 멤버를 찾을 수 없습니다.");
    }

    const updated = await prisma.groupMember.update({
      where: { id: existing.id },
      data: { memberRole: args.memberRole },
    });

    return textResult(updated);
  } catch (error) {
    return errorResult("그룹 멤버 역할 변경 실패", error);
  }
}

function subjectToColumns(subjectType: "user" | "group" | "role", subjectId: string) {
  if (subjectType === "user") {
    return { userId: subjectId, groupId: null, role: null };
  }
  if (subjectType === "group") {
    return { userId: null, groupId: subjectId, role: null };
  }

  const parsed = roleSchema.safeParse(subjectId);
  if (!parsed.success) {
    throw new Error("role 대상의 subjectId는 역할명이어야 합니다.");
  }
  return { userId: null, groupId: null, role: parsed.data as Role };
}

export async function permissionGrantListHandler(args: {
  token: string;
  subjectType: "user" | "group" | "role";
  subjectId: string;
}) {
  try {
    await requirePermission(
      args.token,
      "group.permission.manage",
      "권한 정책 관리 권한이 필요합니다.",
    );
    const subject = subjectToColumns(args.subjectType, args.subjectId);

    const items = await prisma.permissionGrant.findMany({
      where: {
        deletedAt: null,
        userId: subject.userId,
        groupId: subject.groupId,
        role: subject.role,
      },
      orderBy: [{ permissionKey: "asc" }, { createdAt: "asc" }],
    });

    return textResult({ items, total: items.length });
  } catch (error) {
    return errorResult("권한 정책 조회 실패", error);
  }
}

export async function permissionGrantUpsertHandler(args: {
  token: string;
  id?: string;
  subjectType: "user" | "group" | "role";
  subjectId: string;
  permissionKey: string;
  effect: "allow" | "deny";
  note?: string;
}) {
  try {
    const actor = await requirePermission(
      args.token,
      "group.permission.manage",
      "권한 정책 관리 권한이 필요합니다.",
    );
    const subject = subjectToColumns(args.subjectType, args.subjectId);
    if (args.subjectType === "role" && args.subjectId === "admin" && args.effect === "deny") {
      throw new Error("admin 역할에는 deny 정책을 저장할 수 없습니다.");
    }

    if (subject.userId) {
      const user = await prisma.user.findFirst({
        where: { id: subject.userId, deletedAt: null, isActive: true },
      });
      if (!user) throw new Error("대상 사용자를 찾을 수 없습니다.");
    }
    if (subject.groupId) {
      await ensureGroupExists(subject.groupId);
    }

    if (args.id) {
      const existing = await prisma.permissionGrant.findFirst({
        where: { id: args.id, deletedAt: null },
      });
      if (!existing) {
        throw new Error("수정할 권한 정책을 찾을 수 없습니다.");
      }
      const updated = await prisma.permissionGrant.update({
        where: { id: args.id },
        data: {
          userId: subject.userId,
          groupId: subject.groupId,
          role: subject.role,
          permissionKey: args.permissionKey.trim(),
          effect: args.effect,
          note: args.note?.trim() || null,
        },
      });
      return textResult(updated);
    }

    const created = await prisma.permissionGrant.create({
      data: {
        userId: subject.userId,
        groupId: subject.groupId,
        role: subject.role,
        permissionKey: args.permissionKey.trim(),
        effect: args.effect,
        note: args.note?.trim() || null,
        createdBy: actor.id,
      },
    });
    return textResult(created);
  } catch (error) {
    return errorResult("권한 정책 저장 실패", error);
  }
}

export async function permissionGrantDeleteHandler(args: {
  token: string;
  id: string;
}) {
  try {
    await requirePermission(
      args.token,
      "group.permission.manage",
      "권한 정책 관리 권한이 필요합니다.",
    );

    const existing = await prisma.permissionGrant.findFirst({
      where: { id: args.id, deletedAt: null },
    });
    if (!existing) {
      throw new Error("삭제할 권한 정책을 찾을 수 없습니다.");
    }

    const updated = await prisma.permissionGrant.update({
      where: { id: args.id },
      data: { deletedAt: new Date() },
    });
    return textResult(updated);
  } catch (error) {
    return errorResult("권한 정책 삭제 실패", error);
  }
}

export async function authzCheckHandler(args: {
  token: string;
  permissionKey: string;
}) {
  try {
    const result = await evaluatePermission({
      token: args.token,
      permissionKey: args.permissionKey,
    });
    return textResult(result);
  } catch (error) {
    return errorResult("권한 평가 실패", error);
  }
}
