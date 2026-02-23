# EduX Skill Guide — 마스터 인덱스

사이트를 처음부터 만들 때 이 순서대로 읽는다.

## 빌드 순서

| Phase | 폴더 | 핵심 질문 | 읽는 시점 |
|-------|------|----------|----------|
| 0 | `00_ORIENTATION` | 어떤 규칙으로 개발하나? | 가장 먼저 |
| 1 | `01_PROJECT_SETUP` | 환경은 어떻게 구성하나? | 프로젝트 시작 시 |
| 2 | `02_AUTH_AND_RBAC` | 인증/권한은 어떻게 설계하나? | 유저 모델 설계 시 |
| 3 | `03_BACKEND_MCP` | API는 어떻게 만드나? | 백엔드 개발 시 |
| 4 | `04_FRONTEND` | UI는 어떻게 만드나? | 프론트엔드 개발 시 |
| 5 | `05_DOMAIN_FEATURES` | 도메인 기능 규칙은? | 기능 구현 시 |
| 6 | `06_TEMPLATES_AND_PDF` | 문서 생성은 어떻게? | 템플릿/PDF 작업 시 |
| 7 | `07_DATABASE_AND_MIGRATION` | DB 변경은 어떻게? | 스키마 변경 시 |
| 8 | `08_TESTING` | 무엇을 어떻게 테스트? | 테스트 작성 시 |
| 9 | `09_DEPLOYMENT` | 배포는 어떻게? | 운영 배포 시 |

## 전체 문서 맵

| 폴더 | 파일 | 내용 |
|------|------|------|
| 00_ORIENTATION | 01_INDEX | 이 문서 |
| | 02_DEV_RULES | 개발 규칙과 컨벤션 |
| | 03_TROUBLESHOOTING | 공통 트러블슈팅 |
| 01_PROJECT_SETUP | 01_ENVIRONMENT_SETUP | Windows 개발환경 셋업 |
| | 02_ARCHITECTURE | 시스템 아키텍처 |
| | 03_DATA_MODEL | Prisma 스키마 & 데이터 모델 |
| 02_AUTH_AND_RBAC | 01_SECURITY | JWT, RBAC, 위협 모델 |
| | 02_USER_POLICY | 사용자 생명주기 |
| | 03_SOCIAL_LOGIN | OAuth 설정 |
| | 04_FEATURES_PERMISSIONS | 기능×역할 권한 매트릭스 |
| 03_BACKEND_MCP | 01_MCP_TOOLS | MCP 도구 레퍼런스 |
| | 02_API_REFERENCE | Transport & 인증 플로우 |
| | 03_WORKFLOW | 작업 흐름 원칙 |
| 04_FRONTEND | 01_FRONTEND_GUIDE | React+Vite+AntD 스택 |
| | 02_COLUMN_SETTINGS | 테이블 컬럼 동적 설정 |
| | 03_SITE_SETTINGS | 사이트 관리 UI |
| | 04_REUSE_MAINTENANCE | 코드 재사용 규칙 |
| 05_DOMAIN_FEATURES | 01_COURSE_GUIDE | 코스 CRUD & 공유 |
| | 02_LECTURE_SHARE_POLICY | 강의 공유 정책 |
| | 03_MEMBER_PLAN | 사용자/강사 관리 |
| | 04_ML_LABELING | ML 데이터 수집 |
| 06_TEMPLATES_AND_PDF | 01_TEMPLATES | Handlebars 문법 |
| | 02_TEMPLATE_GUIDE | 데이터 키 레퍼런스 |
| | 03_PDF_RENDER_GUIDE | 렌더링 파이프라인 |
| 07_DATABASE_AND_MIGRATION | 01_MIGRATION_RUNBOOK | Prisma 마이그레이션 |
| | 02_SEED_SCRIPTS | 시드 데이터 |
| 08_TESTING | 01_TESTING_GUIDE | 테스트 전략 |
| | DEPLOY_TEST_2026-02-13/ | 배포 게이트 (8파일) |
| 09_DEPLOYMENT | 01_DEPLOYMENT_GUIDE | Docker, Nginx, CI/CD |
| _archive | | 과거 기록 (읽지 않아도 됨) |

## 역할별 빠른 시작

| 역할 | 읽을 문서 |
|------|----------|
| 신규 개발자 | 00 전체 → 01 전체 → 02/01 → 해당 파트 |
| AI 에이전트 | 00/02 → 01/02 → 03 전체 → 해당 기능 |
| 배포 담당 | 01/01 → 07 전체 → 09 전체 |
| 기능 추가 | 00/02 → 해당 05 기능 → 04/04 |

## 기술 스택

| 레이어 | 기술 | 버전 |
|--------|------|------|
| Backend | Node.js + TypeScript + Express | TS 5.5+, Express 4.21 |
| Protocol | MCP SDK | 1.26+ |
| Database | PostgreSQL + Prisma | Prisma 5.14 |
| Queue | BullMQ + Redis | BullMQ 5.0 |
| PDF | Puppeteer + Handlebars | Puppeteer 23, HBS 4.7 |
| Auth | JWT + bcrypt | JWT 9.0 |
| Frontend | React + Vite + Ant Design | React 19, Vite 7, AntD 6 |
| State | TanStack Query | 5.90+ |
| Validation | Zod | 3.23 |
