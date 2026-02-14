import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { renderQueue, RENDER_QUEUE_NAME } from '../services/queue.js'; // Import the queue
import { verifyToken } from '../services/jwt.js';

// 스키마 정의
export const renderCoursePdfSchema = {
  token: z.string().describe('액세스 토큰'),
  templateId: z.string().describe('템플릿 ID'),
  courseId: z.string().describe('코스 ID'),
  label: z.string().optional().describe('문서 라벨'),
};

export const renderSchedulePdfSchema = {
  token: z.string().describe('액세스 토큰'),
  templateId: z.string().describe('템플릿 ID'),
  scheduleId: z.string().describe('스케줄 ID'),
  label: z.string().optional().describe('문서 라벨'),
};

export const renderInstructorProfilePdfSchema = {
  token: z.string().describe('액세스 토큰'),
  templateId: z.string().describe('템플릿 ID'),
  profileId: z.string().describe('강사 프로필 ID'),
  label: z.string().optional().describe('문서 라벨'),
};

// 핸들러 정의
export async function renderCoursePdfHandler(args: {
  token: string;
  templateId: string;
  courseId: string;
  label?: string;
}) {
  try {
    const payload = verifyToken(args.token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!user) {
      return {
        content: [{ type: 'text' as const, text: '사용자를 찾을 수 없습니다.' }],
        isError: true,
      };
    }

    // 1. Validate template and course existence
    const template = await prisma.template.findFirst({
      where: { id: args.templateId, deletedAt: null },
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
    const isAdminOperator =
      payload.role === "admin" || payload.role === "operator";
    if (!isAdminOperator) {
      const visibleCourse = await prisma.course.findFirst({
        where: {
          id: args.courseId,
          deletedAt: null,
          OR: [
            { createdBy: user.id },
            {
              CourseShares: {
                some: {
                  sharedWithUserId: user.id,
                  status: "accepted",
                },
              },
            },
          ],
        },
        select: { id: true },
      });
      if (!visibleCourse) {
        return {
          content: [{ type: "text" as const, text: "코스 내보내기 권한이 없습니다." }],
          isError: true,
        };
      }
    }

    // 2. Create RenderJob record (status: pending)
    const renderJob = await prisma.renderJob.create({
      data: {
        userId: user.id,
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
        userId: user.id,
        templateId: args.templateId,
        targetType: 'course',
        targetId: args.courseId,
        courseId: args.courseId,
        label: args.label,
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
  token: string;
  templateId: string;
  scheduleId: string;
  label?: string;
}) {
  try {
    const payload = verifyToken(args.token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!user) {
      return {
        content: [{ type: 'text' as const, text: '사용자를 찾을 수 없습니다.' }],
        isError: true,
      };
    }

    // 1. Validate template and schedule existence
    const template = await prisma.template.findFirst({
      where: { id: args.templateId, deletedAt: null },
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
      select: { id: true, courseId: true },
    });
    if (!schedule) {
      return {
        content: [{ type: 'text' as const, text: `Schedule not found: ${args.scheduleId}` }],
        isError: true,
      };
    }
    const isAdminOperator =
      payload.role === "admin" || payload.role === "operator";
    if (!isAdminOperator) {
      const visibleCourse = await prisma.course.findFirst({
        where: {
          id: schedule.courseId,
          deletedAt: null,
          OR: [
            { createdBy: user.id },
            {
              CourseShares: {
                some: {
                  sharedWithUserId: user.id,
                  status: "accepted",
                },
              },
            },
          ],
        },
        select: { id: true },
      });
      if (!visibleCourse) {
        return {
          content: [{ type: "text" as const, text: "일정 내보내기 권한이 없습니다." }],
          isError: true,
        };
      }
    }

    // 2. Create RenderJob record (status: pending)
    const renderJob = await prisma.renderJob.create({
      data: {
        userId: user.id,
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
        userId: user.id,
        templateId: args.templateId,
        targetType: 'schedule',
        targetId: args.scheduleId,
        scheduleId: args.scheduleId,
        label: args.label,
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

export async function renderInstructorProfilePdfHandler(args: {
  token: string;
  templateId: string;
  profileId: string;
  label?: string;
}) {
  try {
    const payload = verifyToken(args.token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!user) {
      return {
        content: [{ type: 'text' as const, text: '사용자를 찾을 수 없습니다.' }],
        isError: true,
      };
    }

    const template = await prisma.template.findFirst({
      where: { id: args.templateId, deletedAt: null },
      select: { id: true },
    });
    if (!template) {
      return {
        content: [{ type: 'text' as const, text: `Template not found: ${args.templateId}` }],
        isError: true,
      };
    }

    const profile = await prisma.instructorProfile.findUnique({
      where: { id: args.profileId },
      select: { id: true, userId: true },
    });
    if (!profile) {
      return {
        content: [{ type: 'text' as const, text: `Instructor profile not found: ${args.profileId}` }],
        isError: true,
      };
    }
    const isAdminOperator =
      payload.role === "admin" || payload.role === "operator";
    if (!isAdminOperator && profile.userId !== user.id) {
      return {
        content: [{ type: "text" as const, text: "강사 프로필 내보내기 권한이 없습니다." }],
        isError: true,
      };
    }

    const renderJob = await prisma.renderJob.create({
      data: {
        userId: user.id,
        templateId: args.templateId,
        targetType: 'instructor_profile',
        targetId: args.profileId,
        status: 'pending',
      },
    });

    await renderQueue.add(
      'renderInstructorProfilePdf',
      {
        renderJobId: renderJob.id,
        userId: user.id,
        templateId: args.templateId,
        targetType: 'instructor_profile',
        targetId: args.profileId,
        profileId: args.profileId,
        label: args.label,
      },
      {
        jobId: renderJob.id,
      }
    );

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ jobId: renderJob.id, status: renderJob.status }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `Failed to enqueue instructor profile PDF render job: ${message}` }],
      isError: true,
    };
  }
}
