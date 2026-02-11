import { prisma } from "../src/services/prisma.js";

async function main() {
  const c = await prisma.course.findFirst({
    where: { title: { startsWith: "[샘플]" }, deletedAt: null },
    include: {
      Lectures: { where: { deletedAt: null }, orderBy: { order: "asc" } },
      CourseInstructors: { include: { Instructor: true } },
    },
  });

  if (!c) {
    console.log("샘플 과정 없음!");
    return;
  }

  console.log("=== DB 샘플 과정 ===");
  console.log("제목:", c.title);
  console.log("설명:", c.description);
  console.log("시간:", c.durationHours);
  console.log("목표:", c.goal);
  console.log("강사:", c.CourseInstructors.map((ci) => ci.Instructor.name));
  c.Lectures.forEach((l, i) =>
    console.log(`  ${i + 1}. ${l.title} - ${l.description} (${l.hours}H)`)
  );
}

main().finally(() => prisma.$disconnect());
