import { prisma } from "../dist/services/prisma.js";

const courseTopics = [
  "Python 기초",
  "JavaScript 심화",
  "React 실무 프로젝트",
  "Node.js 백엔드",
  "Vue.js 입문",
  "TypeScript 완벽 가이드",
  "MongoDB 데이터베이스",
  "Docker & Kubernetes",
  "GraphQL API 개발",
  "AWS 클라우드 서비스",
];

const lectureDescriptions = [
  "기본 개념과 환경 설정",
  "핵심 문법과 자료구조",
  "실제 프로젝트 적용",
  "고급 패턴과 최적화",
  "테스트와 배포",
  "API 설계 및 구현",
  "성능 개선 기법",
  "보안 및 인증",
  "마이크로서비스 아키텍처",
  "운영 및 모니터링",
];

async function main() {
  try {
    // 사용자 확인
    let user = await prisma.user.findFirst();
    if (!user) {
      console.log("❌ 사용자가 없습니다.");
      return;
    }

    console.log("🚀 코스 10개 생성 시작...\n");

    for (let c = 0; c < 10; c++) {
      // 코스의 총 시간 (1~8시간)
      const totalHours = Math.floor(Math.random() * 8) + 1;

      // 렉처 수 (1~4개)
      const lectureCount = Math.floor(Math.random() * 4) + 1;

      // 각 렉처의 시간 (총합 = totalHours)
      const lectureHours: number[] = [];
      let remaining = totalHours;
      for (let i = 0; i < lectureCount; i++) {
        if (i === lectureCount - 1) {
          lectureHours.push(remaining);
        } else {
          const hours =
            Math.floor(Math.random() * (remaining - lectureCount + i + 1)) + 1;
          lectureHours.push(hours);
          remaining -= hours;
        }
      }

      const courseId = `c_${Date.now()}_${c}`;
      const isOnline = Math.random() > 0.5;
      const course = await prisma.course.create({
        data: {
          id: courseId,
          title: courseTopics[c],
          description: `${courseTopics[c]}을 처음부터 차근차근 배우는 과정입니다. 실무 예제와 함께 학습합니다.`,
          durationHours: totalHours,
          isOnline,
          equipment: isOnline ? ["노트북"] : ["노트북", "실습용 장비"],
          goal: `${courseTopics[c]}의 핵심을 이해하고 실제 프로젝트에 적용할 수 있습니다.`,
          notes:
            "사전 지식이 필요할 수 있습니다. 개인 환경에서 실습하는 것을 권장합니다.",
          createdBy: user.id,
        },
      });

      // 렉처 생성
      for (let l = 0; l < lectureCount; l++) {
        const lectureTitle = `${lectureDescriptions[l]}`;
        await prisma.lecture.create({
          data: {
            id: `l_${Date.now()}_${c}_${l}`,
            courseId: course.id,
            title: lectureTitle,
            description: `이 강의에서는 ${lectureTitle.toLowerCase()}에 대해 배웁니다.`,
            hours: lectureHours[l],
            order: l + 1,
            createdBy: user.id,
          },
        });
      }

      console.log(
        `✓ [${c + 1}/10] ${course.title} (${totalHours}시간, ${isOnline ? "온라인" : "오프라인"}, 렉처 ${lectureCount}개)`,
      );
    }

    console.log("\n✅ 완료! 코스 10개와 렉처 모두 생성되었습니다.");
  } catch (error) {
    console.error("❌ 오류:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
