import { z } from 'zod';
import { prisma } from '../services/prisma.js';

// 스키마 정의
export const moduleBatchSetSchema = {
  courseId: z.string().describe('코스 ID'),
  modules: z.array(
    z.object({
      title: z.string().describe('모듈 제목'),
      details: z.string().optional(),
      hours: z.number().min(0).optional(),
      order: z.number().int().min(0).optional(),
    })
  ).describe('모듈 목록'),
};

// 핸들러 정의
export async function moduleBatchSetHandler(args: {
  courseId: string;
  modules: Array<{
    title: string;
    details?: string;
    hours?: number;
    order?: number;
  }>;
}) {
  try {
    // 1. 기존 모듈 삭제
    await prisma.courseModule.deleteMany({
      where: { courseId: args.courseId },
    });

    // 2. 새 모듈 생성
    const createdModules = await Promise.all(
      args.modules.map((moduleData, index) =>
        prisma.courseModule.create({
          data: {
            courseId: args.courseId,
            title: moduleData.title,
            details: moduleData.details,
            hours: moduleData.hours,
            order: moduleData.order ?? index, // order가 없으면 배열 인덱스 사용
          },
        })
      )
    );

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ courseId: args.courseId, count: createdModules.length }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `Failed to batch set modules: ${message}` }],
      isError: true,
    };
  }
}
