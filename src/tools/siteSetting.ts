import { z } from "zod";
import { prisma } from "../services/prisma.js";
import { requirePermission } from "../services/authorization.js";
import { errorResult } from "../services/toolResponse.js";

export const siteSettingGetSchema = {
  token: z.string().describe("액세스 토큰"),
  key: z.string().describe("설정 키"),
};
export const siteSettingGetManySchema = {
  token: z.string().describe("액세스 토큰"),
  keys: z.array(z.string()).min(1).max(100).describe("설정 키 목록"),
};

export const siteSettingUpsertSchema = {
  token: z.string().describe("액세스 토큰 (admin/operator)"),
  key: z.string().describe("설정 키"),
  value: z.any().describe("설정 값 (JSON)"),
};

export async function siteSettingGetHandler(args: {
  token: string;
  key: string;
}) {
  try {
    await requirePermission(
      args.token,
      "site.settings.read",
      "사이트 설정 조회 권한이 없습니다.",
    );
    const item = await prisma.appSetting.findUnique({
      where: { key: args.key },
    });
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ key: args.key, value: item?.value ?? null }),
        },
      ],
    };
  } catch (error) {
    return errorResult("설정 조회 실패", error);
  }
}

export async function siteSettingGetManyHandler(args: {
  token: string;
  keys: string[];
}) {
  try {
    await requirePermission(
      args.token,
      "site.settings.read",
      "사이트 설정 조회 권한이 없습니다.",
    );
    const keys = Array.from(new Set((args.keys || []).map((key) => key.trim()).filter(Boolean)));
    if (keys.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ items: {}, keys: [] }),
          },
        ],
      };
    }

    const items = await prisma.appSetting.findMany({
      where: { key: { in: keys } },
      select: { key: true, value: true },
    });

    const valueByKey: Record<string, unknown> = {};
    keys.forEach((key) => {
      valueByKey[key] = null;
    });
    items.forEach((item) => {
      valueByKey[item.key] = item.value ?? null;
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ items: valueByKey, keys }),
        },
      ],
    };
  } catch (error) {
    return errorResult("설정 다건 조회 실패", error);
  }
}

export async function siteSettingUpsertHandler(args: {
  token: string;
  key: string;
  value: any;
}) {
  try {
    await requirePermission(
      args.token,
      "site.settings.update",
      "사이트 설정 저장 권한이 없습니다.",
    );
    const item = await prisma.appSetting.upsert({
      where: { key: args.key },
      create: { key: args.key, value: args.value },
      update: { value: args.value },
    });
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ key: item.key, value: item.value }),
        },
      ],
    };
  } catch (error) {
    return errorResult("설정 저장 실패", error);
  }
}
