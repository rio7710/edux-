import { prisma } from "../dist/services/prisma.js";

async function main() {
  try {
    // 강사 사용자 찾기
    const instructorUser = await prisma.user.findUnique({
      where: { email: "instructor@example.com" },
    });

    if (!instructorUser) {
      console.log("❌ 강사 사용자를 찾을 수 없습니다.");
      return;
    }

    // InstructorProfile 업데이트
    const profile = await prisma.instructorProfile.upsert({
      where: { userId: instructorUser.id },
      update: {
        displayName: "박정우",
        title: "고급 강사",
        bio: "10년 이상의 소프트웨어 개발 경험과 3년의 강의 경력을 보유하고 있습니다. 프로덕트 개발과 팀 관리 경험이 풍부하며, 실무 중심의 교육을 지향합니다.",
        phone: "010-1234-5678",
        website: "https://www.instructor-portfolio.com",
        links: {
          github: "https://github.com/instructor-박영희",
          linkedin: "https://linkedin.com/in/박영희",
          velog: "https://velog.io/@박영희",
        },
        isApproved: true,
        isPending: false,
      },
      create: {
        userId: instructorUser.id,
        displayName: "박정우",
        title: "고급 강사",
        bio: "10년 이상의 소프트웨어 개발 경험과 3년의 강의 경력을 보유하고 있습니다. 프로덕트 개발과 팀 관리 경험이 풍부하며, 실무 중심의 교육을 지향합니다.",
        phone: "010-1234-5678",
        website: "https://www.instructor-portfolio.com",
        links: {
          github: "https://github.com/instructor-박영희",
          linkedin: "https://linkedin.com/in/박영희",
          velog: "https://velog.io/@박영희",
        },
        isApproved: true,
        isPending: false,
      },
    });

    console.log("✅ 강사 프로필 업데이트 완료!\n");
    console.log("=== 강사 정보 ===");
    console.log(`이메일: ${instructorUser.email}`);
    console.log(`기존 이름: ${instructorUser.name}`);
    console.log(`프로필 표시 이름: ${profile.displayName}`);
    console.log(`직급: ${profile.title}`);
    console.log(`자기소개: ${profile.bio}`);
    console.log(`전화: ${profile.phone}`);
    console.log(`웹사이트: ${profile.website}`);
    console.log(
      `승인상태: ${profile.isApproved ? "✓ 승인됨" : "× 승인 대기 중"}`,
    );
    console.log(`펜딩: ${profile.isPending}`);
    console.log(`링크:`, profile.links);
  } catch (error) {
    console.error("❌ 오류:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
