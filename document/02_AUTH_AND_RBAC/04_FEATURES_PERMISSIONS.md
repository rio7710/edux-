# 기능 목록 & 권한 매트릭스

이 문서가 권한의 Single Source of Truth.

## 메뉴별 접근 권한

| 메뉴 | admin | oper | editor | instr | viewer | guest |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| 로그인/회원가입 | - | - | - | - | - | - |
| 대시보드 | O | O | O | O | O | X |
| 사용자 관리 | O | O | X | X | X | X |
| 그룹 관리 | O | O | X | X | X | X |
| 권한 설정 | O | X | X | X | X | X |
| 강사 관리 | O | O | X | X | X | X |
| 과정 관리 | O | O | O | O | X | X |
| 템플릿 허브 | O | O | O | O | O | X |
| 내 템플릿 | O | O | O | O | X | X |
| 내 문서 | O | O | O | O | O | X |
| 기능 공유 | O | O | O | O | O | X |
| PDF 렌더링 | O | O | O | O | X | X |
| 사이트 설정 | O | X | X | X | X | X |
| 테이블 설정 | O | O | X | X | X | X |
| 프로필 | O | O | O | O | O | X |

`-` = 인증 불필요, `O` = 허용, `X` = 거부

## MCP Tool 권한 매트릭스

### 코스/강의

| Tool | admin | oper | editor | instr | viewer | guest |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| course.upsert | O | O | O | O* | X | X |
| course.get/list/listMine | O | O | O | O | O | X |
| course.delete | O | O | O | O* | X | X |
| course.share* | O | O | O | O | △ | X |
| lecture.upsert | O | O | O | O* | X | X |
| lecture.get/list | O | O | O | O | O | X |
| lecture.delete | O | O | O | O* | X | X |
| lecture.grant.* | O | O | O | O | △ | X |

`O*` = 자기 소유만, `△` = respond/listReceived/leave/listMine만

### 강사/일정

| Tool | admin | oper | editor | instr | viewer | guest |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| instructor.upsert | O | O | O | O | X | X |
| instructor.get/list/getByUser | O | O | O | O | O | X |
| schedule.upsert | O | O | O | O* | X | X |
| schedule.get/list | O | O | O | O | O | X |

### 템플릿/렌더

| Tool | admin | oper | editor | instr | viewer | guest |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| template.read/use | O | O | O | O | O | O |
| template.update/delete | O | O | X | X | X | X |
| render.* | O | O | O | O | X | X |

### 사용자/시스템

| Tool | admin | oper | editor | instr | viewer | guest |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| user.register/login | - | - | - | - | - | - |
| user.me/update/delete | O | O | O | O | O | O |
| user.get/list/updateRole/updateByAdmin | O | X | X | X | X | X |
| user.requestInstructor/updateInstructorProfile | O | O | O | O | O | O |
| user.approveInstructor | O | X | X | X | X | X |
| dashboard.read | O | O | O | O | O | X |
| message.* | O | O | O | O | O | O |
| document.* | O | O | O | O | O | O |
| tableConfig.*/site.settings.* | O | O | X | X | X | X |

## 권한 평가 로직

`authorization.ts` → admin bypass → deny(user→group→role) → allow(user→group→role) → ROLE_DEFAULT_ALLOW → default-deny
