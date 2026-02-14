import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const acceptedShares = await prisma.courseShare.findMany({
    where: { status: "accepted" },
    select: {
      courseId: true,
      sharedWithUserId: true,
      sharedByUserId: true,
    },
  });

  let upserted = 0;
  for (const share of acceptedShares) {
    const links = await prisma.courseLecture.findMany({
      where: { courseId: share.courseId },
      select: { lectureId: true },
    });

    for (const link of links) {
      await prisma.lectureGrant.upsert({
        where: {
          lectureId_userId: {
            lectureId: link.lectureId,
            userId: share.sharedWithUserId,
          },
        },
        update: {
          grantedByUserId: share.sharedByUserId,
          canMap: true,
          canEdit: false,
          canReshare: false,
          revokedAt: null,
        },
        create: {
          lectureId: link.lectureId,
          userId: share.sharedWithUserId,
          grantedByUserId: share.sharedByUserId,
          canMap: true,
          canEdit: false,
          canReshare: false,
        },
      });
      upserted += 1;
    }
  }

  const activeGrantCount = await prisma.lectureGrant.count({
    where: { revokedAt: null },
  });
  console.log(
    JSON.stringify(
      {
        acceptedShares: acceptedShares.length,
        attemptedUpserts: upserted,
        activeGrantCount,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("Failed to backfill lecture grants:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
