import type { PermissionEffect, PermissionGrant, Role, User } from "@prisma/client";
import { prisma } from "./prisma.js";
import { verifyToken } from "./jwt.js";

type ActorUser = Pick<User, "id" | "email" | "role" | "isActive" | "deletedAt">;
type GrantSource = "user" | "group" | "role" | "role-default";

const ROLE_DEFAULT_ALLOW: Record<Role, string[]> = {
  admin: ["*"],
  operator: [
    "dashboard.read",
    "group.manage",
    "group.member.manage",
    "group.permission.manage",
    "site.settings.read",
    "site.settings.update",
    "template.read",
    "template.use",
    "template.update",
    "template.delete",
    "course.upsert",
    "course.get",
    "course.list",
    "course.listMine",
    "course.delete",
    "course.shareInvite",
    "course.shareRespond",
    "course.shareListReceived",
    "course.shareListForCourse",
    "course.shareRevoke",
    "course.shareTargets",
    "course.shareLeave",
    "instructor.upsert",
    "instructor.get",
    "instructor.getByUser",
    "instructor.list",
    "schedule.upsert",
    "schedule.get",
    "schedule.list",
    "lecture.get",
    "lecture.list",
    "lecture.upsert",
    "lecture.delete",
    "lecture.grant.list",
    "lecture.grant.upsert",
    "lecture.grant.delete",
    "lecture.grant.listMine",
    "lecture.grant.leave",
    "message.list",
    "message.send",
    "message.delete",
    "message.seedDummy",
    "render.coursePdf",
    "render.schedulePdf",
    "render.instructorProfilePdf",
    "document.list",
    "document.delete",
    "document.share",
    "document.revokeShare",
    "tableConfig.get",
    "tableConfig.upsert",
  ],
  editor: [
    "dashboard.read",
    "template.read",
    "template.use",
    "course.upsert",
    "course.get",
    "course.list",
    "course.listMine",
    "course.delete",
    "course.shareInvite",
    "course.shareRespond",
    "course.shareListReceived",
    "course.shareListForCourse",
    "course.shareRevoke",
    "course.shareTargets",
    "course.shareLeave",
    "instructor.upsert",
    "instructor.get",
    "instructor.getByUser",
    "instructor.list",
    "schedule.upsert",
    "schedule.get",
    "schedule.list",
    "lecture.get",
    "lecture.list",
    "lecture.upsert",
    "lecture.delete",
    "lecture.grant.list",
    "lecture.grant.upsert",
    "lecture.grant.delete",
    "lecture.grant.listMine",
    "lecture.grant.leave",
    "message.list",
    "message.send",
    "message.delete",
    "render.coursePdf",
    "render.schedulePdf",
    "render.instructorProfilePdf",
    "document.list",
    "document.delete",
    "document.share",
    "document.revokeShare",
  ],
  instructor: [
    "dashboard.read",
    "template.read",
    "template.use",
    "course.upsert",
    "course.get",
    "course.list",
    "course.listMine",
    "course.delete",
    "course.shareInvite",
    "course.shareRespond",
    "course.shareListReceived",
    "course.shareListForCourse",
    "course.shareRevoke",
    "course.shareTargets",
    "course.shareLeave",
    "instructor.upsert",
    "instructor.get",
    "instructor.getByUser",
    "instructor.list",
    "schedule.upsert",
    "schedule.get",
    "schedule.list",
    "lecture.get",
    "lecture.list",
    "lecture.upsert",
    "lecture.delete",
    "lecture.grant.list",
    "lecture.grant.upsert",
    "lecture.grant.delete",
    "lecture.grant.listMine",
    "lecture.grant.leave",
    "message.list",
    "message.send",
    "message.delete",
    "render.coursePdf",
    "render.schedulePdf",
    "render.instructorProfilePdf",
    "document.list",
    "document.delete",
    "document.share",
    "document.revokeShare",
  ],
  viewer: [
    "dashboard.read",
    "template.read",
    "template.use",
    "course.get",
    "course.list",
    "course.listMine",
    "course.shareRespond",
    "course.shareListReceived",
    "course.shareLeave",
    "instructor.get",
    "instructor.getByUser",
    "instructor.list",
    "schedule.get",
    "schedule.list",
    "lecture.get",
    "lecture.list",
    "lecture.grant.listMine",
    "lecture.grant.leave",
    "message.list",
    "message.send",
    "message.delete",
    "document.list",
    "document.delete",
    "document.share",
    "document.revokeShare",
  ],
  guest: [
    "template.read",
    "template.use",
    "message.list",
    "message.send",
    "message.delete",
    "document.list",
    "document.delete",
    "document.share",
    "document.revokeShare",
  ],
};

export function getRoleDefaultAllowSnapshot(): Record<Role, string[]> {
  return {
    admin: [...ROLE_DEFAULT_ALLOW.admin],
    operator: [...ROLE_DEFAULT_ALLOW.operator],
    editor: [...ROLE_DEFAULT_ALLOW.editor],
    instructor: [...ROLE_DEFAULT_ALLOW.instructor],
    viewer: [...ROLE_DEFAULT_ALLOW.viewer],
    guest: [...ROLE_DEFAULT_ALLOW.guest],
  };
}

