import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { renderQueue, RENDER_QUEUE_NAME } from '../services/queue.js'; // Import the queue

// 스키마 정의
export const renderCoursePdfSchema = {
  templateId: z.string().describe('템플릿 ID'),
  courseId: z.string().describe('코스 ID'),
};

export const renderSchedulePdfSchema = {
  templateId: z.string().describe('템플릿 ID'),
  scheduleId: z.string().describe('스케줄 ID'),
};

// 핸들러 정의
export async function renderCoursePdfHandler(args: {
  templateId: string;
  courseId: string;
}) {
  try {
    // 1. Validate template and course existence
    const template = await prisma.template.findUnique({
      where: { id: args.templateId },
      select: { id: true },
    });
    if (!template) {
      return {
        content: [{ type: 'text' as const, text: `Template not found: ${args.templateId}` }],
        isError: true,
      };
    }

    const course = await prisma.course.findUnique({
      where: { id: args.courseId, deletedAt: null },
      select: { id: true },
    });
    if (!course) {
      return {
        content: [{ type: 'text' as const, text: `Course not found: ${args.courseId}` }],
        isError: true,
      };
    }

    // 2. Create RenderJob record (status: pending)
    const renderJob = await prisma.renderJob.create({
      data: {
        templateId: args.templateId,
        targetType: 'course',
        targetId: args.courseId,
        status: 'pending',
      },
    });

    // 3. Add job to BullMQ queue
    await renderQueue.add(
      'renderCoursePdf', // Job name
      {
        renderJobId: renderJob.id,
        templateId: args.templateId,
        courseId: args.courseId,
      },
      {
        jobId: renderJob.id, // Use renderJob ID as BullMQ job ID for easy tracking
        // attempts: 3, // Retry failed jobs
        // backoff: {
        //   type: 'exponential',
        //   delay: 1000,
        // },
      }
    );

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ jobId: renderJob.id, status: renderJob.status }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `Failed to enqueue course PDF render job: ${message}` }],
      isError: true,
    };
  }
}

export async function renderSchedulePdfHandler(args: {
  templateId: string;
  scheduleId: string;
}) {
  try {
    // 1. Validate template and schedule existence
    const template = await prisma.template.findUnique({
      where: { id: args.templateId },
      select: { id: true },
    });
    if (!template) {
      return {
        content: [{ type: 'text' as const, text: `Template not found: ${args.templateId}` }],
        isError: true,
      };
    }

    const schedule = await prisma.courseSchedule.findUnique({
      where: { id: args.scheduleId, deletedAt: null },
      select: { id: true },
    });
    if (!schedule) {
      return {
        content: [{ type: 'text' as const, text: `Schedule not found: ${args.scheduleId}` }],
        isError: true,
      };
    }

    // 2. Create RenderJob record (status: pending)
    const renderJob = await prisma.renderJob.create({
      data: {
        templateId: args.templateId,
        targetType: 'schedule',
        targetId: args.scheduleId,
        status: 'pending',
      },
    });

    // 3. Add job to BullMQ queue
    await renderQueue.add(
      'renderSchedulePdf', // Job name
      {
        renderJobId: renderJob.id,
        templateId: args.templateId,
        scheduleId: args.scheduleId,
      },
      {
        jobId: renderJob.id, // Use renderJob ID as BullMQ job ID for easy tracking
        // attempts: 3, // Retry failed jobs
        // backoff: {
        //   type: 'exponential',
        //   delay: 1000,
        // },
      }
    );

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ jobId: renderJob.id, status: renderJob.status }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `Failed to enqueue schedule PDF render job: ${message}` }],
      isError: true,
    };
  }
}
