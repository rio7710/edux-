import { Worker } from 'bullmq';
import { RENDER_QUEUE_NAME } from '../services/queue.js';
import { prisma } from '../services/prisma.js';
import { convertHtmlToPdf } from '../services/pdf.js';
import Handlebars from 'handlebars';

Handlebars.registerHelper('plus1', (val: number) => val + 1);

// Redis connection for BullMQ
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD, // Optional
};

const pdfWorker = new Worker(
  RENDER_QUEUE_NAME,
  async (job) => {
    const { renderJobId, templateId, courseId, scheduleId, profileId, userId, targetType, targetId, label } = job.data;
    console.log(`[pdfWorker] Processing job ${job.id}: renderJobId=${renderJobId}`);

    // Update RenderJob status to processing
    await prisma.renderJob.update({
      where: { id: renderJobId },
      data: { status: 'processing' },
    });

    try {
      // 1. Fetch Template
      const template = await prisma.template.findUnique({
        where: { id: templateId },
        select: { html: true, css: true },
      });
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // 2. Fetch Data (Course / Schedule / Instructor Profile)
      let data: any = {};
      let pdfFileName: string;

      if (courseId) {
        data.course = await prisma.course.findUnique({
          where: { id: courseId, deletedAt: null },
          include: { Lectures: { where: { deletedAt: null }, orderBy: { order: 'asc' } }, Schedules: true },
        });
        if (!data.course) throw new Error(`Course not found: ${courseId}`);
        pdfFileName = `course-${courseId}-${renderJobId}.pdf`;
      } else if (scheduleId) {
        data.schedule = await prisma.courseSchedule.findUnique({
          where: { id: scheduleId, deletedAt: null },
          include: { Course: true, Instructor: true },
        });
        if (!data.schedule) throw new Error(`Schedule not found: ${scheduleId}`);
        pdfFileName = `schedule-${scheduleId}-${renderJobId}.pdf`;
      } else if (profileId) {
        const profile = await prisma.instructorProfile.findUnique({
          where: { id: profileId },
          include: { User: true },
        });
        if (!profile) throw new Error(`InstructorProfile not found: ${profileId}`);

        const instructor = await prisma.instructor.findFirst({
          where: { userId: profile.userId, deletedAt: null },
          include: {
            CourseInstructors: { include: { Course: true } },
            Schedules: true,
          },
        });

        const mergedInstructor = {
          ...(instructor || {}),
          name: profile.displayName || profile.User?.name || instructor?.name,
          title: profile.title ?? instructor?.title,
          bio: profile.bio ?? instructor?.bio,
          phone: profile.phone ?? instructor?.phone,
          email: profile.User?.email ?? instructor?.email,
          links: profile.links ?? instructor?.links,
        };

        data.instructor = mergedInstructor;
        data.instructorProfile = profile;
        data.courses = instructor?.CourseInstructors?.map((ci) => ci.Course) || [];
        data.schedules = instructor?.Schedules || [];

        pdfFileName = `instructor-profile-${profileId}-${renderJobId}.pdf`;
      } else {
        throw new Error('No target provided for rendering.');
      }

      // 3. Render HTML with Handlebars
      const compiledTemplate = Handlebars.compile(template.html);
      const renderedHtml = compiledTemplate(data);

      const fullHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>${template.css}</style>
        </head>
        <body>
            ${renderedHtml}
        </body>
        </html>
      `;

      // 4. Convert HTML to PDF using Puppeteer
      const pdfUrl = await convertHtmlToPdf(fullHtml, pdfFileName);

      // 5. Update RenderJob status to done
      const completedJob = await prisma.renderJob.update({
        where: { id: renderJobId },
        data: { status: 'done', pdfUrl: pdfUrl },
      });

      // 6. Create UserDocument (best-effort)
      try {
        const resolvedUserId = userId || completedJob.userId;
        if (resolvedUserId) {
          await prisma.userDocument.create({
            data: {
              userId: resolvedUserId,
              renderJobId: completedJob.id,
              templateId: completedJob.templateId,
              targetType: completedJob.targetType || targetType || 'unknown',
              targetId: completedJob.targetId || targetId || '',
              label: label || undefined,
              pdfUrl,
            },
          });
        }
      } catch (docError: any) {
        console.error(`[pdfWorker] Failed to create UserDocument: ${docError?.message || docError}`);
      }

      console.log(`[pdfWorker] Job ${job.id} completed. PDF: ${pdfUrl}`);
      return { pdfUrl };
    } catch (error: any) {
      console.error(`[pdfWorker] Job ${job.id} failed: ${error.message}`);
      // Update RenderJob status to failed
      await prisma.renderJob.update({
        where: { id: renderJobId },
        data: { status: 'failed', errorMessage: error.message || 'Unknown error' },
      });
      throw error; // Re-throw to mark job as failed in BullMQ
    }
  },
  { connection, concurrency: parseInt(process.env.PDF_CONCURRENCY || '2', 10) }
);

pdfWorker.on('ready', () => console.log(`[pdfWorker] Worker started (concurrency: ${pdfWorker.opts.concurrency})`));
pdfWorker.on('error', (err) => console.error(`[pdfWorker] Worker error: ${err.message}`));

// Keep the worker alive
// process.on('SIGTERM', () => pdfWorker.close());
// process.on('SIGINT', () => pdfWorker.close());