function permissionMatches(ruleKey: string, permissionKey: string): boolean {
  if (ruleKey === "*" || ruleKey === permissionKey) return true;
  if (ruleKey.endsWith(".*")) {
    const prefix = ruleKey.slice(0, -1);
    return permissionKey.startsWith(prefix);
  }
  return false;
}

function hasRoleDefaultAllow(role: Role, permissionKey: string): boolean {
  return ROLE_DEFAULT_ALLOW[role].some((ruleKey) =>
    permissionMatches(ruleKey, permissionKey),
  );
}

function chooseByEffect(
  grants: PermissionGrant[],
  effect: PermissionEffect,
  source: GrantSource,
  permissionKey: string,
) {
  return grants.find(
    (grant) =>
      grant.effect === effect &&
      permissionMatches(grant.permissionKey, permissionKey),
  )
    ? {
        matched: true,
        source,
      }
    : {
        matched: false,
        source,
      };
}

type MinimalGrant = Pick<PermissionGrant, "permissionKey" | "effect">;

export function evaluatePermissionDecision(input: {
  role: Role;
  permissionKey: string;
  userGrants?: MinimalGrant[];
  groupGrants?: MinimalGrant[];
  roleGrants?: MinimalGrant[];
}) {
  const userGrants = (input.userGrants || []) as PermissionGrant[];
  const groupGrants = (input.groupGrants || []) as PermissionGrant[];
  const roleGrants = (input.roleGrants || []) as PermissionGrant[];

  if (input.role === "admin") {
    return {
      allowed: true,
      reason: "admin-bypass",
      source: "admin" as const,
    };
  }

  const userDeny = chooseByEffect(userGrants, "deny", "user", input.permissionKey);
  if (userDeny.matched) {
    return {
      allowed: false,
      reason: "user-deny",
      source: userDeny.source,
    };
  }

  const groupDeny = chooseByEffect(
    groupGrants,
    "deny",
    "group",
    input.permissionKey,
  );
  if (groupDeny.matched) {
    return {
      allowed: false,
      reason: "group-deny",
      source: groupDeny.source,
    };
  }

  const roleDeny = chooseByEffect(roleGrants, "deny", "role", input.permissionKey);
  if (roleDeny.matched) {
    return {
      allowed: false,
      reason: "role-deny",
      source: roleDeny.source,
    };
  }

  const userAllow = chooseByEffect(
    userGrants,
    "allow",
    "user",
    input.permissionKey,
  );
  if (userAllow.matched) {
    return {
      allowed: true,
      reason: "user-allow",
      source: userAllow.source,
    };
  }

  const groupAllow = chooseByEffect(
    groupGrants,
    "allow",
    "group",
    input.permissionKey,
  );
  if (groupAllow.matched) {
    return {
      allowed: true,
      reason: "group-allow",
      source: groupAllow.source,
    };
  }

  const roleAllow = chooseByEffect(roleGrants, "allow", "role", input.permissionKey);
  if (roleAllow.matched) {
    return {
      allowed: true,
      reason: "role-allow",
      source: roleAllow.source,
    };
  }

  if (hasRoleDefaultAllow(input.role, input.permissionKey)) {
    return {
      allowed: true,
      reason: "role-default-allow",
      source: "role-default" as const,
    };
  }

  return {
    allowed: false,
    reason: "default-deny",
    source: "none" as const,
  };
}

export async function verifyAndGetActor(token: string): Promise<ActorUser> {
  const payload = verifyToken(token) as { userId: string; role: Role };
  const actor = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      deletedAt: true,
    },
  });
  if (!actor || !actor.isActive || actor.deletedAt) {
    throw new Error("유효한 사용자 계정을 찾을 수 없습니다.");
  }
  return actor;
}

export async function evaluatePermission(args: {
  token: string;
  permissionKey: string;
}) {
  const actor = await verifyAndGetActor(args.token);

  const memberships = await prisma.groupMember.findMany({
    where: {
      userId: actor.id,
      deletedAt: null,
      Group: { deletedAt: null, isActive: true },
    },
    select: { groupId: true },
  });
  const groupIds = memberships.map((membership) => membership.groupId);

  const [userGrants, groupGrants, roleGrants] = await Promise.all([
    prisma.permissionGrant.findMany({
      where: {
        userId: actor.id,
        deletedAt: null,
      },
    }),
    groupIds.length > 0
      ? prisma.permissionGrant.findMany({
          where: {
            groupId: { in: groupIds },
            deletedAt: null,
          },
        })
      : Promise.resolve([]),
    prisma.permissionGrant.findMany({
      where: {
        role: actor.role,
        deletedAt: null,
      },
    }),
  ]);

  const decision = evaluatePermissionDecision({
    role: actor.role,
    permissionKey: args.permissionKey,
    userGrants,
    groupGrants,
    roleGrants,
  });
  return { ...decision, actor };
}

export async function requirePermission(
  token: string,
  permissionKey: string,
  errorMessage = "권한이 없습니다.",
) {
  const decision = await evaluatePermission({ token, permissionKey });
  if (!decision.allowed) {
    throw new Error(errorMessage);
  }
  return decision.actor;
}
