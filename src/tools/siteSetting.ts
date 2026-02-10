import { z } from "zod";
import { prisma } from "../services/prisma.js";
import { verifyToken } from "../services/jwt.js";

export const siteSettingGetSchema = {
  token: z.string().describe("액세스 토큰"),
  key: z.string().describe("설정 키"),
};

export const siteSettingUpsertSchema = {
  token: z.string().describe("액세스 토큰 (admin/operator)"),
  key: z.string().describe("설정 키"),
  value: z.any().describe("설정 값 (JSON)"),
};

function requireAdminOperator(token: string) {
  const payload = verifyToken(token) as { userId: string; role: string };
  if (payload.role !== "admin" && payload.role !== "operator") {
    throw new Error("관리자 또는 운영자 권한이 필요합니다.");
  }
  return payload;
}

function verifyAnyUser(token: string) {
  return verifyToken(token) as { userId: string; role: string };
}

export async function siteSettingGetHandler(args: {
  token: string;
  key: string;
}) {
  try {
    verifyAnyUser(args.token);
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
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text" as const, text: `설정 조회 실패: ${message}` }],
      isError: true,
    };
  }
}

export async function siteSettingUpsertHandler(args: {
  token: string;
  key: string;
  value: any;
}) {
  try {
    requireAdminOperator(args.token);
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
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text" as const, text: `설정 저장 실패: ${message}` }],
      isError: true,
    };
  }
}
