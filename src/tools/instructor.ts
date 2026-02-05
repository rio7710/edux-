import { z } from 'zod';
import { prisma } from '../services/prisma.js';

// 스키마 정의
export const instructorUpsertSchema = {
  id: z.string().optional().describe('없으면 새로 생성'),
  name: z.string().describe('강사 이름'),
  title: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  affiliation: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  tagline: z.string().optional(),
  specialties: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  awards: z.array(z.string()).optional(),
  links: z.record(z.any()).optional(), // JSON type in Prisma
};

export const instructorGetSchema = {
  id: z.string().describe('강사 ID'),
};

// 핸들러 정의
export async function instructorUpsertHandler(args: {
  id?: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  affiliation?: string;
  avatarUrl?: string;
  tagline?: string;
  specialties?: string[];
  certifications?: string[];
  awards?: string[];
  links?: Record<string, any>;
}) {
  try {
    const instructorId = args.id || `i_${Date.now()}`;

    const instructor = await prisma.instructor.upsert({
      where: { id: instructorId },
      create: {
        id: instructorId,
        name: args.name,
        title: args.title,
        email: args.email,
        phone: args.phone,
        affiliation: args.affiliation,
        avatarUrl: args.avatarUrl,
        tagline: args.tagline,
        specialties: args.specialties || [],
        certifications: args.certifications || [],
        awards: args.awards || [],
        links: args.links,
      },
      update: {
        name: args.name,
        title: args.title,
        email: args.email,
        phone: args.phone,
        affiliation: args.affiliation,
        avatarUrl: args.avatarUrl,
        tagline: args.tagline,
        specialties: args.specialties || [],
        certifications: args.certifications || [],
        awards: args.awards || [],
        links: args.links,
      },
    });

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ id: instructor.id, name: instructor.name }) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `Failed to upsert instructor: ${message}` }],
      isError: true,
    };
  }
}

export async function instructorGetHandler(args: { id: string }) {
  try {
    const instructor = await prisma.instructor.findUnique({
      where: { id: args.id, deletedAt: null },
      include: {
        Schedules: true, // Instructors can have many schedules
      },
    });

    if (!instructor) {
      return {
        content: [{ type: 'text' as const, text: `Instructor not found: ${args.id}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(instructor) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `Failed to get instructor: ${message}` }],
      isError: true,
    };
  }
}
