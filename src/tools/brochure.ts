import { z } from "zod";
import crypto from "crypto";
import Handlebars from "handlebars";
import { prisma } from "../services/prisma.js";
import { verifyToken } from "../services/jwt.js";
import { requirePermission } from "../services/authorization.js";
import { errorResult } from "../services/toolResponse.js";
import { PDF_PRINT_HELPER_CSS } from "../services/pdfPrintStyles.js";

type BrochureMode = "my_documents" | "edux";

Handlebars.registerHelper("plus1", (val: number) => val + 1);

const BROCHURE_CONTENT_ORDER_VALUES = ["course-first", "instructor-first"] as const;
const BROCHURE_OUTPUT_MODE_VALUES = ["web", "pdf", "both"] as const;
const BROCHURE_SOURCE_MODE_VALUES = ["my_documents", "edux"] as const;

const brochureBaseSchema = {
  token: z.string().describe("액세스 토큰"),
  title: z.string().min(1).describe("브로셔 제목"),
  summary: z.string().optional().describe("브로셔 요약"),
  brochureTemplateId: z.string().describe("브로셔 템플릿 ID"),
  courseTemplateId: z.string().optional().describe("웹용 강의 템플릿 ID"),
  instructorTemplateId: z.string().optional().describe("웹용 강사 템플릿 ID"),
  includeToc: z.boolean().default(true).describe("목차 포함 여부"),
  includeCourse: z.boolean().default(true).describe("강의 포함 여부"),
  includeInstructor: z.boolean().default(true).describe("강사 포함 여부"),
  contentOrder: z
    .enum(BROCHURE_CONTENT_ORDER_VALUES)
    .default("course-first")
    .describe("콘텐츠 정렬 순서"),
  outputMode: z
    .enum(BROCHURE_OUTPUT_MODE_VALUES)
    .default("both")
    .describe("출력 모드"),
  sourceMode: z
    .enum(BROCHURE_SOURCE_MODE_VALUES)
    .default("edux")
    .describe("데이터 소스 모드"),
  renderBatchToken: z.string().optional().describe("브로셔 배치 렌더 토큰"),
  sourceCourseDocIds: z.array(z.string()).optional().describe("내문서함 코스 문서 ID 목록"),
  sourceInstructorDocIds: z.array(z.string()).optional().describe("내문서함 강사 문서 ID 목록"),
  sourceCourseIds: z.array(z.string()).optional().describe("Edux 코스 ID 목록"),
  sourceInstructorIds: z.array(z.string()).optional().describe("Edux 강사 ID 목록"),
};

export const brochureCreateSchema = brochureBaseSchema;

export const brochureGetSchema = {
  token: z.string().describe("액세스 토큰"),
  id: z.string().describe("브로셔 패키지 ID"),
};

const buildBrochureSettingKey = (id: string) => `brochure.package.${id}`;

