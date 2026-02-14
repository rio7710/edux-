import { prisma } from "../src/services/prisma.js";

const specialtiesPool = [
  "leadership",
  "communication",
  "productivity",
  "coaching",
  "data-analysis",
  "project-management",
  "ai-basics",
  "customer-success",
  "negotiation",
  "facilitation",
];

const certPool = [
  "PMP",
  "AWS CCP",
  "Google Data Analytics",
  "Six Sigma Green Belt",
  "Scrum Master",
  "ITIL Foundation",
];

const publisherPool = [
  "Acme Press",
  "Northwind Learning",
  "Contoso Institute",
  "Global HR Review",
  "SkillWorks Journal",
];

const schoolPool = [
  "Seoul National University",
  "Korea University",
  "Yonsei University",
  "KAIST",
  "Hanyang University",
];

const majorPool = [
  "Business Administration",
  "Computer Science",
  "Education",
  "Psychology",
  "Statistics",
];

const companyPool = [
  "Acme Corp",
  "Contoso",
  "Northwind",
  "Fabrikam",
  "Globex",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickManyUnique<T>(arr: T[], min: number, max: number): T[] {
  const count = Math.max(min, Math.min(max, min + Math.floor(Math.random() * (max - min + 1))));
  const copied = [...arr];
  const out: T[] = [];
  while (out.length < count && copied.length > 0) {
    const idx = Math.floor(Math.random() * copied.length);
    out.push(copied[idx]);
    copied.splice(idx, 1);
  }
  return out;
}

function randomYear(start = 2008, end = 2025): string {
  return String(start + Math.floor(Math.random() * (end - start + 1)));
}

function randomPeriod(): string {
  const start = 2012 + Math.floor(Math.random() * 9);
  const end = start + 1 + Math.floor(Math.random() * 4);
  return `${start}-${Math.min(end, 2025)}`;
}

async function main() {
  const instructors = await prisma.instructor.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });

  if (instructors.length === 0) {
    console.log("No instructors found.");
    return;
  }

  let updated = 0;
  for (const inst of instructors) {
    const degreeCount = 1 + Math.floor(Math.random() * 2);
    const careerCount = 2 + Math.floor(Math.random() * 2);
    const publicationCount = 1 + Math.floor(Math.random() * 3);
    const certificationCount = 1 + Math.floor(Math.random() * 2);

    const degrees = Array.from({ length: degreeCount }).map((_, idx) => ({
      name: idx === 0 ? "Bachelor" : "Master",
      school: pick(schoolPool),
      major: pick(majorPool),
      year: randomYear(2004, 2018),
      fileUrl: `/uploads/dummy-degree-${inst.id}-${idx + 1}.pdf`,
    }));

    const careers = Array.from({ length: careerCount }).map(() => ({
      company: pick(companyPool),
      role: pick(["trainer", "manager", "consultant", "lead instructor"]),
      period: randomPeriod(),
      description: pick([
        "Designed and delivered enterprise training programs.",
        "Led cross-functional workshops and coaching sessions.",
        "Built curriculum for leadership and communication tracks.",
        "Managed learning operations and quality reviews.",
      ]),
    }));

    const publications = Array.from({ length: publicationCount }).map((_, idx) => ({
      title: `Practical Learning Guide Vol.${idx + 1}`,
      type: Math.random() > 0.4 ? "publication" : "paper",
      year: randomYear(2016, 2025),
      publisher: pick(publisherPool),
      url: `https://example.com/publications/${inst.id}/${idx + 1}`,
    }));

    const certifications = Array.from({ length: certificationCount }).map((_, idx) => ({
      name: pick(certPool),
      issuer: pick(["PMI", "Amazon", "Google", "AXELOS", "IASSC"]),
      date: `${randomYear(2018, 2025)}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, "0")}`,
      fileUrl: `/uploads/dummy-cert-${inst.id}-${idx + 1}.pdf`,
    }));

    await prisma.instructor.update({
      where: { id: inst.id },
      data: {
        title: pick(["Senior Instructor", "Lead Consultant", "Principal Trainer"]),
        affiliation: pick(["Acme Learning", "Contoso Academy", "Northwind Institute"]),
        bio: `${inst.name} is an experienced instructor focused on practical outcomes and team capability building.`,
        specialties: pickManyUnique(specialtiesPool, 2, 4),
        awards: pickManyUnique(
          ["Top Trainer 2023", "Best Session Award", "Excellence in Coaching", "Learning Innovation Prize"],
          1,
          2,
        ),
        degrees,
        careers,
        publications,
        certifications,
      },
    });

    updated += 1;
  }

  console.log(`Updated instructors: ${updated}/${instructors.length}`);
}

main()
  .catch((err) => {
    console.error("Failed to fill dummy instructor data:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
