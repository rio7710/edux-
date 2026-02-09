import bcrypt from "bcrypt";
import { prisma } from "../src/services/prisma.js";

const DEFAULT_PASSWORD = "Temp!1234";
const EMAIL_DOMAIN = "example.local";

async function findUniqueEmail(baseLocal: string) {
  let candidate = `${baseLocal}@${EMAIL_DOMAIN}`;
  let suffix = 1;
  // Ensure uniqueness in User table
  while (true) {
    const exists = await prisma.user.findUnique({ where: { email: candidate } });
    if (!exists) return candidate;
    candidate = `${baseLocal}-${suffix}@${EMAIL_DOMAIN}`;
    suffix += 1;
  }
}

async function main() {
  const instructors = await prisma.instructor.findMany({
    where: { deletedAt: null, userId: null },
    select: { id: true, name: true, email: true, userId: true },
  });

  if (instructors.length === 0) {
    console.log("No instructors without userId. Nothing to do.");
    return;
  }

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  let created = 0;
  let linked = 0;
  let skipped = 0;

  for (const inst of instructors) {
    // If instructor has a real email and no user exists, use it.
    const preferredEmail = inst.email?.trim() || "";
    let emailToUse = preferredEmail;

    if (emailToUse) {
      const existingByEmail = await prisma.user.findUnique({
        where: { email: emailToUse },
      });
      if (existingByEmail) {
        // If already linked, skip; otherwise link to existing user.
        if (!inst.userId) {
          await prisma.instructor.update({
            where: { id: inst.id },
            data: { userId: existingByEmail.id },
          });
          linked += 1;
        }
        skipped += 1;
        continue;
      }
    } else {
      const baseLocal = `instructor+${inst.id}`;
      emailToUse = await findUniqueEmail(baseLocal);
    }

    const user = await prisma.user.create({
      data: {
        email: emailToUse,
        name: inst.name || "Instructor",
        hashedPassword,
        provider: "local",
        role: "instructor",
      },
    });

    await prisma.instructor.update({
      where: { id: inst.id },
      data: { userId: user.id },
    });

    created += 1;
  }

  console.log(
    `Done. Created users: ${created}, linked existing: ${linked}, skipped: ${skipped}`,
  );
  console.log(`Default password: ${DEFAULT_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
