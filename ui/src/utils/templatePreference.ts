export type TemplateTargetType = "course" | "instructor_profile" | "brochure_package";

type TemplatePreference = {
  courseTemplateId?: string;
  instructorProfileTemplateId?: string;
  brochureTemplateId?: string;
  updatedAt?: number;
};

const STORAGE_PREFIX = "edux:templatePreference:";

const getKey = (userId: string) => `${STORAGE_PREFIX}${userId}`;

export const getTemplatePreference = (userId?: string | null): TemplatePreference => {
  if (!userId) return {};
  try {
    const raw = localStorage.getItem(getKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as TemplatePreference;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export const setTemplatePreference = (
  userId: string,
  partial: Partial<TemplatePreference>,
): TemplatePreference => {
  const next: TemplatePreference = {
    ...getTemplatePreference(userId),
    ...partial,
    updatedAt: Date.now(),
  };
  localStorage.setItem(getKey(userId), JSON.stringify(next));
  return next;
};

export const getPreferredTemplateId = (
  userId: string | null | undefined,
  targetType: TemplateTargetType,
): string | undefined => {
  const pref = getTemplatePreference(userId);
  if (targetType === "course") return pref.courseTemplateId;
  if (targetType === "brochure_package") return pref.brochureTemplateId;
  return pref.instructorProfileTemplateId;
};

export const setPreferredTemplateId = (
  userId: string,
  targetType: TemplateTargetType,
  templateId: string | undefined,
): TemplatePreference => {
  if (targetType === "course") {
    return setTemplatePreference(userId, { courseTemplateId: templateId });
  }
  if (targetType === "brochure_package") {
    return setTemplatePreference(userId, { brochureTemplateId: templateId });
  }
  return setTemplatePreference(userId, { instructorProfileTemplateId: templateId });
};