function sanitizeEmbeddedHtmlForBrochure(html: string) {
  // Prevent embedded template nav links from escaping brochure/PDF flow.
  return html.replace(/href=(['"])(\/[^'"]*)\1/g, (full, quote: string, path: string) => {
    const normalizedPath = path.split(/[?#]/)[0];
    if (
      normalizedPath === "/" ||
      normalizedPath === "/courses" ||
      normalizedPath === "/instructors" ||
      normalizedPath === "/documents" ||
      normalizedPath === "/my-documents" ||
      normalizedPath === "/templates"
    ) {
      return `href=${quote}#${quote}`;
    }
    return full;
  });
}

async function getActiveUser(token: string) {
  const payload = verifyToken(token);
  const user = await prisma.user.findUnique({
    where: { id: payload.userId, isActive: true, deletedAt: null },
    select: { id: true },
  });
  return user;
}

async function getTemplateById(templateId: string) {
  return prisma.template.findFirst({
    where: { id: templateId, deletedAt: null, type: "brochure_package" },
    select: { id: true, name: true, html: true, css: true },
  });
}

async function getTypedTemplateById(templateId: string, type: "course_intro" | "instructor_profile") {
  return prisma.template.findFirst({
    where: { id: templateId, deletedAt: null, type },
    select: { id: true, name: true, html: true, css: true },
  });
}

async function buildCourseTemplateData(courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId, deletedAt: null },
    include: {
      CourseLectures: {
        where: { Lecture: { deletedAt: null } },
        include: { Lecture: true },
        orderBy: { order: "asc" },
      },
      Schedules: { where: { deletedAt: null }, include: { Instructor: true } },
      CourseInstructors: { include: { Instructor: true } },
    },
  });
  if (!course) return null;
  const instructors = course.CourseInstructors?.map((ci) => ci.Instructor).filter(Boolean) || [];
  const courseLectures = (course.CourseLectures || []).map((link) => ({
    ...link.Lecture,
    order: link.order,
  }));
  return {
    course: {
      ...course,
      Instructors: instructors,
      instructorIds: instructors.map((i) => i.id),
    },
    instructors,
    content: course.content || "",
    lectures: courseLectures,
    modules: courseLectures,
    schedules: course.Schedules || [],
    courseLectures,
    courseSchedules: course.Schedules || [],
  };
}

async function buildInstructorTemplateData(instructorId: string) {
  const instructor = await prisma.instructor.findFirst({
    where: { id: instructorId, deletedAt: null },
    include: {
      User: true,
      CourseInstructors: { include: { Course: true } },
      Schedules: true,
    },
  });
  if (!instructor) return null;
  const profile = instructor.userId
    ? await prisma.instructorProfile.findUnique({
        where: { userId: instructor.userId },
        include: { User: true },
      })
    : null;

  const mergedInstructor = {
    ...instructor,
    name: instructor.name || profile?.displayName || instructor.User?.name,
    title: instructor.title ?? profile?.title,
    bio: instructor.bio ?? profile?.bio,
    phone: instructor.User?.phone ?? null,
    email: instructor.User?.email ?? instructor.email,
    links: instructor.links ?? profile?.links,
  };

  return {
    instructor: mergedInstructor,
    instructorProfile: profile,
    courses: instructor.CourseInstructors?.map((ci) => ci.Course) || [],
    schedules: instructor.Schedules || [],
  };
}

async function getLatestPdfMapByTargets(args: {
  userId: string;
  targetType: "course" | "instructor_profile";
  targetIds: string[];
}) {
  if (args.targetIds.length === 0) return new Map<string, string>();
  const docs = await prisma.userDocument.findMany({
    where: {
      userId: args.userId,
      isActive: true,
      targetType: args.targetType,
      targetId: { in: args.targetIds },
    },
    orderBy: { createdAt: "desc" },
    select: {
      targetId: true,
      pdfUrl: true,
      RenderJob: { select: { status: true } },
    },
  });
  const map = new Map<string, string>();
  for (const doc of docs) {
    if (map.has(doc.targetId)) continue;
    if (!doc.pdfUrl) continue;
    if (doc.RenderJob?.status !== "done") continue;
    map.set(doc.targetId, doc.pdfUrl);
  }
  return map;
}

