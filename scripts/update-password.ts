import bcrypt from "bcrypt";
import { prisma } from "../dist/services/prisma.js";

async function main() {
  try {
    const password = "Password123!";
    const hashedPassword = await bcrypt.hash(password, 12);

    // 사용자 생성 또는 업데이트
    const user = await prisma.user.upsert({
      where: { email: "sample@example.com" },
      update: { hashedPassword },
      create: {
        id: `u_${Date.now()}`,
        email: "sample@example.com",
        hashedPassword,
        name: "샘플 사용자",
        role: "instructor",
      },
    });

    console.log("✓ 사용자 비밀번호 업데이트 완료");
    console.log("로그인 정보:");
    console.log("  이메일:", user.email);
    console.log("  비밀번호:", password);
  } catch (error) {
    console.error("❌ 오류:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
