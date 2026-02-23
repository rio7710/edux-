import { z } from "zod";

const nullableString = z.string().nullable().optional();

export const instructorProfileSchema = {
  displayName: nullableString.describe("표시 이름"),
  title: nullableString.describe("직함"),
  bio: nullableString.describe("자기소개"),
  phone: nullableString.describe("전화번호"),
  website: nullableString.describe("웹사이트"),
  links: z.any().optional().describe("추가 링크 (JSON)"),
  degrees: z
    .array(
      z.object({
        name: z.string(),
        school: z.string(),
        major: z.string(),
        year: z.string(),
        fileUrl: nullableString,
      }),
    )
    .nullable()
    .optional()
    .describe("학위 정보"),
  careers: z
    .array(
      z.object({
        company: z.string(),
        role: z.string(),
        period: z.string(),
        description: nullableString,
      }),
    )
    .nullable()
    .optional()
    .describe("경력 정보"),
  publications: z
    .array(
      z.object({
        title: z.string(),
        type: z.string(),
        year: nullableString,
        publisher: nullableString,
        url: nullableString,
      }),
    )
    .nullable()
    .optional()
    .describe("출판/논문"),
  certifications: z
    .array(
      z.object({
        name: z.string(),
        issuer: nullableString,
        date: nullableString,
        fileUrl: nullableString,
      }),
    )
    .nullable()
    .optional()
    .describe("자격증"),
  specialties: z.array(z.string()).nullable().optional().describe("전문분야"),
  affiliation: nullableString.describe("소속"),
  email: z
    .string()
    .email()
    .nullable()
    .optional()
    .or(z.literal(""))
    .describe("이메일"),
};