async function resolveBrochureSources(args: {
  userId: string;
  sourceMode: BrochureMode;
  includeCourse: boolean;
  includeInstructor: boolean;
  sourceCourseDocIds: string[];
  sourceInstructorDocIds: string[];
  sourceCourseIds: string[];
  sourceInstructorIds: string[];
}) {
  let courseIds: string[] = [];
  let instructorIds: string[] = [];
  let coursePdfMap = new Map<string, string>();
  let instructorPdfMap = new Map<string, string>();
  let instructorProfileIdByInstructorId = new Map<string, string>();
  let preloadedInstructors:
    | Array<{
        id: string;
        name: string | null;
        title: string | null;
        email: string | null;
        affiliation: string | null;
        tagline: string | null;
        bio: string | null;
        pdfUrl?: string;
      }>
    | null = null;

  if (args.sourceMode === "my_documents") {
    const selectedDocIds = [
      ...(args.includeCourse ? args.sourceCourseDocIds : []),
      ...(args.includeInstructor ? args.sourceInstructorDocIds : []),
    ];
    const docs = selectedDocIds.length
      ? await prisma.userDocument.findMany({
          where: {
            userId: args.userId,
            isActive: true,
            id: { in: selectedDocIds },
          },
          select: {
            id: true,
            targetType: true,
            targetId: true,
            pdfUrl: true,
            RenderJob: { select: { status: true } },
          },
        })
      : [];

    const courseDocs = docs.filter((doc) => doc.targetType === "course");
    const instructorDocs = docs.filter((doc) => doc.targetType === "instructor_profile");

    courseIds = courseDocs.map((doc) => doc.targetId);

    coursePdfMap = new Map(
      courseDocs
        .filter((doc) => doc.RenderJob?.status === "done" && !!doc.pdfUrl)
        .map((doc) => [doc.targetId, doc.pdfUrl as string]),
    );

    // In my_documents mode, instructor_profile documents are keyed by profileId,
    // so normalize to instructorId for consistent link behavior with courses.
    const instructorProfileIds = instructorDocs.map((doc) => doc.targetId);
    if (instructorProfileIds.length > 0) {
      const profiles = await prisma.instructorProfile.findMany({
        where: { id: { in: instructorProfileIds } },
        select: { id: true, userId: true, displayName: true, title: true, bio: true, affiliation: true, email: true },
      });
      const userIds = profiles.map((profile) => profile.userId);
      const instructors = userIds.length
        ? await prisma.instructor.findMany({
            where: { userId: { in: userIds }, deletedAt: null },
            select: {
              id: true,
              userId: true,
              name: true,
              title: true,
              email: true,
              affiliation: true,
              tagline: true,
              bio: true,
            },
          })
        : [];
      const users = userIds.length
        ? await prisma.user.findMany({
            where: { id: { in: userIds }, deletedAt: null, isActive: true },
            select: { id: true, name: true, email: true },
          })
        : [];

      const profileIdByUserId = new Map(profiles.map((profile) => [profile.userId, profile.id]));
      const profileByUserId = new Map(profiles.map((profile) => [profile.userId, profile]));
      const userById = new Map(users.map((user) => [user.id, user]));
      const pdfByProfileId = new Map(
        instructorDocs
          .filter((doc) => doc.RenderJob?.status === "done" && !!doc.pdfUrl)
          .map((doc) => [doc.targetId, doc.pdfUrl as string]),
      );
      const profileOrder = new Map(instructorProfileIds.map((profileId, idx) => [profileId, idx]));

      const normalized = instructors
        .map((instructor) => {
          const profileId = instructor.userId ? profileIdByUserId.get(instructor.userId) : undefined;
          return {
            instructorId: instructor.id,
            profileId: profileId || null,
            pdfUrl: profileId ? pdfByProfileId.get(profileId) : undefined,
            order: profileId ? (profileOrder.get(profileId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER,
          };
        })
        .sort((a, b) => a.order - b.order);

      instructorIds = normalized.map((row) => row.instructorId);
      instructorPdfMap = new Map(
        normalized
          .filter((row) => !!row.pdfUrl)
          .map((row) => [row.instructorId, row.pdfUrl as string]),
      );

      // Fallback for profiles that do not have Instructor entity rows yet.
      const existingInstructorUserIds = new Set(instructors.map((item) => item.userId));
      const fallbackRows = profiles
        .filter((profile) => !existingInstructorUserIds.has(profile.userId))
        .map((profile) => {
          const profileId = profile.id;
          const user = userById.get(profile.userId);
          return {
            id: profileId,
            name: profile.displayName || user?.name || null,
            title: profile.title || null,
            email: profile.email || user?.email || null,
            affiliation: profile.affiliation || null,
            tagline: null,
            bio: profile.bio || null,
            pdfUrl: pdfByProfileId.get(profileId),
            order: profileOrder.get(profileId) ?? Number.MAX_SAFE_INTEGER,
          };
        });
      const instructorRows = normalized
        .map((row) => {
          const matched = instructors.find((item) => item.id === row.instructorId);
          if (!matched) return null;
          return {
            id: matched.id,
            name: matched.name || null,
            title: matched.title || null,
            email: matched.email || null,
            affiliation: matched.affiliation || null,
            tagline: matched.tagline || null,
            bio: matched.bio || null,
            pdfUrl: row.pdfUrl,
            order: row.order,
          };
        })
        .filter((item): item is NonNullable<typeof item> => !!item);
      preloadedInstructors = [...instructorRows, ...fallbackRows]
        .sort((a, b) => a.order - b.order)
        .map(({ order: _order, ...rest }) => rest);
    }
  } else {
    courseIds = args.includeCourse ? args.sourceCourseIds : [];
    instructorIds = args.includeInstructor ? args.sourceInstructorIds : [];
    coursePdfMap = await getLatestPdfMapByTargets({
      userId: args.userId,
      targetType: "course",
      targetIds: courseIds,
    });
    if (instructorIds.length > 0) {
      const instructorsForProfileMap = await prisma.instructor.findMany({
        where: { id: { in: instructorIds }, deletedAt: null },
        select: { id: true, userId: true },
      });
      const userIds = instructorsForProfileMap
        .map((instructor) => instructor.userId)
        .filter((value): value is string => !!value);
      if (userIds.length > 0) {
        const profiles = await prisma.instructorProfile.findMany({
          where: { userId: { in: userIds } },
          select: { id: true, userId: true },
        });
        const profileIdByUserId = new Map(profiles.map((profile) => [profile.userId, profile.id]));
        instructorProfileIdByInstructorId = new Map(
          instructorsForProfileMap
            .filter((instructor) => !!instructor.userId && profileIdByUserId.has(instructor.userId as string))
            .map((instructor) => [instructor.id, profileIdByUserId.get(instructor.userId as string) as string]),
        );
      }
      const profileIds = [...new Set([...instructorProfileIdByInstructorId.values()])];
      instructorPdfMap = await getLatestPdfMapByTargets({
        userId: args.userId,
        targetType: "instructor_profile",
        targetIds: profileIds,
      });
    }
  }

  const [coursesRaw, instructorsRaw] = await Promise.all([
    courseIds.length
      ? prisma.course.findMany({
          where: { id: { in: courseIds }, deletedAt: null },
          select: {
            id: true,
            title: true,
            description: true,
            durationHours: true,
            goal: true,
          },
        })
      : Promise.resolve([]),
    preloadedInstructors
      ? Promise.resolve([])
      : instructorIds.length
      ? prisma.instructor.findMany({
          where: { id: { in: instructorIds }, deletedAt: null },
          select: {
            id: true,
            name: true,
            title: true,
            email: true,
            affiliation: true,
            tagline: true,
            bio: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const courseOrderMap = new Map(courseIds.map((id, idx) => [id, idx]));
  const instructorOrderMap = new Map(instructorIds.map((id, idx) => [id, idx]));

  const courses = coursesRaw
    .slice()
    .sort((a, b) => (courseOrderMap.get(a.id) ?? 0) - (courseOrderMap.get(b.id) ?? 0))
    .map((course) => ({
      ...course,
      pdfUrl: coursePdfMap.get(course.id),
    }));

  const instructors = preloadedInstructors
    ? preloadedInstructors
    : instructorsRaw
        .slice()
        .sort((a, b) => (instructorOrderMap.get(a.id) ?? 0) - (instructorOrderMap.get(b.id) ?? 0))
        .map((instructor) => ({
          ...instructor,
          pdfUrl:
            args.sourceMode === "edux"
              ? instructorPdfMap.get(instructorProfileIdByInstructorId.get(instructor.id) || "")
              : instructorPdfMap.get(instructor.id),
        }));

  return { courses, instructors, courseIds, instructorIds };
}

export async function brochureCreateHandler(args: {
  token: string;
  title: string;
  summary?: string;
  brochureTemplateId: string;
  courseTemplateId?: string;
  instructorTemplateId?: string;
  includeToc?: boolean;
  includeCourse?: boolean;
  includeInstructor?: boolean;
  contentOrder?: "course-first" | "instructor-first";
  outputMode?: "web" | "pdf" | "both";
  sourceMode?: BrochureMode;
  renderBatchToken?: string;
  sourceCourseDocIds?: string[];
  sourceInstructorDocIds?: string[];
  sourceCourseIds?: string[];
  sourceInstructorIds?: string[];
}) {
  try {
    await requirePermission(args.token, "document.list", "브로셔 저장 권한이 없습니다.");
    const user = await getActiveUser(args.token);
    if (!user) {
      return {
        content: [{ type: "text" as const, text: "사용자를 찾을 수 없습니다." }],
        isError: true,
      };
    }

    const includeCourse = args.includeCourse !== false;
    const includeInstructor = args.includeInstructor !== false;
    if (!includeCourse && !includeInstructor) {
      return {
        content: [{ type: "text" as const, text: "강의 또는 강사 중 최소 하나는 포함해야 합니다." }],
        isError: true,
      };
    }

    const template = await getTemplateById(args.brochureTemplateId);
    if (!template) {
      return {
        content: [{ type: "text" as const, text: "브로셔 템플릿을 찾을 수 없습니다." }],
        isError: true,
      };
    }

    const sourceMode = args.sourceMode || "edux";
    const [courseTemplate, instructorTemplate] = await Promise.all([
      args.courseTemplateId ? getTypedTemplateById(args.courseTemplateId, "course_intro") : Promise.resolve(null),
      args.instructorTemplateId
        ? getTypedTemplateById(args.instructorTemplateId, "instructor_profile")
        : Promise.resolve(null),
    ]);

    const resolved = await resolveBrochureSources({
      userId: user.id,
      sourceMode,
      includeCourse,
      includeInstructor,
      sourceCourseDocIds: args.sourceCourseDocIds || [],
      sourceInstructorDocIds: args.sourceInstructorDocIds || [],
      sourceCourseIds: args.sourceCourseIds || [],
      sourceInstructorIds: args.sourceInstructorIds || [],
    });

    if (includeCourse && resolved.courses.length === 0) {
      return {
        content: [{ type: "text" as const, text: "포함할 강의 데이터를 찾을 수 없습니다." }],
        isError: true,
      };
    }
    if (includeInstructor && resolved.instructors.length === 0) {
      return {
        content: [{ type: "text" as const, text: "포함할 강사 데이터를 찾을 수 없습니다." }],
        isError: true,
      };
    }

    const renderedCourses = await Promise.all(
      resolved.courses.map(async (course) => {
        const normalizedCourse = { ...course };
        if (!courseTemplate) return normalizedCourse;
        const templateData = await buildCourseTemplateData(course.id);
        if (!templateData) return normalizedCourse;
        const compiled = Handlebars.compile(courseTemplate.html);
        const sectionHtml = compiled(templateData);
        const webHtml = `<style>${courseTemplate.css}</style>${sanitizeEmbeddedHtmlForBrochure(sectionHtml)}`;
        return { ...normalizedCourse, webHtml };
      }),
    );

    const renderedInstructors = await Promise.all(
      resolved.instructors.map(async (instructor) => {
        const normalizedInstructor = { ...instructor };
        if (!instructorTemplate) return normalizedInstructor;
        const templateData = await buildInstructorTemplateData(instructor.id);
        if (!templateData) return normalizedInstructor;
        const compiled = Handlebars.compile(instructorTemplate.html);
        const sectionHtml = compiled(templateData);
        const webHtml = `<style>${instructorTemplate.css}</style>${sanitizeEmbeddedHtmlForBrochure(sectionHtml)}`;
        return { ...normalizedInstructor, webHtml };
      }),
    );

    const packageId = `brochure_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const compiled = Handlebars.compile(template.html);
    const rendered = compiled({
      brochure: {
        title: args.title,
        summary: args.summary || "",
        includeToc: args.includeToc !== false,
        includeCourses: includeCourse,
        includeInstructors: includeInstructor,
        courseFirst: (args.contentOrder || "course-first") !== "instructor-first",
        outputMode: args.outputMode || "both",
      },
      courses: renderedCourses,
      instructors: renderedInstructors,
    });
    const renderedHtml = `<!doctype html><html><head><meta charset="utf-8"><style>${template.css}</style><style>${PDF_PRINT_HELPER_CSS}</style></head><body>${rendered}</body></html>`;
    const brochureUrl = `/brochure/${packageId}`;

    const now = new Date();
    const settingValue = {
      id: packageId,
      userId: user.id,
      title: args.title,
      summary: args.summary || "",
      sourceMode,
      includeToc: args.includeToc !== false,
      includeCourse,
      includeInstructor,
      contentOrder: args.contentOrder || "course-first",
      outputMode: args.outputMode || "both",
      renderBatchToken: args.renderBatchToken || null,
      templateId: template.id,
      templateName: template.name,
      courseTemplateId: courseTemplate?.id || null,
      courseTemplateName: courseTemplate?.name || null,
      instructorTemplateId: instructorTemplate?.id || null,
      instructorTemplateName: instructorTemplate?.name || null,
      sourceCourseDocIds: args.sourceCourseDocIds || [],
      sourceInstructorDocIds: args.sourceInstructorDocIds || [],
      sourceCourseIds: resolved.courseIds,
      sourceInstructorIds: resolved.instructorIds,
      html: renderedHtml,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const [job, doc] = await prisma.$transaction(async (tx) => {
      await tx.appSetting.upsert({
        where: { key: buildBrochureSettingKey(packageId) },
        create: {
          key: buildBrochureSettingKey(packageId),
          value: settingValue,
        },
        update: {
          value: settingValue,
          updatedAt: now,
        },
      });

      const renderJob = await tx.renderJob.create({
        data: {
          userId: user.id,
          templateId: template.id,
          targetType: "brochure_package",
          targetId: packageId,
          status: "done",
          pdfUrl: brochureUrl,
        },
      });

      const userDoc = await tx.userDocument.create({
        data: {
          userId: user.id,
          renderJobId: renderJob.id,
          templateId: template.id,
          targetType: "brochure_package",
          targetId: packageId,
          label: args.title,
          pdfUrl: brochureUrl,
          isActive: true,
        },
        include: {
          Template: { select: { id: true, name: true, type: true } },
          RenderJob: { select: { status: true } },
        },
      });

      return [renderJob, userDoc] as const;
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            id: packageId,
            url: brochureUrl,
            renderJobId: job.id,
            document: doc,
          }),
        },
      ],
    };
  } catch (error) {
    return errorResult("브로셔 저장 실패", error);
  }
}

export async function brochureGetHandler(args: { token: string; id: string }) {
  try {
    await requirePermission(args.token, "document.list", "브로셔 조회 권한이 없습니다.");
    const user = await getActiveUser(args.token);
    if (!user) {
      return {
        content: [{ type: "text" as const, text: "사용자를 찾을 수 없습니다." }],
        isError: true,
      };
    }

    const setting = await prisma.appSetting.findUnique({
      where: { key: buildBrochureSettingKey(args.id) },
      select: { value: true },
    });
    const value = setting?.value as Record<string, unknown> | undefined;
    if (!value || value.userId !== user.id) {
      return {
        content: [{ type: "text" as const, text: "브로셔를 찾을 수 없습니다." }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(value) }],
    };
  } catch (error) {
    return errorResult("브로셔 조회 실패", error);
  }
}
