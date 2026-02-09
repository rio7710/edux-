import { prisma } from "../dist/services/prisma.js";

async function main() {
  try {
    console.log("🚀 강사 데이터 생성 시작...\n");

    const instructors = [
      {
        name: "박영희",
        title: "고급 강사",
        email: "instructor@example.com",
        phone: "010-1234-5678",
        affiliation: "소프트웨어 아카데미",
        avatarUrl: "https://i.pravatar.cc/150?img=1",
        tagline: "실무 중심의 프로그래밍 교육",
        specialties: ["JavaScript", "React", "Node.js", "TypeScript"],
        certifications: ["AWS Certified Developer", "Google Cloud Associate"],
        awards: ["Best Instructor 2024", "우수 강사상"],
      },
      {
        name: "이지은",
        title: "수석 강사",
        email: "lee@instructor.com",
        phone: "010-2345-6789",
        affiliation: "기술 교육센터",
        avatarUrl: "https://i.pravatar.cc/150?img=2",
        tagline: "Python과 데이터 분석 전문",
        specialties: ["Python", "Pandas", "NumPy", "Machine Learning"],
        certifications: ["Python Certified", "Data Science Professional"],
        awards: [],
      },
      {
        name: "김준호",
        title: "시니어 강사",
        email: "kim@instructor.com",
        phone: "010-3456-7890",
        affiliation: "개발자 교육원",
        avatarUrl: "https://i.pravatar.cc/150?img=3",
        tagline: "Java 및 Spring 전문가",
        specialties: ["Java", "Spring Boot", "Microservices", "SQL"],
        certifications: ["Oracle Certified Associate", "Spring Professional"],
        awards: ["Outstanding Educator 2023"],
      },
      {
        name: "최민지",
        title: "강사",
        email: "choi@instructor.com",
        phone: "010-4567-8901",
        affiliation: "프론트엔드 스쿨",
        avatarUrl: "https://i.pravatar.cc/150?img=4",
        tagline: "UI/UX와 웹 디자인",
        specialties: ["Vue.js", "CSS", "HTML", "UI Design"],
        certifications: [],
        awards: [],
      },
    ];

    for (const data of instructors) {
      const instructor = await prisma.instructor.create({
        data: {
          id: `instr_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          ...data,
        },
      });
      console.log(
        `✓ ${instructor.name.padEnd(15)} | ${instructor.title} | ${instructor.email}`,
      );
    }

    console.log("\n✅ 완료! 강사 4명 생성 완료");
  } catch (error) {
    console.error("❌ 오류:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
