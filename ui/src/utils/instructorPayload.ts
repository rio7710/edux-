export interface Degree {
  name: string;
  school: string;
  major: string;
  year: string;
  fileUrl?: string;
}

export interface Career {
  company: string;
  role: string;
  period: string;
  description?: string;
}

export interface Publication {
  title: string;
  type: string;
  year?: string;
  publisher?: string;
  url?: string;
}

export interface Certification {
  name: string;
  issuer?: string;
  date?: string;
  fileUrl?: string;
}

type AnyRecord = Record<string, unknown>;

type InstructorCollectionPayload = {
  specialties?: string[];
  awards?: string[];
  degrees?: Degree[];
  careers?: Career[];
  publications?: Publication[];
  certifications?: Certification[];
};

export const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const csvToStringArray = (value: unknown): string[] => {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const sanitizeDegreeList = (value: unknown): Degree[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => {
      if (!item || typeof item !== "object") return false;
      const degree = item as Degree;
      return Boolean(toOptionalString(degree.name) || toOptionalString(degree.school));
    })
    .map((item) => item as Degree);
};

const sanitizeCareerList = (value: unknown): Career[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => {
      if (!item || typeof item !== "object") return false;
      const career = item as Career;
      return Boolean(toOptionalString(career.company) || toOptionalString(career.role));
    })
    .map((item) => item as Career);
};

const sanitizePublicationList = (value: unknown): Publication[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => {
      if (!item || typeof item !== "object") return false;
      const publication = item as Publication;
      return Boolean(toOptionalString(publication.title));
    })
    .map((item) => item as Publication);
};

const sanitizeCertificationList = (value: unknown): Certification[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => {
      if (!item || typeof item !== "object") return false;
      const certification = item as Certification;
      return Boolean(toOptionalString(certification.name));
    })
    .map((item) => item as Certification);
};

export const normalizeInstructorCollections = (
  values: AnyRecord,
  options?: {
    specialtiesField?: string;
    awardsField?: string;
    keepEmptyArrays?: boolean;
  },
): InstructorCollectionPayload => {
  const specialtiesField = options?.specialtiesField ?? "specialties";
  const awardsField = options?.awardsField ?? "awards";
  const keepEmptyArrays = options?.keepEmptyArrays ?? true;

  const specialties = csvToStringArray(values[specialtiesField]);
  const awards = csvToStringArray(values[awardsField]);
  const degrees = sanitizeDegreeList(values.degrees);
  const careers = sanitizeCareerList(values.careers);
  const publications = sanitizePublicationList(values.publications);
  const certifications = sanitizeCertificationList(values.certifications);

  return {
    specialties: keepEmptyArrays || specialties.length > 0 ? specialties : undefined,
    awards: keepEmptyArrays || awards.length > 0 ? awards : undefined,
    degrees: keepEmptyArrays || degrees.length > 0 ? degrees : undefined,
    careers: keepEmptyArrays || careers.length > 0 ? careers : undefined,
    publications: keepEmptyArrays || publications.length > 0 ? publications : undefined,
    certifications:
      keepEmptyArrays || certifications.length > 0 ? certifications : undefined,
  };
};

export const linksTextToJson = (value: unknown): unknown => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    const valid =
      Array.isArray(parsed) &&
      parsed.every(
        (item) =>
          item &&
          typeof item === "object" &&
          typeof (item as Record<string, unknown>).label === "string" &&
          typeof (item as Record<string, unknown>).url === "string",
      );
    if (!valid) {
      throw new Error("invalid_links");
    }
    return parsed;
  } catch {
    throw new Error(
      "추가 링크(JSON)는 [{\"label\":\"...\",\"url\":\"...\"}] 형식이어야 합니다.",
    );
  }
};

export const toCsvText = (values?: string[] | null): string | undefined => {
  if (!Array.isArray(values) || values.length === 0) return undefined;
  return values.join(", ");
};
