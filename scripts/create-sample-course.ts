import { prisma } from "../dist/services/prisma.js";

async function main() {
  try {
    // 첫 번째 사용자 찾기 (없으면 생성)
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: `u_${Date.now()}`,
          email: "sample@example.com",
          password: "hashed_password",
          name: "샘플 사용자",
          role: "instructor",
        },
      });
      console.log("✓ 사용자 생성:", user.name);
    }

    // 코스 생성
    const courseId = `c_${Date.now()}`;
    const course = await prisma.course.create({
      data: {
        id: courseId,
        title: "React 실무 입문",
        description: "React를 처음 배우는 개발자를 위한 기초 강좌입니다.",
        durationHours: 6,
        isOnline: true,
        equipment: ["노트북", "VS Code"],
        goal: "React의 기본 개념을 이해하고 간단한 프로젝트를 만들 수 있습니다.",
        notes: "JavaScript 기본 지식이 필요합니다.",
        createdBy: user.id,
      },
    });
    console.log("✓ 코스 생성:", course.title);

    // 렉처 3개 생성
    const lectures = [];
    for (let i = 1; i <= 3; i++) {
      const lecture = await prisma.lecture.create({
        data: {
          id: `l_${Date.now()}_${i}`,
          courseId: course.id,
          title: `렉처 ${i}: ${["React 기본 개념", "JSX와 컴포넌트", "State와 Props"][i - 1]}`,
          description: `이 강의에서는 ${["React의 기초", "JSX 문법과 컴포넌트 작성법", "State와 Props를 통한 데이터 관리"][i - 1]}에 대해 배웁니다.`,
          hours: 2,
          order: i,
          createdBy: user.id,
        },
      });
      lectures.push(lecture);
      console.log(`  ✓ 렉처 ${i} 생성: ${lecture.title}`);
    }

    console.log("\n✅ 완료! 코스 ID:", course.id);
  } catch (error) {
    console.error("❌ 오류:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
