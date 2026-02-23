import { Worker } from 'bullmq';
import fs from 'fs/promises';
import { constants as fsConstants, mkdirSync, appendFileSync } from 'fs';
import path from 'path';
import { RENDER_QUEUE_NAME } from '../services/queue.js';
import { prisma } from '../services/prisma.js';
import { convertHtmlToPdf, closeBrowser } from '../services/pdf.js';
import { logger } from '../services/logger.js';
import { PDF_PRINT_HELPER_CSS } from '../services/pdfPrintStyles.js';
import Handlebars from 'handlebars';

Handlebars.registerHelper('plus1', (val: number) => val + 1);

function formatTimestamp(date: Date): string {
  // Asia/Seoul 기준 타임스탬프 (UTC+9 고정)
  const koDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = koDate.getUTCFullYear();
  const mm = String(koDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(koDate.getUTCDate()).padStart(2, '0');
  const hh = String(koDate.getUTCHours()).padStart(2, '0');
  const mi = String(koDate.getUTCMinutes()).padStart(2, '0');
  const ss = String(koDate.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
}

// Redis connection for BullMQ
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
};
const workerCrashFallbackPath = path.resolve(process.cwd(), 'logs', 'worker-crash-fallback.log');

const writeCrashFallback = (event: string, payload: Record<string, unknown>) => {
  try {
    mkdirSync(path.dirname(workerCrashFallbackPath), { recursive: true });
    appendFileSync(
      workerCrashFallbackPath,
      `${JSON.stringify({ ts: new Date().toISOString(), event, ...payload })}\n`,
      'utf8',
    );
  } catch {
    // ignore fallback logging errors
  }
};

const pdfWorker = new Worker(
  RENDER_QUEUE_NAME,
  async (job) => {
    const { renderJobId, templateId, courseId, scheduleId, profileId, userId, targetType, targetId, label } = job.data;
    logger.info('pdfWorker.job.processing', {
      jobId: String(job.id),
      renderJobId,
      attemptsMade: job.attemptsMade,
    });

    // ─── 원자적 pending → processing 전환 ───────────────────────────────
    // updateMany로 조건부 전환: pending인 레코드만 업데이트
    // 이미 processing/done/failed이면 count=0 → 중복 실행 스킵
    const now = new Date();
    const { count } = await prisma.renderJob.updateMany({
      where: { id: renderJobId, status: 'pending' },
      data: {
        status: 'processing',
        processingAt: now,
        lastTriedAt: now,
        retryCount: { increment: job.attemptsMade > 0 ? 1 : 0 },
      },
    });

    if (count === 0) {
      // 이미 다른 워커가 처리 중이거나 완료된 작업 → 스킵
      const existing = await prisma.renderJob.findUnique({
        where: { id: renderJobId },
        select: { status: true },
      });
      logger.warn('pdfWorker.job.skipped', {
        jobId: String(job.id),
        renderJobId,
        currentStatus: existing?.status,
        reason: 'already_processing_or_done',
      });
      return { skipped: true, status: existing?.status };
    }
    // ────────────────────────────────────────────────────────────────────

    try {
      // 1. Fetch Template
      const template = await prisma.template.findFirst({
        where: { id: templateId, deletedAt: null },
        select: { html: true, css: true },
      });
      if (!template) {
        throw Object.assign(new Error(`Template not found: ${templateId}`), { code: 'TEMPLATE_NOT_FOUND' });
      }

      // 2. Fetch Data (Course / Schedule / Instructor Profile)
      const data: any = {};
      let pdfFileName: string;
      let defaultLabel: string | undefined;
      const timestamp = formatTimestamp(new Date());

      if (courseId) {
        const course = await prisma.course.findUnique({
          where: { id: courseId, deletedAt: null },
          include: {
            CourseLectures: {
              where: { Lecture: { deletedAt: null } },
              include: { Lecture: true },
              orderBy: { order: 'asc' },
            },
            Schedules: { where: { deletedAt: null }, include: { Instructor: true } },
            CourseInstructors: { include: { Instructor: true } },
          },
        });
        if (!course) throw Object.assign(new Error(`Course not found: ${courseId}`), { code: 'DATA_FETCH_ERROR' });
        const instructors =
          course.CourseInstructors?.map((ci) => ci.Instructor).filter(Boolean) || [];
        data.course = {
          ...course,
          Instructors: instructors,
          instructorIds: instructors.map((i) => i.id),
        };
        data.instructors = instructors;
        data.content = course.content || '';
        const courseLectures = (course.CourseLectures || []).map((link) => ({
          ...link.Lecture,
          order: link.order,
        }));
        data.lectures = courseLectures;
        data.modules = courseLectures;
        data.schedules = course.Schedules || [];
        data.courseLectures = courseLectures;
        data.courseSchedules = course.Schedules || [];
        defaultLabel = `${course.title}_${timestamp}`;
        pdfFileName = `${sanitizeFileName(defaultLabel)}_${renderJobId}.pdf`;
      } else if (scheduleId) {
        data.schedule = await prisma.courseSchedule.findUnique({
          where: { id: scheduleId, deletedAt: null },
          include: { Course: true, Instructor: true },
        });
        if (!data.schedule) throw Object.assign(new Error(`Schedule not found: ${scheduleId}`), { code: 'DATA_FETCH_ERROR' });
        const scheduleTitle = data.schedule.Course?.title || `schedule_${scheduleId}`;
        defaultLabel = `${scheduleTitle}_${timestamp}`;
        pdfFileName = `${sanitizeFileName(defaultLabel)}_${renderJobId}.pdf`;
      } else if (profileId) {
        const profile = await prisma.instructorProfile.findUnique({
          where: { id: profileId },
          include: { User: true },
        });
        if (!profile) throw Object.assign(new Error(`InstructorProfile not found: ${profileId}`), { code: 'DATA_FETCH_ERROR' });

        const instructor = await prisma.instructor.findFirst({
          where: { userId: profile.userId, deletedAt: null },
          include: {
            CourseInstructors: { include: { Course: true } },
            Schedules: true,
          },
        });

        const mergedInstructor = {
          ...(instructor || {}),
          name: instructor?.name || profile.displayName || profile.User?.name,
          title: instructor?.title ?? profile.title,
          bio: instructor?.bio ?? profile.bio,
          phone: profile.User?.phone ?? null,
          email: profile.User?.email ?? instructor?.email,
          links: instructor?.links ?? profile.links,
        };

        data.instructor = mergedInstructor;
        data.instructorProfile = profile;
        data.courses = instructor?.CourseInstructors?.map((ci) => ci.Course) || [];
        data.schedules = instructor?.Schedules || [];

        const profileName = mergedInstructor?.name || `profile_${profileId}`;
        defaultLabel = `${profileName}_${timestamp}`;
        pdfFileName = `${sanitizeFileName(defaultLabel)}_${renderJobId}.pdf`;
      } else {
        throw Object.assign(new Error('No target provided for rendering.'), { code: 'DATA_FETCH_ERROR' });
      }

      // 3. Render HTML with Handlebars
      let renderedHtml: string;
      try {
        const compiledTemplate = Handlebars.compile(template.html);
        renderedHtml = compiledTemplate(data);
      } catch (hbsErr: any) {
        throw Object.assign(
          new Error(`Template render failed: ${hbsErr?.message}`),
          { code: 'TEMPLATE_RENDER_ERROR' },
        );
      }

      const fullHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>${template.css}</style>
            <style>${PDF_PRINT_HELPER_CSS}</style>
        </head>
        <body>
            ${renderedHtml}
        </body>
        </html>
      `;

      // 4. Convert HTML to PDF using Puppeteer
      const pdfUrl = await convertHtmlToPdf(fullHtml, pdfFileName);

      // 4-1. PDF 파일 디스크 존재 확인 (생성 실패 시 즉시 오류 처리)
      const pdfDiskPath = path.resolve(process.cwd(), 'public', pdfFileName.replace(/^\/pdf\//, 'pdf/'));
      try {
        await fs.access(pdfDiskPath, fsConstants.F_OK);
      } catch {
        throw Object.assign(
          new Error(`PDF file not found on disk after render: ${pdfDiskPath}`),
          { code: 'PDF_FILE_MISSING' },
        );
      }

      // 5. Update RenderJob status to done
      const completedJob = await prisma.renderJob.update({
        where: { id: renderJobId },
        data: { status: 'done', pdfUrl },
      });

      // 6. Create UserDocument (best-effort)
      try {
        const ownerUserId = completedJob.userId ?? userId;
        if (!ownerUserId) throw new Error('RenderJob owner userId is missing');
        await prisma.userDocument.create({
          data: {
            userId: ownerUserId,
            renderJobId: completedJob.id,
            templateId: completedJob.templateId,
            targetType: completedJob.targetType || targetType || 'unknown',
            targetId: completedJob.targetId || targetId || '',
            label: label || defaultLabel || undefined,
            pdfUrl,
          },
        });
      } catch (docError: any) {
        logger.error('pdfWorker.userDocument.create_failed', {
          jobId: String(job.id),
          renderJobId,
          error: docError?.message || docError,
        });
      }

      logger.info('pdfWorker.job.completed', {
        jobId: String(job.id),
        renderJobId,
        pdfUrl,
      });
      return { pdfUrl };
    } catch (error: any) {
      const errorCode: string = error?.code || 'UNKNOWN';
      const errorMessage: string = error?.message || 'Unknown error';
      const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);

      logger.error('pdfWorker.job.failed', {
        jobId: String(job.id),
        renderJobId,
        errorCode,
        message: errorMessage,
        attemptsMade: job.attemptsMade,
        isFinalAttempt,
      });

      // 재시도가 남아 있으면 pending으로 되돌려 다음 시도 허용
      // 최종 실패이면 failed로 확정
      await prisma.renderJob.update({
        where: { id: renderJobId },
        data: {
          status: isFinalAttempt ? 'failed' : 'pending',
          errorCode,
          errorMessage,
          lastTriedAt: new Date(),
        },
      });
      throw error;
    }
  },
  { connection, concurrency: parseInt(process.env.PDF_CONCURRENCY || '2', 10) }
);

pdfWorker.on('ready', () => {
  logger.info('pdfWorker.ready', {
    concurrency: pdfWorker.opts.concurrency,
  });
});
pdfWorker.on('error', (err) => {
  logger.error('pdfWorker.error', { message: err.message });
});

const closeWorker = async (signal: NodeJS.Signals) => {
  writeCrashFallback('pdfWorker.shutdown.signal', { signal });
  logger.warn('pdfWorker.shutdown.signal', { signal });
  try {
    await pdfWorker.close();
    await closeBrowser();
    logger.info('pdfWorker.shutdown.completed', { signal });
    process.exit(0);
  } catch (error) {
    writeCrashFallback('pdfWorker.shutdown.failed', {
      signal,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    logger.error('pdfWorker.shutdown.failed', { signal, error });
    process.exit(1);
  }
};

process.on('SIGTERM', () => { void closeWorker('SIGTERM'); });
process.on('SIGINT', () => { void closeWorker('SIGINT'); });
process.on('uncaughtException', (error) => {
  writeCrashFallback('pdfWorker.uncaughtException', {
    message: error.message,
    stack: error.stack,
  });
  logger.error('pdfWorker.uncaughtException', { error });
});
process.on('unhandledRejection', (reason) => {
  writeCrashFallback('pdfWorker.unhandledRejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  logger.error('pdfWorker.unhandledRejection', { reason });
});
