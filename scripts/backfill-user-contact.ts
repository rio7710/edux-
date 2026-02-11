import { prisma } from "../src/services/prisma.js";

async function main() {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true, phone: true, website: true },
  });

  let updated = 0;

  for (const user of users) {
    let nextPhone = user.phone;
    let nextWebsite = user.website;

    if (!nextPhone || !nextWebsite) {
      const profile = await prisma.instructorProfile.findUnique({
        where: { userId: user.id },
        select: { phone: true, website: true },
      });
      nextPhone = nextPhone || profile?.phone || null;
      nextWebsite = nextWebsite || profile?.website || null;
    }

    if (!nextPhone) {
      const instructor = await prisma.instructor.findFirst({
        where: { userId: user.id, deletedAt: null },
        select: { phone: true },
      });
      nextPhone = instructor?.phone || null;
    }

    if (nextPhone !== user.phone || nextWebsite !== user.website) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          phone: nextPhone,
          website: nextWebsite,
        },
      });
      updated += 1;
    }
  }

  console.log(`Backfill complete. Updated users: ${updated}`);
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
