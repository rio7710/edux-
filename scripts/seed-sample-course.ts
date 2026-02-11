import { prisma } from "../src/services/prisma.js";

async function main() {
  const SAMPLE_COURSE_TITLE = "[샘플] 클라우드 네이티브 애플리케이션 개발";

  // 이미 존재하면 스킵
  const existing = await prisma.course.findFirst({
    where: { title: SAMPLE_COURSE_TITLE },
  });
  if (existing) {
    console.log(`이미 존재: ${SAMPLE_COURSE_TITLE} (${existing.id})`);
    return;
  }

  // 1. 강사 2명 생성 (또는 기존 사용)
  const instructorData = [
    { name: "김영수", title: "클라우드 아키텍트", email: "yskim@example.com", affiliation: "ABC 테크놀로지", specialties: ["클라우드 인프라", "DevOps", "Kubernetes"] },
    { name: "이수진", title: "DevOps 엔지니어", email: "sjlee@example.com", affiliation: "XYZ 솔루션즈", specialties: ["CI/CD", "Docker", "모니터링"] },
  ];

  const instructors = [];
  for (const data of instructorData) {
    let instructor = await prisma.instructor.findFirst({
      where: { name: data.name, email: data.email },
    });
    if (!instructor) {
      instructor = await prisma.instructor.create({ data });
      console.log(`강사 생성: ${data.name}`);
    } else {
      console.log(`강사 존재: ${data.name}`);
    }
    instructors.push(instructor);
  }

  // 2. 과정 생성 + 강의 + 강사 연결
  const course = await prisma.course.create({
    data: {
      title: SAMPLE_COURSE_TITLE,
      description: "Docker, Kubernetes를 활용한 클라우드 네이티브 개발 실무 과정입니다.",
      durationHours: 16,
      isOnline: false,
      goal: "컨테이너 기반 애플리케이션 설계·배포·운영 역량을 습득하여 실무에 즉시 적용할 수 있다.",
      Lectures: {
        create: [
          { title: "컨테이너 기초", description: "Docker 개념과 이미지 빌드 실습", hours: 4, order: 1 },
          { title: "Kubernetes 핵심", description: "Pod, Service, Deployment 운영", hours: 4, order: 2 },
          { title: "CI/CD 파이프라인", description: "GitHub Actions 기반 자동 배포 구성", hours: 4, order: 3 },
          { title: "모니터링과 운영", description: "Prometheus, Grafana를 활용한 관측성 구축", hours: 4, order: 4 },
        ],
      },
      CourseInstructors: {
        create: instructors.map((i) => ({ instructorId: i.id })),
      },
    },
  });

  console.log(`과정 생성: ${course.title} (${course.id})`);
}

main()
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
