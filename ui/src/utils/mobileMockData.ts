export interface MobileDocumentItem {
  id: string;
  title: string;
  type: "course" | "instructor";
  createdAt: string;
  status: "ready" | "processing";
  fileUrl?: string;
  shareUrl?: string;
}

export interface MobileMessageItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  isRead: boolean;
  category: "general" | "notice";
}

export interface MobileNoticeItem {
  id: string;
  title: string;
  urgent?: boolean;
}

export interface MobileCourseItem {
  id: string;
  title: string;
  description?: string;
  totalHours?: number;
  goal?: string;
  content?: string;
  updatedAt: string;
  ownership: "mine" | "shared";
  lectures?: Array<{
    id: string;
    title: string;
    hours?: number;
    order?: number;
  }>;
}

export interface MobileProfileInfo {
  name: string;
  email: string;
  roleLabel: string;
  phone?: string;
  website?: string;
}

export interface MobileInstructorProfileInfo {
  displayName: string;
  title: string;
  bio: string;
  specialties: string[];
  affiliation?: string;
  degrees?: Array<{
    name: string;
    school: string;
    major: string;
    year: string;
  }>;
  careers?: Array<{
    company: string;
    role: string;
    period: string;
    description?: string;
  }>;
  publications?: Array<{
    title: string;
    type: string;
    year?: string;
    publisher?: string;
  }>;
  certifications?: Array<{
    name: string;
    issuer?: string;
    date?: string;
  }>;
}

export const mobileMockDocuments: MobileDocumentItem[] = [
  {
    id: "doc-001",
    title: "리더십 코스 소개서",
    type: "course",
    createdAt: "2026-02-16 09:20",
    status: "ready",
    fileUrl: "/pdf/sample-course-001.pdf",
    shareUrl: `${window.location.origin}/m/documents?doc=doc-001`,
  },
  {
    id: "doc-002",
    title: "김영수 강사 프로필",
    type: "instructor",
    createdAt: "2026-02-16 09:45",
    status: "ready",
    fileUrl: "/pdf/sample-instructor-001.pdf",
    shareUrl: `${window.location.origin}/m/documents?doc=doc-002`,
  },
  {
    id: "doc-003",
    title: "세일즈 기초 코스 소개서",
    type: "course",
    createdAt: "2026-02-16 10:10",
    status: "processing",
  },
];

export const mobileMockMessages: MobileMessageItem[] = [
  {
    id: "msg-001",
    title: "강의 공유 요청",
    body: "데이터 분석 기초 강의가 공유되었습니다.",
    createdAt: "2026-02-16 08:31",
    isRead: false,
    category: "general",
  },
  {
    id: "msg-002",
    title: "강사 승인 안내",
    body: "강사 권한이 승인되었습니다.",
    createdAt: "2026-02-15 17:12",
    isRead: true,
    category: "general",
  },
  {
    id: "msg-003",
    title: "시스템 점검 공지",
    body: "2월 18일 02:00~03:00 서비스 점검이 예정되어 있습니다.",
    createdAt: "2026-02-15 12:00",
    isRead: false,
    category: "notice",
  },
];

export const mobileMockNotices: MobileNoticeItem[] = [
  { id: "notice-001", title: "2월 18일 02:00~03:00 시스템 점검 예정", urgent: true },
  { id: "notice-002", title: "모바일 사용자 모드가 오픈되었습니다." },
  { id: "notice-003", title: "PDF 저장 후 내 문서함에서 즉시 확인할 수 있습니다." },
];

export const mobileMockCourses: MobileCourseItem[] = [
  {
    id: "course-001",
    title: "리더십 커뮤니케이션 실무",
    description: "중간관리자 대상 리더십/대화법 코스",
    totalHours: 4,
    goal: "현업 리더의 대화 역량을 향상해 팀 성과를 높입니다.",
    content: "리더십 대화 원칙, 피드백 프레임워크, 코칭 실습",
    updatedAt: "2026-02-16 10:30",
    ownership: "mine",
    lectures: [
      { id: "lec-001", title: "리더십 대화 원칙", hours: 2, order: 1 },
      { id: "lec-002", title: "피드백 실습", hours: 2, order: 2 },
    ],
  },
  {
    id: "course-002",
    title: "성과관리 기본 과정",
    description: "OKR/성과면담 실전 적용",
    totalHours: 3.5,
    goal: "성과관리 체계를 이해하고 면담을 실전 운영할 수 있습니다.",
    content: "성과지표 설계, 목표 정렬, 성과면담 운영",
    updatedAt: "2026-02-15 16:20",
    ownership: "mine",
    lectures: [
      { id: "lec-003", title: "성과지표 설계", hours: 2, order: 1 },
      { id: "lec-004", title: "성과면담 운영", hours: 1.5, order: 2 },
    ],
  },
  {
    id: "course-003",
    title: "공유받은 코스 샘플",
    description: "다른 강사로부터 공유된 과정",
    totalHours: 2,
    goal: "공유받은 과정 샘플 목표",
    content: "샘플 학습 내용",
    updatedAt: "2026-02-14 09:00",
    ownership: "shared",
  },
];

export const mobileMockProfile: MobileProfileInfo = {
  name: "홍길동",
  email: "hong@example.com",
  roleLabel: "사용자",
  phone: "010-1234-5678",
  website: "https://example.com",
};

export const mobileMockInstructorProfile: MobileInstructorProfileInfo = {
  displayName: "홍길동",
  title: "Lead Consultant",
  bio: "실무 중심 강의로 현업 적용도를 높이는 것을 목표로 합니다.",
  specialties: ["리더십", "커뮤니케이션", "코칭"],
  affiliation: "Edux Academy",
  degrees: [
    {
      name: "학사",
      school: "연세대학교",
      major: "경영학",
      year: "2015",
    },
  ],
  careers: [
    {
      company: "Northwind",
      role: "Consultant",
      period: "2019-2022",
      description: "기업 대상 커뮤니케이션/리더십 과정 운영",
    },
    {
      company: "Contoso Academy",
      role: "Lead Instructor",
      period: "2022-현재",
      description: "강사 역량 표준화 및 커리큘럼 개발",
    },
  ],
  publications: [
    {
      title: "Practical Leadership Guide",
      type: "paper",
      year: "2025",
      publisher: "Acme Press",
    },
  ],
  certifications: [
    {
      name: "Scrum Master",
      issuer: "PMI",
      date: "2020-04",
    },
    {
      name: "Six Sigma Green Belt",
      issuer: "PMI",
      date: "2023-07",
    },
  ],
};
