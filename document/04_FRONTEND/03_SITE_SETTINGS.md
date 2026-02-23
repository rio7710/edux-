# 사이트 관리 UI

## 접근 권한

- SiteSettingsPage: **admin만**
- 테이블 설정 탭: **admin, operator**

## 설정 항목 (AppSetting key-value)

| 설정 키 | 타입 | 설명 |
|---------|------|------|
| `site.name` | string | 사이트 이름 |
| `site.logo` | string | 로고 URL |
| `site.description` | string | 사이트 설명 |
| `menu.{menuKey}.enabled` | boolean | 메뉴 ON/OFF |

메뉴 OFF → 사이드바 숨김 + 프론트엔드 Tool 호출 차단. 데이터 보존.

## 테이블 설정 관리

각 테이블(courses, instructors, templates 등) 컬럼 편집:
- 표시/숨김 토글, 순서 드래그, 라벨 수정(customLabel), 너비 설정
- `tableConfig.upsert` Tool로 저장

## UI 구조

```
SiteSettingsPage
├── 사이트 정보 (이름, 로고, 설명)
├── 메뉴 관리 (각 메뉴 ON/OFF 스위치)
└── 테이블 설정
    ├── 테이블 선택 (courses, instructors, ...)
    └── 컬럼 목록 (visible, 순서, 라벨)
```
