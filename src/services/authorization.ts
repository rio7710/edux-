import type { PermissionEffect, PermissionGrant, Role, User } from "@prisma/client";
import { prisma } from "./prisma.js";
import { verifyToken } from "./jwt.js";

type ActorUser = Pick<User, "id" | "email" | "role" | "isActive" | "deletedAt">;
type GrantSource = "user" | "group" | "role" | "role-default";

const ROLE_DEFAULT_ALLOW: Record<Role, string[]> = {
  admin: ["*"],
  operator: [
    "group.manage",
    "group.member.manage",
    "group.permission.manage",
    "site.settings.read",
    "site.settings.update",
    "template.read",
    "template.use",
    "template.update",
    "template.delete",
  ],
  editor: ["template.read", "template.use"],
  instructor: ["template.read", "template.use"],
  viewer: ["template.read", "template.use"],
  guest: ["template.read", "template.use"],
};

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

  if (actor.role === "admin") {
    return {
      allowed: true,
      reason: "admin-bypass",
      source: "admin" as const,
      actor,
    };
  }

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

  const userDeny = chooseByEffect(userGrants, "deny", "user", args.permissionKey);
  if (userDeny.matched) {
    return {
      allowed: false,
      reason: "user-deny",
      source: userDeny.source,
      actor,
    };
  }

  const groupDeny = chooseByEffect(
    groupGrants,
    "deny",
    "group",
    args.permissionKey,
  );
  if (groupDeny.matched) {
    return {
      allowed: false,
      reason: "group-deny",
      source: groupDeny.source,
      actor,
    };
  }

  const roleDeny = chooseByEffect(roleGrants, "deny", "role", args.permissionKey);
  if (roleDeny.matched) {
    return {
      allowed: false,
      reason: "role-deny",
      source: roleDeny.source,
      actor,
    };
  }

  const userAllow = chooseByEffect(
    userGrants,
    "allow",
    "user",
    args.permissionKey,
  );
  if (userAllow.matched) {
    return {
      allowed: true,
      reason: "user-allow",
      source: userAllow.source,
      actor,
    };
  }

  const groupAllow = chooseByEffect(
    groupGrants,
    "allow",
    "group",
    args.permissionKey,
  );
  if (groupAllow.matched) {
    return {
      allowed: true,
      reason: "group-allow",
      source: groupAllow.source,
      actor,
    };
  }

  const roleAllow = chooseByEffect(roleGrants, "allow", "role", args.permissionKey);
  if (roleAllow.matched) {
    return {
      allowed: true,
      reason: "role-allow",
      source: roleAllow.source,
      actor,
    };
  }

  if (hasRoleDefaultAllow(actor.role, args.permissionKey)) {
    return {
      allowed: true,
      reason: "role-default-allow",
      source: "role-default" as const,
      actor,
    };
  }

  return {
    allowed: false,
    reason: "default-deny",
    source: "none" as const,
    actor,
  };
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
