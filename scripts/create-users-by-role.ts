import bcrypt from "bcrypt";
import { prisma } from "../dist/services/prisma.js";

const users = [
  {
    email: "admin@example.com",
    password: "Admin123!",
    name: "관리자 아이다",
    role: "admin",
  },
  {
    email: "operator@example.com",
    password: "Operator123!",
    name: "운영자 김철수",
    role: "operator",
  },
  {
    email: "instructor@example.com",
    password: "Instructor123!",
    name: "강의자 박영희",
    role: "instructor",
  },
  {
    email: "viewer@example.com",
    password: "Viewer123!",
    name: "사용자 이민정",
    role: "viewer",
  },
  {
    email: "guest@example.com",
    password: "Guest123!",
    name: "게스트 최민호",
    role: "guest",
  },
];

async function main() {
  try {
    console.log("🚀 역할별 사용자 5명 생성 시작...\n");

    for (const userData of users) {
      const hashedPassword = await bcrypt.hash(userData.password, 12);

      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: {},
        create: {
          id: `u_${userData.role}_${Date.now()}`,
          email: userData.email,
          hashedPassword,
          name: userData.name,
          role: userData.role as any,
        },
      });

      console.log(
        `✓ ${userData.role.toUpperCase().padEnd(10)} | ${user.name.padEnd(15)} | ${user.email}`,
      );
    }

    console.log("\n✅ 완료! 사용자 5명 생성 완료\n");
    console.log("=== 로그인 정보 ===");
    for (const userData of users) {
      console.log(
        `${userData.role.padEnd(10)} | ${userData.email.padEnd(25)} | ${userData.password}`,
      );
    }
  } catch (error) {
    console.error("❌ 오류:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
