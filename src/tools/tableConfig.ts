import { z } from "zod";
import { prisma } from "../services/prisma.js";
import { verifyToken } from "../services/jwt.js";

const OWNER_TYPE_GLOBAL = "global";

export const tableConfigGetSchema = {
  token: z.string().describe("액세스 토큰 (admin/operator)"),
  tableKey: z.string().describe("테이블 키 (courses/instructors/...)"),
};

export const tableConfigUpsertSchema = {
  token: z.string().describe("액세스 토큰 (admin/operator)"),
  tableKey: z.string().describe("테이블 키 (courses/instructors/...)"),
  columns: z
    .array(
      z.object({
        columnKey: z.string().describe("컬럼 키"),
        label: z.string().describe("기본 라벨"),
        customLabel: z.string().optional().describe("커스텀 라벨"),
        visible: z.boolean().describe("표시 여부"),
        order: z.number().int().describe("정렬 순서"),
        width: z.number().int().optional().describe("컬럼 너비"),
        fixed: z.enum(["left", "right"]).optional().describe("고정 위치"),
      }),
    )
    .min(1)
    .describe("컬럼 설정 목록"),
};

function verifyAnyUser(token: string) {
  return verifyToken(token) as { userId: string; role: string };
}

function requireAdminOperator(token: string) {
  const payload = verifyToken(token) as { userId: string; role: string };
  if (payload.role !== "admin" && payload.role !== "operator") {
    throw new Error("관리자 또는 운영자 권한이 필요합니다.");
  }
  return payload;
}

export async function tableConfigGetHandler(args: {
  token: string;
  tableKey: string;
}) {
  try {
    verifyAnyUser(args.token);

    const items = await prisma.tableColumnConfig.findMany({
      where: {
        tableKey: args.tableKey,
        ownerType: OWNER_TYPE_GLOBAL,
        ownerId: null,
      },
      orderBy: { order: "asc" },
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ items }),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `설정 조회 실패: ${message}` },
      ],
      isError: true,
    };
  }
}

export async function tableConfigUpsertHandler(args: {
  token: string;
  tableKey: string;
  columns: Array<{
    columnKey: string;
    label: string;
    customLabel?: string;
    visible: boolean;
    order: number;
    width?: number;
    fixed?: "left" | "right";
  }>;
}) {
  try {
    requireAdminOperator(args.token);

    const columns = args.columns.map((c, index) => ({
      tableKey: args.tableKey,
      columnKey: c.columnKey,
      label: c.label,
      customLabel: c.customLabel || null,
      visible: c.visible,
      order: c.order ?? index,
      width: c.width ?? null,
      fixed: c.fixed ?? null,
      ownerType: OWNER_TYPE_GLOBAL,
      ownerId: null,
    }));

    await prisma.$transaction([
      prisma.tableColumnConfig.deleteMany({
        where: {
          tableKey: args.tableKey,
          ownerType: OWNER_TYPE_GLOBAL,
          ownerId: null,
        },
      }),
      prisma.tableColumnConfig.createMany({
        data: columns,
      }),
    ]);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ tableKey: args.tableKey, count: columns.length }),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [
        { type: "text" as const, text: `설정 저장 실패: ${message}` },
      ],
      isError: true,
    };
  }
}
